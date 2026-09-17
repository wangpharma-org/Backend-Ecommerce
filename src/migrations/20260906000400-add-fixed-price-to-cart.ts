import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * กระเช้าสำเร็จรูป (bundle_set) เข้าตะกร้า — ทาง A
 * shopping_cart ไม่เคยเก็บราคา ทุกจุดคิดจาก product.pro_priceA/B/C
 * เพิ่มราคารวมต่อบรรทัดที่ล็อกไว้ (null = คิดราคาปกติ) และให้ cart_basket ชี้ set ได้
 */
export class AddFixedPriceToCart20260906000400 implements MigrationInterface {
  name = 'AddFixedPriceToCart20260906000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` ADD COLUMN `spc_fixed_total` decimal(16,2) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `cart_basket` MODIFY COLUMN `promo_id` int NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `cart_basket` ADD COLUMN `set_code` varchar(30) NULL DEFAULT NULL, ADD COLUMN `set_qty` int NULL DEFAULT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `cart_basket` DROP COLUMN `set_qty`, DROP COLUMN `set_code`',
    );
    await queryRunner.query(
      'ALTER TABLE `cart_basket` MODIFY COLUMN `promo_id` int NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` DROP COLUMN `spc_fixed_total`',
    );
  }
}
