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
  /** รูปของขั้น (tier_postter) */
  poster: string | null;
  rewards: {
    proCode: string;
    name: string;
    qty: number;
    unit: string;
    /** รูปของแถม (pro_imgmain ตามกติกาหน้าร้าน) */
    image: string | null;
  }[];
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
    /** ชื่อสินค้าที่ซื้อ */
    name: string;
    buyQty: number;
    buyUnit: string;
    giftProCode: string;
    giftName: string;
    giftQty: number;
    giftUnit: string;
    title: string | null;
    kind: 'product-pro' | 'buy-more-get-1';
    image: string | null;
    giftImage: string | null;
  }[];
  flashSales: {
    id: number;
    name: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    live: boolean;
    products: {
      proCode: string;
      limit: number | null;
      name: string;
      image: string | null;
    }[];
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
    image: string | null;
    items: {
      proCode: string;
      qty: number;
      unitLevel: number;
      isGift: boolean;
      name: string;
      image: string | null;
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

/** สินค้าตัวอย่างของขั้น (ไม่ครบทุกตัว — ดูจำนวนเต็มที่ conditionCount) */
export interface PromotionSampleProduct {
  proCode: string;
  name: string;
  image: string | null;
}

/**
 * โปรที่เปิดอยู่วันนี้สำหรับทุกคน (แถบโปรบนหัวหน้าระบบขาย) — ไม่ผูกร้าน จึงไม่มี Special Collection และ Wang Rebate
 * มุมมองเดียวกับร้านทั่วไป (ไม่ใช่ L16) · Hot Deal ส่งไม่เกิน CURRENT_HOTDEAL_LIMIT รายการ พร้อมจำนวนทั้งหมด
 */
export interface CurrentPromotionsResponse {
  generatedAt: string;
  promotions: (PromotionView & {
    tiers: (PromotionTierView & { sampleProducts: PromotionSampleProduct[] })[];
  })[];
  hotDeals: CustomerPromotionsResponse['hotDeals'];
  hotDealTotal: number;
  flashSales: CustomerPromotionsResponse['flashSales'];
  happyHour: CustomerPromotionsResponse['happyHour'];
  bundleSets: CustomerPromotionsResponse['bundleSets'];
}
