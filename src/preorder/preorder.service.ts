import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  PreorderCampaignEntity,
  PreorderCampaignStatus,
  PreorderIncreasePolicy,
  PreorderMode,
} from './preorder-campaign.entity';
import { PreorderItemLotEntity } from './preorder-item-lot.entity';
import { applyAmountChange, distributeToLots } from './preorder.lots';
import { PreorderProductEntity } from './preorder-product.entity';
import { PreorderItemEntity, PreorderItemStatus } from './preorder-item.entity';
import {
  PreorderItemLogEntity,
  PreorderLogAction,
} from './preorder-item-log.entity';
import { PreorderNotifierService } from './preorder-notifier.service';
import { computeAllocation } from './preorder.allocation';
import {
  AddProductDto,
  AdminUpdateItemDto,
  AllocateDto,
  CreateCampaignDto,
  PreorderActor,
  QueueInfo,
  UpdateCampaignDto,
  UpdateProductDto,
  UpsertItemDto,
} from './preorder.types';
import { ProductEntity } from '../products/products.entity';
import { ProductUnitEntity } from '../products/product-unit.entity';

/** ชื่อหน่วยเล็กสุด (level 1) จากตาราง product_unit */
function unit1Of(product?: ProductEntity | null): string | null {
  return product?.units?.find((u) => u.level === 1)?.unit_name ?? null;
}

/** สถานะที่ถือว่า "ยังจองอยู่" นับเข้าคิวและยอดรวม */
const ACTIVE_ITEM_STATUSES = [
  PreorderItemStatus.RESERVED,
  PreorderItemStatus.LOCKED,
  PreorderItemStatus.ALLOCATED,
  PreorderItemStatus.FULFILLED,
];

interface QueueLotRow {
  lot_id: number;
  item_id: number;
  qty: number;
  ordered_at: Date;
  allocated_qty: number | null;
  mem_code: string;
  status: PreorderItemStatus;
  position: number;
  ahead_qty: number;
}

interface QueueRowOut {
  id: number;
  lot_id: number;
  lot_no: number;
  lots_count: number;
  position: number | null;
  mem_code: string;
  mem_name: string | null;
  mem_phone: string | null;
  mem_price: string | null;
  mem_route: string | null;
  sale_emp: string | null;
  amount: number;
  item_amount: number;
  unit: string | null;
  cumulative_qty: number | null;
  status: PreorderItemStatus;
  allocated_qty: number | null;
  item_allocated_qty: number | null;
  is_paid: boolean;
  ordered_at: Date;
  first_ordered_at: Date;
  updated_at: Date;
}

const STATUS_TRANSITIONS: Record<
  PreorderCampaignStatus,
  PreorderCampaignStatus[]
> = {
  [PreorderCampaignStatus.DRAFT]: [
    PreorderCampaignStatus.OPEN,
    PreorderCampaignStatus.CANCELLED,
  ],
  [PreorderCampaignStatus.OPEN]: [
    PreorderCampaignStatus.CLOSED,
    PreorderCampaignStatus.CANCELLED,
  ],
  [PreorderCampaignStatus.CLOSED]: [
    PreorderCampaignStatus.OPEN,
    PreorderCampaignStatus.ALLOCATING,
    PreorderCampaignStatus.CANCELLED,
  ],
  [PreorderCampaignStatus.ALLOCATING]: [
    PreorderCampaignStatus.FULFILLED,
    PreorderCampaignStatus.CANCELLED,
  ],
  [PreorderCampaignStatus.FULFILLED]: [],
  [PreorderCampaignStatus.CANCELLED]: [],
};

function toInt(value: unknown, field: string, min = 0): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new BadRequestException(`${field} ต้องเป็นจำนวนเต็มตั้งแต่ ${min}`);
  }
  return n;
}

function toIntOrNull(value: unknown, field: string, min = 0): number | null {
  if (value === undefined || value === null || value === '') return null;
  return toInt(value, field, min);
}

