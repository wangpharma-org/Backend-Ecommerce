import { MigrationInterface, QueryRunner } from 'typeorm';

/// ECWC-749: ประวัติการเปิด/ปิด feature flag — endpoint เปลี่ยน flag จำกัดเฉพาะ Admin / เมนู feature-flag แล้ว
/// และทุกครั้งที่เปลี่ยนต้องรู้ว่าใครทำ
export class CreateFeatureFlagLog20261024000200 implements MigrationInterface {
  name = 'CreateFeatureFlagLog20261024000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`feature_flag_log\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`feature_key\` varchar(255) NOT NULL,
        \`old_value\` tinyint NULL,
        \`new_value\` tinyint NOT NULL,
        \`actor_mem_code\` varchar(50) NOT NULL,
        \`actor_username\` varchar(255) NULL,
        \`actor_role\` varchar(30) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_FEATURE_FLAG_LOG_KEY\` (\`feature_key\`),
        KEY \`IDX_FEATURE_FLAG_LOG_CREATED\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `feature_flag_log`');
  }
}
