import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// ECWC-600/601: ลูกค้าแต่ละร้านเลือกเองว่ายอมให้ลูกค้าคนอื่นเห็นชื่อร้านหรือไม่ ตอนขนส่งส่งของถึงร้านนี้
// ไม่มีแถว = ไม่ยอม (คนอื่นเห็นแค่ตำบล/อำเภอ/จังหวัด)
@Entity({ name: 'customer_store_visibility' })
export class CustomerStoreVisibilityEntity {
  @PrimaryColumn({ length: 50 })
  mem_code: string;

  @Column({ type: 'boolean', default: false })
  show_store_name: boolean;

  @UpdateDateColumn()
  updated_at: Date;
}
