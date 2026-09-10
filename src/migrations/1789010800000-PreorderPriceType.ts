import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ประเภทราคาตามนิยามผู้บริหาร (10 ก.ย. 69) เก็บฝั่ง admin:
 * eng_chiu (เอ้งชิ้ว) · half_half (ครึ่งเก่าครึ่งใหม่) · old_price (ราคาเก่า) · new_price (ราคาใหม่) · discount (ลดราคา) · pp (public price)
 * ยังไม่แสดงให้ลูกค้าและไม่กระทบการคิดราคาในตะกร้า
 */
export class PreorderPriceType1789010800000 implements MigrationInterface {
  name = 'PreorderPriceType1789010800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`preorder_products\`
        ADD \`price_type\` enum('eng_chiu','half_half','old_price','new_price','discount','pp') NULL AFTER \`reason\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`preorder_products\` DROP COLUMN \`price_type\``,
    );
  }
}
