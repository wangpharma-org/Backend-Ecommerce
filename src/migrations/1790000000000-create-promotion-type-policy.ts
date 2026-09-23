import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromotionTypePolicy1790000000000
  implements MigrationInterface
{
  name = 'CreatePromotionTypePolicy1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`promotion_type_policy\` (
        \`id\` tinyint unsigned NOT NULL,
        \`locked_type\` varchar(10) NULL DEFAULT NULL,
        \`locked_promo_id\` int unsigned NULL DEFAULT NULL,
        \`locked_at\` datetime NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO \`promotion_type_policy\`
        (\`id\`, \`locked_type\`, \`locked_promo_id\`, \`locked_at\`)
      VALUES (1, NULL, NULL, NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS \`promotion_type_policy\`');
  }
}
