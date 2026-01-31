import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'wangday_sumprice' })
export class WangdaySumPrice {
  @PrimaryGeneratedColumn({ name: 'wang_id' })
  wang_id: number;

  @Column({ name: 'wang_code', type: 'varchar', length: 16, collation: 'utf8_unicode_ci' })
  wang_code: string; // รหัสลูกค้า

  @Column({ name: 'wang_yo', type: 'decimal', precision: 10, scale: 2 })
  wang_yo: string; // ยอดซื้อสินค้า ผีที่ผ่านมา (ยอดเก่าตั้ง)

  @Column({ name: 'wang_tgpm', type: 'decimal', precision: 10, scale: 2 })
  wang_tgpm: string; // เป้าหมายรายเดือน (ยอดที่ลูกค้าต้องสั่งซื้อ/เดือน ขั้นต่ำ)

  @Column({ name: 'wang_tg9', type: 'decimal', precision: 10, scale: 2 })
  wang_tg9: string; // เป้าหมายรวมที่ลูกค้าต้องสั่งซื้อ หากต้องการจะได้รับ รีเบท (ปีนี้เล่น 9 เดือน)

  @Column({ name: 'wang_gif', type: 'decimal', precision: 10, scale: 2 })
  wang_gif: string; // มูลค่ารีเบท หรือ ผลตอบแทนที่ลูกค้าจะได้รับ
}
