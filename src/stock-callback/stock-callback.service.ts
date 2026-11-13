import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { ProductEntity } from '../products/products.entity';
import {
  HIDDEN_PRODUCT_MESSAGE,
  isHiddenProduct,
} from '../products/product-visibility.util';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import {
  CART_STOCK_LIMIT_FLAG,
  cartRowsSmallestUnits,
  unitRatio,
} from '../shopping-cart/cart-stock-limit';
import {
  StockCallbackRequestEntity,
  StockCallbackStatus,
} from './stock-callback.entity';

/** กดซ้ำภายในช่วงนี้ไม่นับเป็นคำขอใหม่ (กันกดรัว) */
const REPEAT_WINDOW_MS = 60_000;

export interface StockCallbackListRow {
  id: number;
  status: StockCallbackStatus;
  mem_code: string;
  mem_name: string | null;
  mem_phone: string | null;
  mem_route: string | null;
  owner_emp_code: string | null;
  owner_emp_name: string | null;
  pro_code: string;
  pro_name: string | null;
  unit_name: string | null;
  smallest_unit_name: string | null;
  requested_amount: number;
  requested_smallest: number;
  stock_smallest: number;
  stock_now: number | null;
  request_count: number;
  channel: string | null;
  note: string | null;
  handled_by_emp: string | null;
  handled_by_name: string | null;
  handled_at: Date | null;
  created_at: Date;
  last_requested_at: Date;
}

@Injectable()
export class StockCallbackService {
  private readonly logger = new Logger(StockCallbackService.name);

  constructor(
    @InjectRepository(StockCallbackRequestEntity)
    private readonly repo: Repository<StockCallbackRequestEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ShoppingCartEntity)
    private readonly cartRepo: Repository<ShoppingCartEntity>,
    private readonly featureFlags: FeatureFlagsService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /// ลูกค้ากด "แจ้งฝ่ายขายให้ติดต่อกลับ" — ร้าน+สินค้าที่ยังเปิดอยู่รวมเป็นแถวเดียว
  async request(
    memCode: string,
    input: { pro_code: string; pro_unit: string | null; amount: number },
    channel: string | null,
  ): Promise<{ id: number; status: StockCallbackStatus; repeated: boolean }> {
    if (!(await this.featureFlags.getFlag(CART_STOCK_LIMIT_FLAG))) {
      throw new NotFoundException('ยังไม่เปิดใช้งาน');
    }
    const product = await this.productRepo.findOne({
      where: { pro_code: input.pro_code },
      relations: ['units'],
    });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    if (isHiddenProduct(product)) {
      throw new NotFoundException(HIDDEN_PRODUCT_MESSAGE);
    }
    const units = product.units ?? [];
    const unit = input.pro_unit
      ? units.find((u) => u.unit_name === input.pro_unit)
      : undefined;
    if (input.pro_unit && !unit) {
      throw new BadRequestException(
        `หน่วย '${input.pro_unit}' ไม่ถูกต้องสำหรับสินค้า '${input.pro_code}'`,
      );
    }
    const rows = await this.cartRepo.find({
      where: {
        mem_code: memCode,
        pro_code: product.pro_code,
        hotdeal_free: false,
        is_reward: false,
      },
      select: ['spc_id', 'spc_amount', 'spc_unit_enum'],
    });
    const requestedSmallest = Math.round(
      cartRowsSmallestUnits(rows, units) +
        input.amount * unitRatio(units, unit?.level ?? 1),
    );
    const stock = Math.max(Number(product.pro_stock ?? 0) || 0, 0);
    const now = new Date();

    const open = await this.repo.findOne({
      where: { mem_code: memCode, pro_code: product.pro_code, status: 'open' },
      order: { id: 'DESC' },
    });
    if (open) {
      const repeated =
        now.getTime() - new Date(open.last_requested_at).getTime() <
        REPEAT_WINDOW_MS;
      await this.repo.update(
        { id: open.id },
        {
          unit_name: unit?.unit_name ?? open.unit_name,
          requested_amount: input.amount,
          requested_smallest: requestedSmallest,
          stock_smallest: stock,
          channel: channel ?? open.channel,
          last_requested_at: now,
          request_count: repeated ? open.request_count : open.request_count + 1,
        },
      );
      return { id: open.id, status: 'open', repeated };
    }
    const saved = await this.repo.save(
      this.repo.create({
        mem_code: memCode,
        pro_code: product.pro_code,
        unit_name: unit?.unit_name ?? null,
        requested_amount: input.amount,
        requested_smallest: requestedSmallest,
        stock_smallest: stock,
        request_count: 1,
        status: 'open',
        channel,
        last_requested_at: now,
      }),
    );
    this.logger.log(
      `stock callback #${saved.id} ${memCode} ${product.pro_code} want=${requestedSmallest} stock=${stock}`,
    );
    return { id: saved.id, status: 'open', repeated: false };
  }

