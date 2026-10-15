import { MigrationInterface, QueryRunner } from 'typeorm';

// ECWC-600/617 (PDPA): ความยินยอมให้ลูกค้าคนอื่นเห็นชื่อร้าน — สถานะปัจจุบัน + log หลักฐาน
//
// ตาราง customer_store_visibility เคยถูกสร้างมือ (ช่วง manual test) ด้วย show_store_name boolean
// ซึ่งแยกไม่ออกว่า "ปฏิเสธ" กับ "ยังไม่ถูกถาม" — DB ไหนมีตารางแบบเก่าอยู่ ตั้งใจไม่ย้ายข้อมูล:
// แถวเดิมไม่ได้ยินยอมภายใต้ข้อความ consent version 1 ให้กลับไป NOT_ASKED แล้วถามใหม่
//
// flag store_name_consent สร้างไว้เป็นปิด — เปิดหลังเซ็น LIA + สเปกความยินยอม (ECWC-617)
export class CreateStoreVisibilityConsent20261014000100 implements MigrationInterface {
  name = 'CreateStoreVisibilityConsent20261014000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('customer_store_visibility'))) {
      await queryRunner.query(`
        CREATE TABLE \`customer_store_visibility\` (
          \`mem_code\` varchar(50) NOT NULL,
          \`status\` enum('NOT_ASKED','GRANTED','DECLINED') NOT NULL DEFAULT 'NOT_ASKED',
          \`consent_version\` int NULL DEFAULT NULL,
          \`asked_count\` int NOT NULL DEFAULT 0,
          \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`mem_code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } else {
      if (
        await queryRunner.hasColumn(
          'customer_store_visibility',
          'show_store_name',
        )
      ) {
        await queryRunner.query(
          'ALTER TABLE `customer_store_visibility` DROP COLUMN `show_store_name`',
        );
      }
      if (
        !(await queryRunner.hasColumn('customer_store_visibility', 'status'))
      ) {
        await queryRunner.query(
          "ALTER TABLE `customer_store_visibility` ADD COLUMN `status` enum('NOT_ASKED','GRANTED','DECLINED') NOT NULL DEFAULT 'NOT_ASKED'",
        );
      }
      if (
        !(await queryRunner.hasColumn(
          'customer_store_visibility',
          'consent_version',
        ))
      ) {
        await queryRunner.query(
          'ALTER TABLE `customer_store_visibility` ADD COLUMN `consent_version` int NULL DEFAULT NULL',
        );
      }
      if (
        !(await queryRunner.hasColumn(
          'customer_store_visibility',
          'asked_count',
        ))
      ) {
        await queryRunner.query(
          'ALTER TABLE `customer_store_visibility` ADD COLUMN `asked_count` int NOT NULL DEFAULT 0',
        );
      }
    }

    if (!(await queryRunner.hasTable('customer_store_visibility_log'))) {
      await queryRunner.query(`
        CREATE TABLE \`customer_store_visibility_log\` (
          \`log_id\` int NOT NULL AUTO_INCREMENT,
          \`mem_code\` varchar(50) NOT NULL,
          \`action\` enum('GRANTED','DECLINED','WITHDRAWN','ASKED') NOT NULL,
          \`consent_version\` int NOT NULL,
          \`text_hash\` varchar(64) NOT NULL,
          \`channel\` enum('WEB','APP') NOT NULL,
          \`ip\` varchar(45) NULL DEFAULT NULL,
          \`user_agent\` varchar(255) NULL DEFAULT NULL,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`log_id\`),
          KEY \`IDX_store_visibility_log_member\` (\`mem_code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'store_name_consent', false
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'store_name_consent')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'store_name_consent'",
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS `customer_store_visibility_log`',
    );
    await queryRunner.query('DROP TABLE IF EXISTS `customer_store_visibility`');
  }
}
