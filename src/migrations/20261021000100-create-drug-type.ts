import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WGDD-427 ประเภทยา + สินค้าแถม/ขายพ่วง (สำเนาจาก ProductService ผ่าน Kafka)
 * - drug_type / drug_type_reward
 * - product.drug_type_code (+ index)
 * - feature flag drug_type_reward เริ่มต้นปิด
 */
export class CreateDrugType20261021000100 implements MigrationInterface {
  name = 'CreateDrugType20261021000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('drug_type'))) {
      await queryRunner.query(
        `CREATE TABLE \`drug_type\` (
          \`code\` varchar(50) NOT NULL,
          \`name\` varchar(150) NOT NULL,
          \`description\` text NULL,
          \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`code\`)
        ) ENGINE=InnoDB`,
      );
    }
    if (!(await queryRunner.hasTable('drug_type_reward'))) {
      await queryRunner.query(
        `CREATE TABLE \`drug_type_reward\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`drug_type_code\` varchar(50) NOT NULL,
          \`reward_type\` varchar(10) NOT NULL,
          \`product_code\` varchar(50) NOT NULL,
          \`buy_qty\` int NOT NULL,
          \`buy_unit\` varchar(50) NULL,
          \`reward_qty\` int NOT NULL,
          \`reward_unit\` varchar(50) NULL,
          \`bundle_price\` decimal(10,2) NULL,
          \`sort_order\` int NOT NULL DEFAULT 0,
          \`note\` varchar(255) NULL,
          INDEX \`IDX_drug_type_reward_type\` (\`drug_type_code\`),
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`FK_drug_type_reward_type\` FOREIGN KEY (\`drug_type_code\`)
            REFERENCES \`drug_type\` (\`code\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB`,
      );
    }
    if (!(await queryRunner.hasColumn('product', 'drug_type_code'))) {
      await queryRunner.query(
        `ALTER TABLE \`product\` ADD \`drug_type_code\` varchar(50) NULL DEFAULT NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX \`IDX_product_drug_type_code\` ON \`product\` (\`drug_type_code\`)`,
      );
    }

    // feature flag เริ่มต้นเป็นปิด เปิดผ่านหน้า admin feature-flag เมื่อข้อมูลประเภทยาพร้อม
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'drug_type_reward', 0 FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'drug_type_reward')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`feature_flag\` WHERE \`feature_key\` = 'drug_type_reward'`,
    );
    if (await queryRunner.hasColumn('product', 'drug_type_code')) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_drug_type_code` ON `product`',
      );
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `drug_type_code`',
      );
    }
    if (await queryRunner.hasTable('drug_type_reward')) {
      await queryRunner.query('DROP TABLE `drug_type_reward`');
    }
    if (await queryRunner.hasTable('drug_type')) {
      await queryRunner.query('DROP TABLE `drug_type`');
    }
  }
}
