import { MigrationInterface, QueryRunner } from 'typeorm';

// flag policy_doc เริ่มปิด — ลูกค้าไม่เห็น popup ยอมรับนโยบาย/โมดัลนโยบายใน Footer จนกว่าแอดมินจะเปิด
export class AddPolicyDocFlag20261017000100 implements MigrationInterface {
  name = 'AddPolicyDocFlag20261017000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'policy_doc', false
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'policy_doc')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'policy_doc'",
    );
  }
}
