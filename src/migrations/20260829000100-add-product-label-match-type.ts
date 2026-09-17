import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductLabelMatchType20260829000100 implements MigrationInterface {
  name = 'AddProductLabelMatchType20260829000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`product_label_rules\`
      ADD COLUMN \`matchType\` varchar(20) NOT NULL DEFAULT 'contains' AFTER \`keyword\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`product_label_rules\`
      DROP COLUMN \`matchType\`
    `);
  }
}
