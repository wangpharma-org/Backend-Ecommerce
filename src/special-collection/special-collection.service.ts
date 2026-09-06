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
        throw new BadRequestException(
          'กระเช้า/ชุดสำเร็จยังไม่เปิดใช้งาน (อยู่ระหว่างพัฒนา)',
        );
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

  async getCollection(collectionId: number): Promise<{
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

    return { collection, items: await this.resolveItems(items) };
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

  // ------------------------------------------------------------- ref resolve

  /** ดึง payload ของทุก item แบบ batch ต่อชนิด — กัน N+1 */
  private async resolveItems(
    items: SpecialCollectionItemEntity[],
  ): Promise<ResolvedCollectionItem[]> {
    if (items.length === 0) return [];

    const idsOf = (refType: SpecialCollectionRefType): string[] =>
      items.filter((item) => item.ref_type === refType).map((it) => it.ref_id);

    const numericIds = (refType: SpecialCollectionRefType): number[] =>
      idsOf(refType)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

    const [promotions, tiers, products, hotdeals, flashsales] =
      await Promise.all([
        this.loadPromotions(numericIds('promotion')),
        this.loadTiers(numericIds('tier')),
        this.loadProducts(idsOf('product')),
        this.loadHotdeals(numericIds('hotdeal')),
        this.loadFlashsales(numericIds('flashsale')),
      ]);

    const lookup: Record<string, Map<string, unknown>> = {
      promotion: promotions,
      tier: tiers,
      product: products,
      hotdeal: hotdeals,
      flashsale: flashsales,
      bundle_set: new Map<string, unknown>(),
    };

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
      };
    });
  }

  private async loadPromotions(ids: number[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (ids.length === 0) return map;

    const rows = await this.promotionRepo.find({
      where: { promo_id: In(ids) },
      relations: ['tiers', 'creditor'],
    });
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

    const rows = await this.tierRepo.find({
      where: { tier_id: In(ids) },
      relations: ['promotion'],
    });
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

  private async loadFlashsales(ids: number[]): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    if (ids.length === 0) return map;

    const rows = await this.flashsaleRepo.find({
      where: { promotion_id: In(ids) },
    });
    for (const flashsale of rows) {
      map.set(String(flashsale.promotion_id), flashsale);
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

  async getForMember(memCode: string): Promise<{
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
    const resolved = await this.resolveItems(allItems);

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
  async getBadgeCount(memCode: string): Promise<{ count: number }> {
    const { total_items } = await this.getForMember(memCode);
    return { count: total_items };
  }
}
