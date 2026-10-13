import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Not,
  IsNull,
  Repository,
} from 'typeorm';
import { ProductEntity } from '../products/products.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  StickerPrintLogEntity,
  type StickerPrintType,
} from './sticker-print-log.entity';
import {
  DOTS_PER_SHEET,
  STICKER_FEATURE_FLAG,
  STICKER_MAX_LENGTH,
  STICKER_PACKS,
  STICKER_PRO_CODE,
  STICKER_PRO_CODES,
  enabledStickerLangs,
  normalizeStickerOptions,
  packToCartUnit,
  parseStickerJson,
  type StickerCustomOptions,
  type StickerOrderSnapshot,
  type StickerPackSize,
  type StickerPrintMode,
} from './sticker-label.options';
import { buildStickerSheetHtml } from './sticker-label.pdf';
import { StickerPdfRendererService } from './sticker-pdf-renderer.service';

export interface StickerActor {
  mem_code: string;
  username: string;
  price_option?: string;
  mem_route?: string;
}

export interface StickerPrinter {
  id: string;
  name: string;
  /** false = เครื่องขาวดำ พิมพ์งานสีไม่ได้ */
  color: boolean;
}

export type StickerQueueStatus = 'pending' | 'printed' | 'all';

const PRINT_TYPES: StickerPrintType[] = ['print', 'reprint', 'test'];

/** กัน PDF ใหญ่จน server ค้าง — 50 แผ่น × 20 งาน */
const MAX_PDF_PAGES = 1000;

export interface PrintRequestBody {
  order_line_ids: unknown;
  print_type: unknown;
  printer: unknown;
}

/** จำนวนเต็มบวก — ใช้กับ packs / id ที่มาจาก client (C-001) */
function positiveInt(value: unknown, field: string, allowZero = false): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) {
    throw new BadRequestException(
      `${field} ต้องเป็นจำนวนเต็ม${allowZero ? 'ตั้งแต่ 0' : 'บวก'}`,
    );
  }
  return n;
}

