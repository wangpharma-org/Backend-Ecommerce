import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { HappyHourConfigEntity } from './happy-hour-config.entity';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';
import { HappyHourSlotRewardEntity } from './happy-hour-slot-reward.entity';
import {
  HappyHourSlotLogEntity,
  SlotLogAction,
} from './happy-hour-slot-log.entity';
import {
  HappyHourConfigLogEntity,
  ConfigLogAction,
} from './happy-hour-config-log.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { SimulateDto } from './dto/simulate.dto';
import { SlotLogQueryDto } from './dto/slot-log-query.dto';
import { ConfigLogQueryDto } from './dto/config-log-query.dto';
import { ProductEntity } from 'src/products/products.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';
import { CreditorEntity } from 'src/products/creditor.entity';
import { HappyHourSlotMinProductEntity } from './happy-hour-slot-min-product.entity';

// import * as ให้ type เป็น { default: PluginFunc } แต่ runtime CJS value คือ PluginFunc โดยตรง
// ต้อง import แบบนี้เพื่อให้ type augmentation ของ .tz() / .utc() ทำงาน
dayjs.extend(utc);
dayjs.extend(timezone);

interface DefaultSlotSeed {
  start_time: string;
  end_time: string;
  min_order_amount: number;
  card_value: number;
  excess_threshold: number;
  discount_per_step: number;
  is_active: boolean;
  reward_amount: number;
  reward_pro_codes: string[];
}

const DEFAULT_SLOTS: DefaultSlotSeed[] = [
  {
    start_time: '22:00',
    // MySQL TIME ยอมรับ 24:00:00 เป็น special case — ใช้เพื่อครอบคลุม slot จนถึงก่อนเที่ยงคืน
    end_time: '24:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1334,
    discount_per_step: 10,
    is_active: true,
    reward_pro_codes: [],
    reward_amount: 1,
  },
  {
    start_time: '00:00',
    end_time: '02:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1000,
    discount_per_step: 10,
    is_active: true,
    reward_pro_codes: [],
    reward_amount: 1,
  },
  {
    start_time: '02:00',
    end_time: '06:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 667,
    discount_per_step: 10,
    is_active: true,
    reward_pro_codes: [],
    reward_amount: 1,
  },
  {
    start_time: '06:00',
    end_time: '08:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1334,
    discount_per_step: 10,
    is_active: true,
    reward_pro_codes: [],
    reward_amount: 1,
  },
];

