import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-525 — บันทึกที่มาของบรรทัดออเดอร์
 *
 * shopping_order ได้คอลัมน์ NULL ได้ 2 ตัวบอกว่าบรรทัดมาจากกระเช้าไหน/ชุดไหน
 * และตาราง order_basket เก็บ snapshot ของกระเช้า ณ ตอนสั่ง เพราะ cart_basket ถูกลบหลังออกออเดอร์
 *
 * ระบบจัดของ/ERP อ่าน shopping_order ตรงจาก DB — เพิ่มได้เฉพาะคอลัมน์ใหม่แบบ NULL ห้ามแตะคอลัมน์เดิม
 */
export class AddOrderBasket20260908000100 implements MigrationInterface {
  name = 'AddOrderBasket20260908000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_order` ADD COLUMN `spo_basket_id` int NULL DEFAULT NULL, ADD COLUMN `spo_set_code` varchar(30) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_order` ADD INDEX `IDX_shopping_order_basket` (`spo_basket_id`)',
    );

    await queryRunner.query(`
      CREATE TABLE \`order_basket\` (
        \`order_basket_id\` int NOT NULL AUTO_INCREMENT,
        \`soh_running\` varchar(20) NOT NULL,
        \`basket_id\` int NOT NULL,
        \`kind\` varchar(10) NOT NULL,
        \`promo_id\` int NULL DEFAULT NULL,
        \`set_code\` varchar(30) NULL DEFAULT NULL,
        \`set_name\` varchar(200) NULL DEFAULT NULL,
        \`set_qty\` int NULL DEFAULT NULL,
        \`set_price\` decimal(16,2) NULL DEFAULT NULL,
        \`line_count\` int NOT NULL,
        \`total_amount\` decimal(16,2) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`order_basket_id\`),
        KEY \`IDX_order_basket_running\` (\`soh_running\`),
        KEY \`IDX_order_basket_basket\` (\`basket_id\`),
        KEY \`IDX_order_basket_set\` (\`set_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `order_basket`');
    await queryRunner.query(
      'ALTER TABLE `shopping_order` DROP INDEX `IDX_shopping_order_basket`',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_order` DROP COLUMN `spo_basket_id`, DROP COLUMN `spo_set_code`',
    );
  }
}
