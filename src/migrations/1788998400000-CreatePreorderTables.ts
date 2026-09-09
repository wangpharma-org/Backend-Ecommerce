import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ตารางฟีเจอร์สั่งจองสินค้า (pre-order) แทนระบบ pre_order / shopping_preorder ใน wang_shopping
 * - preorder_campaigns : รอบจอง (โหมด allocation / aggregation, ช่วงเวลา, ประกาศ, เงื่อนไข)
 * - preorder_products  : สินค้าที่เปิดจองในรอบ (limit, supply, moq, eta)
 * - preorder_items     : รายการจองของร้าน 1 แถวต่อ (สินค้าในรอบ, ร้าน) ordered_at = คิว
 * - preorder_item_logs : ประวัติการเปลี่ยนแปลง
 */
export class CreatePreorderTables1788998400000 implements MigrationInterface {
  name = 'CreatePreorderTables1788998400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`preorder_campaigns\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`mode\` enum('allocation','aggregation') NOT NULL DEFAULT 'aggregation',
        \`status\` enum('draft','open','closed','allocating','fulfilled','cancelled') NOT NULL DEFAULT 'draft',
        \`starts_at\` datetime NULL,
        \`ends_at\` datetime NULL,
        \`detail_announcement\` text NULL,
        \`breaking_announcement\` text NULL,
        \`terms\` text NULL,
        \`allow_cancel\` tinyint NOT NULL DEFAULT 0,
        \`created_by\` varchar(50) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_preorder_campaigns_status\` (\`status\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`preorder_products\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`campaign_id\` int NOT NULL,
        \`pro_code\` varchar(20) NOT NULL,
        \`note\` varchar(500) NULL,
        \`limit_per_member\` int NULL,
        \`supply_qty\` int NULL,
        \`moq\` int NULL,
        \`estimated_price\` decimal(16,2) NULL,
        \`eta_date\` date NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`arrived_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_preorder_products_campaign_pro\` (\`campaign_id\`, \`pro_code\`),
        INDEX \`IDX_preorder_products_pro_code\` (\`pro_code\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_preorder_products_campaign\` FOREIGN KEY (\`campaign_id\`)
          REFERENCES \`preorder_campaigns\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_preorder_products_product\` FOREIGN KEY (\`pro_code\`)
          REFERENCES \`product\`(\`pro_code\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`preorder_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`preorder_product_id\` int NOT NULL,
        \`mem_code\` varchar(30) NOT NULL,
        \`amount\` int NOT NULL,
        \`unit\` varchar(30) NULL,
        \`status\` enum('reserved','locked','allocated','fulfilled','cancelled') NOT NULL DEFAULT 'reserved',
        \`allocated_qty\` int NULL,
        \`is_paid\` tinyint NOT NULL DEFAULT 0,
        \`accepted_terms_at\` datetime NULL,
        \`ordered_at\` datetime(6) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_preorder_items_product_mem\` (\`preorder_product_id\`, \`mem_code\`),
        INDEX \`IDX_preorder_items_queue\` (\`preorder_product_id\`, \`ordered_at\`),
        INDEX \`IDX_preorder_items_mem_code\` (\`mem_code\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_preorder_items_product\` FOREIGN KEY (\`preorder_product_id\`)
          REFERENCES \`preorder_products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`preorder_item_logs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`item_id\` int NOT NULL,
        \`actor\` varchar(50) NOT NULL,
        \`action\` enum('create','update','lock','unlock','allocate','paid','unpaid','cancel','fulfill','arrived_notify') NOT NULL,
        \`from_amount\` int NULL,
        \`to_amount\` int NULL,
        \`note\` varchar(255) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_preorder_item_logs_item\` (\`item_id\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_preorder_item_logs_item\` FOREIGN KEY (\`item_id\`)
          REFERENCES \`preorder_items\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    // feature flag เริ่มต้นเป็นปิด เปิดผ่านหน้า admin feature-flag เมื่อพร้อม
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'preorder', 0 FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'preorder')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`preorder_item_logs\``);
    await queryRunner.query(`DROP TABLE \`preorder_items\``);
    await queryRunner.query(`DROP TABLE \`preorder_products\``);
    await queryRunner.query(`DROP TABLE \`preorder_campaigns\``);
    await queryRunner.query(
      `DELETE FROM \`feature_flag\` WHERE \`feature_key\` = 'preorder'`,
    );
  }
}
