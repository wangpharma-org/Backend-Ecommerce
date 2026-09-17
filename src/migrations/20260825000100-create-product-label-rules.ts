import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductLabelRules20260825000100 implements MigrationInterface {
  name = 'CreateProductLabelRules20260825000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`product_label_rules\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`label\` varchar(100) NOT NULL,
        \`keyword\` varchar(255) NOT NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_product_label_rules_keyword\` (\`keyword\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE \`product_label_rules\`');
  }
}
