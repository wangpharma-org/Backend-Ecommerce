import { MigrationInterface, QueryRunner } from 'typeorm';

// พนักงานขาย (Key ขาย) ขออนุญาตลูกค้าก่อนเข้าดูแลตะกร้า → ความยินยอมต่อร้าน (90 วัน · ถอนได้) + รอบที่เซลส์กำลังดูแล
// consent: แถวละคำขอ/การตัดสิน (app/web = ลูกค้ากดเอง · phone = เซลส์บันทึกว่าลูกค้ายืนยันทางโทรศัพท์)
// session: หนึ่งร้านมีรอบเปิดได้ทีละรอบ · หมดเองเมื่อไม่มีความเคลื่อนไหว 30 นาที (ตรวจตอนอ่าน)
export class CreateSalesCartSession20261018000200 implements MigrationInterface {
  name = 'CreateSalesCartSession20261018000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sales_cart_consent\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`mem_code\` varchar(50) NOT NULL,
        \`status\` enum('pending','granted','denied','withdrawn','expired') NOT NULL DEFAULT 'pending',
        \`channel\` enum('app','web','phone') NULL,
        \`session_id\` varchar(36) NULL,
        \`emp_code\` varchar(30) NULL,
        \`sales_name\` varchar(120) NULL,
        \`sales_nick\` varchar(60) NULL,
        \`decided_by\` varchar(30) NULL,
        \`requested_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`decided_at\` datetime(6) NULL,
        \`expires_at\` datetime(6) NULL,
        \`withdrawn_at\` datetime(6) NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_sales_cart_consent_mem_status\` (\`mem_code\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sales_cart_session\` (
        \`id\` varchar(36) NOT NULL,
        \`mem_code\` varchar(50) NOT NULL,
        \`emp_code\` varchar(30) NULL,
        \`sales_name\` varchar(120) NULL,
        \`sales_nick\` varchar(60) NULL,
        \`draft_ref\` varchar(64) NULL,
        \`status\` enum('awaiting_consent','active','denied','ended') NOT NULL,
        \`end_reason\` enum('saved','discarded','idle','denied','replaced') NULL,
        \`consent_id\` int NULL,
        \`lines\` json NULL,
        \`started_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`last_activity_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`ended_at\` datetime(6) NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_sales_cart_session_mem_status\` (\`mem_code\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `sales_cart_session`');
    await queryRunner.query('DROP TABLE IF EXISTS `sales_cart_consent`');
  }
}
