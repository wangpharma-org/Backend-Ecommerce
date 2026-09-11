// ECWC-4xx: type ตอบกลับให้ตรงกับ API เก่าฝั่ง PHP (Akitokung) เป๊ะๆ เพื่อให้ mobile app
// สลับมาเรียก endpoint ใหม่นี้แทนได้โดยไม่ต้องแก้โค้ด parsing ฝั่งแอป — คุมด้วย feature flag
// 'new_order_list_api' / 'new_order_detail_api' (GET /ecom/feature-flag/:flag)
//
// หมายเหตุ field ที่ยังเป็น best-effort/placeholder รอข้อมูลจริงมา refine:
// - LegacyOrderListItem.title: วันที่ในข้อความยังไม่รู้สูตรคำนวณจริงจาก PHP ใช้ soh_datetime ไปก่อน
// - LegacyOrderListItem.point / LegacyOrderDetailRes.gimmick_point: ตาม feedback ไม่ต้องแสดงจริง
//   ใส่ 0 คงที่
// - LegacyOrderDetailRes.timeline: PHP มีประวัติละเอียดกว่านี้ (หลาย sub-event ต่อ status พร้อม
//   เวลา) ฝั่งเราไม่มีข้อมูลระดับนั้น สร้างแค่ 1 entry ต่อ step ที่รู้จริง (เปิดบิล/จัดออเดอร์/ส่ง)
export interface LegacyOrderListProduct {
  thumbnail: string;
  pro_code: string;
  amountUnit: number;
  Unit: string;
}

export interface LegacyOrderListItem {
  orderNo: string;
  status: string;
  title: string;
  body: string;
  date: string;
  point: number;
  price: string;
  products: LegacyOrderListProduct[];
  // ECWC-545: มีเมื่อบิลมีสินค้า pro_code เดียวกันสั่งหลายหน่วย (เราแสดงแค่หน่วยแรกต่อ pro_code)
  note: string | null;
}

export interface LegacyTimelineDetail {
  title: string;
  detail: string;
  dateText: string;
}

export interface LegacyTimelineStep {
  status: string;
  detail: LegacyTimelineDetail[];
}

export interface LegacyOrderDetailProduct {
  thumbnail: string;
  pro_code: string;
  pro_name: string | null;
  order_amount: string;
  Unit: string;
  price_unit: string;
  discount: string;
  price_total: string;
  qc_amount: number;
}

export interface LegacyShipping {
  name: string;
  address: string;
  phone: string;
}

export interface LegacyOrderDetailRes {
  orderNo: string;
  timeline: LegacyTimelineStep[];
  shipping: LegacyShipping;
  products: LegacyOrderDetailProduct[];
  total_list: string;
  total_price: string;
  discount_price: string;
  shipping_price: string;
  gimmick_point: string;
  sumprice: string;
  pay_type: string;
  orderTime: string;
  No_order: string;
  // ECWC-545: มีเมื่อราคาบางรายการต้อง fallback มาจากฐานข้อมูล ecommerce เอง (บิลเก่าที่คลังไม่มีราคา)
  note: string | null;
}
