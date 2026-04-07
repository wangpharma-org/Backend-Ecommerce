import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';
import { PromotionService } from '../promotion/promotion.service';

export interface CompanyDayAnalyticDto {
  promo_id: number;
  promo_name: string;
  event: 'view' | 'addcart' | 'purchase';
  source: string;
  tier: string;
  mem_code: string;
}

export interface CompanyDayContextPayload {
  promo_id: number;
  promo_name: string;
  tier: string;
  source: string;
}

interface CompanyDayTierCandidate {
  tier_name?: string;
  min_amount?: number | string;
  promotion?: {
    promo_name?: string;
  };
}

interface CompanyDayProductTierCandidate {
  tier?: CompanyDayTierCandidate;
}

@Injectable()
export class CompanyDayAnalyticService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CompanyDayAnalyticService.name);

  constructor(
    @Inject(COMPANY_DAY_ANALYTIC_KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
    private readonly promotionService: PromotionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
  }

  normalizeContext(context?: CompanyDayContextPayload): {
    promo_id: number;
    promo_name: string;
    tier: string;
    source: string;
  } | null {
    if (!context) return null;
    const promoId = context.promo_id;
    const promoName = context.promo_name?.trim();
    const tier = context.tier?.trim();
    if (!promoName || !tier) return null;
    return {
      promo_id: promoId,
      promo_name: promoName,
      tier,
      source: this.normalizeSource(context.source),
    };
  }

  emitEvent(
    event: 'view' | 'addcart' | 'purchase',
    memCode: string,
    context?: CompanyDayContextPayload,
  ): void {
    const normalized = this.normalizeContext(context);
    if (!normalized || !memCode?.trim()) return;

    void this.sendAnalytic({
      ...normalized,
      event,
      mem_code: memCode.trim(),
    });
  }

  async resolveContextFromProductCartTotal(
    proCode: string,
    memCode: string,
    cartTotal: number,
  ): Promise<CompanyDayContextPayload | undefined> {
    if (!proCode?.trim() || !memCode?.trim()) return undefined;

    try {
      const productTierRows = (await this.promotionService.getTierWithProCode(
        proCode.trim(),
        memCode.trim(),
      )) as CompanyDayProductTierCandidate[];
      const tierCandidates = (productTierRows || [])
        .map((item) => item?.tier)
        .filter(Boolean) as CompanyDayTierCandidate[];

      return this.pickContextFromCandidates(
        tierCandidates,
        cartTotal,
        'cart_product_tier_progress',
      );
    } catch {
      return undefined;
    }
  }

  async resolveContextFromCartTotal(
    cartTotal: number,
  ): Promise<CompanyDayContextPayload | undefined> {
    if (!Number.isFinite(cartTotal) || cartTotal <= 0) return undefined;

    try {
      const tiers =
        (await this.promotionService.getTierAllProduct()) as CompanyDayTierCandidate[];
      return this.pickContextFromCandidates(
        tiers,
        cartTotal,
        'cart_tier_progress',
      );
    } catch {
      return undefined;
    }
  }

  async sendAnalytic(data: CompanyDayAnalyticDto): Promise<void> {
    if (!data.mem_code?.trim()) return;
    if (
      !data.promo_name?.trim() ||
      !data.tier?.trim() ||
      !data.source?.trim()
    ) {
      return;
    }

    try {
      await firstValueFrom(this.kafkaClient.emit('company_day_analytic', data));
    } catch (error) {
      this.logger.warn(
        `Failed to emit company day analytic: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private normalizeSource(source?: string): string {
    const raw = source?.trim();
    if (!raw) return 'web';
    if (!raw.startsWith('/')) return raw;

    const pathname = raw.split('?')[0].split('#')[0];
    const sourceByPath: Record<string, string> = {
      '/': 'Home',
      '/cart': 'Cart',
      '/product-list': 'Product List',
      '/product-detail': 'Product Detail',
      '/hotdeal': 'Hotdeal',
    };

    if (sourceByPath[pathname]) return sourceByPath[pathname];

    const firstSegment = pathname.split('/').filter(Boolean)[0];
    if (!firstSegment) return 'Home';

    return firstSegment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private pickContextFromCandidates(
    tiers: CompanyDayTierCandidate[] | undefined,
    cartTotal: number,
    source: string,
  ): CompanyDayContextPayload | undefined {
    if (!tiers?.length || !Number.isFinite(cartTotal) || cartTotal < 0) {
      return undefined;
    }

    const normalized = tiers
      .map((tier) => ({
        tier_name: tier.tier_name?.trim() || '',
        min_amount: Number(tier.min_amount || 0),
        promo_name: tier.promotion?.promo_name?.trim() || '',
      }))
      .filter((tier) => tier.tier_name && Number.isFinite(tier.min_amount))
      .sort((a, b) => a.min_amount - b.min_amount);

    if (!normalized.length) return undefined;

    const eligible = [...normalized]
      .reverse()
      .find((tier) => cartTotal >= tier.min_amount);
    const selectedTier = eligible ?? normalized[0];

    return {
      promo_name:
        selectedTier.promo_name || `Company Day - ${selectedTier.tier_name}`,
      tier: selectedTier.tier_name,
      source,
    };
  }

  /**
   * Track purchase event safely (Fire & Forget)
   * ไม่ให้ error กระทบกับ main flow ของการ submit order
   */
  trackPurchaseEventSafely(
    memCode: string,
    cartSnapshot: Array<{ pro_code: string }>,
    cartTotal: number,
    fallbackTotal: number,
    frontendContext?: CompanyDayContextPayload,
  ): void {
    // Fire & Forget - ทำงานใน background ไม่ต้องรอ
    process.nextTick(async () => {
      try {
        this.logger.log('Starting purchase analytics calculation', {
          mem_code: memCode,
          cart_total: cartTotal,
          fallback_total: fallbackTotal,
        });

        let purchaseContextToUse: CompanyDayContextPayload | null | undefined =
          frontendContext;

        const actualCartTotal = Number(cartTotal || fallbackTotal || 0);
        let computedContext: CompanyDayContextPayload | undefined;

        // ส่วนที่ 1: เช็คว่ามีโปรโมชันเจาะจงสินค้าหรือไม่ (แบบเดียวกับ addcart)
        if (cartSnapshot && cartSnapshot.length > 0) {
          for (const item of cartSnapshot) {
            const productContext =
              await this.resolveContextFromProductCartTotal(
                item.pro_code,
                memCode,
                actualCartTotal,
              );
            if (productContext) {
              computedContext = productContext;
              this.logger.log('Found product-specific analytics context', {
                pro_code: item.pro_code,
                context: computedContext,
              });
              break; // เจอโปรแรกที่เข้าเงื่อนไข ให้หยุดหาเลย
            }
          }
        }

        // ส่วนที่ 2: ถ้าไม่เจอโปรโมชันระดับสินค้า ให้หาจากยอดรวมตะกร้า
        if (!computedContext) {
          computedContext =
            await this.resolveContextFromCartTotal(actualCartTotal);
          if (computedContext) {
            this.logger.log('Found cart-total analytics context', {
              cart_total: actualCartTotal,
              context: computedContext,
            });
          }
        }

        // ส่วนที่ 3: ผสมข้อมูล ถ้า Backend คำนวณได้ให้ใช้เป็นหลัก โดยดึง source จากฝั่งหน้าบ้านมาด้วย
        if (computedContext) {
          purchaseContextToUse = {
            ...frontendContext,
            promo_name: computedContext.promo_name,
            tier: computedContext.tier,
            source: frontendContext?.source ?? computedContext.source,
          };
        }

        // ส่วนที่ 4: ส่งข้อมูล Analytics
        const normalizedPurchaseContext = this.normalizeContext(
          purchaseContextToUse ?? undefined,
        );

        if (normalizedPurchaseContext) {
          this.emitEvent('purchase', memCode, normalizedPurchaseContext);
          this.logger.log('Purchase analytics event sent successfully', {
            mem_code: memCode,
            context: normalizedPurchaseContext,
          });
        } else {
          this.logger.log('No valid purchase analytics context found', {
            mem_code: memCode,
            frontend_context: frontendContext,
            computed_context: computedContext,
          });
        }
      } catch (error) {
        // เก็บ error ไว้ใน service ไม่ให้ออกไปข้างนอก
        this.logger.warn('Purchase analytics calculation failed (silent)', {
          mem_code: memCode,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    });
  }
}
