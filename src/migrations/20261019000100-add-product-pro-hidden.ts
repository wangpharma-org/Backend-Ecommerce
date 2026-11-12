import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WGDD-428: product.pro_hidden — งดแสดงสินค้าบนหน้าร้าน (sync จาก productservice `is_display` ผ่าน Kafka)
 * 1 = ซ่อนจากลูกค้าทุกหน้า + ห้ามสั่งซื้อ, 0 = แสดงปกติ
 */
export class AddProductProHidden20261019000100 implements MigrationInterface {
  name = 'AddProductProHidden20261019000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('product', 'pro_hidden'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD `pro_hidden` tinyint NOT NULL DEFAULT 0',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('product', 'pro_hidden')) {
      await queryRunner.query('ALTER TABLE `product` DROP COLUMN `pro_hidden`');
    }
  }
}
