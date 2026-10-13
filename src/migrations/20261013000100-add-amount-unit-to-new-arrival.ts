import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เก็บจำนวนและหน่วยของการรับเข้าแต่ละครั้งไว้ในตาราง new_arrival
 * (เดิมจำนวนถูกบวกสะสมเข้าตาราง lot อย่างเดียว จึงย้อนดูไม่ได้ว่าแต่ละครั้งรับเข้ากี่ชิ้น)
 * ใช้โดย GET /ecom/internal/new-arrivals — แถวเดิมเป็น NULL
 *
 * ต้องรัน migration นี้ก่อน deploy โค้ดที่บันทึกสองคอลัมน์นี้ ไม่งั้น POST /ecom/new-arrivals จะล้ม
 */
export class AddAmountUnitToNewArrival20261013000100 implements MigrationInterface {
  name = 'AddAmountUnitToNewArrival20261013000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('new_arrival', 'amount'))) {
      await queryRunner.query(
        'ALTER TABLE `new_arrival` ADD `amount` int NULL DEFAULT NULL',
      );
    }
    if (!(await queryRunner.hasColumn('new_arrival', 'unit'))) {
      await queryRunner.query(
        'ALTER TABLE `new_arrival` ADD `unit` varchar(50) NULL DEFAULT NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('new_arrival', 'unit')) {
      await queryRunner.query('ALTER TABLE `new_arrival` DROP COLUMN `unit`');
    }
    if (await queryRunner.hasColumn('new_arrival', 'amount')) {
      await queryRunner.query('ALTER TABLE `new_arrival` DROP COLUMN `amount`');
    }
  }
}
