import { MigrationInterface, QueryRunner } from 'typeorm';

// ECWC-751: flag search_all_sources เริ่มปิด — ค้นหาสินค้ายังเป็นแบบเดิม (ES ก่อน แหล่งอื่นเมื่อ ES ไม่เจอ)
// จนกว่าแอดมินจะเปิด
export class AddSearchAllSourcesFlag20261028000100 implements MigrationInterface {
  name = 'AddSearchAllSourcesFlag20261028000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`feature_flag\` (\`feature_key\`, \`is_enabled\`)
      SELECT 'search_all_sources', false
      WHERE NOT EXISTS (SELECT 1 FROM \`feature_flag\` WHERE \`feature_key\` = 'search_all_sources')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'search_all_sources'",
    );
  }
}
