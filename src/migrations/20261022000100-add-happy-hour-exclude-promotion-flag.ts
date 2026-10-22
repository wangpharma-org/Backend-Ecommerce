import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-747 Happy Hour ไม่รวมกับ Promotion (Company Day / Wang Day)
 * - feature flag happy_hour_exclude_promotion เริ่มต้นปิด (behavior เดิม: นับยอดทั้งบิล)
 */
export class AddHappyHourExcludePromotionFlag20261022000100
  implements MigrationInterface
{
  name = 'AddHappyHourExcludePromotionFlag20261022000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'happy_hour_exclude_promotion', 0 FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'happy_hour_exclude_promotion')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`feature_flag\` WHERE \`feature_key\` = 'happy_hour_exclude_promotion'`,
    );
  }
}
