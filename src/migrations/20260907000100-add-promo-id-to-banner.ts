import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-532 — แบนเนอร์รูปใหญ่ผูกกับโปรโมชั่นได้ เพื่อมีปุ่ม "สรุปโปร" เปิด modal
 * null = แบนเนอร์ธรรมดาเหมือนเดิม ไม่ผูก FK เพราะ promotion ใช้ soft delete
 */
export class AddPromoIdToBanner20260907000100 implements MigrationInterface {
  name = 'AddPromoIdToBanner20260907000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `banner` ADD COLUMN `promo_id` int NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `banner` ADD INDEX `IDX_banner_promo` (`promo_id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `banner` DROP INDEX `IDX_banner_promo`');
    await queryRunner.query('ALTER TABLE `banner` DROP COLUMN `promo_id`');
  }
}
