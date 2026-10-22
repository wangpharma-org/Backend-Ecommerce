import { createHash } from 'crypto';

// ECWC-600 (PDPA): ข้อความขอความยินยอมอยู่ฝั่ง backend ที่เดียว frontend/แอปดึงจาก
// GET /ecom/store-visibility ไปแสดง — ถ้าให้แต่ละ client เขียนข้อความเอง เราจะพิสูจน์ไม่ได้ว่า
// ลูกค้ายินยอมโดยเห็นข้อความว่าอะไร
//
// แก้สาระสำคัญของข้อความ (ขอบเขตข้อมูลที่เปิดเผย / ใครเห็น) = ต้อง bump CONSENT_VERSION
// ความยินยอมเวอร์ชันเก่าจะไม่นับอีก (ดู findVisibleMemCodes) และต้องขอใหม่
// แก้แค่คำผิดหรือการจัดบรรทัด ไม่ต้อง bump
//
// v2 (ECWC-617): ให้ตรงกับ ToS v2.5.0 ข้อ 7.3 + Privacy v1.7.0 ข้อ 5.1/5.6 — ยินยอมแล้วเปิดเผย
// ทั้งชื่อร้าน "และตำแหน่งที่แน่นอน" (v1 บอกแค่ชื่อร้าน ไม่ครบขอบเขตที่เปิดเผยจริง)
export const CONSENT_VERSION = 2;

// ชื่อเดียวกับที่ ToS ข้อ 7.3 อ้างถึง — แก้ที่นี่ต้องแก้ ToS ด้วย
export const CONSENT_TITLE = 'แสดงชื่อร้านและตำแหน่งร้านให้ลูกค้าท่านอื่นเห็น';

export const CONSENT_DESCRIPTION =
  'เมื่อรถขนส่งส่งสินค้าถึงร้านของคุณ ลูกค้าที่มีสินค้าอยู่บนรถคันเดียวกันจะเห็นชื่อร้านและตำแหน่งที่แน่นอนของร้านคุณ ' +
  'หากไม่เปิด จะเห็นเพียงถนน ตำบล อำเภอ จังหวัด และตำแหน่งโดยประมาณ (ราว 100 เมตร) ' +
  'เปลี่ยนใจได้ทุกเมื่อ และไม่กระทบการใช้บริการอื่น';

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
