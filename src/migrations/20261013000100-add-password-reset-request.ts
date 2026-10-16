import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-706 ลืมรหัสผ่าน — ลูกค้าส่งคำขอ → พนักงานขายโทรยืนยันตัวตน → รีเซ็ตด้วยรหัสผ่านชั่วคราว
 * - password_reset_request: คำขอ + ผลการยืนยัน (audit) + hash ของรหัสชั่วคราว
 * - feature flag password_reset_request เริ่มต้นปิด
 * ไม่แก้ตาราง users
 */
export class AddPasswordResetRequest20261013000100 implements MigrationInterface {
  name = 'AddPasswordResetRequest20261013000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('password_reset_request'))) {
      await queryRunner.query(
        `CREATE TABLE \`password_reset_request\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`ref_code\` varchar(16) NOT NULL,
          \`mem_code\` varchar(30) NULL DEFAULT NULL,
          \`input_account\` varchar(60) NOT NULL,
          \`phone_changed\` tinyint NOT NULL DEFAULT 0,
          \`callback_phone\` varchar(20) NULL DEFAULT NULL,
          \`ip_address\` varchar(45) NULL DEFAULT NULL,
          \`user_agent\` varchar(255) NULL DEFAULT NULL,
          \`status\` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
          \`expires_at\` datetime NOT NULL,
          \`handled_by\` varchar(30) NULL DEFAULT NULL,
          \`handled_by_name\` varchar(255) NULL DEFAULT NULL,
          \`handled_at\` datetime NULL DEFAULT NULL,
          \`checklist\` json NULL DEFAULT NULL,
          \`reject_reason\` varchar(20) NULL DEFAULT NULL,
          \`note\` text NULL DEFAULT NULL,
          \`password_mode\` enum('auto','manual') NULL DEFAULT NULL,
          \`force_change\` tinyint NOT NULL DEFAULT 1,
          \`temp_password_hash\` varchar(255) NULL DEFAULT NULL,
          \`temp_expires_at\` datetime NULL DEFAULT NULL,
          \`password_changed_at\` datetime NULL DEFAULT NULL,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          UNIQUE INDEX \`UQ_password_reset_ref_code\` (\`ref_code\`),
          INDEX \`IDX_password_reset_mem_status\` (\`mem_code\`, \`status\`),
          INDEX \`IDX_password_reset_account_created\` (\`input_account\`, \`created_at\`),
          INDEX \`IDX_password_reset_ip_created\` (\`ip_address\`, \`created_at\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB`,
      );
    }

    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'password_reset_request', 0 FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'password_reset_request')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`feature_flag\` WHERE \`feature_key\` = 'password_reset_request'`,
    );
    if (await queryRunner.hasTable('password_reset_request')) {
      await queryRunner.query('DROP TABLE `password_reset_request`');
    }
  }
}
