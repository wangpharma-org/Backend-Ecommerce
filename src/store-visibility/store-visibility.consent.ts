import { createHash } from 'crypto';

// ECWC-600 (PDPA): ข้อความขอความยินยอมอยู่ฝั่ง backend ที่เดียว frontend/แอปดึงจาก
// GET /ecom/store-visibility ไปแสดง — ถ้าให้แต่ละ client เขียนข้อความเอง เราจะพิสูจน์ไม่ได้ว่า
// ลูกค้ายินยอมโดยเห็นข้อความว่าอะไร
//
// แก้สาระสำคัญของข้อความ (ขอบเขตข้อมูลที่เปิดเผย / ใครเห็น) = ต้อง bump CONSENT_VERSION
// ความยินยอมเวอร์ชันเก่าจะไม่นับอีก (ดู findVisibleMemCodes) และต้องขอใหม่
// แก้แค่คำผิดหรือการจัดบรรทัด ไม่ต้อง bump
export const CONSENT_VERSION = 1;

export const CONSENT_TITLE = 'แสดงชื่อร้านให้ลูกค้าท่านอื่นเห็น';

export const CONSENT_DESCRIPTION =
  'เมื่อขนส่งส่งสินค้าถึงร้านของคุณ ลูกค้าที่รอรถคันเดียวกันจะเห็นชื่อร้านของคุณ ' +
  'หากปิดไว้จะเห็นเพียงถนน ตำบล อำเภอ จังหวัด';

export interface ConsentText {
  version: number;
  title: string;
  description: string;
}

export const CONSENT_TEXT: ConsentText = {
  version: CONSENT_VERSION,
  title: CONSENT_TITLE,
  description: CONSENT_DESCRIPTION,
};

// เก็บ hash ของข้อความลง log แทนตัวข้อความเต็ม — log โตช้ากว่า และยังพิสูจน์ได้ว่า
// ตอนนั้นลูกค้าเห็นข้อความชุดเดียวกับที่อยู่ในโค้ด version นั้นจริง
export const consentTextHash = (): string =>
  createHash('sha256')
    .update(`${CONSENT_VERSION}|${CONSENT_TITLE}|${CONSENT_DESCRIPTION}`)
    .digest('hex');
