import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StickerPrintType = 'print' | 'reprint' | 'test';

/**
 * ECWC-702 ประวัติการพิมพ์สติ๊กเกอร์ต่อ order line
 * สถานะ "พิมพ์แล้ว" และจำนวนครั้งพิมพ์นับจากตารางนี้ ไม่เก็บซ้ำที่ order
 */
@Entity({ name: 'sticker_print_log' })
@Index('IDX_sticker_print_log_line', ['order_line_id'])
export class StickerPrintLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** shopping_order.spo_id */
  @Column({ type: 'int' })
  order_line_id!: number;

  /** username จาก JWT เท่านั้น */
  @Column({ type: 'varchar', length: 100 })
  printed_by!: string;

  /** เวลา server เท่านั้น */
  @CreateDateColumn({ type: 'datetime' })
  printed_at!: Date;

  @Column({ type: 'enum', enum: ['print', 'reprint', 'test'] })
  print_type!: StickerPrintType;

  @Column({ type: 'int' })
  sheets!: number;

  @Column({ type: 'varchar', length: 100 })
  printer!: string;
}
