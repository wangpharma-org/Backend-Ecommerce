import { MigrationInterface, QueryRunner } from 'typeorm';

/// ECWC-766: ห้ามใส่ตะกร้าเกินสต็อก — สร้าง flag ไว้เป็นปิด เปิดเมื่อหน้าบ้าน/แอปแสดงข้อความพร้อมแล้ว
export class AddCartStockLimitFlag20261113000100 implements MigrationInterface {
  name = 'AddCartStockLimitFlag20261113000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'cart_stock_limit', false
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'cart_stock_limit')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'cart_stock_limit'",
    );
  }
}
