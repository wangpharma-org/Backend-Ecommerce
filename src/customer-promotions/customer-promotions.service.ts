import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from 'src/users/users.entity';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { PromotionRewardEntity } from 'src/promotion/promotion-reward.entity';
import { PromotionTierExclusionEntity } from 'src/promotion/promotion-tier-exclusion.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import { FlashSaleEntity } from 'src/flashsale/flashsale.entity';
import {
  flashsaleClock,
  flashsaleDate,
  isFlashsaleLive,
} from 'src/flashsale/flashsale.service';
import { BundleSetEntity } from 'src/bundle-set/bundle-set.entity';
import { ProductEntity } from 'src/products/products.entity';
import { SpecialCollectionService } from 'src/special-collection/special-collection.service';
import { HappyHourService } from 'src/happy-hour/happy-hour.service';
import { WangdayService } from 'src/wangday/wangday.service';
import { getTodayRange } from 'src/utils/date.util';
import {
  MEM_CODE_PATTERN,
  bangkokToday,
  hhmm,
  isDateInRange,
  matchedProCodes,
  num,
  parseProCodes,
  rebateSeason,
  unitNameOf,
  imageUrl,
} from './customer-promotions.util';
import type {
  CurrentPromotionsResponse,
  CustomerPromotionsResponse,
  PromotionSampleProduct,
  PromotionView,
} from './customer-promotions.types';

type UnitDef = { level: number; unit_name: string };

/** Hot Deal ในแถบโปรของทุกคน — ส่งไม่เกินเท่านี้ (หน้ารายละเอียดบอกจำนวนทั้งหมด) */
export const CURRENT_HOTDEAL_LIMIT = 60;
/** สินค้าตัวอย่างต่อขั้น */
export const SAMPLE_PRODUCTS_PER_TIER = 12;

/**
 * โปรทั้งหมดที่ร้านหนึ่งร่วมได้ตอนนี้ — ให้ระบบขาย (หน้า Key ขาย) อ่านสดผ่าน /ecom/internal/customer-promotions
 * อ่านอย่างเดียว · ใช้ช่วงเวลาและกติกา L16 แบบเดียวกับหน้าร้านของแต่ละโปร
 */
@Injectable()
export class CustomerPromotionsService {
  private readonly logger = new Logger(CustomerPromotionsService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(PromotionConditionEntity)
    private readonly conditionRepo: Repository<PromotionConditionEntity>,
    @InjectRepository(PromotionRewardEntity)
    private readonly rewardRepo: Repository<PromotionRewardEntity>,
    @InjectRepository(PromotionTierExclusionEntity)
    private readonly exclusionRepo: Repository<PromotionTierExclusionEntity>,
    @InjectRepository(ProductUnitEntity)
    private readonly unitRepo: Repository<ProductUnitEntity>,
    @InjectRepository(HotdealEntity)
    private readonly hotdealRepo: Repository<HotdealEntity>,
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepo: Repository<FlashSaleEntity>,
    @InjectRepository(BundleSetEntity)
    private readonly bundleSetRepo: Repository<BundleSetEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly specialCollectionService: SpecialCollectionService,
    private readonly happyHourService: HappyHourService,
    private readonly wangdayService: WangdayService,
  ) {}

