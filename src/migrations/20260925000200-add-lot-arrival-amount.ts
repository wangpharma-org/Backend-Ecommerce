import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-643 — เก็บจำนวนรับเข้า (หน่วยเล็กสุด) + วันที่รับของ ของแต่ละ lot จาก new-arrivals
 * ใช้เทียบกับ stock ตอนแสดงผลว่าควรแสดง lot ล่าสุด 1 หรือ 2 lot (ดู lot-display.util.ts)
 * lot ที่มาจาก add-lots อย่างเดียวจะเป็น NULL ทั้งคู่
 */
export class AddLotArrivalAmount20260925000200 implements MigrationInterface {
  name = 'AddLotArrivalAmount20260925000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('lot', 'amount'))) {
      await queryRunner.query('ALTER TABLE `lot` ADD `amount` int NULL');
    }
    if (!(await queryRunner.hasColumn('lot', 'received_at'))) {
      await queryRunner.query(
        'ALTER TABLE `lot` ADD `received_at` datetime NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('lot', 'received_at')) {
      await queryRunner.query('ALTER TABLE `lot` DROP COLUMN `received_at`');
    }
    if (await queryRunner.hasColumn('lot', 'amount')) {
      await queryRunner.query('ALTER TABLE `lot` DROP COLUMN `amount`');
    }
  }
}
