import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * release-1.53.0 — ตามเก็บ `preorder_campaigns.open_notified_at` บน DB ใหม่
 *
 * TypeORM เรียง migration ด้วยเลข 13 หลักท้ายของชื่อ class: ไฟล์แบบวันที่ (เช่น 20261003000100 → 261003000100)
 * จึงรันก่อนไฟล์แบบ epoch ms (CreatePreorderTables1788998400000) บน DB ที่ยังไม่เคยรัน pre-order
 * AddPreorderOpenNotifiedAt20261003000100 เลยข้ามไปเพราะยังไม่มีตาราง — ไฟล์นี้ (epoch ms หลังสุด) เพิ่มคอลัมน์ให้
 * บน prod ที่รันครบแล้ว คอลัมน์มีอยู่ → no-op
 */
export class EnsurePreorderOpenNotifiedAt1791936000000 implements MigrationInterface {
  name = 'EnsurePreorderOpenNotifiedAt1791936000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('preorder_campaigns'))) return;
    if (
      !(await queryRunner.hasColumn('preorder_campaigns', 'open_notified_at'))
    ) {
      await queryRunner.query(
        'ALTER TABLE `preorder_campaigns` ADD `open_notified_at` datetime NULL AFTER `closing_reminded_at`',
      );
      await queryRunner.query(`
        UPDATE \`preorder_campaigns\`
        SET \`open_notified_at\` = NOW()
        WHERE \`status\` <> 'draft'
          AND (\`starts_at\` IS NULL OR \`starts_at\` <= NOW())
      `);
    }
  }

  public async down(): Promise<void> {
    // ไม่ drop — คอลัมน์เป็นของ AddPreorderOpenNotifiedAt20261003000100 (down ของไฟล์นั้นจัดการเอง)
  }
}
