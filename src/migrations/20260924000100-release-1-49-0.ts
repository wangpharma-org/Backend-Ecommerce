import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Release 1.49.0 — รวม migration ของ release นี้ไว้ไฟล์เดียว
 *
 * คัดลอกมาจากไฟล์เดิม (SQL, เงื่อนไข hasColumn) ไม่ได้ generate ใหม่
 * แต่ละไฟล์เดิมเป็น method คู่ up/down ตามชื่อด้านล่าง — up รันตามลำดับเดิม, down ย้อนกลับ
 *
 *  1. 20260831000100-add-product-thai-name       (ECWC-421)
 *  2. 20260831000100-create-dhl-tracking
 */
export class Release1490_20260924000100 implements MigrationInterface {
  name = 'Release1490_20260924000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.upAddProductThaiName(queryRunner);
    await this.upCreateDhlTracking(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.downCreateDhlTracking(queryRunner);
    await this.downAddProductThaiName(queryRunner);
  }

  // ---------------------------------------------------------------------------
  // 1. 20260831000100-add-product-thai-name
  // ECWC-421 — ชื่อสินค้าภาษาไทยจาก EasyAcc เก็บแยกจาก pro_name
  // ---------------------------------------------------------------------------
  private async upAddProductThaiName(queryRunner: QueryRunner): Promise<void> {
    const hasProductThaiName = await queryRunner.hasColumn(
      'product',
      'pro_nameTH',
    );

    if (!hasProductThaiName) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD `pro_nameTH` varchar(255) NULL',
      );
    }
  }

  private async downAddProductThaiName(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const hasProductThaiName = await queryRunner.hasColumn(
      'product',
      'pro_nameTH',
    );

    if (hasProductThaiName) {
      await queryRunner.query('ALTER TABLE `product` DROP COLUMN `pro_nameTH`');
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 20260831000100-create-dhl-tracking
  // หมายเลขพัสดุ DHL ที่ระบบภายนอกส่งมา อ้างอิงคำสั่งจองด้วย soh_running
  //
  // เช็ค hasTable เพิ่มจากไฟล์เดิม — env ที่เคยรันไฟล์เดิมไปแล้ว (UAT/local)
  // จะมีตารางอยู่แล้ว ถ้าไม่เช็คจะ CREATE ซ้ำแล้ว error
  // ---------------------------------------------------------------------------
  private async upCreateDhlTracking(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('dhl_tracking')) return;

    await queryRunner.query(`
      CREATE TABLE \`dhl_tracking\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`soh_running\` varchar(60) NOT NULL,
        \`tracking_number\` varchar(120) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_dhl_tracking_order_number\` (\`soh_running\`, \`tracking_number\`),
        KEY \`IDX_dhl_tracking_soh_running\` (\`soh_running\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async downCreateDhlTracking(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `dhl_tracking`');
  }
}
