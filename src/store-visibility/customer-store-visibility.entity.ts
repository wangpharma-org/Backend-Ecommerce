import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// ECWC-600: สามสถานะ ไม่ใช่ boolean — ต้องแยก "ปฏิเสธแล้ว" ออกจาก "ยังไม่ถูกถาม"
// ไม่งั้นการ์ดขอความยินยอม (ECWC-617) จะตื๊อคนที่ตอบว่าไม่ไปตลอด
export type StoreVisibilityStatus = 'NOT_ASKED' | 'GRANTED' | 'DECLINED';

export const STORE_VISIBILITY_STATUSES: StoreVisibilityStatus[] = [
  'NOT_ASKED',
  'GRANTED',
  'DECLINED',
];

// ECWC-600/601: ลูกค้าแต่ละร้านเลือกเองว่ายอมให้ลูกค้าคนอื่นเห็นชื่อร้านหรือไม่ ตอนขนส่งส่งของถึงร้านนี้
// ไม่มีแถว = ยังไม่ถูกถาม และยังไม่ยินยอม (คนอื่นเห็นแค่ถนน/ตำบล/อำเภอ/จังหวัด)
// ตารางนี้เก็บ "สถานะปัจจุบัน" ส่วนหลักฐานว่าใครกดอะไรเมื่อไหร่อยู่ใน customer_store_visibility_log
@Entity({ name: 'customer_store_visibility' })
export class CustomerStoreVisibilityEntity {
  @PrimaryColumn({ length: 50 })
  mem_code: string;

  @Column({
    type: 'enum',
    enum: STORE_VISIBILITY_STATUSES,
    default: 'NOT_ASKED',
  })
  status: StoreVisibilityStatus;

  // เวอร์ชันข้อความที่ลูกค้ายินยอมภายใต้ (null = ยังไม่เคยยินยอม)
  // ความยินยอมที่ผูกกับข้อความเวอร์ชันเก่าไม่นับ — ดู store-visibility.consent.ts
  @Column({ type: 'int', nullable: true, default: null })
  consent_version: number | null;

  // กี่ครั้งแล้วที่เอาการ์ดขอความยินยอมไปแสดงแล้วลูกค้าปัดทิ้ง — มีเพดานกันรบกวน
  @Column({ type: 'int', default: 0 })
  asked_count: number;

  @UpdateDateColumn()
  updated_at: Date;
}
