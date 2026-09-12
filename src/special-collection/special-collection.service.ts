import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { SpecialCollectionEntity } from './special-collection.entity';
import {
  SpecialCollectionItemEntity,
  SpecialCollectionRefType,
} from './special-collection-item.entity';
import { SpecialCollectionAudienceEntity } from './special-collection-audience.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddItemDto } from './dto/add-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { SetAudienceDto } from './dto/set-audience.dto';
import { PromotionEntity } from '../promotion/promotion.entity';
import { PromotionTierEntity } from '../promotion/promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';
import { HotdealEntity } from '../hotdeal/hotdeal.entity';
import { FlashSaleEntity } from '../flashsale/flashsale.entity';
import {
  flashsaleClock,
  flashsaleDate,
  isFlashsaleLive,
} from '../flashsale/flashsale.service';
import { UserEntity } from '../users/users.entity';
import { BundleSetEntity } from '../bundle-set/bundle-set.entity';
import {
  BundleSetService,
  type PriceOption,
} from '../bundle-set/bundle-set.service';

/** ร้านค้าแบบย่อ สำหรับ picker ฝั่งแอดมิน */
export interface ShopOption {
  mem_code: string;
  shop_name: string | null;
}

/** รายการที่ resolve payload แล้ว พร้อมส่งให้หน้าบ้าน */
export interface ResolvedCollectionItem {
  item_id: number;
  ref_type: SpecialCollectionRefType;
  ref_id: string;
  title_override: string | null;
  sort_order: number;
  /** null เมื่อของที่อ้างถึงถูกลบ/ปิดไปแล้ว */
  payload: unknown;
  unavailable: boolean;
  /**
   * ชื่อของที่อ้างถึง หามาแบบไม่สนสถานะ/วันหมดอายุ — แอดมินต้องอ่านออกเสมอว่ารายการนี้คืออะไร
   * ถึงแม้โปรจะถูกปิดหรือหมดอายุจน payload เป็น null (null เมื่อของถูกลบออกจาก DB จริงๆ)
   */
  display_name: string | null;
}

@Injectable()
export class SpecialCollectionService {
  private readonly logger = new Logger(SpecialCollectionService.name);

  constructor(
    @InjectRepository(SpecialCollectionEntity)
    private readonly collectionRepo: Repository<SpecialCollectionEntity>,
    @InjectRepository(SpecialCollectionItemEntity)
    private readonly itemRepo: Repository<SpecialCollectionItemEntity>,
    @InjectRepository(SpecialCollectionAudienceEntity)
    private readonly audienceRepo: Repository<SpecialCollectionAudienceEntity>,
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly tierRepo: Repository<PromotionTierEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(HotdealEntity)
    private readonly hotdealRepo: Repository<HotdealEntity>,
    @InjectRepository(FlashSaleEntity)
    private readonly flashsaleRepo: Repository<FlashSaleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(BundleSetEntity)
    private readonly bundleSetRepo: Repository<BundleSetEntity>,
    private readonly bundleSetService: BundleSetService,
  ) {}

  // ---------------------------------------------------------------- helpers

