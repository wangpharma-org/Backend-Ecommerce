import type { PromotionEntity } from './promotion.entity';

/// SSN0-255 — one Company Day as the sale service needs it for its activity
/// report: who takes part, when, and which products count. Product details stay
/// in the sale service (it has its own product table); only codes go across.
export interface CompanyDayReportPromotion {
  promoId: number;
  promoName: string;
  startDate: string;
  endDate: string;
  status: boolean;
  /// Admins soft-delete finished Company Days by hand — the report still needs them.
  deleted: boolean;
  creditors: { code: string; name: string | null }[];
  tiers: {
    tierId: number;
    tierName: string;
    minAmount: number;
    isUnit: boolean;
    /// true = every product in the store except `excludedProCodes`.
    allProducts: boolean;
    proCodes: string[];
    excludedProCodes: string[];
    rewards: {
      proCode: string;
      proName: string | null;
      qty: number;
      unit: string;
    }[];
  }[];
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/// The connection runs with `timezone: 'Z'`, so datetimes are real instants
/// (start 2026-04-07T17:00Z = 8 Apr in Bangkok). Report the Bangkok date.
export function toBangkokDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function toCompanyDayReport(
  promotion: PromotionEntity,
): CompanyDayReportPromotion {
  const creditors = new Map<string, string | null>();
  for (const c of [promotion.creditor, ...(promotion.creditors ?? [])]) {
    if (c?.creditor_code && !creditors.has(c.creditor_code)) {
      creditors.set(c.creditor_code, c.creditor_name ?? null);
    }
  }
  return {
    promoId: promotion.promo_id,
    promoName: promotion.promo_name?.trim() ?? '',
    startDate: toBangkokDate(promotion.start_date),
    endDate: toBangkokDate(promotion.end_date),
    status: Boolean(promotion.status),
    deleted: Boolean(promotion.deleted_at),
    creditors: [...creditors].map(([code, name]) => ({ code, name })),
    // Deleting a promotion leaves its tiers alone; a tier deleted on its own is gone.
    tiers: (promotion.tiers ?? [])
      .filter((tier) => !tier.deleted_at)
      .map((tier) => ({
        tierId: tier.tier_id,
        tierName: tier.tier_name,
        minAmount: Number(tier.min_amount ?? 0),
        isUnit: Boolean(tier.is_unit),
        allProducts: Boolean(tier.all_products),
        proCodes: [
          ...new Set(
            (tier.conditions ?? [])
              .map((c) => c.product?.pro_code)
              .filter((code): code is string => Boolean(code)),
          ),
        ],
        excludedProCodes: [
          ...new Set((tier.exclusions ?? []).map((e) => e.product_code)),
        ],
        rewards: (tier.rewards ?? [])
          .filter((r) => r.giftProduct?.pro_code)
          .map((r) => ({
            proCode: r.giftProduct.pro_code,
            proName: r.giftProduct.pro_name ?? null,
            qty: Number(r.qty ?? 0),
            unit: r.unit,
          })),
      })),
  };
}
