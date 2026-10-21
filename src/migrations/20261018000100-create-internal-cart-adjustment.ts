import { MigrationInterface, QueryRunner } from 'typeorm';

// ระบบขาย (Key ขาย) เอาสินค้าที่ลูกค้าค้างในตะกร้าไปใส่ใบสั่งจอง → ลดตะกร้าตอนบันทึกใบ / คืนตอนยกเลิกใบ
// แถวละ (order_ref, kind) — กันลด/คืนซ้ำเมื่อระบบขายส่งซ้ำ (retry) · result = แถวตะกร้าที่ลด/คืนจริง (ไว้คืนให้ตรง)
export class CreateInternalCartAdjustment20261018000100 implements MigrationInterface {
  name = 'CreateInternalCartAdjustment20261018000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('internal_cart_adjustment')) return;
    await queryRunner.query(`
      CREATE TABLE \`internal_cart_adjustment\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`order_ref\` varchar(64) NOT NULL,
        \`kind\` enum('consume','restore') NOT NULL,
        \`mem_code\` varchar(50) NOT NULL,
        \`result\` json NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_internal_cart_adjustment_ref_kind\` (\`order_ref\`, \`kind\`),
        KEY \`IDX_internal_cart_adjustment_mem\` (\`mem_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('internal_cart_adjustment'))
      await queryRunner.query('DROP TABLE `internal_cart_adjustment`');
  }
}
