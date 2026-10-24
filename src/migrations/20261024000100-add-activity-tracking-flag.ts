import { MigrationInterface, QueryRunner } from 'typeorm';

/// อีเวนต์กิจกรรมกลาง (activity_event) — สร้าง flag ไว้เป็นปิด เปิดเมื่อ sale-backend รับ topic แล้ว
export class AddActivityTrackingFlag20261024000100 implements MigrationInterface {
  name = 'AddActivityTrackingFlag20261024000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'activity_tracking', false
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'activity_tracking')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'activity_tracking'",
    );
  }
}
