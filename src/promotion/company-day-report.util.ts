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

/// `datetime` columns come back as JS Dates in server local time (Asia/Bangkok
/// in every environment) — keep the wall-clock date, not the UTC one.
function toLocalDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    startDate: toLocalDate(promotion.start_date),
    endDate: toLocalDate(promotion.end_date),
    status: Boolean(promotion.status),
    creditors: [...creditors].map(([code, name]) => ({ code, name })),
    tiers: (promotion.tiers ?? []).map((tier) => ({
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