  /// ระบบขาย: รายการคำขอ (ทุกเซลส์เห็นทั้งหมด) ที่ยังเปิดอยู่ก่อน แล้วใหม่สุดก่อน
  async list(filter: {
    status: StockCallbackStatus | null;
    q: string | null;
    page: number;
    limit: number;
  }): Promise<{
    items: StockCallbackListRow[];
    total: number;
    page: number;
    limit: number;
    counts: Record<StockCallbackStatus, number>;
  }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.status) {
      where.push('r.status = ?');
      params.push(filter.status);
    }
    if (filter.q) {
      const like = `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push(
        '(r.mem_code LIKE ? OR r.pro_code LIKE ? OR u.mem_nameSite LIKE ? OR p.pro_name LIKE ? OR p.pro_nameTH LIKE ?)',
      );
      params.push(like, like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `
      FROM stock_callback_request r
      LEFT JOIN users u ON u.mem_code = r.mem_code
      LEFT JOIN employee e ON e.emp_code = u.emp_id_ref
      LEFT JOIN product p ON p.pro_code = r.pro_code
      ${whereSql}`;
    const totalRows: Array<{ total: string | number }> = await this.db.query(
      `SELECT COUNT(*) AS total ${from}`,
      params,
    );
    const items: StockCallbackListRow[] = await this.db.query(
      `SELECT r.id, r.status, r.mem_code,
              u.mem_nameSite AS mem_name, u.mem_phone, u.mem_route,
              u.emp_id_ref AS owner_emp_code,
              NULLIF(TRIM(CONCAT_WS(' ', e.emp_firstname, e.emp_lastname,
                IF(e.emp_nickname IS NULL OR e.emp_nickname = '', NULL, CONCAT('(', e.emp_nickname, ')')))), '') AS owner_emp_name,
              r.pro_code, COALESCE(NULLIF(p.pro_nameTH, ''), p.pro_name) AS pro_name,
              r.unit_name,
              (SELECT pu.unit_name FROM product_unit pu WHERE pu.pro_code = r.pro_code ORDER BY pu.level ASC LIMIT 1) AS smallest_unit_name,
              r.requested_amount, r.requested_smallest, r.stock_smallest,
              p.pro_stock AS stock_now, r.request_count, r.channel, r.note,
              r.handled_by_emp, r.handled_by_name, r.handled_at,
              r.created_at, r.last_requested_at
       ${from}
       ORDER BY (r.status = 'open') DESC, r.last_requested_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...params, filter.limit, (filter.page - 1) * filter.limit],
    );
    const countRows: Array<{ status: string; n: string | number }> =
      await this.db.query(
        'SELECT status, COUNT(*) AS n FROM stock_callback_request GROUP BY status',
      );
    const counts: Record<StockCallbackStatus, number> = {
      open: 0,
      contacted: 0,
      closed: 0,
    };
    for (const row of countRows) {
      if (row.status in counts) {
        counts[row.status as StockCallbackStatus] = Number(row.n);
      }
    }
    return {
      items: items.map((r) => ({
        ...r,
        id: Number(r.id),
        requested_amount: Number(r.requested_amount),
        requested_smallest: Number(r.requested_smallest),
        stock_smallest: Number(r.stock_smallest),
        stock_now: r.stock_now === null ? null : Number(r.stock_now),
        request_count: Number(r.request_count),
      })),
      total: Number(totalRows[0]?.total ?? 0),
      page: filter.page,
      limit: filter.limit,
      counts,
    };
  }

  /// ระบบขาย: เปลี่ยนสถานะ (ติดต่อแล้ว / ปิด / เปิดใหม่) + บันทึกผู้ดำเนินการ
  async updateStatus(
    id: number,
    input: {
      status: StockCallbackStatus;
      note: string | null;
      emp_code: string;
      emp_name: string | null;
    },
  ): Promise<StockCallbackRequestEntity> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('ไม่พบคำขอ');
    if (input.status === 'open' && row.status !== 'open') {
      const other = await this.repo.findOne({
        where: {
          mem_code: row.mem_code,
          pro_code: row.pro_code,
          status: 'open',
        },
      });
      if (other) {
        throw new BadRequestException(
          `ร้านนี้มีคำขอสินค้านี้ที่เปิดอยู่แล้ว (#${other.id})`,
        );
      }
    }
    const reopen = input.status === 'open';
    await this.repo.update(
      { id },
      {
        status: input.status,
        note: input.note ?? row.note,
        handled_by_emp: reopen ? null : input.emp_code,
        handled_by_name: reopen ? null : input.emp_name,
        handled_at: reopen ? null : new Date(),
      },
    );
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('ไม่พบคำขอ');
    return updated;
  }
}
