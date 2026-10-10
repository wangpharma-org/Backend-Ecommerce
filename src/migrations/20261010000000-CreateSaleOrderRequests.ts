import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaleOrderRequests20261010000000 implements MigrationInterface {
  name = 'CreateSaleOrderRequests20261010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sale_order_requests (
        id varchar(36) NOT NULL,
        customer_code varchar(30) NOT NULL,
        salesperson_code varchar(50) NOT NULL,
        session_id varchar(36) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING',
        cart_version varchar(20) NOT NULL,
        cart_snapshot json NOT NULL,
        address_snapshot json NOT NULL,
        price_option varchar(6) NOT NULL,
        shipping_option varchar(30) NOT NULL,
        payment_option varchar(30) NOT NULL,
        quoted_total decimal(16,2) NOT NULL,
        otp_attempts int NOT NULL DEFAULT 0,
        notified_at datetime(6) NULL,
        expires_at datetime(6) NOT NULL,
        confirmed_order_numbers json NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_sale_order_requests_customer_status (customer_code, status),
        INDEX IDX_sale_order_requests_session (session_id),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE sale_order_requests');
  }
}
