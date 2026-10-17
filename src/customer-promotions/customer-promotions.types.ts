/** รูปแบบคำตอบของ GET /ecom/internal/customer-promotions — สัญญากับระบบขาย (หน้า Key ขาย) */

export interface PromotionTierView {
  tierId: number;
  name: string;
  /** isUnit=true: จำนวนชิ้น · false: บาท */
  minAmount: number;
  isUnit: boolean;
  allProducts: boolean;
  description: string | null;
  /** จำนวนสินค้าที่นับยอดของขั้นนี้ · allProducts = null */
  conditionCount: number | null;
  /** pro_codes ที่ส่งมาซึ่งนับยอดขั้นนี้ */
  matchedProCodes: string[];
  rewards: { proCode: string; name: string; qty: number; unit: string }[];
}

export interface PromotionView {
  promoId: number;
  name: string;
  /** company = Company Day (มีบริษัท) · wang = Wang Day */
  type: 'company' | 'wang';
  creditors: { code: string; name: string }[];
  startDate: string;
  endDate: string;
  poster: string | null;
  tiers: PromotionTierView[];
}

export interface CustomerPromotionsResponse {
  generatedAt: string;
  member: { memCode: string; memRoute: string | null };
  promotions: PromotionView[];
  hotDeals: {
    proCode: string;
    buyQty: number;
    buyUnit: string;
    giftProCode: string;
    giftName: string;
    giftQty: number;
    giftUnit: string;
    title: string | null;
    kind: 'product-pro' | 'buy-more-get-1';
  }[];
  flashSales: {
    id: number;
    name: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    live: boolean;
    products: { proCode: string; limit: number | null }[];
  }[];
  happyHour: null | {
    startDate: string | null;
    endDate: string | null;
    slots: {
      startTime: string;
      endTime: string;
      minOrderAmount: number;
      scope: 'all' | 'specific' | 'vendor';
      vendorCode: string | null;
      rewardType: 'card' | 'bill_discount';
      rewardValue: number;
      rewardProCode: string | null;
    }[];
  };
  specialCollections: {
    id: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    items: { refType: string; refId: string; label: string | null }[];
  }[];
  bundleSets: {
    setCode: string;
    name: string;
    price: number;
    startDate: string | null;
    endDate: string | null;
    items: {
      proCode: string;
      qty: number;
      unitLevel: number;
      isGift: boolean;
    }[];
  }[];
  wangRebate: null | {
    seasonStart: string;
    seasonEnd: string;
    lastYear: number;
    monthlyTarget: number;
    seasonTarget: number;
    rebate: number;
    monthly: { month: string; amount: number }[];
    total: number;
  };
}
