import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BundleSetEntity } from './bundle-set.entity';
import { BundleSetItemEntity } from './bundle-set-item.entity';
import { ProductEntity } from '../products/products.entity';
import { ProductUnitEntity } from '../products/product-unit.entity';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { AddSetItemDto } from './dto/add-set-item.dto';

export type PriceOption = 'A' | 'B' | 'C';

export interface SetLineView {
  item_id: number;
  pro_code: string;
  pro_name: string;
  unit_level: number;
  unit_name: string;
  qty: number;
  is_gift: boolean;
  /** ราคาต่อหน่วยเล็กสุดตาม price option ของร้าน */
  unit_price: number;
  /** มูลค่าตามราคาปกติของบรรทัดนี้ (ของแถม = 0) */
  line_total: number;
}

export interface SetAvailability {
  available_sets: number;
  /** สินค้าที่ทำให้สั่งได้น้อยที่สุด — ไว้บอกลูกค้าว่าติดตัวไหน */
  limiting_pro_code: string | null;
}

export interface SetView {
  set_code: string;
  set_name: string;
  description: string | null;
  image: string | null;
  price: number;
  list_total: number;
  savings: number;
  items: SetLineView[];
  gifts: SetLineView[];
  availability: SetAvailability;
}

/** บรรทัดที่จะเขียนลงตะกร้า/ออเดอร์ หลังแตกกระเช้าออกเป็นรายชิ้น */
export interface ExplodedLine {
  pro_code: string;
  unit_level: number;
  qty: number;
  is_gift: boolean;
  /** ราคารวมของบรรทัดนี้หลังเฉลี่ยส่วนลดชุดแล้ว */
  line_total: number;
}

@Injectable()
export class BundleSetService {
  private readonly logger = new Logger(BundleSetService.name);