  async forCustomer(
    rawMemCode: unknown,
    rawProCodes: unknown,
  ): Promise<CustomerPromotionsResponse> {
    const memCode = typeof rawMemCode === 'string' ? rawMemCode.trim() : '';
    if (!MEM_CODE_PATTERN.test(memCode)) {
      throw new BadRequestException('ต้องระบุ mem_code ที่ถูกต้อง');
    }
    const parsed = parseProCodes(rawProCodes);
    if (!parsed.ok) throw new BadRequestException(parsed.message);
    const proCodes = parsed.codes;

    const member = await this.userRepo.findOne({
      where: { mem_code: memCode },
      select: { mem_code: true, mem_route: true },
    });
    if (!member) throw new NotFoundException(`ไม่พบร้าน ${memCode}`);
    const isL16 = (member.mem_route ?? '').toUpperCase() === 'L16';

    const [
      promotions,
      hotDeals,
      flashSales,
      happyHour,
      specialCollections,
      bundleSets,
      wangRebate,
    ] = await Promise.all([
      this.promotions(proCodes, isL16),
      this.hotDeals(proCodes, isL16),
      this.flashSales(proCodes, isL16),
      this.happyHour(),
      this.specialCollections(memCode),
      this.bundleSets(proCodes),
      this.wangRebate(memCode),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      member: { memCode: member.mem_code, memRoute: member.mem_route ?? null },
      promotions,
      hotDeals,
      flashSales,
      happyHour,
      specialCollections,
      bundleSets,
      wangRebate,
    };
  }

  /**
   * โปรที่เปิดอยู่วันนี้สำหรับทุกคน — แถบโปรบนหัวทุกหน้าของระบบขาย (Tim 18 ต.ค. 2569)
   * ไม่ผูกร้าน: มุมมองร้านทั่วไป (ไม่ใช่ L16) · ไม่มี Special Collection / Wang Rebate (เป็นของรายร้าน)
   */
  async current(): Promise<CurrentPromotionsResponse> {
    const [promotions, hot, flashSales, happyHour, bundleSets] =
      await Promise.all([
        this.promotions([], false),
        this.allHotDeals(),
        this.flashSales([], false),
        this.happyHour(),
        this.bundleSets([]),
      ]);
    const samples = await this.sampleProducts(
      promotions.flatMap((p) =>
        p.tiers.filter((t) => !t.allProducts).map((t) => t.tierId),
      ),
    );
    return {
      generatedAt: new Date().toISOString(),
      promotions: promotions.map((p) => ({
        ...p,
        tiers: p.tiers.map((t) => ({
          ...t,
          sampleProducts: samples.get(t.tierId) ?? [],
        })),
      })),
      hotDeals: hot.items,
      hotDealTotal: hot.total,
      flashSales,
      happyHour,
      bundleSets,
    };
  }

  /** สินค้าตัวอย่างของแต่ละขั้น (ไม่เกิน SAMPLE_PRODUCTS_PER_TIER ตัว เรียงตามรหัส) */
  private async sampleProducts(
    tierIds: number[],
  ): Promise<Map<number, PromotionSampleProduct[]>> {
    const map = new Map<number, PromotionSampleProduct[]>();
    if (!tierIds.length) return map;
    const rows = await this.conditionRepo
      .createQueryBuilder('c')
      .innerJoin('c.product', 'product')
      .select('c.tier_id', 'tierId')
      .addSelect('product.pro_code', 'proCode')
      .addSelect('product.pro_name', 'proName')
      .addSelect('product.pro_nameTH', 'proNameTH')
      .addSelect('product.pro_imgmain', 'img')
      .where('c.tier_id IN (:...tierIds)', { tierIds })
      .orderBy('c.tier_id', 'ASC')
      .addOrderBy('product.pro_code', 'ASC')
      .getRawMany<{
        tierId: number;
        proCode: string;
        proName: string | null;
        proNameTH: string | null;
        img: string | null;
      }>();
    for (const r of rows) {
      const tierId = Number(r.tierId);
      const list = map.get(tierId) ?? [];
      if (list.length >= SAMPLE_PRODUCTS_PER_TIER) continue;
      list.push({
        proCode: r.proCode,
        name: r.proNameTH || r.proName || r.proCode,
        image: imageUrl(r.img),
      });
      map.set(tierId, list);
    }
    return map;
  }

  /** Hot Deal ทั้งหมด (ร้านทั่วไป ไม่ใช่ L16) ตามลำดับหน้าร้าน — ส่งไม่เกิน CURRENT_HOTDEAL_LIMIT พร้อมจำนวนทั้งหมด */
  private async allHotDeals(): Promise<{
    items: CustomerPromotionsResponse['hotDeals'];
    total: number;
  }> {
    const q = this.hotDealQuery(false);
    const [deals, total] = await Promise.all([
      q.clone().take(CURRENT_HOTDEAL_LIMIT).getMany(),
      q.clone().getCount(),
    ]);
    return { items: this.hotDealViews(deals), total };
  }

  /** Company Day / Wang Day ที่จัดวันนี้ — ช่วงวันเดียวกับ getAllTiers ของหน้าร้าน (เทียบทั้งวันเวลาไทย) */
  private async promotions(
    proCodes: string[],
    isL16: boolean,
  ): Promise<PromotionView[]> {
    const { startOfDay, endOfDay } = getTodayRange();
    const rows = await this.promotionRepo.find({
      where: {
        status: true,
        start_date: LessThanOrEqual(endOfDay),
        end_date: MoreThanOrEqual(startOfDay),
      },
      relations: { creditor: true, creditors: true, tiers: true },
      order: { start_date: 'ASC', promo_id: 'ASC' },
    });
    if (!rows.length) return [];

    const tierIds = rows.flatMap((p) => (p.tiers ?? []).map((t) => t.tier_id));
    if (!tierIds.length) return rows.map((p) => this.promotionView(p, []));

    const [counts, conditionHits, exclusionHits, rewards] = await Promise.all([
      this.conditionRepo
        .createQueryBuilder('c')
        .select('c.tier_id', 'tierId')
        .addSelect('COUNT(*)', 'n')
        .where('c.tier_id IN (:...tierIds)', { tierIds })
        .groupBy('c.tier_id')
        .getRawMany<{ tierId: number; n: string }>(),
      proCodes.length
        ? this.conditionRepo
            .createQueryBuilder('c')
            .select('c.tier_id', 'tierId')
            .addSelect('c.product_code', 'proCode')
            .where('c.tier_id IN (:...tierIds)', { tierIds })
            .andWhere('c.product_code IN (:...proCodes)', { proCodes })
            .getRawMany<{ tierId: number; proCode: string }>()
        : Promise.resolve([]),
      proCodes.length
        ? this.exclusionRepo.find({
            where: { tier_id: In(tierIds), product_code: In(proCodes) },
            select: { tier_id: true, product_code: true },
          })
        : Promise.resolve([]),
      this.rewardQuery(tierIds, isL16),
    ]);

    const countByTier = new Map(
      counts.map((c) => [Number(c.tierId), num(c.n)]),
    );
    const condByTier = groupSet(
      conditionHits,
      (h) => Number(h.tierId),
      (h) => h.proCode,
    );
    const exclByTier = groupSet(
      exclusionHits,
      (h) => h.tier_id,
      (h) => h.product_code,
    );

    const giftCodes = [
      ...new Set(rewards.map((r) => r.giftProduct?.pro_code).filter(Boolean)),
    ] as string[];
    const unitsByCode = await this.unitsOf(giftCodes);

    const rewardsByTier = new Map<
      number,
      PromotionView['tiers'][number]['rewards']
    >();
    for (const r of rewards) {
      const tierId = r.tier?.tier_id;
      const code = r.giftProduct?.pro_code;
      if (!tierId || !code) continue;
      const list = rewardsByTier.get(tierId) ?? [];
      list.push({
        proCode: code,
        name: r.giftProduct.pro_nameTH || r.giftProduct.pro_name || code,
        qty: num(r.qty),
        unit: unitNameOf(r.unit, unitsByCode.get(code)),
        image: imageUrl(r.giftProduct.pro_imgmain),
      });
      rewardsByTier.set(tierId, list);
    }

    return rows.map((p) =>
      this.promotionView(
        p,
        [...(p.tiers ?? [])]
          .sort(
            (a, b) =>
              num(a.min_amount) - num(b.min_amount) || a.tier_id - b.tier_id,
          )
          .map((t) => ({
            tierId: t.tier_id,
            name: t.tier_name,
            minAmount: num(t.min_amount),
            isUnit: Boolean(t.is_unit),
            allProducts: Boolean(t.all_products),
            description: t.description ?? null,
            conditionCount: t.all_products
              ? null
              : (countByTier.get(t.tier_id) ?? 0),
            matchedProCodes: matchedProCodes(
              proCodes,
              { allProducts: Boolean(t.all_products) },
              condByTier.get(t.tier_id) ?? new Set(),
              exclByTier.get(t.tier_id) ?? new Set(),
            ),
            poster: imageUrl(t.tier_postter),
            rewards: rewardsByTier.get(t.tier_id) ?? [],
          })),
      ),
    );
  }

  private promotionView(
    p: PromotionEntity,
    tiers: PromotionView['tiers'],
  ): PromotionView {
    const creditors = new Map<string, string>();
    if (p.creditor)
      creditors.set(p.creditor.creditor_code, p.creditor.creditor_name);
    for (const c of p.creditors ?? [])
      creditors.set(c.creditor_code, c.creditor_name);
    return {
      promoId: p.promo_id,
      name: p.promo_name,
      // มีบริษัทหลัก = Company Day · ไม่มี = Wang Day (เหมือน getPromotionType ของ PromotionService)
      type: p.creditor ? 'company' : 'wang',
      creditors: [...creditors].map(([code, name]) => ({ code, name })),
      startDate: new Date(p.start_date).toISOString(),
      endDate: new Date(p.end_date).toISOString(),
      poster: imageUrl(p.promo_poster),
      tiers,
    };
  }

  /** ของแถมทุกตัวของขั้น — ร้าน L16 ไม่เห็นของแถม pro_l16_only (เหมือน getAllTiers) */
  private rewardQuery(tierIds: number[], isL16: boolean) {
    const q = this.rewardRepo
      .createQueryBuilder('reward')
      .leftJoin('reward.tier', 'tier')
      .leftJoin('reward.giftProduct', 'giftProduct')
      .select([
        'reward.reward_id',
        'reward.qty',
        'reward.unit',
        'tier.tier_id',
        'giftProduct.pro_code',
        'giftProduct.pro_name',
        'giftProduct.pro_nameTH',
        'giftProduct.pro_imgmain',
      ])
      .where('tier.tier_id IN (:...tierIds)', { tierIds })
      .orderBy('reward.reward_id', 'ASC');
    if (isL16) {
      q.andWhere(
        '(giftProduct.pro_l16_only = 0 OR giftProduct.pro_l16_only IS NULL)',
      );
    }
    return q.getMany();
  }

  /** Hot Deal ของสินค้าที่ส่งมา — ร้านที่ไม่ใช่ L16 ไม่เห็นดีลที่มีสินค้า pro_l16_only (เหมือนหน้าร้าน) */
  private async hotDeals(
    proCodes: string[],
    isL16: boolean,
  ): Promise<CustomerPromotionsResponse['hotDeals']> {
    if (!proCodes.length) return [];
    const deals = await this.hotDealQuery(isL16)
      .andWhere('product.pro_code IN (:...proCodes)', { proCodes })
      .getMany();
    return this.hotDealViews(deals);
  }

  private hotDealQuery(isL16: boolean) {
    const q = this.hotdealRepo
      .createQueryBuilder('hotdeal')
      .leftJoinAndSelect('hotdeal.product', 'product')
      .leftJoinAndSelect('product.units', 'units1')
      .leftJoinAndSelect('hotdeal.product2', 'product2')
      .leftJoinAndSelect('product2.units', 'units2')
      .where('product.pro_code IS NOT NULL')
      .andWhere('product2.pro_code IS NOT NULL')
      .orderBy('hotdeal.order', 'ASC');
    if (!isL16) {
      q.andWhere(
        '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)',
      ).andWhere(
        '(product2.pro_l16_only = 0 OR product2.pro_l16_only IS NULL)',
      );
    }
    return q;
  }

  private hotDealViews(
    deals: HotdealEntity[],
  ): CustomerPromotionsResponse['hotDeals'] {
    return deals
      .filter((d) => d.product && d.product2)
      .map((d) => ({
        proCode: d.product.pro_code,
        name: d.product.pro_nameTH || d.product.pro_name || d.product.pro_code,
        buyQty: num(d.pro1_amount),
        buyUnit: unitNameOf(d.pro1_unit, d.product.units),
        giftProCode: d.product2.pro_code,
        giftName:
          d.product2.pro_nameTH || d.product2.pro_name || d.product2.pro_code,
        giftQty: num(d.pro2_amount),
        // หน่วยของแถมใช้หน่วยของสินค้าแถมเอง (G-001)
        giftUnit: unitNameOf(d.pro2_unit, d.product2.units),
        title: d.promo_title ?? null,
        kind: d.special_deal ? 'product-pro' : 'buy-more-get-1',
        image: imageUrl(d.product.pro_imgmain),
        giftImage: imageUrl(d.product2.pro_imgmain),
      }));
  }

  /** Flash Sale วันนี้ที่เปิดอยู่ — live = อยู่ในช่วงเวลาตอนนี้ · กติกา L16 แบบ flashsaleQuery ของหน้าร้าน */
  private async flashSales(
    proCodes: string[],
    isL16: boolean,
  ): Promise<CustomerPromotionsResponse['flashSales']> {
    const clock = flashsaleClock();
    const q = this.flashSaleRepo
      .createQueryBuilder('flash')
      .leftJoinAndSelect('flash.flashsaleProducts', 'fsp')
      .leftJoinAndSelect('fsp.product', 'product')
      .where('flash.date = :date', { date: clock.date })
      .andWhere('flash.is_active = :active', { active: true })
      .orderBy('flash.time_start', 'ASC');
    if (isL16) {
      q.andWhere('(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)');
    }
    const flashes = await q.getMany();
    const wanted = new Set(proCodes);
    return flashes
      .map((f) => ({
        id: f.promotion_id,
        name: f.promotion_name,
        date: flashsaleDate(f.date),
        timeStart: hhmm(f.time_start),
        timeEnd: hhmm(f.time_end),
        live: isFlashsaleLive(f, clock),
        products: (f.flashsaleProducts ?? [])
          .filter(
            (p) =>
              p.product && (!wanted.size || wanted.has(p.product.pro_code)),
          )
          .map((p) => ({
            proCode: p.product.pro_code,
            limit: p.limit ?? null,
            name:
              p.product.pro_nameTH || p.product.pro_name || p.product.pro_code,
            image: imageUrl(p.product.pro_imgmain),
          })),
      }))
      .filter((f) => !wanted.size || f.products.length > 0);
  }

  /** Happy Hour: เปิดอยู่และวันนี้อยู่ในช่วงของ config — ส่งเฉพาะช่องที่เปิด */
  private async happyHour(): Promise<CustomerPromotionsResponse['happyHour']> {
    try {
      const config = await this.happyHourService.getConfig();
      const today = bangkokToday();
      if (
        !config.is_enabled ||
        !isDateInRange(today, config.start_date, config.end_date)
      ) {
        return null;
      }
      const slots = (await this.happyHourService.getSlots()).filter(
        (s): s is NonNullable<typeof s> => !!s && s.is_active,
      );
      return {
        startDate: config.start_date
          ? String(config.start_date).slice(0, 10)
          : null,
        endDate: config.end_date ? String(config.end_date).slice(0, 10) : null,
        slots: slots.map((s) => ({
          startTime: hhmm(s.start_time),
          endTime: hhmm(s.end_time),
          minOrderAmount: num(s.min_order_amount),
          scope: s.min_order_scope,
          vendorCode: s.min_order_vendor_code ?? null,
          rewardType: s.reward_type,
          rewardValue: num(s.reward_value),
          rewardProCode: s.reward_pro_code ?? null,
        })),
      };
    } catch (error) {
      // Happy Hour อยู่อีกฐาน (e-commerce-database-other) — ล้มแล้วไม่ทำให้โปรอื่นหาย แต่ต้องเห็นใน log
      this.logger.error(
        'อ่าน Happy Hour ไม่ได้',
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /** Special Collection ที่ร้านนี้เห็น (ทุกร้าน หรือเลือกร้านนี้) และอยู่ในช่วงวัน — ใช้ตรรกะเดียวกับหน้าร้าน */
  private async specialCollections(
    memCode: string,
  ): Promise<CustomerPromotionsResponse['specialCollections']> {
    const { collections } =
      await this.specialCollectionService.getForMember(memCode);
    return collections.map((c) => ({
      id: c.collection_id,
      name: c.name,
      startDate: c.start_date ? new Date(c.start_date).toISOString() : null,
      endDate: c.end_date ? new Date(c.end_date).toISOString() : null,
      items: c.items.map((i) => ({
        refType: i.ref_type,
        refId: String(i.ref_id),
        label: i.title_override ?? i.display_name ?? null,
      })),
    }));
  }

  /** Bundle Set ที่เปิดขายตอนนี้ — ส่งสินค้ามา = เฉพาะชุดที่มีสินค้านั้น */
  private async bundleSets(
    proCodes: string[],
  ): Promise<CustomerPromotionsResponse['bundleSets']> {
    const now = new Date();
    const sets = await this.bundleSetRepo
      .createQueryBuilder('bundle')
      .leftJoinAndSelect('bundle.items', 'item')
      .where('bundle.status = :status', { status: true })
      .andWhere('(bundle.start_date IS NULL OR bundle.start_date <= :now)', {
        now,
      })
      .andWhere('(bundle.end_date IS NULL OR bundle.end_date >= :now)', { now })
      .orderBy('bundle.sort_order', 'ASC')
      .addOrderBy('bundle.set_code', 'ASC')
      .addOrderBy('item.sort_order', 'ASC')
      .getMany();
    const wanted = new Set(proCodes);
    const picked = sets.filter(
      (s) =>
        !wanted.size || (s.items ?? []).some((i) => wanted.has(i.pro_code)),
    );
    const itemCodes = [
      ...new Set(picked.flatMap((s) => (s.items ?? []).map((i) => i.pro_code))),
    ];
    const products = itemCodes.length
      ? await this.productRepo.find({
          where: { pro_code: In(itemCodes) },
          select: {
            pro_code: true,
            pro_name: true,
            pro_nameTH: true,
            pro_imgmain: true,
          },
        })
      : [];
    const productBy = new Map(products.map((p) => [p.pro_code, p]));
    return picked
      .filter(
        (s) =>
          !wanted.size || (s.items ?? []).some((i) => wanted.has(i.pro_code)),
      )
      .map((s) => ({
        setCode: s.set_code,
        name: s.set_name,
        price: num(s.price),
        startDate: s.start_date ? new Date(s.start_date).toISOString() : null,
        endDate: s.end_date ? new Date(s.end_date).toISOString() : null,
        image: imageUrl(s.image),
        items: (s.items ?? []).map((i) => {
          const p = productBy.get(i.pro_code);
          return {
            proCode: i.pro_code,
            qty: num(i.qty),
            unitLevel: num(i.unit_level),
            isGift: Boolean(i.is_gift),
            name: p?.pro_nameTH || p?.pro_name || i.pro_code,
            image: imageUrl(p?.pro_imgmain),
          };
        }),
      }));
  }

  /**
   * Wang Rebate ของร้าน (ตาราง wangday / wangday_sumprice) — ฤดู เม.ย.–ธ.ค.
   * ยอดรายเดือนใช้ getMonthlySumByWangCode เดิม ซึ่งรวมตามเลขเดือน (ตารางเก็บฤดูเดียว จากการนำเข้า Excel)
   */
  private async wangRebate(
    memCode: string,
  ): Promise<CustomerPromotionsResponse['wangRebate']> {
    const [{ data: target }, { monthly }] = await Promise.all([
      this.wangdayService.getAllWangSumPrice(memCode),
      this.wangdayService.getMonthlySumByWangCode(memCode),
    ]);
    const season = rebateSeason();
    const months = season.months.map((m) => ({
      month: m.month,
      amount: num(monthly[m.monthNumber]),
    }));
    const total = months.reduce((sum, m) => sum + m.amount, 0);
    if (!target && total === 0) return null;
    return {
      seasonStart: season.seasonStart,
      seasonEnd: season.seasonEnd,
      lastYear: num(target?.wang_yo),
      monthlyTarget: num(target?.wang_tgpm),
      seasonTarget: num(target?.wang_tg9),
      rebate: num(target?.wang_gif),
      monthly: months,
      total: Math.round(total * 100) / 100,
    };
  }

  private async unitsOf(codes: string[]): Promise<Map<string, UnitDef[]>> {
    const map = new Map<string, UnitDef[]>();
    if (!codes.length) return map;
    const units = await this.unitRepo.find({
      where: { pro_code: In(codes) },
      select: { pro_code: true, level: true, unit_name: true },
    });
    for (const u of units) {
      const list = map.get(u.pro_code) ?? [];
      list.push({ level: u.level, unit_name: u.unit_name });
      map.set(u.pro_code, list);
    }
    return map;
  }
}

function groupSet<T>(
  rows: readonly T[],
  key: (row: T) => number,
  value: (row: T) => string,
): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  for (const row of rows) {
    const k = key(row);
    const set = map.get(k) ?? new Set<string>();
    set.add(value(row));
    map.set(k, set);
  }
  return map;
}