  /** ref_id ของ promotion/tier/hotdeal/flashsale เป็นตัวเลข — กันค่าขยะแบบ "2a0 " */
  private toNumericRefId(refId: string, refType: string): number {
    const parsed = Number(refId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `ref_id ของ ${refType} ต้องเป็นตัวเลขจำนวนเต็มบวก`,
      );
    }
    return parsed;
  }

  /** ยืนยันว่าของที่จะหยิบเข้าคอลเลกชันมีอยู่จริง ก่อนบันทึก */
  private async assertRefExists(
    refType: SpecialCollectionRefType,
    refId: string,
  ): Promise<void> {
    let found: unknown = null;

    switch (refType) {
      case 'promotion':
        found = await this.promotionRepo.findOne({
          where: { promo_id: this.toNumericRefId(refId, refType) },
        });
        break;
      case 'tier':
        found = await this.tierRepo.findOne({
          where: { tier_id: this.toNumericRefId(refId, refType) },
        });
        break;
      case 'product':
        found = await this.productRepo.findOne({ where: { pro_code: refId } });
        break;
      case 'hotdeal':
        found = await this.hotdealRepo.findOne({
          where: { id: this.toNumericRefId(refId, refType) },
        });
        break;
      case 'flashsale':
        // ⚠️ PK ของ flashsale ชื่อ promotion_id แต่ไม่เกี่ยวกับ promotion.promo_id
        found = await this.flashsaleRepo.findOne({
          where: { promotion_id: this.toNumericRefId(refId, refType) },
        });
        break;
      case 'bundle_set':
        found = await this.bundleSetRepo.findOne({
          where: { set_code: refId },
        });
        break;
    }

    if (!found) {
      throw new NotFoundException(`ไม่พบ ${refType} รหัส ${refId}`);
    }
  }

  private async findCollectionOrFail(
    collectionId: number,
  ): Promise<SpecialCollectionEntity> {
    const collection = await this.collectionRepo.findOne({
      where: { collection_id: collectionId },
    });
    if (!collection) {
      throw new NotFoundException(`ไม่พบคอลเลกชันรหัส ${collectionId}`);
    }
    return collection;
  }

  private async replaceAudience(
    collectionId: number,
    memCodes: string[],
  ): Promise<void> {
    const unique = Array.from(
      new Set(memCodes.map((code) => code.trim()).filter(Boolean)),
    );
    await this.audienceRepo.delete({ collection_id: collectionId });
    if (unique.length === 0) return;
    await this.audienceRepo.save(
      unique.map((mem_code) =>
        this.audienceRepo.create({ collection_id: collectionId, mem_code }),
      ),
    );
  }

  // ------------------------------------------------------------ admin: CRUD

  async listCollections(): Promise<SpecialCollectionEntity[]> {
    return this.collectionRepo.find({
      relations: ['items', 'audiences'],
      order: { sort_order: 'ASC', collection_id: 'ASC' },
    });
  }

  async getCollection(
    collectionId: number,
    option: PriceOption = 'C',
  ): Promise<{
    collection: SpecialCollectionEntity;
    items: ResolvedCollectionItem[];
  }> {
    const collection = await this.collectionRepo.findOne({
      where: { collection_id: collectionId },
      relations: ['audiences'],
    });
    if (!collection) {
      throw new NotFoundException(`ไม่พบคอลเลกชันรหัส ${collectionId}`);
    }

    const items = await this.itemRepo.find({
      where: { collection_id: collectionId },
      order: { sort_order: 'ASC', item_id: 'ASC' },
    });

    return { collection, items: await this.resolveItems(items, option) };
  }

  async createCollection(
    dto: CreateCollectionDto,
  ): Promise<SpecialCollectionEntity> {
    const collection = this.collectionRepo.create({
      name: dto.name,
      description: dto.description,
      status: dto.status ?? false,
      start_date: dto.start_date ? new Date(dto.start_date) : undefined,
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      audience_scope: dto.audience_scope ?? 'all',
      sort_order: dto.sort_order ?? 0,
    });
    const saved = await this.collectionRepo.save(collection);

    if (dto.mem_codes?.length) {
      await this.replaceAudience(saved.collection_id, dto.mem_codes);
    }

    this.logger.log(`created special collection ${saved.collection_id}`);
    return saved;
  }

  async updateCollection(
    collectionId: number,
    dto: UpdateCollectionDto,
  ): Promise<SpecialCollectionEntity> {
    const collection = await this.findCollectionOrFail(collectionId);

    if (dto.name !== undefined) collection.name = dto.name;
    if (dto.description !== undefined) collection.description = dto.description;
    if (dto.status !== undefined) collection.status = dto.status;
    if (dto.start_date !== undefined) {
      collection.start_date = dto.start_date
        ? new Date(dto.start_date)
        : undefined;
    }
    if (dto.end_date !== undefined) {
      collection.end_date = dto.end_date ? new Date(dto.end_date) : undefined;
    }
    if (dto.audience_scope !== undefined) {
      collection.audience_scope = dto.audience_scope;
    }
    if (dto.sort_order !== undefined) collection.sort_order = dto.sort_order;

    return this.collectionRepo.save(collection);
  }

  async deleteCollection(collectionId: number): Promise<{ deleted: boolean }> {
    await this.findCollectionOrFail(collectionId);
    await this.collectionRepo.softDelete({ collection_id: collectionId });
    this.logger.log(`soft deleted special collection ${collectionId}`);
    return { deleted: true };
  }

  // ------------------------------------------------------------ admin: items

  async addItem(
    collectionId: number,
    dto: AddItemDto,
  ): Promise<SpecialCollectionItemEntity> {
    await this.findCollectionOrFail(collectionId);
    await this.assertRefExists(dto.ref_type, dto.ref_id);

    const duplicate = await this.itemRepo.findOne({
      where: {
        collection_id: collectionId,
        ref_type: dto.ref_type,
        ref_id: dto.ref_id,
      },
    });
    if (duplicate) {
      throw new BadRequestException('รายการนี้ถูกเพิ่มไว้ในคอลเลกชันแล้ว');
    }

    let sortOrder = dto.sort_order;
    if (sortOrder === undefined) {
      const last = await this.itemRepo.findOne({
        where: { collection_id: collectionId },
        order: { sort_order: 'DESC' },
      });
      sortOrder = last ? last.sort_order + 1 : 0;
    }

    return this.itemRepo.save(
      this.itemRepo.create({
        collection_id: collectionId,
        ref_type: dto.ref_type,
        ref_id: dto.ref_id,
        title_override: dto.title_override,
        sort_order: sortOrder,
      }),
    );
  }

  async removeItem(
    collectionId: number,
    itemId: number,
  ): Promise<{ deleted: boolean }> {
    const item = await this.itemRepo.findOne({
      where: { item_id: itemId, collection_id: collectionId },
    });
    if (!item) {
      throw new NotFoundException(`ไม่พบรายการรหัส ${itemId} ในคอลเลกชันนี้`);
    }
    await this.itemRepo.delete({ item_id: itemId });
    return { deleted: true };
  }

  async reorderItems(
    collectionId: number,
    dto: ReorderItemsDto,
  ): Promise<{ reordered: number }> {
    const items = await this.itemRepo.find({
      where: { collection_id: collectionId },
    });
    const known = new Set(items.map((item) => item.item_id));

    const unknown = dto.item_ids.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `ไม่พบรายการรหัส ${unknown.join(', ')} ในคอลเลกชันนี้`,
      );
    }
    if (dto.item_ids.length !== items.length) {
      throw new BadRequestException(
        `item_ids ต้องครบทุกรายการในคอลเลกชัน (มี ${items.length} รายการ)`,
      );
    }

    await Promise.all(
      dto.item_ids.map((itemId, index) =>
        this.itemRepo.update({ item_id: itemId }, { sort_order: index }),
      ),
    );
    return { reordered: dto.item_ids.length };
  }

  // --------------------------------------------------------- admin: audience

  async setAudience(
    collectionId: number,
    dto: SetAudienceDto,
  ): Promise<{ mem_codes: string[] }> {
    await this.findCollectionOrFail(collectionId);
    await this.replaceAudience(collectionId, dto.mem_codes);
    const saved = await this.audienceRepo.find({
      where: { collection_id: collectionId },
    });
    return { mem_codes: saved.map((row) => row.mem_code) };
  }

  // ------------------------------------------------------------- shop picker

  /** ค้นร้านด้วยรหัสหรือชื่อ สำหรับให้แอดมินเลือกกลุ่มเป้าหมาย */
  async searchShops(keyword: string): Promise<ShopOption[]> {
    const query = (keyword ?? '').trim();
    if (query.length < 2) {
      throw new BadRequestException('กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร');
    }

    const rows = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.mem_code', 'user.mem_nameSite'])
      .where('user.mem_code LIKE :query OR user.mem_nameSite LIKE :query', {
        query: `%${query}%`,
      })
      .orderBy('user.mem_code', 'ASC')
      .limit(20)
      .getMany();

    return rows.map((row) => ({
      mem_code: row.mem_code,
      shop_name: row.mem_nameSite ?? null,
    }));
  }

  /** เติมชื่อร้านให้ mem_code ที่บันทึกไว้แล้ว เพื่อไม่ให้หน้าแก้ไขโชว์แต่รหัสเปล่า */
  async resolveShops(memCodes: string[]): Promise<ShopOption[]> {
    const unique = Array.from(
      new Set((memCodes ?? []).map((code) => code.trim()).filter(Boolean)),
    );
    if (unique.length === 0) return [];

    const rows = await this.userRepo.find({
      where: { mem_code: In(unique) },
      select: ['mem_code', 'mem_nameSite'],
    });
    const found = new Map(rows.map((row) => [row.mem_code, row.mem_nameSite]));

    // คง mem_code ที่หาไม่เจอไว้ด้วย จะได้เห็นว่าร้านนั้นหายไปจากระบบแล้ว
    return unique.map((mem_code) => ({
      mem_code,
      shop_name: found.get(mem_code) ?? null,
    }));
  }

  // ------------------------------------------------------------- ref resolve

  /** ดึง payload ของทุก item แบบ batch ต่อชนิด — กัน N+1 */
  private async resolveItems(
    items: SpecialCollectionItemEntity[],
    option: PriceOption,
  ): Promise<ResolvedCollectionItem[]> {
    if (items.length === 0) return [];

    const idsOf = (refType: SpecialCollectionRefType): string[] =>
      items.filter((item) => item.ref_type === refType).map((it) => it.ref_id);

    const numericIds = (refType: SpecialCollectionRefType): number[] =>
      idsOf(refType)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

    const [promotions, tiers, products, hotdeals, flashsales, bundleSets] =
      await Promise.all([
        this.loadPromotions(numericIds('promotion')),
        this.loadTiers(numericIds('tier')),
        this.loadProducts(idsOf('product')),
        this.loadHotdeals(numericIds('hotdeal')),
        this.loadFlashsales(numericIds('flashsale')),
        this.loadBundleSets(idsOf('bundle_set'), option),
      ]);

    const lookup: Record<string, Map<string, unknown>> = {
      promotion: promotions,
      tier: tiers,
      product: products,
      hotdeal: hotdeals,
      flashsale: flashsales,
      bundle_set: bundleSets,
    };

    const labels = await this.loadDisplayNames(items);

    return items.map((item) => {
      const payload = lookup[item.ref_type]?.get(item.ref_id) ?? null;
      return {
        item_id: item.item_id,
        ref_type: item.ref_type,
        ref_id: item.ref_id,
        title_override: item.title_override ?? null,
        sort_order: item.sort_order,
        payload,
        unavailable: payload === null,
        display_name: labels.get(`${item.ref_type}:${item.ref_id}`) ?? null,
      };
    });
  }

  /**
   * ชื่อของทุกรายการ ไม่กรองสถานะ/ช่วงเวลา ต่างจาก loadXxx ด้านล่างที่ตั้งใจกรอง
   * หน้าแอดมินเคยโชว์ ref_id เป็นหัวรายการเมื่อของนั้นปิด/หมดอายุ ซึ่งอ่านไม่รู้เรื่อง
   */
  private async loadDisplayNames(
    items: SpecialCollectionItemEntity[],
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    if (items.length === 0) return labels;

    const idsOf = (refType: SpecialCollectionRefType): string[] => {
      const ids = items
        .filter((item) => item.ref_type === refType)
        .map((item) => item.ref_id);
      return Array.from(new Set(ids));
    };
    const numericIds = (refType: SpecialCollectionRefType): number[] =>
      idsOf(refType)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

    const promoIds = numericIds('promotion');
    const tierIds = numericIds('tier');
    const productCodes = idsOf('product');
    const hotdealIds = numericIds('hotdeal');
    const flashsaleIds = numericIds('flashsale');
    const setCodes = idsOf('bundle_set');

    const [promotions, tiers, products, hotdeals, flashsales, sets] =
      await Promise.all([
        promoIds.length
          ? this.promotionRepo.find({
              where: { promo_id: In(promoIds) },
              select: { promo_id: true, promo_name: true },
            })
          : [],
        tierIds.length
          ? this.tierRepo.find({
              where: { tier_id: In(tierIds) },
              select: { tier_id: true, tier_name: true },
            })
          : [],
        productCodes.length
          ? this.productRepo.find({
              where: { pro_code: In(productCodes) },
              select: { pro_code: true, pro_name: true },
            })
          : [],
        hotdealIds.length
          ? this.hotdealRepo.find({
              where: { id: In(hotdealIds) },
              relations: { product: true },
            })
          : [],
        flashsaleIds.length
          ? this.flashsaleRepo.find({
              where: { promotion_id: In(flashsaleIds) },
              select: { promotion_id: true, promotion_name: true },
            })
          : [],
        setCodes.length
          ? this.bundleSetRepo.find({
              where: { set_code: In(setCodes) },
              select: { set_code: true, set_name: true },
              withDeleted: true,
            })
          : [],
      ]);

    for (const row of promotions) {
      if (row.promo_name) labels.set(`promotion:${row.promo_id}`, row.promo_name);
    }
    for (const row of tiers) {
      if (row.tier_name) labels.set(`tier:${row.tier_id}`, row.tier_name);
    }
    for (const row of products) {
      if (row.pro_name) labels.set(`product:${row.pro_code}`, row.pro_name);
    }
    for (const row of hotdeals) {
      labels.set(
        `hotdeal:${row.id}`,
        row.product?.pro_name ?? row.promo_title ?? `Hot Deal ${row.id}`,
      );
    }
    for (const row of flashsales) {
      if (row.promotion_name) {
        labels.set(`flashsale:${row.promotion_id}`, row.promotion_name);
      }
    }
    for (const row of sets) {
      if (row.set_name) labels.set(`bundle_set:${row.set_code}`, row.set_name);
    }
    return labels;
  }

  private async loadPromotions(ids: number[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (ids.length === 0) return map;

    // โปรที่ปิดหรือหมดอายุแล้วให้ resolve ไม่เจอ → ขึ้น unavailable
    // ไม่งั้นหน้ารวมโปรจะโชว์โปรที่กดเข้าไปแล้วเจอหน้าว่าง
    const rows = await this.promotionRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.tiers', 'tiers')
      .leftJoinAndSelect('promo.creditor', 'creditor')
      .where('promo.promo_id IN (:...ids)', { ids })
      .andWhere('promo.status = :status', { status: true })
      .andWhere('promo.start_date <= :now', { now: new Date() })
      .andWhere('promo.end_date >= :now', { now: new Date() })
      .getMany();
    for (const promo of rows) {
      map.set(String(promo.promo_id), {
        promo_id: promo.promo_id,
        promo_name: promo.promo_name,
        promo_poster: promo.promo_poster,
        start_date: promo.start_date,
        end_date: promo.end_date,
        status: promo.status,
        creditor_code: promo.creditor?.creditor_code ?? null,
        tiers: (promo.tiers ?? []).map((tier) => this.toTierSummary(tier)),
      });
    }
    return map;
  }

  private async loadTiers(ids: number[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (ids.length === 0) return map;

    // tier ผูกกับโปร ถ้าโปรแม่ปิด/หมดอายุ tier ก็ใช้ไม่ได้เหมือนกัน
    const rows = await this.tierRepo
      .createQueryBuilder('tier')
      .innerJoinAndSelect('tier.promotion', 'promo')
      .where('tier.tier_id IN (:...ids)', { ids })
      .andWhere('promo.status = :status', { status: true })
      .andWhere('promo.start_date <= :now', { now: new Date() })
      .andWhere('promo.end_date >= :now', { now: new Date() })
      .getMany();
    for (const tier of rows) {
      map.set(String(tier.tier_id), {
        ...this.toTierSummary(tier),
        promotion: tier.promotion
          ? {
              promo_id: tier.promotion.promo_id,
              promo_name: tier.promotion.promo_name,
              promo_poster: tier.promotion.promo_poster,
              start_date: tier.promotion.start_date,
              end_date: tier.promotion.end_date,
            }
          : null,
      });
    }
    return map;
  }

  private toTierSummary(tier: PromotionTierEntity) {
    return {
      tier_id: tier.tier_id,
      tier_name: tier.tier_name,
      tier_postter: tier.tier_postter,
      min_amount: tier.min_amount,
      description: tier.description ?? null,
      detail: tier.detail ?? null,
      is_unit: tier.is_unit,
      all_products: tier.all_products,
    };
  }

  private async loadProducts(codes: string[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (codes.length === 0) return map;

    const rows = await this.productRepo.find({
      where: { pro_code: In(codes) },
    });
    for (const product of rows) {
      map.set(product.pro_code, product);
    }
    return map;
  }

  private async loadHotdeals(ids: number[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (ids.length === 0) return map;

    const rows = await this.hotdealRepo.find({ where: { id: In(ids) } });
    for (const hotdeal of rows) {
      map.set(String(hotdeal.id), hotdeal);
    }
    return map;
  }

  private async loadBundleSets(
    codes: string[],
    option: PriceOption,
  ): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (codes.length === 0) return map;

    // กระเช้าที่ปิดหรือหมดช่วงเวลาก็ไม่ควรโชว์เช่นกัน
    const now = new Date();
    const rows = await this.bundleSetRepo
      .createQueryBuilder('bundle')
      .select('bundle.set_code')
      .where('bundle.set_code IN (:...codes)', { codes })
      .andWhere('bundle.status = :status', { status: true })
      .andWhere('(bundle.start_date IS NULL OR bundle.start_date <= :now)', {
        now,
      })
      .andWhere('(bundle.end_date IS NULL OR bundle.end_date >= :now)', { now })
      .getMany();

    // ต้องคืน view ที่คำนวณแล้ว (ราคารวม/ส่วนลด/จำนวนชุดที่สั่งได้)
    // ไม่ใช่ entity ดิบ ไม่งั้นหน้าบ้านไม่มีข้อมูลพอจะ render
    // N+1 ยอมรับได้เพราะกระเช้าในคอลเลกชันหนึ่งมีไม่กี่ชุด
    const views = await Promise.all(
      rows.map((row) => this.bundleSetService.getSetView(row.set_code, option)),
    );
    views.forEach((view) => map.set(view.set_code, view));
    return map;
  }

  private async loadFlashsales(ids: number[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (ids.length === 0) return map;

    // flashsale เป็นรายวัน — ตัวที่ปิดหรือจบไปแล้วให้ resolve ไม่เจอ (unavailable) เหมือน promotion
    // ตัวที่ยังไม่ถึงเวลาให้เห็นได้ หน้าบ้านจะโชว์ว่าเริ่มเมื่อไหร่และยังไม่ให้ใส่ตะกร้า
    const clock = flashsaleClock();
    const rows = await this.flashsaleRepo
      .createQueryBuilder('flash')
      .loadRelationCountAndMap('flash.product_count', 'flash.flashsaleProducts')
      .where('flash.promotion_id IN (:...ids)', { ids })
      .andWhere('flash.is_active = :active', { active: true })
      .andWhere(
        '(flash.date > :today OR (flash.date = :today AND flash.time_end >= :now))',
        { today: clock.date, now: clock.time },
      )
      .getMany();
    for (const flash of rows) {
      map.set(String(flash.promotion_id), {
        promotion_id: flash.promotion_id,
        promotion_name: flash.promotion_name,
        date: flashsaleDate(flash.date),
        time_start: flash.time_start,
        time_end: flash.time_end,
        is_active: flash.is_active,
        product_count:
          (flash as FlashSaleEntity & { product_count?: number })
            .product_count ?? 0,
        live: isFlashsaleLive(flash, clock),
      });
    }
    return map;
  }

  // ---------------------------------------------------------- customer reads

  /** คอลเลกชันที่ร้านนี้มองเห็น — เปิดใช้งาน + อยู่ในช่วงเวลา + ตรงกลุ่มเป้าหมาย */
  private visibleCollectionsQuery(memCode: string) {
    const now = new Date();
    return this.collectionRepo
      .createQueryBuilder('collection')
      .where('collection.status = :status', { status: true })
      .andWhere(
        '(collection.start_date IS NULL OR collection.start_date <= :now)',
        { now },
      )
      .andWhere(
        '(collection.end_date IS NULL OR collection.end_date >= :now)',
        {
          now,
        },
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('collection.audience_scope = :allScope', {
            allScope: 'all',
          }).orWhere(
            `EXISTS (
              SELECT 1 FROM special_collection_audience audience
              WHERE audience.collection_id = collection.collection_id
                AND audience.mem_code = :memCode
            )`,
            { memCode },
          );
        }),
      )
      .orderBy('collection.sort_order', 'ASC')
      .addOrderBy('collection.collection_id', 'ASC');
  }

  async getForMember(
    memCode: string,
    option: PriceOption = 'C',
  ): Promise<{
    collections: Array<{
      collection_id: number;
      name: string;
      description: string | null;
      start_date: Date | null;
      end_date: Date | null;
      items: ResolvedCollectionItem[];
    }>;
    total_items: number;
  }> {
    const collections = await this.visibleCollectionsQuery(memCode).getMany();
    if (collections.length === 0) {
      return { collections: [], total_items: 0 };
    }

    const allItems = await this.itemRepo.find({
      where: { collection_id: In(collections.map((c) => c.collection_id)) },
      order: { sort_order: 'ASC', item_id: 'ASC' },
    });
    const resolved = await this.resolveItems(allItems, option);

    const byCollection = new Map<number, ResolvedCollectionItem[]>();
    allItems.forEach((item, index) => {
      const bucket = byCollection.get(item.collection_id) ?? [];
      bucket.push(resolved[index]);
      byCollection.set(item.collection_id, bucket);
    });

    let totalItems = 0;
    const payload = collections.map((collection) => {
      // ของที่ถูกลบไปแล้วไม่ต้องโชว์ให้ลูกค้า
      const items = (byCollection.get(collection.collection_id) ?? []).filter(
        (item) => !item.unavailable,
      );
      totalItems += items.length;
      return {
        collection_id: collection.collection_id,
        name: collection.name,
        description: collection.description ?? null,
        start_date: collection.start_date ?? null,
        end_date: collection.end_date ?? null,
        items,
      };
    });

    return { collections: payload, total_items: totalItems };
  }

  /** ตัวเลขบน badge ข้างไอคอนของขวัญ */
  async getBadgeCount(
    memCode: string,
    option: PriceOption = 'C',
  ): Promise<{ count: number }> {
    const { total_items } = await this.getForMember(memCode, option);
    return { count: total_items };
  }
}