@Injectable()
export class StickerLabelService {
  private readonly logger = new Logger(StickerLabelService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ShoppingCartEntity)
    private readonly cartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(ShoppingOrderEntity)
    private readonly orderRepo: Repository<ShoppingOrderEntity>,
    @InjectRepository(StickerPrintLogEntity)
    private readonly logRepo: Repository<StickerPrintLogEntity>,
    private readonly shoppingCartService: ShoppingCartService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly dataSource: DataSource,
    private readonly pdfRenderer: StickerPdfRendererService,
  ) {}

  async assertEnabled() {
    const enabled = await this.featureFlags.getFlag(STICKER_FEATURE_FLAG);
    if (!enabled) {
      throw new ForbiddenException('ฟีเจอร์สติ๊กเกอร์ฉลากยายังไม่เปิดใช้งาน');
    }
  }

  private priceOf(product: ProductEntity, priceOption?: string): number {
    const value =
      priceOption === 'A'
        ? product.pro_priceA
        : priceOption === 'B'
          ? product.pro_priceB
          : product.pro_priceC;
    return Number(value) || 0;
  }

  // ---------------------------------------------------------------------------
  // ECWC-698 ตัวเลือกสินค้า
  // ---------------------------------------------------------------------------

  /** ตัวเลือกทั้งหมดของหน้าสินค้า — ราคา/การมีสินค้าอ่านจาก product ที่ sync มาจาก ERP */
  async getConfig(actor: StickerActor) {
    const products = await this.productRepo.find({
      where: { pro_code: In(STICKER_PRO_CODES) },
      relations: ['units'],
    });
    const byCode = new Map(products.map((p) => [p.pro_code, p]));

    const printModes = (
      Object.keys(STICKER_PRO_CODE) as StickerPrintMode[]
    ).map((mode) => {
      const pro_code = STICKER_PRO_CODE[mode];
      const product = byCode.get(pro_code);
      // pro_price* เป็นราคาต่อหน่วยเล็กสุด (ดวง) — ตรงกับวิธีคิดใน submitOrder
      const pricePerDot = product
        ? this.priceOf(product, actor.price_option)
        : 0;
      return {
        mode,
        pro_code,
        pro_name: product?.pro_name ?? null,
        pro_imgmain: product?.pro_imgmain ?? null,
        available: !!product && pricePerDot > 0,
        price_per_dot: pricePerDot,
        packs: (Object.keys(STICKER_PACKS) as StickerPackSize[]).map(
          (packSize) => ({
            packSize,
            ...STICKER_PACKS[packSize],
            price:
              Math.round(pricePerDot * STICKER_PACKS[packSize].dots * 100) /
              100,
          }),
        ),
      };
    });

    return {
      printModes,
      langs: enabledStickerLangs(),
      maxLength: STICKER_MAX_LENGTH,
      dotsPerSheet: DOTS_PER_SHEET,
    };
  }

  // ---------------------------------------------------------------------------
  // ECWC-699 ตะกร้า
  // ---------------------------------------------------------------------------

  private async cartResponse(
    mem_code: string,
    mutation: { cart: unknown; cartVersion: unknown; cartSyncedAt: unknown },
  ) {
    const summary = await this.shoppingCartService.summaryCart(mem_code);
    return {
      cart: mutation.cart,
      summaryCart: summary.total,
      cartVersion: mutation.cartVersion,
      cartSyncedAt: mutation.cartSyncedAt,
    };
  }

  private async loadStickerProduct(pro_code: string) {
    const product = await this.productRepo.findOne({
      where: { pro_code },
      relations: ['units'],
    });
    if (!product) {
      throw new BadRequestException(
        `ยังไม่มีสินค้า ${pro_code} ในระบบ (ต้องสร้างใน ERP ก่อน)`,
      );
    }
    return product;
  }

  /** หยิบใส่ตะกร้า — backend เลือก pro_code และหน่วยเอง client ส่งแค่รูปแบบ + จำนวนแพ็ค */
  async addToCart(
    actor: StickerActor,
    body: { custom_options: unknown; packs: unknown; clientVersion?: string },
  ) {
    const options = normalizeStickerOptions(body.custom_options);
    const packs = positiveInt(body.packs, 'packs');
    const pro_code = STICKER_PRO_CODE[options.printMode];
    const product = await this.loadStickerProduct(pro_code);
    const unit = packToCartUnit(options.packSize, packs, product.units ?? []);

    const result = await this.shoppingCartService.addProductCart({
      mem_code: actor.mem_code,
      pro_code,
      pro_unit: unit.unit_name,
      amount: unit.amount,
      priceCondition: actor.price_option ?? 'C',
      mem_route: actor.mem_route,
      clientVersion: body.clientVersion,
      customOptions: options,
    });
    return this.cartResponse(actor.mem_code, result);
  }

  /** ตั้งจำนวนแพ็คของแถวสติ๊กเกอร์แถวเดียว (packs = 0 คือลบแถวนี้) — ไม่กระทบรูปแบบอื่นของสินค้าเดียวกัน */
  async updateCartLine(
    actor: StickerActor,
    body: { spc_id: unknown; packs: unknown; clientVersion?: string },
  ) {
    const spc_id = positiveInt(body.spc_id, 'spc_id');
    const packs = positiveInt(body.packs, 'packs', true);
    const row = await this.cartRepo.findOne({
      where: {
        spc_id,
        mem_code: actor.mem_code,
        custom_options_hash: Not(IsNull()),
      },
    });
    const options = parseStickerJson<StickerCustomOptions>(row?.custom_options);
    if (!row || !options) {
      throw new NotFoundException('ไม่พบรายการสติ๊กเกอร์นี้ในตะกร้า');
    }
    const product = await this.loadStickerProduct(row.pro_code);
    const unit = (product.units ?? []).find(
      (u) => String(u.level) === String(row.spc_unit_enum),
    );
    if (!unit) {
      throw new BadRequestException('หน่วยของรายการนี้ไม่ตรงกับสินค้า');
    }
    const target = (packs * STICKER_PACKS[options.packSize].dots) / unit.ratio;
    const delta = target - Number(row.spc_amount);

    // addProductCart รวม/ลบตามแถวรูปแบบเดียวกัน — delta ลบเท่าจำนวนเดิมคือลบแถว
    const result = await this.shoppingCartService.addProductCart({
      mem_code: actor.mem_code,
      pro_code: row.pro_code,
      pro_unit: unit.unit_name,
      amount: delta,
      priceCondition: actor.price_option ?? 'C',
      mem_route: actor.mem_route,
      clientVersion: body.clientVersion,
      customOptions: options,
    });
    return this.cartResponse(actor.mem_code, result);
  }

  /**
   * ECWC-701 รูปแบบสติ๊กเกอร์ของออเดอร์หนึ่ง สำหรับหน้าประวัติคำสั่งซื้อ
   * (รายละเอียดออเดอร์ v2 มาจากระบบคลังซึ่งไม่มี custom_options) — เห็นได้เฉพาะออเดอร์ของร้านตัวเอง
   */
  async getOrderStickers(mem_code: string, soh_running: string) {
    const rows = await this.orderRepo
      .createQueryBuilder('spo')
      .innerJoin('spo.orderHeader', 'soh')
      .where('soh.soh_running = :soh_running', { soh_running })
      .andWhere('soh.mem_code = :mem_code', { mem_code })
      .andWhere('spo.pro_code IN (:...codes)', { codes: STICKER_PRO_CODES })
      .andWhere('spo.custom_options IS NOT NULL')
      .orderBy('spo.spo_id', 'ASC')
      .select([
        'spo.spo_id',
        'spo.pro_code',
        'spo.spo_qty',
        'spo.spo_unit',
        'spo.custom_options',
      ])
      .getMany();
    return rows.map((r) => ({
      spo_id: r.spo_id,
      pro_code: r.pro_code,
      spo_qty: Number(r.spo_qty),
      spo_unit: r.spo_unit,
      custom_options: parseStickerJson<StickerOrderSnapshot>(r.custom_options),
    }));
  }

  /** "ใช้ข้อมูลจากคำสั่งซื้อครั้งก่อน" — รูปแบบล่าสุดที่ร้านนี้เคยสั่ง */
  async getLastOptions(
    mem_code: string,
    pro_code?: string,
  ): Promise<StickerCustomOptions | null> {
    const line = await this.orderRepo
      .createQueryBuilder('spo')
      .innerJoin('spo.orderHeader', 'soh')
      .where('soh.mem_code = :mem_code', { mem_code })
      .andWhere('spo.pro_code IN (:...codes)', {
        codes: pro_code ? [pro_code] : STICKER_PRO_CODES,
      })
      .andWhere('spo.custom_options IS NOT NULL')
      .orderBy('spo.spo_id', 'DESC')
      .select(['spo.spo_id', 'spo.custom_options'])
      .getOne();
    const snapshot = parseStickerJson<StickerOrderSnapshot>(
      line?.custom_options,
    );
    if (!snapshot) return null;
    return {
      shopName: snapshot.shopName,
      address: snapshot.address,
      line3: snapshot.line3,
      lang: snapshot.lang,
      ...(snapshot.lang2 ? { lang2: snapshot.lang2 } : {}),
      printMode: snapshot.printMode,
      color: snapshot.color,
      packSize: snapshot.packSize,
    };
  }

  // ---------------------------------------------------------------------------
  // ECWC-702 คิวพิมพ์ (admin)
  // ---------------------------------------------------------------------------

  /** เครื่องพิมพ์ต่างกันตาม environment จึงเก็บใน env (C-003) */
  getPrinters(): StickerPrinter[] {
    const raw = process.env.STICKER_PRINTERS;
    if (!raw?.trim()) return [];
    try {
      const parsed = JSON.parse(raw) as Partial<StickerPrinter>[];
      return parsed
        .filter((p) => p && typeof p.id === 'string' && p.id)
        .map((p) => ({
          id: String(p.id),
          name: String(p.name ?? p.id),
          color: p.color === true,
        }));
    } catch (error) {
      this.logger.error('STICKER_PRINTERS ไม่ใช่ JSON ที่ถูกต้อง', error);
      return [];
    }
  }

  async getQueue(query: { status?: string; page?: string; limit?: string }) {
    const status = (query.status ?? 'pending') as StickerQueueStatus;
    if (!['pending', 'printed', 'all'].includes(status)) {
      throw new BadRequestException('status ต้องเป็น pending|printed|all');
    }
    const page = query.page == null ? 1 : positiveInt(query.page, 'page');
    const limit = query.limit == null ? 50 : positiveInt(query.limit, 'limit');
    if (limit > 200) throw new BadRequestException('limit สูงสุด 200');
    const order = status === 'pending' ? 'ASC' : 'DESC';

    const printedExists = `EXISTS (SELECT 1 FROM sticker_print_log l WHERE l.order_line_id = spo.spo_id AND l.print_type = 'print')`;

    const base = () =>
      this.orderRepo
        .createQueryBuilder('spo')
        .innerJoin('spo.orderHeader', 'soh')
        .leftJoin('soh.member', 'mem')
        .where('spo.pro_code IN (:...codes)', { codes: STICKER_PRO_CODES })
        .andWhere('spo.custom_options IS NOT NULL');

    const listQb = base();
    if (status === 'pending') listQb.andWhere(`NOT ${printedExists}`);
    if (status === 'printed') listQb.andWhere(printedExists);

    const total = await listQb.clone().getCount();
    const rows = await listQb
      .select([
        'spo.spo_id AS spo_id',
        'spo.pro_code AS pro_code',
        'spo.spo_qty AS spo_qty',
        'spo.spo_unit AS spo_unit',
        'spo.custom_options AS custom_options',
        'soh.soh_running AS soh_running',
        'soh.soh_datetime AS soh_datetime',
        'soh.mem_code AS mem_code',
        'mem.mem_nameSite AS mem_name',
      ])
      // รอพิมพ์: มาก่อนพิมพ์ก่อน · พิมพ์แล้ว/ทั้งหมด: ล่าสุดก่อน ไม่ให้งานใหม่ตกไปหน้าหลัง
      .orderBy('soh.soh_datetime', order)
      .addOrderBy('spo.spo_id', order)
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{
        spo_id: number;
        pro_code: string;
        spo_qty: string;
        spo_unit: string;
        custom_options: StickerOrderSnapshot | string;
        soh_running: string;
        soh_datetime: Date;
        mem_code: string;
        mem_name: string | null;
      }>();

    const ids = rows.map((r) => r.spo_id);
    const stats = await this.logStats(ids);

    const items = rows.map((r) => {
      const snapshot = parseStickerJson<StickerOrderSnapshot>(r.custom_options);
      const stat = stats.get(r.spo_id);
      return {
        spo_id: r.spo_id,
        soh_running: r.soh_running,
        soh_datetime: r.soh_datetime,
        mem_code: r.mem_code,
        mem_name: r.mem_name,
        pro_code: r.pro_code,
        spo_qty: Number(r.spo_qty),
        spo_unit: r.spo_unit,
        custom_options: snapshot,
        sheets: snapshot?.sheets ?? 0,
        dots: snapshot?.dots ?? 0,
        status: stat?.printed ? 'printed' : 'pending',
        print_count: stat?.print_count ?? 0,
        last_printed_by: stat?.last_printed_by ?? null,
        last_printed_at: stat?.last_printed_at ?? null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      summary: await this.pendingSummary(base),
    };
  }

  /** การ์ดสรุปงานรอพิมพ์ — แยกขาวดำ (-05) / สี (-07) */
  private async pendingSummary(
    base: () => ReturnType<
      Repository<ShoppingOrderEntity>['createQueryBuilder']
    >,
  ) {
    const pending = await base()
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM sticker_print_log l WHERE l.order_line_id = spo.spo_id AND l.print_type = 'print')`,
      )
      .select([
        'spo.spo_id AS spo_id',
        'spo.pro_code AS pro_code',
        'spo.custom_options AS custom_options',
      ])
      .getRawMany<{
        spo_id: number;
        pro_code: string;
        custom_options: unknown;
      }>();

    const summary = {
      pending_jobs: pending.length,
      pending_sheets: 0,
      bw: { pro_code: STICKER_PRO_CODE.bw, jobs: 0, sheets: 0 },
      color: { pro_code: STICKER_PRO_CODE.color, jobs: 0, sheets: 0 },
    };
    for (const row of pending) {
      const sheets =
        parseStickerJson<StickerOrderSnapshot>(row.custom_options)?.sheets ?? 0;
      const bucket =
        row.pro_code === STICKER_PRO_CODE.color ? summary.color : summary.bw;
      bucket.jobs += 1;
      bucket.sheets += sheets;
      summary.pending_sheets += sheets;
    }
    return summary;
  }

  /** จำนวนครั้งพิมพ์ (print + reprint ไม่นับ test) และคนพิมพ์ล่าสุด จาก log */
  private async logStats(ids: number[]) {
    const map = new Map<
      number,
      {
        printed: boolean;
        print_count: number;
        last_printed_by: string | null;
        last_printed_at: Date | null;
      }
    >();
    if (ids.length === 0) return map;
    const logs = await this.logRepo.find({
      where: { order_line_id: In(ids) },
      order: { printed_at: 'ASC', id: 'ASC' },
    });
    for (const log of logs) {
      const stat = map.get(log.order_line_id) ?? {
        printed: false,
        print_count: 0,
        last_printed_by: null,
        last_printed_at: null,
      };
      if (log.print_type !== 'test') {
        stat.print_count += 1;
        stat.last_printed_by = log.printed_by;
        stat.last_printed_at = log.printed_at;
      }
      if (log.print_type === 'print') stat.printed = true;
      map.set(log.order_line_id, stat);
    }
    return map;
  }

  /**
   * บันทึกการพิมพ์ — printed_by จาก token, printed_at เวลา server
   * print ครั้งแรกเปลี่ยนเป็นพิมพ์แล้ว · reprint/test ไม่เปลี่ยนสถานะ
   */
  async recordPrint(actor: StickerActor, body: PrintRequestBody) {
    return this.writeLogs(actor, await this.preparePrint(body));
  }

  /**
   * ECWC-704 สร้าง PDF ของงานที่เลือกแล้วบันทึก log ในครั้งเดียว — กันพิมพ์โดยไม่ลงประวัติ
   * สร้าง PDF ก่อน ถ้าสร้างไม่สำเร็จจะไม่มี log
   */
  async printPdf(actor: StickerActor, body: PrintRequestBody) {
    const prep = await this.preparePrint(body);
    if (prep.printType === 'print') {
      await this.assertNotPrinted(this.logRepo.manager, prep.ids);
    }
    const jobs = prep.ids.map((id) => {
      const snapshot = parseStickerJson<StickerOrderSnapshot>(
        prep.found.get(id)?.custom_options,
      ) as StickerOrderSnapshot;
      return {
        snapshot,
        pages: prep.printType === 'test' ? 1 : Math.ceil(snapshot.sheets),
      };
    });
    const totalPages = jobs.reduce((sum, j) => sum + j.pages, 0);
    if (totalPages > MAX_PDF_PAGES) {
      throw new BadRequestException(
        `PDF ยาวได้ไม่เกิน ${MAX_PDF_PAGES} หน้าต่อครั้ง (เลือกไว้ ${totalPages} หน้า) — แบ่งพิมพ์ทีละชุด`,
      );
    }
    const pdf = await this.pdfRenderer.render(buildStickerSheetHtml(jobs));
    const { logs } = await this.writeLogs(actor, prep);
    return { pdf, logs, pages: totalPages };
  }

  /** ตัวอย่าง 1 หน้าในแผงรายละเอียด — ไม่บันทึก log */
  async previewPdf(spo_id: number): Promise<Buffer> {
    const line = await this.orderRepo.findOne({
      where: { spo_id, pro_code: In(STICKER_PRO_CODES) },
      select: { spo_id: true, custom_options: true },
    });
    const snapshot = parseStickerJson<StickerOrderSnapshot>(
      line?.custom_options,
    );
    if (!snapshot) throw new NotFoundException('ไม่พบงานสติ๊กเกอร์นี้');
    return this.pdfRenderer.render(
      buildStickerSheetHtml([{ snapshot, pages: 1 }]),
    );
  }

  private async assertNotPrinted(manager: EntityManager, ids: number[]) {
    const already = await manager.find(StickerPrintLogEntity, {
      where: { order_line_id: In(ids), print_type: 'print' },
      select: { order_line_id: true },
    });
    if (already.length > 0) {
      const dup = [...new Set(already.map((l) => l.order_line_id))];
      throw new BadRequestException(
        `งานนี้พิมพ์แล้ว ให้ใช้พิมพ์ซ้ำ (reprint): ${dup.join(', ')}`,
      );
    }
  }

  private async preparePrint(body: PrintRequestBody) {
    const printType = body.print_type as StickerPrintType;
    if (!PRINT_TYPES.includes(printType)) {
      throw new BadRequestException('print_type ต้องเป็น print|reprint|test');
    }
    if (
      !Array.isArray(body.order_line_ids) ||
      body.order_line_ids.length === 0
    ) {
      throw new BadRequestException('ต้องเลือกอย่างน้อย 1 งาน');
    }
    const ids = [
      ...new Set(
        body.order_line_ids.map((id) => positiveInt(id, 'order_line_ids')),
      ),
    ];
    if (ids.length > 200)
      throw new BadRequestException('เลือกได้สูงสุด 200 งาน');

    const printer = this.getPrinters().find((p) => p.id === body.printer);
    if (!printer) throw new BadRequestException('ไม่พบเครื่องพิมพ์ที่เลือก');

    const lines = await this.orderRepo.find({
      where: { spo_id: In(ids), pro_code: In(STICKER_PRO_CODES) },
      select: { spo_id: true, pro_code: true, custom_options: true },
    });
    const found = new Map(lines.map((l) => [l.spo_id, l]));
    const missing = ids.filter((id) => !found.get(id)?.custom_options);
    if (missing.length > 0) {
      throw new NotFoundException(
        `ไม่พบงานสติ๊กเกอร์ order line: ${missing.join(', ')}`,
      );
    }

    // กันพิมพ์งานสีด้วยเครื่องขาวดำ
    if (!printer.color) {
      const colorJobs = lines.filter(
        (l) => l.pro_code === STICKER_PRO_CODE.color,
      );
      if (colorJobs.length > 0) {
        throw new BadRequestException(
          `เครื่อง ${printer.name} เป็นเครื่องขาวดำ พิมพ์งานสีไม่ได้: ${colorJobs
            .map((l) => l.spo_id)
            .join(', ')}`,
        );
      }
    }

    return { ids, printType, printer, found };
  }

  private async writeLogs(
    actor: StickerActor,
    prep: Awaited<ReturnType<StickerLabelService['preparePrint']>>,
  ) {
    const { ids, printType, printer, found } = prep;
    return this.dataSource.transaction(async (manager) => {
      if (printType === 'print') {
        await this.assertNotPrinted(manager, ids);
      }

      const logs = ids.map((id) => {
        const snapshot = parseStickerJson<StickerOrderSnapshot>(
          found.get(id)?.custom_options,
        );
        return manager.create(StickerPrintLogEntity, {
          order_line_id: id,
          printed_by: actor.username,
          print_type: printType,
          // พิมพ์ทดสอบ = 1 แผ่น
          sheets: printType === 'test' ? 1 : Math.ceil(snapshot?.sheets ?? 0),
          printer: printer.id,
        });
      });
      const saved = await manager.save(StickerPrintLogEntity, logs);
      return { logs: saved };
    });
  }

  async getLineLogs(spo_id: number) {
    const line = await this.orderRepo.findOne({
      where: { spo_id, pro_code: In(STICKER_PRO_CODES) },
      select: { spo_id: true, pro_code: true, custom_options: true },
    });
    if (!line?.custom_options) {
      throw new NotFoundException('ไม่พบงานสติ๊กเกอร์นี้');
    }
    const logs = await this.logRepo.find({
      where: { order_line_id: spo_id },
      order: { printed_at: 'DESC', id: 'DESC' },
    });
    return {
      spo_id,
      pro_code: line.pro_code,
      custom_options: parseStickerJson<StickerOrderSnapshot>(
        line.custom_options,
      ),
      logs,
    };
  }
}
