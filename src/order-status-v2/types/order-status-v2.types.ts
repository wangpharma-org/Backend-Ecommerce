export interface EcomOrderListV2Product {
  pro_code: string;
  pro_imgmain: string;
}

export interface EcomOrderListV2Item {
  spo_id: number;
  spo_qty: number;
  spo_unit: string;
}

export interface EcomOrderListV2Detail {
  pro_code: string;
  product: EcomOrderListV2Product;
  items: EcomOrderListV2Item[];
}

export interface EcomOrderListV2TotalSmallestUnit {
  pro_code: string;
  totalSmallestUnit: number;
}

export interface EcomOrderListV2Order {
  soh_running: string;
  soh_datetime: Date;
  soh_sumprice: number;
  soh_coin_recieve: number;
  details: number;
  totalSmallestUnit: EcomOrderListV2TotalSmallestUnit[];
  Newdetails: EcomOrderListV2Detail[];
  status: EcomOrderTimelineStatus;
  status_label: string;
}

export type EcomOrderListV2Res = EcomOrderListV2Order[];

// สถานะรวมของหน้า order-status — ECWC-403
export type EcomOrderTimelineStatus =
  | 'opened' // เปิดบิล
  | 'picking' // กำลังจัดออเดอร์
  | 'checking' // กำลังตรวจสอบออเดอร์
  | 'waiting_load' // รอขึ้นของ
  | 'delivering' // กำลังส่งออเดอร์
  | 'done' // ขอบคุณค่ะสั่งออเดอร์ใหม่ได้ทันทีนะคะ
  | 'blocked' // ติดปัญหา QC ต้องติดต่อร้าน
  | 'returned' // ตีกลับ
  | 'cancelled'; // ลูกค้ายกเลิก

export const ECOM_ORDER_TIMELINE_LABEL: Record<EcomOrderTimelineStatus, string> = {
  opened: 'เปิดบิล',
  picking: 'กำลังจัดออเดอร์',
  checking: 'กำลังตรวจสอบออเดอร์',
  waiting_load: 'รอขึ้นของ',
  delivering: 'กำลังส่งออเดอร์',
  done: 'ขอบคุณค่ะสั่งออเดอร์ใหม่ได้ทันทีนะคะ',
  blocked: 'ออเดอร์ติดปัญหา กรุณาติดต่อร้านค้า',
  returned: 'จัดส่งไม่สำเร็จ (ตีกลับ)',
  cancelled: 'ยกเลิกออเดอร์แล้ว',
};

export interface EcomOrderStatusV2Item {
  so_procode: string;
  product_name: string | null;
  so_amount: number;
  so_qc_amount: number;
  so_qc_deficit: number;
  so_qc_note: string | null;
  change_from_procode: string | null;
  so_price_unit: number | null;
  so_price_total: number | null;
  qc_price_total: number | null;
  // so_already_qc = 'RT' ฝั่ง Order Picking Service → ลูกค้าจะไม่ได้สินค้าตัวนี้ (สินค้าหมดชั่วคราว)
  is_rt: boolean;
}

export interface EcomOrderStatusV2Checkpoint {
  type: 'DEPARTURE' | 'STORE_DELIVERED';
  latitude: string;
  longitude: string;
  time: string | null;
}

export interface EcomOrderStatusV2Evidence {
  image1: string | null;
  image2: string | null;
  image3: string | null;
  image4: string | null;
  cancel_img: string | null;
  employee_sign: string | null;
}

export interface EcomOrderStatusV2Res {
  soh_running: string;
  status: EcomOrderTimelineStatus;
  status_label: string;
  picking: {
    picked_time: string | null;
    qc_time: string | null;
    price_before_qc: number | null;
    price_after_qc: number | null;
    items: EcomOrderStatusV2Item[];
  } | null;
  delivery: {
    driver_name: string | null;
    driver_tel: string | null;
    checkpoint: EcomOrderStatusV2Checkpoint | null;
    finished_at: string | null;
    evidence: EcomOrderStatusV2Evidence | null;
  } | null;
}
