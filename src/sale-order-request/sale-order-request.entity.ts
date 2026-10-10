import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SaleCartSnapshot } from '../shopping-cart/shopping-cart.service';
import type {
  SaleOrderPaymentOption,
  SaleOrderShippingOption,
} from './sale-order-request.types';

export enum SaleOrderRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
}

export interface SaleOrderAddressSnapshot {
  id: number;
  name: string;
  fullName: string;
  mem_address: string;
  mem_village: string;
  mem_alley: string;
  mem_road: string;
  mem_tumbon: string;
  mem_amphur: string;
  mem_province: string;
  mem_post: string;
  phoneNumber: string;
  Note: string | null;
}

@Entity({ name: 'sale_order_requests' })
@Index('IDX_sale_order_requests_customer_status', ['customerCode', 'status'])
@Index('IDX_sale_order_requests_session', ['sessionId'])
export class SaleOrderRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_code', length: 30 })
  customerCode: string;

  @Column({ name: 'salesperson_code', length: 50 })
  salespersonCode: string;

  @Column({ name: 'session_id', length: 36 })
  sessionId: string;

  @Column({ length: 20, default: SaleOrderRequestStatus.PENDING })
  status: SaleOrderRequestStatus;

  @Column({ name: 'cart_version', length: 20 })
  cartVersion: string;

  @Column({ name: 'cart_snapshot', type: 'json' })
  cartSnapshot: SaleCartSnapshot;

  @Column({ name: 'address_snapshot', type: 'json' })
  addressSnapshot: SaleOrderAddressSnapshot;

  @Column({ name: 'price_option', length: 6 })
  priceOption: string;

  @Column({ name: 'shipping_option', length: 30 })
  shippingOption: SaleOrderShippingOption;

  @Column({ name: 'payment_option', length: 30 })
  paymentOption: SaleOrderPaymentOption;

  @Column({ name: 'quoted_total', type: 'decimal', precision: 16, scale: 2 })
  quotedTotal: string;

  @Column({ name: 'otp_attempts', type: 'int', default: 0 })
  otpAttempts: number;

  @Column({
    name: 'notified_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  notifiedAt: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'confirmed_order_numbers', type: 'json', nullable: true })
  confirmedOrderNumbers: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
