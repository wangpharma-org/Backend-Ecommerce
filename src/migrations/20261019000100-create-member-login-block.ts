import { MigrationInterface, QueryRunner } from 'typeorm';

// SSN0-273: sale ระงับ/ยกเลิกระงับการเข้าใช้งาน E-commerce รายร้าน — สถานะปัจจุบัน + log
// flag member_login_block สร้างไว้เป็นปิด — เปิดเมื่อ sale-backend/sale-services ขึ้นครบ
export class CreateMemberLoginBlock20261019000100 implements MigrationInterface {
  name = 'CreateMemberLoginBlock20261019000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('member_login_block'))) {
      await queryRunner.query(`
        CREATE TABLE \`member_login_block\` (
          \`mem_code\` varchar(30) NOT NULL,
          \`is_blocked\` tinyint NOT NULL DEFAULT 0,
          \`reason\` varchar(500) NULL DEFAULT NULL,
          \`blocked_by_emp_code\` varchar(50) NULL DEFAULT NULL,
          \`blocked_by_name\` varchar(255) NULL DEFAULT NULL,
          \`blocked_at\` datetime NULL DEFAULT NULL,
          \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`mem_code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await queryRunner.hasTable('member_login_block_log'))) {
      await queryRunner.query(`
        CREATE TABLE \`member_login_block_log\` (
          \`log_id\` int NOT NULL AUTO_INCREMENT,
          \`mem_code\` varchar(30) NOT NULL,
          \`action\` enum('BLOCK','UNBLOCK') NOT NULL,
          \`reason\` varchar(500) NULL DEFAULT NULL,
          \`actor_emp_code\` varchar(50) NOT NULL,
          \`actor_name\` varchar(255) NULL DEFAULT NULL,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`log_id\`),
          KEY \`IDX_member_login_block_log_member\` (\`mem_code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'member_login_block', false
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'member_login_block')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'member_login_block'",
    );
    await queryRunner.query('DROP TABLE IF EXISTS `member_login_block_log`');
    await queryRunner.query('DROP TABLE IF EXISTS `member_login_block`');
  }
}
