import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * price_tag: tag ราคาที่ลูกค้าเห็นบนการ์ดสินค้า (old_price = ราคาเก่า · discount = ลดราคา)
 * แยกออกจาก price_type เดิมที่เก็บไว้ใช้ภายในเท่านั้น (eng_chiu, half_half) ลูกค้าไม่เห็น
 */
export class PreorderPriceTag1789200000000 implements MigrationInterface {
  name = 'PreorderPriceTag1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`preorder_products\`
        ADD \`price_tag\` enum('old_price','discount') NULL AFTER \`price_type\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`preorder_products\` DROP COLUMN \`price_tag\``,
    );
  }
}
