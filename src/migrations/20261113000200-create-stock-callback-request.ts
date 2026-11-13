import { MigrationInterface, QueryRunner } from 'typeorm';

/// ECWC-766: คำขอให้ฝ่ายขายติดต่อกลับเมื่อสั่งเกินสต็อก (ระบบขายดึงผ่าน /ecom/internal/stock-callback-requests)
export class CreateStockCallbackRequest20261113000200 implements MigrationInterface {
  name = 'CreateStockCallbackRequest20261113000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('stock_callback_request')) return;
    await queryRunner.query(`
      CREATE TABLE \`stock_callback_request\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`mem_code\` varchar(30) NOT NULL,
        \`pro_code\` varchar(30) NOT NULL,
        \`unit_name\` varchar(100) NULL DEFAULT NULL,
        \`requested_amount\` int NOT NULL,
        \`requested_smallest\` int NOT NULL,
        \`stock_smallest\` int NOT NULL,
        \`request_count\` int NOT NULL DEFAULT 1,
        \`status\` varchar(20) NOT NULL DEFAULT 'open',
        \`handled_by_emp\` varchar(30) NULL DEFAULT NULL,
        \`handled_by_name\` varchar(150) NULL DEFAULT NULL,
        \`handled_at\` datetime NULL DEFAULT NULL,
        \`note\` text NULL,
        \`channel\` varchar(10) NULL DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`last_requested_at\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_stock_callback_member_product\` (\`mem_code\`, \`pro_code\`, \`status\`),
        KEY \`IDX_stock_callback_status\` (\`status\`, \`last_requested_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `stock_callback_request`');
  }
}
