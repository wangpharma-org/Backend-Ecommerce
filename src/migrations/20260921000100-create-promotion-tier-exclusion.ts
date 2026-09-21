import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-507 — สินค้าที่ไม่เข้าร่วมสำหรับ tier แบบ "สินค้าทั้งหมด" ของ Company Day / Wang Day
 */
export class CreatePromotionTierExclusion20260921000100 implements MigrationInterface {
  name = 'CreatePromotionTierExclusion20260921000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`promotion_tier_exclusion\` (
        \`exclusion_id\` int NOT NULL AUTO_INCREMENT,
        \`tier_id\` int NOT NULL,
        \`product_code\` varchar(20) NOT NULL,
        PRIMARY KEY (\`exclusion_id\`),
        UNIQUE KEY \`IDX_promotion_tier_exclusion_tier_product\` (\`tier_id\`, \`product_code\`),
        KEY \`IDX_promotion_tier_exclusion_product\` (\`product_code\`),
        CONSTRAINT \`FK_promotion_tier_exclusion_tier\`
          FOREIGN KEY (\`tier_id\`) REFERENCES \`promotion_tier\` (\`tier_id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`FK_promotion_tier_exclusion_product\`
          FOREIGN KEY (\`product_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `promotion_tier_exclusion`');
  }
}
