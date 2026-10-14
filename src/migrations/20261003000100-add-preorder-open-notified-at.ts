import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-653 / ECWC-673 — เก็บเวลาที่แจ้งลูกค้า (LINE + FCM) ว่ารอบเปิดรับจองแล้ว กันแจ้งซ้ำ
 * รอบที่ลูกค้าเห็นไปแล้วก่อน deploy ถูก backfill เป็นเวลาปัจจุบัน ไม่งั้น cron จะแจ้งย้อนหลังทุกรอบ
 * รอบ draft และรอบที่ starts_at ยังไม่ถึงปล่อยเป็น NULL เพื่อให้แจ้งตอนเปิดจริง
 */
export class AddPreorderOpenNotifiedAt20261003000100 implements MigrationInterface {
  name = 'AddPreorderOpenNotifiedAt20261003000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // DB ใหม่: TypeORM เรียงตามเลข 13 หลักท้ายของชื่อ class → ไฟล์นี้ (261003000100) รันก่อน
    // CreatePreorderTables1788998400000 จึงยังไม่มีตาราง — ข้ามไป ให้ EnsurePreorderOpenNotifiedAt1791936000000 เพิ่มให้
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('preorder_campaigns', 'open_notified_at')) {
      await queryRunner.query(
        'ALTER TABLE `preorder_campaigns` DROP COLUMN `open_notified_at`',
      );
    }
  }
}
