import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'customer_delivery_preference' })
export class CustomerDeliveryPreferenceEntity {
  @PrimaryColumn({ length: 50 })
  mem_code: string;

  @Column({ length: 30 })
  preference: string;

  @UpdateDateColumn()
  updated_at: Date;
}
