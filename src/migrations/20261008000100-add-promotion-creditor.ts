import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Company Day หลายบริษัท — ตาราง promotion_creditor เก็บบริษัททั้งหมดที่เข้าร่วมโปรโมชั่น
 * promotion.creditor_code ยังเก็บบริษัทหลักเหมือนเดิม (ใช้แยก company/wang)
 * backfill: โปรโมชั่นเดิมที่มี creditor_code ถูกใส่ลงตารางใหม่ 1 แถว
 */
export class AddPromotionCreditor20261008000100 implements MigrationInterface {
  name = 'AddPromotionCreditor20261008000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('promotion_creditor'))) {
      // ใช้ charset/collation เดียวกับ creditor.creditor_code ไม่งั้นสร้าง FK ไม่ได้
      const [col] = (await queryRunner.query(
        `SELECT CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'creditor' AND COLUMN_NAME = 'creditor_code'`,
      )) as { charset: string; collation: string }[];

      await queryRunner.query(
        `CREATE TABLE \`promotion_creditor\` (
          \`promo_id\` int NOT NULL,
          \`creditor_code\` varchar(255) CHARACTER SET ${col.charset} COLLATE ${col.collation} NOT NULL,
          PRIMARY KEY (\`promo_id\`, \`creditor_code\`),
          INDEX \`IDX_promotion_creditor_promo_id\` (\`promo_id\`),
          INDEX \`IDX_promotion_creditor_creditor_code\` (\`creditor_code\`),
          CONSTRAINT \`FK_promotion_creditor_promo_id\` FOREIGN KEY (\`promo_id\`)
            REFERENCES \`promotion\`(\`promo_id\`) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT \`FK_promotion_creditor_creditor_code\` FOREIGN KEY (\`creditor_code\`)
            REFERENCES \`creditor\`(\`creditor_code\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB`,
      );
    }

    await queryRunner.query(
      `INSERT IGNORE INTO \`promotion_creditor\` (\`promo_id\`, \`creditor_code\`)
       SELECT \`promo_id\`, \`creditor_code\` FROM \`promotion\` WHERE \`creditor_code\` IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('promotion_creditor')) {
      await queryRunner.query('DROP TABLE `promotion_creditor`');
    }
  }
}