@Injectable()
export class HappyHourService implements OnModuleInit {
  private readonly logger = new Logger(HappyHourService.name);
  constructor(
    @InjectRepository(HappyHourConfigEntity)
    private readonly configRepo: Repository<HappyHourConfigEntity>,
    @InjectRepository(HappyHourSlotEntity)
    private readonly slotRepo: Repository<HappyHourSlotEntity>,
    @InjectRepository(HappyHourSlotRewardEntity)
    private readonly rewardRepo: Repository<HappyHourSlotRewardEntity>,
    @InjectRepository(HappyHourSlotLogEntity)
    private readonly slotLogRepo: Repository<HappyHourSlotLogEntity>,
    @InjectRepository(HappyHourConfigLogEntity)
    private readonly configLogRepo: Repository<HappyHourConfigLogEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductUnitEntity)
    private readonly productUnitRepo: Repository<ProductUnitEntity>,
    @InjectRepository(HappyHourSlotMinProductEntity)
    private readonly minProductRepo: Repository<HappyHourSlotMinProductEntity>,
    @InjectRepository(CreditorEntity)
    private readonly creditorRepo: Repository<CreditorEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const count = await this.slotRepo.count();
      if (count === 0) {
        for (const { reward_pro_codes, ...slotData } of DEFAULT_SLOTS) {
          const slot = await this.slotRepo.save(this.slotRepo.create(slotData));
          if (reward_pro_codes.length) {
            await this.rewardRepo.save(
              reward_pro_codes.map((code) =>
                this.rewardRepo.create({
                  pro_code: code,
                  slot: { id: slot.id },
                }),
              ),
            );
          }
        }
      }
    } catch {
      // table ยังไม่มีใน DB — ข้ามไปก่อน feature จะทำงานหลัง migrate
    }
  }

  async getConfig(): Promise<HappyHourConfigEntity> {
    let config = await this.configRepo.findOneBy({ id: 1 });
    if (!config) {
      config = this.configRepo.create({ id: 1, is_enabled: false });
      await this.configRepo.save(config);
    }
    return config;
  }

  /**
   * สำหรับ GET /config endpoint — คืน config พร้อม is_enabled ที่สะท้อนสถานะจริง
   *
   * ถ้า start_date / end_date เป็น null ทั้งคู่ → ใช้ is_enabled จาก DB ตรงๆ
   * ถ้ามีวันที่กำหนด → เช็คว่าวันนี้อยู่ในช่วงหรือไม่
   *   - อยู่ในช่วง  : ใช้ is_enabled จาก DB
   *   - นอกช่วง    : override is_enabled เป็น false
   *
   * หมายเหตุ: getConfig() (ไม่มี Response) ยังคืน pure entity
   * เพื่อให้ toggle() / updateConfig() ทำงานถูกต้อง
   */
  async getConfigResponse() {
    const config = await this.getConfig();

    // ไม่มีวันที่กำหนดเลย → ใช้ค่า is_enabled จาก DB ตรงๆ
    if (!config.start_date && !config.end_date) {
      return config;
    }

    // Bangkok UTC+7 — ใช้ native Date เพื่อเลี่ยงปัญหา dayjs typings
    const bangkokToday = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    const withinRange =
      (!config.start_date || bangkokToday >= config.start_date) &&
      (!config.end_date || bangkokToday <= config.end_date);

    return {
      ...config,
      is_enabled: withinRange ? config.is_enabled : false,
    };
  }

  async toggle(username: string): Promise<HappyHourConfigEntity> {
    const config = await this.getConfig();
    const before = { is_enabled: config.is_enabled };
    config.is_enabled = !config.is_enabled;
    config.updated_at = new Date();
    config.updated_by = username;
    const saved = await this.configRepo.save(config);
    void this.saveConfigLog({
      action: 'TOGGLE',
      performed_by: username,
      before,
      after: { is_enabled: saved.is_enabled },
    });
    return saved;
  }

  async updateConfig(
    dto: {
      is_enabled?: boolean;
      start_date?: string | null;
      end_date?: string | null;
    },
    username: string,
  ): Promise<HappyHourConfigEntity> {
    const config = await this.getConfig();
    const before = {
      is_enabled: config.is_enabled,
      start_date: config.start_date,
      end_date: config.end_date,
    };
    if (dto.is_enabled !== undefined) config.is_enabled = dto.is_enabled;
    if (Object.prototype.hasOwnProperty.call(dto, 'start_date')) {
      config.start_date = dto.start_date ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'end_date')) {
      config.end_date = dto.end_date ?? null;
    }
    config.updated_at = new Date();
    config.updated_by = username;
    const saved = await this.configRepo.save(config);
    void this.saveConfigLog({
      action: 'UPDATE',
      performed_by: username,
      before,
      after: {
        is_enabled: saved.is_enabled,
        start_date: saved.start_date,
        end_date: saved.end_date,
      },
    });
    return saved;
  }

  async getSlots() {
    const slots = await this.slotRepo.find({ order: { start_time: 'ASC' } });
    return Promise.all(slots.map((s) => this.enrichSlotWithProducts(s)));
  }

  private async enrichSlotWithProducts(slot: HappyHourSlotEntity | null) {
    if (!slot) return null;
    const rewardList = slot.rewards ?? [];

    // Batch query: ดึงสินค้าทั้งหมดใน 1 query แทนที่จะ query ทีละ reward (N+1)
    const productMap = new Map<
      string,
      { pro_name: string; pro_imgmain: string }
    >();
    if (rewardList.length) {
      const codes = rewardList.map((r) => r.pro_code);
      const products = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.pro_code', 'p.pro_name', 'p.pro_imgmain'])
        .where('p.pro_code IN (:...codes)', { codes })
        .getMany();
      products.forEach((p) => productMap.set(p.pro_code, p));
    }

    const rewards = rewardList.map((r) => ({
      id: r.id,
      pro_code: r.pro_code,
      unit: r.unit ?? null,
      amount: r.amount ?? 1,
      pro_name: productMap.get(r.pro_code)?.pro_name ?? null,
      pro_imgmain: productMap.get(r.pro_code)?.pro_imgmain ?? null,
    }));

    const min_order_products = (slot.minOrderProducts ?? []).map((p) => ({
      id: p.id,
      pro_code: p.pro_code,
      pro_name: p.pro_name,
    }));

    let min_order_vendor_name: string | null = null;
    if (slot.min_order_vendor_code) {
      const creditor = await this.creditorRepo.findOne({
        where: { creditor_code: slot.min_order_vendor_code },
        select: { creditor_name: true },
      });
      min_order_vendor_name = creditor?.creditor_name ?? null;
    }

    return { ...slot, rewards, min_order_products, min_order_vendor_name };
  }

  async createSlot(dto: CreateSlotDto, performedBy: string) {
    this.validateTimeRange(dto.start_time, dto.end_time);
    await this.validateNoOverlap(dto.start_time, dto.end_time);

    const rewardCodes = dto.reward_pro_codes ?? [];
    const hasCardValue = dto.card_value !== undefined && dto.card_value > 0;

    if (hasCardValue && rewardCodes.length > 0) {
      throw new BadRequestException(
        'ไม่สามารถตั้งค่า card_value และ reward_pro_codes พร้อมกันได้',
      );
    }

    const minOrderScope = dto.min_order_scope ?? 'all';

    const slot = await this.slotRepo.save(
      this.slotRepo.create({
        start_time: dto.start_time,
        end_time: dto.end_time,
        min_order_amount: dto.min_order_amount,
        card_value: rewardCodes.length > 0 ? 0 : (dto.card_value ?? 0),
        excess_threshold: dto.excess_threshold ?? 0,
        discount_per_step: dto.discount_per_step ?? 0,
        is_active: dto.is_active ?? true,
        reward_amount: hasCardValue ? 1 : (dto.reward_amount ?? 1),
        reward_type: dto.reward_type ?? 'card',
        reward_value: dto.reward_value ?? 0,
        min_order_scope: minOrderScope,
        min_order_vendor_code:
          minOrderScope === 'vendor'
            ? (dto.min_order_vendor_code ?? null)
            : null,
      }),
    );

    if (rewardCodes.length) {
      await Promise.all(
        rewardCodes.map(async (code, i) => {
          const unit = await this.findSmallestUnit(code);
          const amount = dto.reward_amounts?.[i] ?? dto.reward_amount ?? 1;
          return this.rewardRepo.save(
            this.rewardRepo.create({
              pro_code: code,
              unit,
              amount,
              slot: { id: slot.id },
            }),
          );
        }),
      );
    }

    if (minOrderScope === 'specific' && dto.min_order_pro_codes?.length) {
      await this.syncMinOrderProducts(slot.id, dto.min_order_pro_codes);
    }

    const saved = await this.slotRepo.findOne({ where: { id: slot.id } });

    void this.saveSlotLog({
      action: 'CREATE',
      slot_id: slot.id,
      performed_by: performedBy,
      changes: dto,
    });

    return this.enrichSlotWithProducts(saved);
  }

  async updateSlot(id: number, dto: UpdateSlotDto, performedBy: string) {
    const slot = await this.slotRepo.findOneBy({ id });
    if (!slot) {
      throw new NotFoundException(`ไม่พบ slot id ${id}`);
    }

    const newStart = dto.start_time ?? slot.start_time.substring(0, 5);
    const newEnd = dto.end_time ?? slot.end_time.substring(0, 5);
    this.validateTimeRange(newStart, newEnd);
    await this.validateNoOverlap(newStart, newEnd, id);

    const {
      reward_pro_codes: codes,
      min_order_pro_codes: minCodes,
      ...slotData
    } = dto;

    if (dto.card_value !== undefined) {
      // card mode: ล้าง rewards ออก + reset reward_amount
      Object.assign(slot, slotData, { reward_amount: 1 });
      await this.slotRepo.save(slot);
      await this.rewardRepo.delete({ slot: { id } });
    } else if (codes !== undefined || dto.reward_amount !== undefined) {
      // reward mode: ล้าง card_value
      Object.assign(slot, slotData, { card_value: 0 });
      await this.slotRepo.save(slot);
      if (codes !== undefined) {
        await this.rewardRepo.delete({ slot: { id } });
        if (codes.length) {
          await Promise.all(
            codes.map(async (code, i) => {
              const unit = await this.findSmallestUnit(code);
              const amount = dto.reward_amounts?.[i] ?? dto.reward_amount ?? 1;
              return this.rewardRepo.save(
                this.rewardRepo.create({ pro_code: code, unit, amount, slot: { id } }),
              );
            }),
          );
        }
      }
    } else {
      Object.assign(slot, slotData);
      await this.slotRepo.save(slot);
    }

    // sync min_order_products และ vendor_code ตาม scope
    const newScope = dto.min_order_scope ?? slot.min_order_scope;
    if (minCodes !== undefined) {
      await this.syncMinOrderProducts(
        id,
        newScope === 'specific' ? minCodes : [],
      );
    } else if (dto.min_order_scope && dto.min_order_scope !== 'specific') {
      await this.minProductRepo.delete({ slot: { id } });
    }

    // sync vendor_code
    if (
      dto.min_order_vendor_code !== undefined ||
      (dto.min_order_scope && dto.min_order_scope !== 'vendor')
    ) {
      const vendorCode =
        newScope === 'vendor'
          ? (dto.min_order_vendor_code ?? slot.min_order_vendor_code)
          : null;
      await this.slotRepo.update(id, { min_order_vendor_code: vendorCode });
    }

    void this.saveSlotLog({
      action: 'UPDATE',
      slot_id: id,
      performed_by: performedBy,
      changes: dto,
    });

    const updated = await this.slotRepo.findOne({ where: { id } });
    return this.enrichSlotWithProducts(updated);
  }

  async deleteSlot(id: number, performedBy: string): Promise<void> {
    const slot = await this.slotRepo.findOneBy({ id });
    if (!slot) {
      throw new NotFoundException(`ไม่พบ slot id ${id}`);
    }
    await this.slotRepo.delete(id);

    void this.saveSlotLog({
      action: 'DELETE',
      slot_id: id,
      performed_by: performedBy,
      changes: null,
    });
  }

  async calcHappyHourReward(
    orderAmount: number,
    orderItems?: { pro_code: string; amount: number; vendor_code?: string }[],
  ): Promise<{
    slot: HappyHourSlotEntity;
    numCards: number;
    excessDiscount: number;
    totalCardValue: number;
    totalReward: number;
  } | null> {
    try {
      const config = await this.getConfig();
      if (!config.is_enabled) return null;

      const now = dayjs().tz('Asia/Bangkok');
      const today = now.format('YYYY-MM-DD');

      if (config.start_date && today < config.start_date) return null;
      if (config.end_date && today > config.end_date) return null;

      const orderTimeSql = now.format('HH:mm:00');

      const slot = await this.slotRepo
        .createQueryBuilder('slot')
        .leftJoinAndSelect('slot.rewards', 'reward')
        .leftJoinAndSelect('slot.minOrderProducts', 'minProduct')
        .where('slot.is_active = true')
        .andWhere(
          '(slot.start_time < slot.end_time AND slot.start_time <= :t AND slot.end_time > :t)' +
          ' OR (slot.start_time > slot.end_time AND (slot.start_time <= :t OR slot.end_time > :t))',
          { t: orderTimeSql },
        )
        .getOne();

      if (!slot) return null;

      // คำนวณ qualifying_amount ตาม min_order_scope
      let qualifyingAmount = orderAmount;
      if (orderItems?.length) {
        if (slot.min_order_scope === 'specific') {
          const allowedCodes = new Set(
            (slot.minOrderProducts ?? []).map((p) => p.pro_code),
          );
          if (allowedCodes.size > 0) {
            qualifyingAmount = orderItems
              .filter((item) => allowedCodes.has(item.pro_code))
              .reduce((sum, item) => sum + item.amount, 0);
          }
        } else if (slot.min_order_scope === 'vendor' && slot.min_order_vendor_code) {
          qualifyingAmount = orderItems
            .filter((item) => item.vendor_code === slot.min_order_vendor_code)
            .reduce((sum, item) => sum + item.amount, 0);
        }
      }

      const minOrder = Number(slot.min_order_amount);
      const numCards = Math.floor(qualifyingAmount / minOrder);

      this.logger.log('calcHappyHourReward', {
        slotId: slot.id,
        scope: slot.min_order_scope,
        orderAmount,
        qualifyingAmount,
        minOrder,
        numCards,
      });

      if (numCards === 0) return null;

      const excess = qualifyingAmount - numCards * minOrder;
      const excessSteps = Math.floor(excess / Number(slot.excess_threshold));
      const excessDiscount = excessSteps * Number(slot.discount_per_step);

      const totalCardValue = numCards * Number(slot.card_value);
      return {
        slot,
        numCards,
        excessDiscount,
        totalCardValue,
        totalReward: totalCardValue + excessDiscount,
      };
    } catch (error) {
      // log error แล้ว return null เพื่อไม่ให้กระทบ flow การสั่งซื้อ
      this.logger.error('Error calculating happy hour reward:', error);
      return null;
    }
  }

  async simulate(dto: SimulateDto) {
    const { order_amount, order_time, order_items } = dto;

    // แปลง "HH:mm" → "HH:mm:ss" สำหรับ MySQL TIME comparison
    const orderTimeSql = `${order_time}:00`;

    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.rewards', 'reward')
      .leftJoinAndSelect('slot.minOrderProducts', 'minProduct')
      .where('slot.is_active = true')
      .andWhere(
        '(slot.start_time < slot.end_time AND slot.start_time <= :t AND slot.end_time > :t)' +
        ' OR (slot.start_time > slot.end_time AND (slot.start_time <= :t OR slot.end_time > :t))',
        { t: orderTimeSql },
      )
      .getOne();

    if (!slot) {
      return { is_happy_hour: false, matched_slot: null };
    }

    // คำนวณ qualifying_amount ตาม min_order_scope
    let qualifying_amount = order_amount;
    if (slot.min_order_scope === 'specific' && order_items?.length) {
      const allowedCodes = new Set(
        (slot.minOrderProducts ?? []).map((p) => p.pro_code),
      );
      qualifying_amount = order_items
        .filter((item) => allowedCodes.has(item.pro_code))
        .reduce((sum, item) => sum + item.amount, 0);
    } else if (
      slot.min_order_scope === 'vendor' &&
      slot.min_order_vendor_code &&
      order_items?.length
    ) {
      qualifying_amount = order_items
        .filter((item) => item.vendor_code === slot.min_order_vendor_code)
        .reduce((sum, item) => sum + item.amount, 0);
    }

    const num_cards = Math.floor(
      qualifying_amount / Number(slot.min_order_amount),
    );
    if (num_cards === 0) {
      return { is_happy_hour: false, matched_slot: null };
    }

    const excess =
      qualifying_amount - num_cards * Number(slot.min_order_amount);
    const excess_steps = Math.floor(excess / Number(slot.excess_threshold));
    const excess_discount = excess_steps * Number(slot.discount_per_step);
    const total_reward = num_cards * Number(slot.card_value) + excess_discount;

    // Batch query สินค้า (reuse pattern จาก enrichSlotWithProducts — ไม่ N+1)
    const rewardList = slot.rewards ?? [];
    const productMap = new Map<
      string,
      { pro_code: string; pro_name: string; pro_imgmain: string }
    >();

    if (rewardList.length) {
      const codes = rewardList.map((r) => r.pro_code);
      const products = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.pro_code', 'p.pro_name', 'p.pro_imgmain'])
        .where('p.pro_code IN (:...codes)', { codes })
        .getMany();
      products.forEach((p) => productMap.set(p.pro_code, p));
    }

    const reward_products = rewardList.map((r) => {
      const product = productMap.get(r.pro_code);
      return {
        pro_code: r.pro_code,
        unit: r.unit ?? null,
        amount: num_cards * (r.amount ?? slot.reward_amount),
        pro_name: product?.pro_name ?? null,
        pro_imgmain: product?.pro_imgmain ?? null,
      };
    });

    const min_order_products = (slot.minOrderProducts ?? []).map((p) => ({
      id: p.id,
      pro_code: p.pro_code,
      pro_name: p.pro_name,
    }));

    let min_order_vendor_name: string | null = null;
    if (slot.min_order_vendor_code) {
      const creditor = await this.creditorRepo.findOne({
        where: { creditor_code: slot.min_order_vendor_code },
        select: { creditor_name: true },
      });
      min_order_vendor_name = creditor?.creditor_name ?? null;
    }

    return {
      is_happy_hour: true,
      matched_slot: slot,
      num_cards,
      qualifying_amount,
      excess_discount,
      total_reward,
      reward_value: Number(slot.reward_value),
      reward_products,
      min_order_products,
      min_order_vendor_code: slot.min_order_vendor_code,
      min_order_vendor_name,
    };
  }

  async getVendorProducts(
    vendorCode: string,
  ): Promise<{ pro_code: string; pro_name: string }[]> {
    const products = await this.productRepo
      .createQueryBuilder('p')
      .select(['p.pro_code', 'p.pro_name'])
      .innerJoin('p.creditor', 'c')
      .where('c.creditor_code = :vendorCode', { vendorCode })
      .andWhere('p.pro_name IS NOT NULL')
      .orderBy('p.pro_code', 'ASC')
      .getMany();

    return products.map((p) => ({
      pro_code: p.pro_code,
      pro_name: p.pro_name,
    }));
  }

  async getCartPreview(dto: {
    order_amount: number;
    cart_items?: { pro_code: string; amount: number }[];
  }): Promise<{
    is_happy_hour: boolean;
    num_cards?: number;
    qualifying_amount?: number;
    excess_discount?: number;
    total_reward?: number;
    reward_items?: {
      pro_code: string;
      pro_name: string | null;
      pro_imgmain: string | null;
      unit: string | null;
      amount: number;
    }[];
  }> {
    const config = await this.getConfig();
    if (!config.is_enabled) return { is_happy_hour: false };

    const now = dayjs().tz('Asia/Bangkok');
    const today = now.format('YYYY-MM-DD');
    if (config.start_date && today < config.start_date) return { is_happy_hour: false };
    if (config.end_date && today > config.end_date) return { is_happy_hour: false };

    const t = now.format('HH:mm:00');
    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.rewards', 'reward')
      .leftJoinAndSelect('slot.minOrderProducts', 'minProduct')
      .where('slot.is_active = true')
      .andWhere(
        '(slot.start_time < slot.end_time AND slot.start_time <= :t AND slot.end_time > :t)' +
        ' OR (slot.start_time > slot.end_time AND (slot.start_time <= :t OR slot.end_time > :t))',
        { t },
      )
      .getOne();

    if (!slot) return { is_happy_hour: false };

    // ── Qualifying amount with scope filtering ──
    let qualifyingAmount = dto.order_amount;
    const items = dto.cart_items ?? [];

    if (items.length > 0) {
      if (slot.min_order_scope === 'specific') {
        const allowed = new Set((slot.minOrderProducts ?? []).map((p) => p.pro_code));
        if (allowed.size > 0) {
          qualifyingAmount = items
            .filter((i) => allowed.has(i.pro_code))
            .reduce((s, i) => s + i.amount, 0);
        }
      } else if (slot.min_order_scope === 'vendor' && slot.min_order_vendor_code) {
        const proCodes = items.map((i) => i.pro_code);
        const vendorProds = await this.productRepo
          .createQueryBuilder('p')
          .select('p.pro_code')
          .innerJoin('p.creditor', 'c', 'c.creditor_code = :vc', {
            vc: slot.min_order_vendor_code,
          })
          .where('p.pro_code IN (:...codes)', { codes: proCodes })
          .getMany();
        const vendorSet = new Set(vendorProds.map((p) => p.pro_code));
        qualifyingAmount = items
          .filter((i) => vendorSet.has(i.pro_code))
          .reduce((s, i) => s + i.amount, 0);
      }
    }

    const minOrder = Number(slot.min_order_amount);
    const num_cards = Math.floor(qualifyingAmount / minOrder);
    if (num_cards === 0) return { is_happy_hour: false };

    const excess = qualifyingAmount - num_cards * minOrder;
    const excess_discount =
      Math.floor(excess / Number(slot.excess_threshold)) * Number(slot.discount_per_step);
    const total_reward = num_cards * Number(slot.card_value) + excess_discount;

    // ── Reward items ──
    const rewardList = slot.rewards ?? [];
    const productMap = new Map<string, { pro_name: string; pro_imgmain: string }>();
    if (rewardList.length) {
      const codes = rewardList.map((r) => r.pro_code);
      const products = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.pro_code', 'p.pro_name', 'p.pro_imgmain'])
        .where('p.pro_code IN (:...codes)', { codes })
        .getMany();
      products.forEach((p) => productMap.set(p.pro_code, p));
    }

    const reward_items = rewardList.map((r) => ({
      pro_code: r.pro_code,
      pro_name: productMap.get(r.pro_code)?.pro_name ?? null,
      pro_imgmain: productMap.get(r.pro_code)?.pro_imgmain ?? null,
      unit: r.unit ?? null,
      amount: num_cards * (r.amount ?? 1),
    }));

    return { is_happy_hour: true, num_cards, qualifying_amount: qualifyingAmount, excess_discount, total_reward, reward_items };
  }

  async searchVendors(keyword: string) {
    const creditors = await this.creditorRepo
      .createQueryBuilder('c')
      .select(['c.creditor_code', 'c.creditor_name'])
      .where('c.creditor_code LIKE :kw OR c.creditor_name LIKE :kw', {
        kw: `%${keyword}%`,
      })
      .orderBy('c.creditor_code', 'ASC')
      .take(20)
      .getMany();

    return creditors.map((c) => ({
      vendor_code: c.creditor_code,
      vendor_name: c.creditor_name,
    }));
  }

  // ─── Slot Activity Log ────────────────────────────────────────────

  /** บันทึก audit log ของการ CRUD slot (fire-and-forget, ไม่ throw) */
  async saveSlotLog(data: {
    action: SlotLogAction;
    slot_id: number;
    performed_by: string;
    changes?: object | null;
  }): Promise<void> {
    try {
      await this.slotLogRepo.save(
        this.slotLogRepo.create({
          action: data.action,
          slot_id: data.slot_id,
          performed_by: data.performed_by,
          changes: data.changes ? JSON.stringify(data.changes) : null,
        }),
      );
    } catch (error) {
      this.logger.error('Failed to save slot log', error);
    }
  }

  /** ดึง slot activity log พร้อม pagination และ filter */
  async getSlotLogs(query: SlotLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.slotLogRepo
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.slot_id) {
      qb.andWhere('log.slot_id = :slot_id', { slot_id: query.slot_id });
    }
    if (query.performed_by) {
      qb.andWhere('log.performed_by LIKE :by', {
        by: `%${query.performed_by}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return buildPagination(data, total, page, limit);
  }

  // ─── Config Activity Log ───────────────────────────────────────────

  /** บันทึก audit log ของการเปลี่ยน config (fire-and-forget, ไม่ throw) */
  async saveConfigLog(data: {
    action: ConfigLogAction;
    performed_by: string;
    before?: object;
    after?: object;
  }): Promise<void> {
    try {
      await this.configLogRepo.save(
        this.configLogRepo.create({
          action: data.action,
          performed_by: data.performed_by,
          changes:
            data.before || data.after
              ? JSON.stringify({ before: data.before, after: data.after })
              : null,
        }),
      );
    } catch (error) {
      this.logger.error('Failed to save config log', error);
    }
  }

  /** ดึง config activity log พร้อม pagination และ filter */
  async getConfigLogs(query: ConfigLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.configLogRepo
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.performed_by) {
      qb.andWhere('log.performed_by LIKE :by', {
        by: `%${query.performed_by}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return buildPagination(data, total, page, limit);
  }

  async getLotusCards(): Promise<{ pro_code: string; pro_name: string }[]> {
    return this.productRepo
      .createQueryBuilder('p')
      .select(['p.pro_code', 'p.pro_name'])
      .where('p.pro_name LIKE :keyword', { keyword: '%โลตัส%' })
      .orderBy('p.pro_code', 'ASC')
      .getMany();
  }

  /** ล้าง min_order_products เดิมและแทนที่ด้วย list ใหม่ (batch upsert) */
  private async syncMinOrderProducts(
    slotId: number,
    proCodes: string[],
  ): Promise<void> {
    await this.minProductRepo.delete({ slot: { id: slotId } });
    if (!proCodes.length) return;

    const productMap = new Map<string, string | null>();
    if (proCodes.length) {
      const products = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.pro_code', 'p.pro_name'])
        .where('p.pro_code IN (:...codes)', { codes: proCodes })
        .getMany();
      products.forEach((p) => productMap.set(p.pro_code, p.pro_name));
    }

    await this.minProductRepo.save(
      proCodes.map((code) =>
        this.minProductRepo.create({
          pro_code: code,
          pro_name: productMap.get(code) ?? null,
          slot: { id: slotId },
        }),
      ),
    );
  }

  async getProductUnits(
    proCodes: string[],
  ): Promise<{ pro_code: string; unit: string | null }[]> {
    if (!proCodes.length) return [];
    const units = await this.productUnitRepo
      .createQueryBuilder('u')
      .select(['u.pro_code', 'u.unit_name'])
      .where('u.pro_code IN (:...codes)', { codes: proCodes })
      .andWhere('u.level = 1')
      .getMany();
    const map = new Map(units.map((u) => [u.pro_code, u.unit_name]));
    return proCodes.map((c) => ({ pro_code: c, unit: map.get(c) ?? null }));
  }

  private async findSmallestUnit(proCode: string): Promise<string | null> {
    const product = await this.productUnitRepo.findOne({
      where: { pro_code: proCode, level: 1 },
      select: { unit_name: true, level: true },
      order: { level: 'ASC' },
    });

    if (!product) return null;

    return product.unit_name;
  }

  private validateTimeRange(start: string, end: string): void {
    if (start === end) {
      throw new BadRequestException('เวลาเริ่มต้นและสิ้นสุดต้องไม่เท่ากัน');
    }
    // start > end = ข้ามคืน (cross-midnight) — อนุญาต
  }

  /** เช็ค overlap บน 24h clock รองรับ cross-midnight (end_time < start_time) */
  private timeSlotsOverlap(
    a: { start_time: string; end_time: string },
    b: { start_time: string; end_time: string },
  ): boolean {
    const norm = (t: string) => t.substring(0, 5); // "HH:mm:ss" → "HH:mm"
    const aS = norm(a.start_time), aE = norm(a.end_time);
    const bS = norm(b.start_time), bE = norm(b.end_time);
    const aWraps = aE < aS;
    const bWraps = bE < bS;
    if (!aWraps && !bWraps) return aS < bE && bS < aE;
    if (aWraps && bWraps) return true; // ทั้งคู่ข้ามคืน → ซ้อนกันที่ช่วงกลางคืนเสมอ
    const [wS, wE, nS, nE] = aWraps ? [aS, aE, bS, bE] : [bS, bE, aS, aE];
    return nE > wS || nS < wE;
  }

  private async validateNoOverlap(
    start: string,
    end: string,
    excludeId?: number,
  ): Promise<void> {
    let qb = this.slotRepo.createQueryBuilder('slot');
    if (excludeId !== undefined) {
      qb = qb.where('slot.id != :excludeId', { excludeId });
    }
    const existing = await qb.getMany();
    const newSlot = { start_time: `${start}:00`, end_time: `${end}:00` };
    const overlap = existing.find((s) => this.timeSlotsOverlap(newSlot, s));
    if (overlap) {
      const s = overlap.start_time.substring(0, 5);
      const e = overlap.end_time.substring(0, 5);
      throw new BadRequestException(`ช่วงเวลานี้ทับซ้อนกับ slot ${s}–${e}`);
    }
  }
}

// ─── Pagination helper ─────────────────────────────────────────────────────

function buildPagination<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  const total_pages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      total_pages,
      has_prev: page > 1,
      has_next: page < total_pages,
    },
  };
}
