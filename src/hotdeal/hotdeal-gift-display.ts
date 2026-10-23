/** ข้อมูลของแถมที่หน้าร้านใช้แสดงใต้สินค้า โดยหน่วยถูกแปลงเป็นชื่อแล้ว */
export interface HotdealGiftDisplay {
  id: number;
  buy_amount: string;
  buy_unit: string;
  gift_pro_code: string;
  gift_name: string;
  gift_image: string | null;
  gift_amount: string;
  gift_unit: string;
  promo_title: string | null;
  promo_body: string | null;
}
