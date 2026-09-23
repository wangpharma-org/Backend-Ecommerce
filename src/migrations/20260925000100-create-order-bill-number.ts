import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-559 — เลขบิลที่ระบบจัดออเดอร์ (order-picking) ส่งมา แสดงในหน้ารายละเอียดสถานะ
 * หนึ่งคำสั่งจองมีเลขบิลเดียว → soh_running เป็น primary key
 */
export class CreateOrderBillNumber20260925000100 implements MigrationInterface {
  name = 'CreateOrderBillNumber20260925000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('order_bill_number')) return;

    await queryRunner.query(`
      CREATE TABLE \`order_bill_number\` (
        \`soh_running\` varchar(60) NOT NULL,
        \`bill_number\` varchar(60) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`soh_running\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `order_bill_number`');
  }
}