function toDateOrNull(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${field} ไม่ใช่วันเวลาที่ถูกต้อง`);
  }
  return d;
}

@Injectable()
export class PreorderService {
  private readonly logger = new Logger(PreorderService.name);

  constructor(
    @InjectRepository(PreorderCampaignEntity)
    private readonly campaignRepo: Repository<PreorderCampaignEntity>,
    @InjectRepository(PreorderProductEntity)
    private readonly productRepo: Repository<PreorderProductEntity>,
    @InjectRepository(PreorderItemEntity)
    private readonly itemRepo: Repository<PreorderItemEntity>,
    @InjectRepository(PreorderItemLogEntity)
    private readonly logRepo: Repository<PreorderItemLogEntity>,
    @InjectRepository(ProductEntity)
    private readonly catalogRepo: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly notifier: PreorderNotifierService,
  ) {}

  // =====================================================================
  // helpers
  // =====================================================================

  private priceFor(product: ProductEntity, priceOption?: string): number {
    switch ((priceOption ?? 'A').toUpperCase()) {
      case 'B':
        return Number(product.pro_priceB);
      case 'C':
        return Number(product.pro_priceC);
      default:
        return Number(product.pro_priceA);
    }
  }

  private isCampaignAcceptingOrders(
    c: PreorderCampaignEntity,
    now = new Date(),
  ) {
    if (c.status !== PreorderCampaignStatus.OPEN) return false;
    if (c.starts_at && c.starts_at > now) return false;
    if (c.ends_at && c.ends_at < now) return false;
    return true;
  }

  /** ล็อตทั้งหมดของสินค้าที่ยังจองอยู่ เรียงตามคิว พร้อมลำดับและยอดสะสมก่อนหน้า */
  private async loadQueueLots(
    manager: EntityManager,
    preorderProductId: number,
  ): Promise<QueueLotRow[]> {
    const rows = await manager
      .createQueryBuilder(PreorderItemLotEntity, 'l')
      .innerJoin(PreorderItemEntity, 'i', 'i.id = l.item_id')
      .select('l.id', 'lot_id')
      .addSelect('l.item_id', 'item_id')
      .addSelect('l.qty', 'qty')
      .addSelect('l.ordered_at', 'ordered_at')
      .addSelect('l.allocated_qty', 'allocated_qty')
      .addSelect('i.mem_code', 'mem_code')
      .addSelect('i.status', 'status')
      .where('i.preorder_product_id = :pid', { pid: preorderProductId })
      .andWhere('i.status IN (:...st)', { st: ACTIVE_ITEM_STATUSES })
      .orderBy('l.ordered_at', 'ASC')
      .addOrderBy('l.id', 'ASC')
      .getRawMany<{
        lot_id: number;
        item_id: number;
        qty: number;
        ordered_at: Date | string;
        allocated_qty: number | null;
        mem_code: string;
        status: PreorderItemStatus;
      }>();
    let position = 0;
    let cumulative = 0;
    return rows.map((r) => {
      position += 1;
      const ahead = cumulative;
      cumulative += Number(r.qty);
      return {
        lot_id: Number(r.lot_id),
        item_id: Number(r.item_id),
        qty: Number(r.qty),
        ordered_at: new Date(r.ordered_at),
        allocated_qty:
          r.allocated_qty === null ? null : Number(r.allocated_qty),
        mem_code: r.mem_code,
        status: r.status,
        position,
        ahead_qty: ahead,
      };
    });
  }

  /** เขียนล็อตของรายการให้ตรงกับผล applyAmountChange */
  private async rewriteLots(
    manager: EntityManager,
    itemId: number,
    result: ReturnType<typeof applyAmountChange>,
  ) {
    if (result.removedIds.length) {
      await manager.delete(PreorderItemLotEntity, {
        id: In(result.removedIds),
      });
    }
    for (const l of result.lots) {
      if (l.id !== undefined) {
        await manager.update(
          PreorderItemLotEntity,
          { id: l.id },
          { qty: l.qty },
        );
      } else {
        await manager.save(
          manager.create(PreorderItemLotEntity, {
            item_id: itemId,
            qty: l.qty,
            ordered_at: l.ordered_at,
          }),
        );
      }
    }
  }

  private async queueInfoFor(
    manager: EntityManager,
    preorderProductId: number,
    item: PreorderItemEntity | null,
  ): Promise<QueueInfo> {
    const lots = await this.loadQueueLots(manager, preorderProductId);
    const total_members = new Set(lots.map((l) => l.item_id)).size;
    const total_qty = lots.reduce((s, l) => s + l.qty, 0);
    if (!item || !ACTIVE_ITEM_STATUSES.includes(item.status)) {
      return { position: 0, ahead_qty: 0, total_members, total_qty, lots: [] };
    }
    const mine = lots
      .filter((l) => l.item_id === item.id)
      .map((l) => ({
        id: l.lot_id,
        qty: l.qty,
        ordered_at: l.ordered_at,
        allocated_qty: l.allocated_qty,
        position: l.position,
        ahead_qty: l.ahead_qty,
      }));
    return {
      position: mine[0]?.position ?? 0,
      ahead_qty: mine[0]?.ahead_qty ?? 0,
      total_members,
      total_qty,
      lots: mine,
    };
  }

  private async log(
    manager: EntityManager,
    itemId: number,
    actor: string,
    action: PreorderLogAction,
    from: number | null,
    to: number | null,
    note?: string,
  ) {
    await manager.save(
      manager.create(PreorderItemLogEntity, {
        item_id: itemId,
        actor,
        action,
        from_amount: from,
        to_amount: to,
        note: note ?? null,
      }),
    );
  }

  private async findProductOrFail(id: number, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(PreorderProductEntity)
      : this.productRepo;
    const p = await repo.findOne({
      where: { id },
      relations: { campaign: true, product: { units: true } },
    });
    if (!p) throw new NotFoundException(`ไม่พบสินค้าที่เปิดจอง id=${id}`);
    return p;
  }

  private async findCampaignOrFail(id: number) {
    const c = await this.campaignRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`ไม่พบรอบจอง id=${id}`);
    return c;
  }

  // =====================================================================
  // customer
  // =====================================================================

  /** รอบที่เปิดรับจองอยู่ พร้อมสินค้า ราคาตามระดับ และรายการจองของร้านนี้ */
  async listOpenCampaigns(actor: PreorderActor) {
    const now = new Date();
    const campaigns = await this.campaignRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.products', 'p', 'p.is_active = 1')
      .leftJoinAndSelect('p.product', 'prod')
      .leftJoinAndSelect('prod.units', 'units')
      .where('c.status = :open', { open: PreorderCampaignStatus.OPEN })
      .andWhere('(c.starts_at IS NULL OR c.starts_at <= :now)', { now })
      .andWhere('(c.ends_at IS NULL OR c.ends_at >= :now)', { now })
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('p.sort_order', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .getMany();

    const productIds = campaigns.flatMap((c) => c.products.map((p) => p.id));
    const myItems = productIds.length
      ? await this.itemRepo.find({
          where: {
            preorder_product_id: In(productIds),
            mem_code: actor.mem_code,
          },
        })
      : [];
    const myByProduct = new Map(myItems.map((i) => [i.preorder_product_id, i]));

    const result: Array<Record<string, unknown>> = [];
    for (const c of campaigns) {
      const products: Array<Record<string, unknown>> = [];
      for (const p of c.products) {
        const mine = myByProduct.get(p.id) ?? null;
        const queue = await this.queueInfoFor(
          this.itemRepo.manager,
          p.id,
          mine,
        );
        products.push(this.presentProduct(p, actor, mine, queue));
      }
      result.push({
        id: c.id,
        name: c.name,
        mode: c.mode,
        status: c.status,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        detail_announcement: c.detail_announcement,
        breaking_announcement: c.breaking_announcement,
        terms: c.terms,
        allow_cancel: c.allow_cancel,
        increase_policy: c.increase_policy,
        increase_grace_hours: c.increase_grace_hours,
        products,
      });
    }
    return result;
  }

  private presentProduct(
    p: PreorderProductEntity,
    actor: PreorderActor,
    mine: PreorderItemEntity | null,
    queue: QueueInfo | null,
  ) {
    const prod = p.product;
    const remaining =
      p.supply_qty === null || queue === null
        ? null
        : Math.max(0, p.supply_qty - queue.total_qty);
    return {
      id: p.id,
      pro_code: p.pro_code,
      pro_name: prod?.pro_name ?? null,
      pro_nameTH: prod?.pro_nameTH ?? null,
      pro_imgmain: prod?.pro_imgmain ?? null,
      unit: unit1Of(prod),
      price: prod ? this.priceFor(prod, actor.price_option) : null,
      estimated_price:
        p.estimated_price === null ? null : Number(p.estimated_price),
      eta_date: p.eta_date,
      note: p.note,
      limit_per_member: p.limit_per_member,
      supply_qty: p.supply_qty,
      remaining_qty: remaining,
      moq: p.moq,
      moq_progress:
        p.moq && queue
          ? Math.min(100, Math.round((queue.total_qty / p.moq) * 100))
          : null,
      arrived_at: p.arrived_at,
      total_qty: queue?.total_qty ?? 0,
      total_members: queue?.total_members ?? 0,
      my_item: mine
        ? {
            id: mine.id,
            amount: mine.amount,
            status: mine.status,
            allocated_qty: mine.allocated_qty,
            is_paid: mine.is_paid,
            ordered_at: mine.ordered_at,
            updated_at: mine.updated_at,
            position: queue?.position ?? 0,
            ahead_qty: queue?.ahead_qty ?? 0,
            lots: queue?.lots ?? [],
          }
        : null,
    };
  }

  /**
   * ลูกค้าตั้งจำนวนจองสำหรับสินค้าในรอบ
   * - สร้างใหม่: ordered_at = now (คิว)
   * - มีอยู่แล้ว: แก้ amount อย่างเดียว ไม่แตะ ordered_at
   * - ล็อค/จัดสรรแล้ว: แก้ไม่ได้
   * ทำใน transaction พร้อมล็อคแถวสินค้าเพื่อกัน supply เกินและแถวซ้ำ
   */
  async upsertItem(
    actor: PreorderActor,
    campaignId: number,
    proCode: string,
    dto: UpsertItemDto,
  ) {
    const amount = toInt(dto.amount, 'amount', 1);
    const memCode = actor.mem_code;
    if (!memCode) throw new ForbiddenException('ไม่พบรหัสสมาชิกใน token');

    return this.dataSource.transaction(async (manager) => {
      const pp = await manager
        .createQueryBuilder(PreorderProductEntity, 'p')
        .setLock('pessimistic_write')
        .where('p.campaign_id = :cid AND p.pro_code = :pc', {
          cid: campaignId,
          pc: proCode,
        })
        .getOne();
      if (!pp || !pp.is_active) {
        throw new NotFoundException('สินค้านี้ไม่ได้เปิดจองในรอบนี้');
      }
      const campaign = await manager.findOneOrFail(PreorderCampaignEntity, {
        where: { id: campaignId },
      });
      if (!this.isCampaignAcceptingOrders(campaign)) {
        throw new ForbiddenException('รอบจองนี้ยังไม่เปิดหรือปิดรับแล้ว');
      }
      if (pp.limit_per_member !== null && amount > pp.limit_per_member) {
        throw new BadRequestException(
          `จองได้ไม่เกิน ${pp.limit_per_member} ต่อร้านสำหรับสินค้านี้`,
        );
      }

      const unit1 = await manager.findOne(ProductUnitEntity, {
        where: { pro_code: proCode, level: 1 },
      });

      let item = await manager.findOne(PreorderItemEntity, {
        where: { preorder_product_id: pp.id, mem_code: memCode },
      });

      // supply ของรอบ (โหมด A): ยอดคนอื่น + ของเรา ต้องไม่เกิน
      if (pp.supply_qty !== null) {
        const others = await manager
          .createQueryBuilder(PreorderItemEntity, 'i')
          .select('COALESCE(SUM(i.amount), 0)', 'qty')
          .where('i.preorder_product_id = :pid', { pid: pp.id })
          .andWhere('i.status IN (:...st)', { st: ACTIVE_ITEM_STATUSES })
          .andWhere('i.mem_code != :mem', { mem: memCode })
          .getRawOne<{ qty: string }>();
        const remaining = pp.supply_qty - Number(others?.qty ?? 0);
        if (amount > remaining) {
          throw new ConflictException(
            remaining > 0
              ? `เหลือให้จองได้อีก ${remaining} เท่านั้น`
              : 'สินค้านี้ถูกจองเต็มจำนวนแล้ว',
          );
        }
      }

      const now = new Date();
      if (!item || item.status === PreorderItemStatus.CANCELLED) {
        if (campaign.terms && !dto.accept_terms && !item?.accepted_terms_at) {
          throw new BadRequestException('ต้องยอมรับเงื่อนไขการจองก่อน');
        }
        const isNew = !item;
        item =
          item ??
          manager.create(PreorderItemEntity, {
            preorder_product_id: pp.id,
            mem_code: memCode,
          });
        item.amount = amount;
        item.unit = unit1?.unit_name ?? null;
        item.status = PreorderItemStatus.RESERVED;
        item.allocated_qty = null;
        item.ordered_at = now; // ยกเลิกแล้วจองใหม่ = ต่อท้ายคิว
        item.accepted_terms_at =
          item.accepted_terms_at ?? (dto.accept_terms ? now : null);
        item = await manager.save(item);
        // ล็อตเดียว = จำนวนทั้งหมด ณ เวลาจองครั้งแรก (จองใหม่หลังยกเลิกจะล้างล็อตเก่า)
        await manager.delete(PreorderItemLotEntity, { item_id: item.id });
        await manager.save(
          manager.create(PreorderItemLotEntity, {
            item_id: item.id,
            qty: amount,
            ordered_at: now,
          }),
        );
        await this.log(
          manager,
          item.id,
          memCode,
          PreorderLogAction.CREATE,
          null,
          amount,
          isNew ? undefined : 'จองใหม่หลังยกเลิก',
        );
      } else {
        if (item.status !== PreorderItemStatus.RESERVED) {
          throw new ForbiddenException(
            item.status === PreorderItemStatus.LOCKED
              ? 'รายการนี้ถูกล็อคโดยเจ้าหน้าที่แล้ว แก้ไขไม่ได้'
              : 'รายการนี้จัดสรรแล้ว แก้ไขไม่ได้',
          );
        }
        if (item.amount !== amount) {
          const from = item.amount;
          const existing = await manager.find(PreorderItemLotEntity, {
            where: { item_id: item.id },
            order: { ordered_at: 'ASC', id: 'ASC' },
          });
          const change = applyAmountChange(
            existing.map((l) => ({
              id: l.id,
              qty: l.qty,
              ordered_at: l.ordered_at,
            })),
            amount,
            campaign.increase_policy,
            campaign.increase_grace_hours,
            now,
          );
          await this.rewriteLots(manager, item.id, change);
          item.amount = amount;
          item.ordered_at = change.itemOrderedAt; // เปลี่ยนเฉพาะนโยบาย reset
          item = await manager.save(item);
          await this.log(
            manager,
            item.id,
            memCode,
            PreorderLogAction.UPDATE,
            from,
            amount,
            change.note,
          );
        }
      }

      const queue = await this.queueInfoFor(manager, pp.id, item);
      return {
        id: item.id,
        campaign_id: campaignId,
        pro_code: proCode,
        amount: item.amount,
        unit: item.unit,
        status: item.status,
        ordered_at: item.ordered_at,
        position: queue?.position ?? 0,
        ahead_qty: queue?.ahead_qty ?? 0,
        total_qty: queue?.total_qty ?? 0,
        total_members: queue?.total_members ?? 0,
        lots: queue?.lots ?? [],
      };
    });
  }

  /** ลูกค้ายกเลิกเอง ได้เฉพาะรอบที่ allow_cancel และรายการยัง reserved */
  async cancelItem(actor: PreorderActor, itemId: number) {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(PreorderItemEntity, {
        where: { id: itemId },
        relations: { preorderProduct: { campaign: true } },
      });
      if (!item || item.mem_code !== actor.mem_code) {
        throw new NotFoundException('ไม่พบรายการจอง');
      }
      const campaign = item.preorderProduct.campaign;
      if (!campaign.allow_cancel) {
        throw new ForbiddenException('รอบจองนี้ไม่อนุญาตให้ยกเลิกเอง');
      }
      if (!this.isCampaignAcceptingOrders(campaign)) {
        throw new ForbiddenException('รอบจองปิดรับแล้ว ยกเลิกไม่ได้');
      }
      if (item.status !== PreorderItemStatus.RESERVED) {
        throw new ForbiddenException(
          'รายการนี้ถูกล็อคหรือจัดสรรแล้ว ยกเลิกไม่ได้',
        );
      }
      const from = item.amount;
      item.status = PreorderItemStatus.CANCELLED;
      await manager.save(item);
      await this.log(
        manager,
        item.id,
        actor.mem_code,
        PreorderLogAction.CANCEL,
        from,
        0,
      );
      return { id: item.id, status: item.status };
    });
  }

  /** ประวัติการจองทั้งหมดของร้าน */
  async getMyItems(actor: PreorderActor) {
    const items = await this.itemRepo.find({
      where: { mem_code: actor.mem_code },
      relations: { preorderProduct: { campaign: true, product: true } },
      order: { ordered_at: 'DESC' },
    });
    const result: Array<Record<string, unknown>> = [];
    for (const i of items) {
      const queue = await this.queueInfoFor(
        this.itemRepo.manager,
        i.preorder_product_id,
        i,
      );
      const p = i.preorderProduct;
      result.push({
        id: i.id,
        campaign: {
          id: p.campaign.id,
          name: p.campaign.name,
          status: p.campaign.status,
          mode: p.campaign.mode,
        },
        pro_code: p.pro_code,
        pro_name: p.product?.pro_name ?? null,
        pro_imgmain: p.product?.pro_imgmain ?? null,
        amount: i.amount,
        unit: i.unit,
        status: i.status,
        allocated_qty: i.allocated_qty,
        is_paid: i.is_paid,
        eta_date: p.eta_date,
        arrived_at: p.arrived_at,
        ordered_at: i.ordered_at,
        updated_at: i.updated_at,
        position: queue?.position ?? 0,
        ahead_qty: queue?.ahead_qty ?? 0,
        lots: queue?.lots ?? [],
      });
    }
    return result;
  }

  // =====================================================================
  // admin: campaigns
  // =====================================================================

  async listCampaigns(status?: PreorderCampaignStatus) {
    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .loadRelationCountAndMap('c.product_count', 'c.products')
      .orderBy('c.created_at', 'DESC');
    if (status) qb.where('c.status = :status', { status });
    return qb.getMany();
  }

  async getCampaign(id: number) {
    const c = await this.campaignRepo.findOne({
      where: { id },
      relations: { products: { product: { units: true } } },
      order: { products: { sort_order: 'ASC', id: 'ASC' } },
    });
    if (!c) throw new NotFoundException(`ไม่พบรอบจอง id=${id}`);

    const products: Array<Record<string, unknown>> = [];
    for (const p of c.products) {
      const q = await this.queueInfoFor(this.itemRepo.manager, p.id, null);
      const allocated = await this.itemRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.allocated_qty), 0)', 'qty')
        .where('i.preorder_product_id = :pid', { pid: p.id })
        .getRawOne<{ qty: string }>();
      products.push({
        ...p,
        product: p.product
          ? {
              pro_code: p.product.pro_code,
              pro_name: p.product.pro_name,
              pro_nameTH: p.product.pro_nameTH,
              pro_imgmain: p.product.pro_imgmain,
              pro_unit1: unit1Of(p.product),
              pro_stock: p.product.pro_stock,
            }
          : null,
        total_qty: q?.total_qty ?? 0,
        total_members: q?.total_members ?? 0,
        allocated_qty: Number(allocated?.qty ?? 0),
        moq_met: p.moq === null ? null : (q?.total_qty ?? 0) >= p.moq,
      });
    }
    return { ...c, products };
  }

  private applyCampaignDto(c: PreorderCampaignEntity, dto: UpdateCampaignDto) {
    if (dto.name !== undefined) {
      if (!dto.name?.trim())
        throw new BadRequestException('name จำเป็นต้องระบุ');
      c.name = dto.name.trim();
    }
    if (dto.mode !== undefined) {
      if (!Object.values(PreorderMode).includes(dto.mode)) {
        throw new BadRequestException(
          'mode ต้องเป็น allocation หรือ aggregation',
        );
      }
      c.mode = dto.mode;
    }
    if (dto.starts_at !== undefined)
      c.starts_at = toDateOrNull(dto.starts_at, 'starts_at');
    if (dto.ends_at !== undefined)
      c.ends_at = toDateOrNull(dto.ends_at, 'ends_at');
    if (c.starts_at && c.ends_at && c.ends_at < c.starts_at) {
      throw new BadRequestException('ends_at ต้องอยู่หลัง starts_at');
    }
    if (dto.detail_announcement !== undefined)
      c.detail_announcement = dto.detail_announcement ?? null;
    if (dto.breaking_announcement !== undefined)
      c.breaking_announcement = dto.breaking_announcement ?? null;
    if (dto.terms !== undefined) c.terms = dto.terms ?? null;
    if (dto.allow_cancel !== undefined)
      c.allow_cancel = Boolean(dto.allow_cancel);
    if (dto.increase_policy !== undefined) {
      if (
        !Object.values(PreorderIncreasePolicy).includes(dto.increase_policy)
      ) {
        throw new BadRequestException(
          'increase_policy ต้องเป็น keep, split หรือ reset',
        );
      }
      c.increase_policy = dto.increase_policy;
    }
    if (dto.increase_grace_hours !== undefined) {
      c.increase_grace_hours = toIntOrNull(
        dto.increase_grace_hours,
        'increase_grace_hours',
        0,
      );
    }
  }

  async createCampaign(actor: PreorderActor, dto: CreateCampaignDto) {
    const c = this.campaignRepo.create({
      status: PreorderCampaignStatus.DRAFT,
      mode: PreorderMode.AGGREGATION,
      allow_cancel: false,
      increase_policy: PreorderIncreasePolicy.KEEP,
      increase_grace_hours: null,
      created_by: actor.username ?? actor.mem_code,
    });
    this.applyCampaignDto(c, { ...dto, name: dto.name ?? '' });
    return this.campaignRepo.save(c);
  }

  async updateCampaign(id: number, dto: UpdateCampaignDto) {
    const c = await this.findCampaignOrFail(id);
    this.applyCampaignDto(c, dto);
    return this.campaignRepo.save(c);
  }

  async setCampaignStatus(id: number, status: PreorderCampaignStatus) {
    const c = await this.findCampaignOrFail(id);
    if (!Object.values(PreorderCampaignStatus).includes(status)) {
      throw new BadRequestException('status ไม่ถูกต้อง');
    }
    if (!STATUS_TRANSITIONS[c.status].includes(status)) {
      throw new BadRequestException(
        `เปลี่ยนสถานะจาก ${c.status} เป็น ${status} ไม่ได้`,
      );
    }
    c.status = status;
    await this.campaignRepo.save(c);

    // ปิดรอบ → ล็อคทุกรายการที่ยัง reserved เพื่อไม่ให้แก้ระหว่างจัดสรร
    if (status === PreorderCampaignStatus.CLOSED) {
      await this.itemRepo
        .createQueryBuilder()
        .update(PreorderItemEntity)
        .set({ status: PreorderItemStatus.LOCKED })
        .where('status = :reserved', { reserved: PreorderItemStatus.RESERVED })
        .andWhere(
          'preorder_product_id IN (SELECT id FROM preorder_products WHERE campaign_id = :cid)',
          { cid: id },
        )
        .execute();
    }
    if (status === PreorderCampaignStatus.CANCELLED) {
      await this.notifyCampaignMembers(
        id,
        'ยกเลิกรอบจอง',
        `รอบจอง "${c.name}" ถูกยกเลิก รายการจองของท่านจะไม่ถูกจัดส่ง`,
      );
    }
    return this.getCampaign(id);
  }

  private async notifyCampaignMembers(
    campaignId: number,
    title: string,
    message: string,
  ) {
    const rows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin('i.preorderProduct', 'p')
      .select('DISTINCT i.mem_code', 'mem_code')
      .where('p.campaign_id = :cid', { cid: campaignId })
      .andWhere('i.status IN (:...st)', { st: ACTIVE_ITEM_STATUSES })
      .getRawMany<{ mem_code: string }>();
    const sent = await this.notifier.sendMany(
      rows.map((r) => ({
        memCode: r.mem_code,
        title,
        message,
        data: { campaign_id: campaignId },
      })),
    );
    this.logger.log(
      `campaign ${campaignId} notify "${title}" sent ${sent}/${rows.length}`,
    );
  }

  // =====================================================================
  // admin: products in campaign
  // =====================================================================

  private applyProductDto(p: PreorderProductEntity, dto: UpdateProductDto) {
    if (dto.note !== undefined) p.note = dto.note ?? null;
    if (dto.limit_per_member !== undefined)
      p.limit_per_member = toIntOrNull(
        dto.limit_per_member,
        'limit_per_member',
        1,
      );
    if (dto.supply_qty !== undefined)
      p.supply_qty = toIntOrNull(dto.supply_qty, 'supply_qty', 0);
    if (dto.moq !== undefined) p.moq = toIntOrNull(dto.moq, 'moq', 1);
    if (dto.estimated_price !== undefined) {
      if (dto.estimated_price === null || dto.estimated_price === undefined)
        p.estimated_price = null;
      else {
        const n = Number(dto.estimated_price);
        if (!Number.isFinite(n) || n < 0)
          throw new BadRequestException('estimated_price ไม่ถูกต้อง');
        p.estimated_price = n.toFixed(2);
      }
    }
    if (dto.eta_date !== undefined) {
      const d = toDateOrNull(dto.eta_date, 'eta_date');
      p.eta_date = d ? d.toISOString().slice(0, 10) : null;
    }
    if (dto.sort_order !== undefined)
      p.sort_order = toInt(dto.sort_order, 'sort_order', 0);
    if (dto.is_active !== undefined) p.is_active = Boolean(dto.is_active);
  }

  async addProduct(campaignId: number, dto: AddProductDto) {
    const campaign = await this.findCampaignOrFail(campaignId);
    if (
      [
        PreorderCampaignStatus.FULFILLED,
        PreorderCampaignStatus.CANCELLED,
      ].includes(campaign.status)
    ) {
      throw new BadRequestException('รอบจองนี้จบแล้ว เพิ่มสินค้าไม่ได้');
    }
    const proCode = String(dto.pro_code ?? '').trim();
    if (!proCode) throw new BadRequestException('pro_code จำเป็นต้องระบุ');
    const catalog = await this.catalogRepo.findOne({
      where: { pro_code: proCode },
      select: ['pro_code'],
    });
    if (!catalog) throw new NotFoundException(`ไม่พบสินค้า ${proCode} ในระบบ`);
    const dup = await this.productRepo.findOne({
      where: { campaign_id: campaignId, pro_code: proCode },
    });
    if (dup) throw new ConflictException(`สินค้า ${proCode} อยู่ในรอบนี้แล้ว`);

    const p = this.productRepo.create({
      campaign_id: campaignId,
      pro_code: proCode,
      is_active: true,
      sort_order: 0,
    });
    this.applyProductDto(p, dto);
    const saved = await this.productRepo.save(p);
    return this.findProductOrFail(saved.id);
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    const p = await this.findProductOrFail(id);
    this.applyProductDto(p, dto);
    await this.productRepo.save(p);
    return this.findProductOrFail(id);
  }

  /** ถอดสินค้าออกจากรอบ ถ้ามีคนจองแล้วจะปิดการมองเห็นแทนการลบ */
  async removeProduct(id: number) {
    const p = await this.findProductOrFail(id);
    const count = await this.itemRepo.count({
      where: { preorder_product_id: id },
    });
    if (count > 0) {
      p.is_active = false;
      await this.productRepo.save(p);
      return { id, removed: false, deactivated: true, items: count };
    }
    await this.productRepo.delete({ id });
    return { id, removed: true, deactivated: false, items: 0 };
  }

  // =====================================================================
  // admin: queue & items
  // =====================================================================

  /** คิวของสินค้า เรียงเวลาจองครั้งแรก พร้อมข้อมูลร้านและยอดสะสม */
  /** คิวของสินค้า แถวละ 1 ล็อต เรียงเวลาเข้าคิว พร้อมข้อมูลร้านและยอดสะสม (รายการที่ยกเลิกต่อท้ายไม่มีลำดับ) */
  async getQueue(preorderProductId: number) {
    const p = await this.findProductOrFail(preorderProductId);
    const items = await this.itemRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.member', 'm')
      .leftJoinAndSelect('m.employee', 'e')
      .where('i.preorder_product_id = :pid', { pid: preorderProductId })
      .orderBy('i.ordered_at', 'ASC')
      .addOrderBy('i.id', 'ASC')
      .getMany();
    const byId = new Map(items.map((i) => [i.id, i]));
    const lots = await this.loadQueueLots(
      this.itemRepo.manager,
      preorderProductId,
    );
    const lotCount = new Map<number, number>();
    for (const l of lots)
      lotCount.set(l.item_id, (lotCount.get(l.item_id) ?? 0) + 1);
    const lotNo = new Map<number, number>();

    const memberOf = (i: PreorderItemEntity) => ({
      mem_code: i.mem_code,
      mem_name: i.member?.mem_nameSite ?? null,
      mem_phone: i.member?.mem_phone ?? null,
      mem_price: i.member?.mem_price ?? null,
      mem_route: i.member?.mem_route ?? null,
      sale_emp: i.member?.employee
        ? `${i.member.employee.emp_code ?? ''} ${i.member.employee.emp_nickname ?? ''}`.trim()
        : null,
    });

    let cumulative = 0;
    const rows: QueueRowOut[] = lots.map((l) => {
      const i = byId.get(l.item_id) as PreorderItemEntity;
      const no = (lotNo.get(l.item_id) ?? 0) + 1;
      lotNo.set(l.item_id, no);
      cumulative += l.qty;
      return {
        id: i.id,
        lot_id: l.lot_id,
        lot_no: no,
        lots_count: lotCount.get(l.item_id) ?? 1,
        position: l.position,
        ...memberOf(i),
        amount: l.qty,
        item_amount: i.amount,
        unit: i.unit,
        cumulative_qty: cumulative,
        status: i.status,
        allocated_qty: l.allocated_qty,
        item_allocated_qty: i.allocated_qty,
        is_paid: i.is_paid,
        ordered_at: l.ordered_at,
        first_ordered_at: i.ordered_at,
        updated_at: i.updated_at,
      };
    });
    // รายการที่ไม่อยู่ในคิว (ยกเลิก) แสดงต่อท้ายเพื่อให้ admin เห็นประวัติ
    for (const i of items) {
      if (ACTIVE_ITEM_STATUSES.includes(i.status)) continue;
      rows.push({
        id: i.id,
        lot_id: 0,
        lot_no: 1,
        lots_count: 1,
        position: null,
        ...memberOf(i),
        amount: i.amount,
        item_amount: i.amount,
        unit: i.unit,
        cumulative_qty: null,
        status: i.status,
        allocated_qty: i.allocated_qty,
        item_allocated_qty: i.allocated_qty,
        is_paid: i.is_paid,
        ordered_at: i.ordered_at,
        first_ordered_at: i.ordered_at,
        updated_at: i.updated_at,
      });
    }

    return {
      product: {
        id: p.id,
        pro_code: p.pro_code,
        pro_name: p.product?.pro_name ?? null,
        unit: unit1Of(p.product),
        supply_qty: p.supply_qty,
        limit_per_member: p.limit_per_member,
        moq: p.moq,
        arrived_at: p.arrived_at,
        campaign: {
          id: p.campaign.id,
          name: p.campaign.name,
          mode: p.campaign.mode,
          status: p.campaign.status,
          increase_policy: p.campaign.increase_policy,
          increase_grace_hours: p.campaign.increase_grace_hours,
        },
      },
      total_qty: lots.reduce((s, l) => s + l.qty, 0),
      total_members: new Set(lots.map((l) => l.item_id)).size,
      items: rows,
    };
  }

  async getQueueCsv(preorderProductId: number): Promise<string> {
    const q = await this.getQueue(preorderProductId);
    const esc = (v: unknown) => {
      const s =
        v === null || v === undefined
          ? ''
          : String(v as string | number | boolean);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'ลำดับ',
      'รหัสร้าน',
      'ชื่อร้าน',
      'เบอร์',
      'ระดับราคา',
      'เส้นทาง',
      'เซลล์',
      'ล็อต',
      'จำนวน (ล็อต)',
      'รวมทั้งรายการ',
      'หน่วย',
      'สะสม',
      'สถานะ',
      'จัดสรร',
      'ชำระแล้ว',
      'เวลาจอง',
    ];
    const lines = q.items.map((r) =>
      [
        r.position,
        r.mem_code,
        r.mem_name,
        r.mem_phone,
        r.mem_price,
        r.mem_route,
        r.sale_emp,
        r.lots_count > 1 ? `${r.lot_no}/${r.lots_count}` : '',
        r.amount,
        r.item_amount,
        r.unit,
        r.cumulative_qty,
        r.status,
        r.allocated_qty,
        r.is_paid ? 'Y' : '',
        r.ordered_at instanceof Date
          ? r.ordered_at.toISOString()
          : r.ordered_at,
      ]
        .map(esc)
        .join(','),
    );
    return '﻿' + [header.join(','), ...lines].join('\n');
  }

  async adminUpdateItem(
    actor: PreorderActor,
    itemId: number,
    dto: AdminUpdateItemDto,
  ) {
    const who = actor.username ?? actor.mem_code;
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(PreorderItemEntity, {
        where: { id: itemId },
      });
      if (!item) throw new NotFoundException('ไม่พบรายการจอง');

      if (dto.amount !== undefined) {
        const amount = toInt(dto.amount, 'amount', 1);
        if (item.amount !== amount) {
          // เจ้าหน้าที่แก้ = คงคิวเดิมเสมอ (รวมเข้าล็อตแรก / ตัดจากล็อตท้าย)
          const existing = await manager.find(PreorderItemLotEntity, {
            where: { item_id: item.id },
            order: { ordered_at: 'ASC', id: 'ASC' },
          });
          const change = applyAmountChange(
            existing.map((l) => ({
              id: l.id,
              qty: l.qty,
              ordered_at: l.ordered_at,
            })),
            amount,
            'keep',
            null,
            new Date(),
          );
          await this.rewriteLots(manager, item.id, change);
          await this.log(
            manager,
            item.id,
            who,
            PreorderLogAction.UPDATE,
            item.amount,
            amount,
            dto.note ? `${dto.note} · ${change.note}` : change.note,
          );
          item.amount = amount;
        }
      }
      if (dto.status !== undefined) {
        if (!Object.values(PreorderItemStatus).includes(dto.status)) {
          throw new BadRequestException('status ไม่ถูกต้อง');
        }
        if (item.status !== dto.status) {
          const actionMap: Partial<
            Record<PreorderItemStatus, PreorderLogAction>
          > = {
            [PreorderItemStatus.LOCKED]: PreorderLogAction.LOCK,
            [PreorderItemStatus.RESERVED]: PreorderLogAction.UNLOCK,
            [PreorderItemStatus.ALLOCATED]: PreorderLogAction.ALLOCATE,
            [PreorderItemStatus.FULFILLED]: PreorderLogAction.FULFILL,
            [PreorderItemStatus.CANCELLED]: PreorderLogAction.CANCEL,
          };
          await this.log(
            manager,
            item.id,
            who,
            actionMap[dto.status] ?? PreorderLogAction.UPDATE,
            item.amount,
            item.amount,
            dto.note,
          );
          item.status = dto.status;
        }
      }
      if (dto.allocated_qty !== undefined) {
        const q = toIntOrNull(dto.allocated_qty, 'allocated_qty', 0);
        if (q !== null && q > item.amount) {
          throw new BadRequestException('allocated_qty ต้องไม่เกินจำนวนที่จอง');
        }
        if (item.allocated_qty !== q) {
          await this.log(
            manager,
            item.id,
            who,
            PreorderLogAction.ALLOCATE,
            item.allocated_qty,
            q,
            dto.note,
          );
          item.allocated_qty = q;
          if (q !== null && dto.status === undefined)
            item.status = PreorderItemStatus.ALLOCATED;
        }
      }
      if (dto.is_paid !== undefined) {
        const paid = Boolean(dto.is_paid);
        if (item.is_paid !== paid) {
          await this.log(
            manager,
            item.id,
            who,
            paid ? PreorderLogAction.PAID : PreorderLogAction.UNPAID,
            item.amount,
            item.amount,
            dto.note,
          );
          item.is_paid = paid;
        }
      }
      return manager.save(item);
    });
  }

  /** admin ลบ = เปลี่ยนสถานะเป็น cancelled พร้อมบันทึกเหตุผล (เก็บประวัติไว้) */
  async adminCancelItem(actor: PreorderActor, itemId: number, note?: string) {
    return this.adminUpdateItem(actor, itemId, {
      status: PreorderItemStatus.CANCELLED,
      note: note ?? 'ยกเลิกโดยเจ้าหน้าที่',
    });
  }

  async getItemLogs(itemId: number) {
    return this.logRepo.find({
      where: { item_id: itemId },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }

  /** จัดสรรของขาดตามคิว (fifo) หรือสัดส่วน (prorata) preview หรือบันทึกจริง */
  async allocate(
    actor: PreorderActor,
    preorderProductId: number,
    dto: AllocateDto,
  ) {
    const p = await this.findProductOrFail(preorderProductId);
    const supply =
      dto.supply_qty !== undefined
        ? toInt(dto.supply_qty, 'supply_qty', 0)
        : p.supply_qty;
    if (supply === null) {
      throw new BadRequestException('ต้องระบุ supply_qty ของสินค้าก่อนจัดสรร');
    }
    const strategy = dto.strategy ?? 'fifo';
    if (!['fifo', 'prorata'].includes(strategy)) {
      throw new BadRequestException('strategy ต้องเป็น fifo หรือ prorata');
    }

    const items = await this.itemRepo.find({
      where: {
        preorder_product_id: preorderProductId,
        status: In([
          PreorderItemStatus.RESERVED,
          PreorderItemStatus.LOCKED,
          PreorderItemStatus.ALLOCATED,
        ]),
      },
      order: { ordered_at: 'ASC', id: 'ASC' },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    const allLots = (
      await this.loadQueueLots(this.itemRepo.manager, preorderProductId)
    ).filter((l) => byId.has(l.item_id));
    const lotsByItem = new Map<number, QueueLotRow[]>();
    for (const l of allLots) {
      const arr = lotsByItem.get(l.item_id) ?? [];
      arr.push(l);
      lotsByItem.set(l.item_id, arr);
    }
    // ผลต่อล็อต: fifo ไล่ตามล็อต (ส่วนที่เพิ่มทีหลังอยู่ท้ายคิวจริง) · prorata แบ่งต่อรายการแล้วเติมล็อตแรกก่อน
    const lotAlloc = new Map<number, number>();
    if (strategy === 'fifo') {
      for (const r of computeAllocation(
        allLots.map((l) => ({ id: l.lot_id, amount: l.qty })),
        supply,
        'fifo',
      ))
        lotAlloc.set(r.id, r.allocated_qty);
    } else {
      for (const r of computeAllocation(
        items.map((i) => ({ id: i.id, amount: i.amount })),
        supply,
        'prorata',
      )) {
        const ls = lotsByItem.get(r.id) ?? [];
        distributeToLots(ls, r.allocated_qty).forEach((q, idx) =>
          lotAlloc.set(ls[idx].lot_id, q),
        );
      }
    }
    const rows = items.map((i) => {
      const ls = lotsByItem.get(i.id) ?? [];
      const lots = ls.map((l) => ({
        lot_id: l.lot_id,
        qty: l.qty,
        position: l.position,
        allocated_qty: lotAlloc.get(l.lot_id) ?? 0,
      }));
      return {
        id: i.id,
        amount: i.amount,
        allocated_qty: lots.reduce((s2, l) => s2 + l.allocated_qty, 0),
        mem_code: i.mem_code,
        ordered_at: i.ordered_at,
        lots,
      };
    });
    const summary = {
      supply,
      strategy,
      total_demand: rows.reduce((s, r) => s + r.amount, 0),
      total_allocated: rows.reduce((s, r) => s + r.allocated_qty, 0),
      members_short: rows.filter((r) => r.allocated_qty < r.amount).length,
    };

    if (!dto.apply) return { applied: false, ...summary, items: rows };

    const who = actor.username ?? actor.mem_code;
    await this.dataSource.transaction(async (manager) => {
      if (dto.supply_qty !== undefined && p.supply_qty !== supply) {
        await manager.update(
          PreorderProductEntity,
          { id: p.id },
          { supply_qty: supply },
        );
      }
      for (const r of rows) {
        const item = byId.get(r.id);
        if (!item) continue;
        if (
          item.allocated_qty !== r.allocated_qty ||
          item.status !== PreorderItemStatus.ALLOCATED
        ) {
          await this.log(
            manager,
            item.id,
            who,
            PreorderLogAction.ALLOCATE,
            item.allocated_qty,
            r.allocated_qty,
            `auto ${strategy}`,
          );
          await manager.update(
            PreorderItemEntity,
            { id: item.id },
            {
              allocated_qty: r.allocated_qty,
              status: PreorderItemStatus.ALLOCATED,
            },
          );
        }
        for (const l of r.lots) {
          await manager.update(
            PreorderItemLotEntity,
            { id: l.lot_id },
            { allocated_qty: l.allocated_qty },
          );
        }
      }
    });

    const sent = await this.notifier.sendMany(
      rows.map((r) => ({
        memCode: r.mem_code,
        title: 'ผลการจัดสรรสินค้าจอง',
        message:
          r.allocated_qty > 0
            ? `${p.product?.pro_name ?? p.pro_code}: ท่านได้รับจัดสรร ${r.allocated_qty} จากที่จอง ${r.amount}`
            : `${p.product?.pro_name ?? p.pro_code}: ขออภัย รอบนี้ของไม่พอสำหรับรายการของท่าน`,
        data: { preorder_product_id: p.id, item_id: r.id },
      })),
    );
    return { applied: true, notified: sent, ...summary, items: rows };
  }

  // =====================================================================
  // arrivals hook (เรียกจาก NewArrivalsService หรือ admin trigger)
  // =====================================================================

  /**
   * สินค้าเข้าคลังแล้ว: ทำเครื่องหมาย arrived_at บนสินค้าที่เปิดจองในรอบที่ยังไม่จบ
   * แล้วแจ้งทุกร้านที่ยังจองอยู่ (ครั้งเดียวต่อสินค้าต่อรอบ)
   */
  async handleArrivals(
    proCodes: string[],
  ): Promise<{ matched: number; notified: number }> {
    const codes = [
      ...new Set(proCodes.map((c) => String(c ?? '').trim()).filter(Boolean)),
    ];
    if (!codes.length) return { matched: 0, notified: 0 };

    const products = await this.productRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.campaign', 'c')
      .leftJoinAndSelect('p.product', 'prod')
      .where('p.pro_code IN (:...codes)', { codes })
      .andWhere('p.arrived_at IS NULL')
      .andWhere('c.status IN (:...st)', {
        st: [
          PreorderCampaignStatus.OPEN,
          PreorderCampaignStatus.CLOSED,
          PreorderCampaignStatus.ALLOCATING,
        ],
      })
      .getMany();
    if (!products.length) return { matched: 0, notified: 0 };

    let notified = 0;
    const now = new Date();
    for (const p of products) {
      await this.productRepo.update({ id: p.id }, { arrived_at: now });
      const items = await this.itemRepo.find({
        where: { preorder_product_id: p.id, status: In(ACTIVE_ITEM_STATUSES) },
      });
      const name = p.product?.pro_name ?? p.pro_code;
      const sent = await this.notifier.sendMany(
        items.map((i) => ({
          memCode: i.mem_code,
          title: 'สินค้าที่ท่านจองเข้าคลังแล้ว',
          message: `${name} เข้าคลังแล้ว ${i.allocated_qty !== null ? `ท่านได้รับจัดสรร ${i.allocated_qty} ${i.unit ?? ''}` : `ที่จองไว้ ${i.amount} ${i.unit ?? ''}`} เจ้าหน้าที่จะจัดส่งตามรอบถัดไป`,
          data: {
            preorder_product_id: p.id,
            item_id: i.id,
            pro_code: p.pro_code,
          },
        })),
      );
      notified += sent;
      for (const i of items) {
        await this.log(
          this.logRepo.manager,
          i.id,
          'system',
          PreorderLogAction.ARRIVED_NOTIFY,
          i.amount,
          i.amount,
          `new-arrival ${now.toISOString()}`,
        );
      }
      this.logger.log(
        `preorder arrival ${p.pro_code} campaign=${p.campaign_id} items=${items.length} notified=${sent}`,
      );
    }
    return { matched: products.length, notified };
  }
}