  constructor(
    @InjectRepository(BundleSetEntity)
    private readonly setRepo: Repository<BundleSetEntity>,
    @InjectRepository(BundleSetItemEntity)
    private readonly itemRepo: Repository<BundleSetItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductUnitEntity)
    private readonly unitRepo: Repository<ProductUnitEntity>,
  ) {}

  // ---------------------------------------------------------------- helpers

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private unitPriceOf(product: ProductEntity, option: PriceOption): number {
    if (option === 'A') return Number(product.pro_priceA);
    if (option === 'B') return Number(product.pro_priceB);
    return Number(product.pro_priceC);
  }

  private async findSetOrFail(setCode: string): Promise<BundleSetEntity> {
    const set = await this.setRepo.findOne({
      where: { set_code: setCode },
      relations: ['items'],
    });
    if (!set) throw new NotFoundException(`ไม่พบกระเช้ารหัส ${setCode}`);
    return set;
  }

  /** ดึง product + ratio ของทุกบรรทัดในชุด ในครั้งเดียว */
  private async loadContext(items: BundleSetItemEntity[]): Promise<{
    products: Map<string, ProductEntity>;
    ratios: Map<string, number>;
    unitNames: Map<string, string>;
  }> {
    const codes = Array.from(new Set(items.map((item) => item.pro_code)));
    const products = new Map<string, ProductEntity>();
    const ratios = new Map<string, number>();
    const unitNames = new Map<string, string>();
    if (codes.length === 0) return { products, ratios, unitNames };

    const [productRows, unitRows] = await Promise.all([
      this.productRepo.find({ where: { pro_code: In(codes) } }),
      this.unitRepo.find({ where: { pro_code: In(codes) } }),
    ]);

    productRows.forEach((row) => products.set(row.pro_code, row));
    unitRows.forEach((row) => {
      const key = `${row.pro_code}|${row.level}`;
      ratios.set(key, Number(row.ratio) || 1);
      unitNames.set(key, row.unit_name);
    });

    return { products, ratios, unitNames };
  }

  private ratioOf(
    ratios: Map<string, number>,
    proCode: string,
    level: number,
  ): number {
    return ratios.get(`${proCode}|${level}`) ?? 1;
  }

  // ------------------------------------------------------------ การคำนวณหลัก

  /**
   * จำนวนชุดที่สั่งได้ = สต็อกน้อยสุดหารด้วยจำนวนที่ใช้ต่อชุด
   * ของแถมในชุดก็ตัดสต็อกเหมือนกัน จึงนับรวมด้วย
   */
  private computeAvailability(
    items: BundleSetItemEntity[],
    products: Map<string, ProductEntity>,
    ratios: Map<string, number>,
  ): SetAvailability {
    if (items.length === 0) {
      return { available_sets: 0, limiting_pro_code: null };
    }

    let available = Number.POSITIVE_INFINITY;
    let limiting: string | null = null;

    for (const item of items) {
      const product = products.get(item.pro_code);
      if (!product)
        return { available_sets: 0, limiting_pro_code: item.pro_code };

      const perSet =
        item.qty * this.ratioOf(ratios, item.pro_code, item.unit_level);
      if (perSet <= 0) continue;

      const canMake = Math.floor(Number(product.pro_stock ?? 0) / perSet);
      if (canMake < available) {
        available = canMake;
        limiting = item.pro_code;
      }
    }

    if (!Number.isFinite(available)) {
      return { available_sets: 0, limiting_pro_code: null };
    }
    return {
      available_sets: Math.max(0, available),
      limiting_pro_code: limiting,
    };
  }

  private buildLines(
    items: BundleSetItemEntity[],
    products: Map<string, ProductEntity>,
    ratios: Map<string, number>,
    unitNames: Map<string, string>,
    option: PriceOption,
  ): SetLineView[] {
    return items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.item_id - b.item_id)
      .map((item) => {
        const product = products.get(item.pro_code);
        const ratio = this.ratioOf(ratios, item.pro_code, item.unit_level);
        const unitPrice = product ? this.unitPriceOf(product, option) : 0;
        return {
          item_id: item.item_id,
          pro_code: item.pro_code,
          pro_name: product?.pro_name ?? item.pro_code,
          unit_level: item.unit_level,
          unit_name: unitNames.get(`${item.pro_code}|${item.unit_level}`) ?? '',
          qty: item.qty,
          is_gift: item.is_gift,
          unit_price: unitPrice,
          line_total: item.is_gift
            ? 0
            : this.round2(item.qty * ratio * unitPrice),
        };
      });
  }

  /**
   * แตกกระเช้าเป็นรายชิ้น พร้อมเฉลี่ยส่วนลดลงแต่ละบรรทัดตามสัดส่วนมูลค่า
   * บรรทัดสุดท้ายรับเศษ เพื่อให้ผลรวมเท่ากับราคาชุด × จำนวนชุด เป๊ะ
   */
  explodeLines(
    lines: SetLineView[],
    setPrice: number,
    setQty: number,
  ): ExplodedLine[] {
    if (setQty <= 0) throw new BadRequestException('จำนวนชุดต้องมากกว่า 0');

    const paidLines = lines.filter((line) => !line.is_gift);
    const listTotal = paidLines.reduce((sum, line) => sum + line.line_total, 0);
    const target = this.round2(setPrice * setQty);

    const exploded: ExplodedLine[] = [];
    let allocated = 0;

    paidLines.forEach((line, index) => {
      const isLast = index === paidLines.length - 1;
      // listTotal = 0 (เช่นสินค้าไม่มีราคา) → เฉลี่ยเท่ากันทุกบรรทัดแทน
      const share =
        listTotal > 0
          ? target * (line.line_total / listTotal)
          : target / paidLines.length;
      const value = isLast
        ? this.round2(target - allocated)
        : this.round2(share);
      allocated = this.round2(allocated + value);

      exploded.push({
        pro_code: line.pro_code,
        unit_level: line.unit_level,
        qty: line.qty * setQty,
        is_gift: false,
        line_total: value,
      });
    });

    lines
      .filter((line) => line.is_gift)
      .forEach((line) =>
        exploded.push({
          pro_code: line.pro_code,
          unit_level: line.unit_level,
          qty: line.qty * setQty,
          is_gift: true,
          line_total: 0,
        }),
      );

    return exploded;
  }

  // --------------------------------------------------------------- read API

  async getSetView(setCode: string, option: PriceOption): Promise<SetView> {
    const set = await this.findSetOrFail(setCode);
    const items = set.items ?? [];
    const { products, ratios, unitNames } = await this.loadContext(items);

    const lines = this.buildLines(items, products, ratios, unitNames, option);
    const paid = lines.filter((line) => !line.is_gift);
    const listTotal = this.round2(
      paid.reduce((sum, line) => sum + line.line_total, 0),
    );
    const price = Number(set.price);

    return {
      set_code: set.set_code,
      set_name: set.set_name,
      description: set.description ?? null,
      image: set.image ?? null,
      price,
      list_total: listTotal,
      savings: this.round2(Math.max(0, listTotal - price)),
      items: paid,
      gifts: lines.filter((line) => line.is_gift),
      availability: this.computeAvailability(items, products, ratios),
    };
  }

  /** กระเช้าที่เปิดขายอยู่ ณ ตอนนี้ */
  async listActiveSets(option: PriceOption): Promise<SetView[]> {
    const now = new Date();
    const sets = await this.setRepo
      .createQueryBuilder('bundle')
      .where('bundle.status = :status', { status: true })
      .andWhere('(bundle.start_date IS NULL OR bundle.start_date <= :now)', {
        now,
      })
      .andWhere('(bundle.end_date IS NULL OR bundle.end_date >= :now)', { now })
      .orderBy('bundle.sort_order', 'ASC')
      .addOrderBy('bundle.set_code', 'ASC')
      .getMany();

    return Promise.all(
      sets.map((set) => this.getSetView(set.set_code, option)),
    );
  }

  /** ใช้ตอนเพิ่มลงตะกร้า — กันสั่งเกินสต็อกที่ประกอบชุดได้ */
  async explodeForCart(
    setCode: string,
    setQty: number,
    option: PriceOption,
  ): Promise<ExplodedLine[]> {
    const view = await this.getSetView(setCode, option);
    if (view.availability.available_sets < setQty) {
      throw new ConflictException(
        `สั่งได้สูงสุด ${view.availability.available_sets} ชุด (สินค้าในชุดไม่พอ)`,
      );
    }
    return this.explodeLines(
      [...view.items, ...view.gifts],
      view.price,
      setQty,
    );
  }

  // -------------------------------------------------------------- admin CRUD

  async listSets(): Promise<BundleSetEntity[]> {
    return this.setRepo.find({
      relations: ['items'],
      order: { sort_order: 'ASC', set_code: 'ASC' },
    });
  }

  async createSet(dto: CreateSetDto): Promise<BundleSetEntity> {
    const exists = await this.setRepo.findOne({
      where: { set_code: dto.set_code },
      withDeleted: true,
    });
    if (exists) {
      throw new ConflictException(`รหัสกระเช้า ${dto.set_code} ถูกใช้ไปแล้ว`);
    }

    const set = this.setRepo.create({
      set_code: dto.set_code,
      set_name: dto.set_name,
      description: dto.description,
      price: dto.price,
      image: dto.image,
      status: dto.status ?? false,
      start_date: dto.start_date ? new Date(dto.start_date) : undefined,
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      promo_id: dto.promo_id,
      sort_order: dto.sort_order ?? 0,
    });
    this.logger.log(`created bundle set ${dto.set_code}`);
    return this.setRepo.save(set);
  }

  async updateSet(
    setCode: string,
    dto: UpdateSetDto,
  ): Promise<BundleSetEntity> {
    const set = await this.findSetOrFail(setCode);

    if (dto.set_name !== undefined) set.set_name = dto.set_name;
    if (dto.description !== undefined) set.description = dto.description;
    if (dto.price !== undefined) set.price = dto.price;
    if (dto.image !== undefined) set.image = dto.image;
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.start_date !== undefined) {
      set.start_date = dto.start_date ? new Date(dto.start_date) : undefined;
    }
    if (dto.end_date !== undefined) {
      set.end_date = dto.end_date ? new Date(dto.end_date) : undefined;
    }
    if (dto.promo_id !== undefined) set.promo_id = dto.promo_id;
    if (dto.sort_order !== undefined) set.sort_order = dto.sort_order;

    return this.setRepo.save(set);
  }

  async deleteSet(setCode: string): Promise<{ deleted: boolean }> {
    await this.findSetOrFail(setCode);
    await this.setRepo.softDelete({ set_code: setCode });
    return { deleted: true };
  }

  async addItem(
    setCode: string,
    dto: AddSetItemDto,
  ): Promise<BundleSetItemEntity> {
    await this.findSetOrFail(setCode);

    const product = await this.productRepo.findOne({
      where: { pro_code: dto.pro_code },
    });
    if (!product) {
      throw new NotFoundException(`ไม่พบสินค้ารหัส ${dto.pro_code}`);
    }

    const unit = await this.unitRepo.findOne({
      where: { pro_code: dto.pro_code, level: dto.unit_level },
    });
    if (!unit) {
      throw new BadRequestException(
        `สินค้า ${dto.pro_code} ไม่มีหน่วยระดับ ${dto.unit_level}`,
      );
    }

    const duplicate = await this.itemRepo.findOne({
      where: {
        set_code: setCode,
        pro_code: dto.pro_code,
        unit_level: dto.unit_level,
        is_gift: dto.is_gift ?? false,
      },
    });
    if (duplicate) {
      throw new ConflictException('สินค้าหน่วยนี้อยู่ในชุดแล้ว');
    }

    let sortOrder = dto.sort_order;
    if (sortOrder === undefined) {
      const last = await this.itemRepo.findOne({
        where: { set_code: setCode },
        order: { sort_order: 'DESC' },
      });
      sortOrder = last ? last.sort_order + 1 : 0;
    }

    return this.itemRepo.save(
      this.itemRepo.create({
        set_code: setCode,
        pro_code: dto.pro_code,
        unit_level: dto.unit_level,
        qty: dto.qty,
        is_gift: dto.is_gift ?? false,
        sort_order: sortOrder,
      }),
    );
  }

  async removeItem(
    setCode: string,
    itemId: number,
  ): Promise<{ deleted: boolean }> {
    const item = await this.itemRepo.findOne({
      where: { item_id: itemId, set_code: setCode },
    });
    if (!item) {
      throw new NotFoundException(`ไม่พบรายการรหัส ${itemId} ในชุดนี้`);
    }
    await this.itemRepo.delete({ item_id: itemId });
    return { deleted: true };
  }
}
