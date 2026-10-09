import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-643 — เก็บประวัติ lot ของสินค้า + unique (pro_code, lot, mfg, exp)
 * เดิม add-lots ลบ lot เก่าทิ้งทุกครั้ง เปลี่ยนเป็นปิดด้วย is_active แทน
 * แถวที่มีอยู่แล้วถือเป็น lot ปัจจุบัน (is_active = 1)
 *
 * ก่อนสร้าง unique index:
 *  - แปลง NULL เป็น '' (NULL ไม่ถูกนับว่าซ้ำใน unique index)
 *  - ลดขนาด column ให้ index ไม่เกิน 3072 bytes (utf8mb4) — ถ้ามีค่าเกินขนาดใหม่
 *    MySQL strict mode จะ error แล้ว migration fail แทนการตัดข้อมูลทิ้ง
 *  - ลบแถวซ้ำ เก็บแถว lot_id ล่าสุดไว้
 */
export class AddLotHistory20260925000100 implements MigrationInterface {
  name = 'AddLotHistory20260925000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('lot', 'is_active'))) {
      await queryRunner.query(
        'ALTER TABLE `lot` ADD `is_active` tinyint NOT NULL DEFAULT 1',
      );
    }
    if (!(await queryRunner.hasColumn('lot', 'created_at'))) {
      await queryRunner.query(
        'ALTER TABLE `lot` ADD `created_at` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6)',
      );
    }
    if (!(await queryRunner.hasColumn('lot', 'updated_at'))) {
      await queryRunner.query(
        'ALTER TABLE `lot` ADD `updated_at` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
      );
    }

    const table = await queryRunner.getTable('lot');
    if (table?.indices.some((i) => i.name === 'UQ_lot_pro_code_lot_mfg_exp')) {
      return;
    }

    // TRIM ด้วย — ข้อมูลจริงมี lot ที่มีช่องว่างหัว/ท้าย (เช่น ' DC.25005', '109803 ')
    // ส่วน LotService.upsertLots trim ค่าที่ส่งเข้ามา ถ้าไม่ trim ของเดิมจะไม่ match กัน
    await queryRunner.query(
      "UPDATE `lot` SET `lot` = TRIM(COALESCE(`lot`, '')), `mfg` = TRIM(COALESCE(`mfg`, '')), `exp` = TRIM(COALESCE(`exp`, ''))",
    );
    await queryRunner.query(
      "ALTER TABLE `lot` MODIFY `lot` varchar(50) NOT NULL DEFAULT '', MODIFY `mfg` varchar(20) NOT NULL DEFAULT '', MODIFY `exp` varchar(20) NOT NULL DEFAULT ''",
    );
    await queryRunner.query(
      'DELETE older FROM `lot` older JOIN `lot` newer ON newer.`pro_code` <=> older.`pro_code` AND newer.`lot` = older.`lot` AND newer.`mfg` = older.`mfg` AND newer.`exp` = older.`exp` AND newer.`lot_id` > older.`lot_id`',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX `UQ_lot_pro_code_lot_mfg_exp` ON `lot` (`pro_code`, `lot`, `mfg`, `exp`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('lot');
    if (table?.indices.some((i) => i.name === 'UQ_lot_pro_code_lot_mfg_exp')) {
      await queryRunner.query(
        'DROP INDEX `UQ_lot_pro_code_lot_mfg_exp` ON `lot`',
      );
    }
    await queryRunner.query(
      'ALTER TABLE `lot` MODIFY `lot` varchar(255) NULL, MODIFY `mfg` varchar(255) NULL, MODIFY `exp` varchar(255) NULL',
    );
    // lot ที่ถูกปิดไว้เป็นประวัติจะกลายเป็น lot ปัจจุบันถ้าไม่ลบ — ลบทิ้งให้เหมือนพฤติกรรมเดิม
    if (await queryRunner.hasColumn('lot', 'is_active')) {
      await queryRunner.query('DELETE FROM `lot` WHERE `is_active` = 0');
      await queryRunner.query('ALTER TABLE `lot` DROP COLUMN `is_active`');
    }
    if (await queryRunner.hasColumn('lot', 'updated_at')) {
      await queryRunner.query('ALTER TABLE `lot` DROP COLUMN `updated_at`');
    }
    if (await queryRunner.hasColumn('lot', 'created_at')) {
      await queryRunner.query('ALTER TABLE `lot` DROP COLUMN `created_at`');
    }
  }
}
