import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-697 สติ๊กเกอร์ฉลากยา แบบพิมพ์หัวร้าน
 * - shopping_cart.custom_options / custom_options_hash: รูปแบบต่อแถว (รูปแบบต่างกัน = คนละแถว)
 * - shopping_order.custom_options: snapshot ณ ตอนสั่ง
 * - sticker_print_log: ประวัติการพิมพ์ (สถานะ/จำนวนครั้งนับจากตารางนี้)
 * - feature flag sticker_label เริ่มต้นปิด
 */
export class AddStickerLabel20261012000100 implements MigrationInterface {
  name = 'AddStickerLabel20261012000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('shopping_cart', 'custom_options'))) {
      await queryRunner.query(
        `ALTER TABLE \`shopping_cart\` ADD \`custom_options\` json NULL DEFAULT NULL`,
      );
    }
    if (
      !(await queryRunner.hasColumn('shopping_cart', 'custom_options_hash'))
    ) {
      await queryRunner.query(
        `ALTER TABLE \`shopping_cart\` ADD \`custom_options_hash\` varchar(40) NULL DEFAULT NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX \`IDX_shopping_cart_custom_hash\` ON \`shopping_cart\` (\`custom_options_hash\`)`,
      );
    }
    if (!(await queryRunner.hasColumn('shopping_order', 'custom_options'))) {
      await queryRunner.query(
        `ALTER TABLE \`shopping_order\` ADD \`custom_options\` json NULL DEFAULT NULL`,
      );
    }

    if (!(await queryRunner.hasTable('sticker_print_log'))) {
      await queryRunner.query(
        `CREATE TABLE \`sticker_print_log\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`order_line_id\` int NOT NULL,
          \`printed_by\` varchar(100) NOT NULL,
          \`printed_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`print_type\` enum('print','reprint','test') NOT NULL,
          \`sheets\` int NOT NULL,
          \`printer\` varchar(100) NOT NULL,
          INDEX \`IDX_sticker_print_log_line\` (\`order_line_id\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB`,
      );
    }

    // feature flag เริ่มต้นเป็นปิด เปิดผ่านหน้า admin feature-flag เมื่อสินค้า/ราคาพร้อม
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'sticker_label', 0 FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'sticker_label')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`feature_flag\` WHERE \`feature_key\` = 'sticker_label'`,
    );
    if (await queryRunner.hasTable('sticker_print_log')) {
      await queryRunner.query('DROP TABLE `sticker_print_log`');
    }
    if (await queryRunner.hasColumn('shopping_order', 'custom_options')) {
      await queryRunner.query(
        'ALTER TABLE `shopping_order` DROP COLUMN `custom_options`',
      );
    }
    if (await queryRunner.hasColumn('shopping_cart', 'custom_options_hash')) {
      await queryRunner.query(
        'DROP INDEX `IDX_shopping_cart_custom_hash` ON `shopping_cart`',
      );
      await queryRunner.query(
        'ALTER TABLE `shopping_cart` DROP COLUMN `custom_options_hash`',
      );
    }
    if (await queryRunner.hasColumn('shopping_cart', 'custom_options')) {
      await queryRunner.query(
        'ALTER TABLE `shopping_cart` DROP COLUMN `custom_options`',
      );
    }
  }
}
