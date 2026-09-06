import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBundleSet20260906000200 implements MigrationInterface {
  name = 'CreateBundleSet20260906000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`bundle_set\` (
        \`set_code\` varchar(30) NOT NULL,
        \`set_name\` varchar(200) NOT NULL,
        \`description\` varchar(500) NULL,
        \`price\` decimal(16,2) NOT NULL,
        \`image\` varchar(500) NULL,
        \`status\` tinyint NOT NULL DEFAULT 0,
        \`start_date\` datetime NULL,
        \`end_date\` datetime NULL,
        \`promo_id\` int NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`deleted_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`set_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`bundle_set_item\` (
        \`item_id\` int NOT NULL AUTO_INCREMENT,
        \`set_code\` varchar(30) NOT NULL,
        \`pro_code\` varchar(20) NOT NULL,
        \`unit_level\` int NOT NULL DEFAULT 1,
        \`qty\` int NOT NULL,
        \`is_gift\` tinyint NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`item_id\`),
        KEY \`IDX_bundle_set_item_order\` (\`set_code\`, \`sort_order\`),
        KEY \`IDX_bundle_set_item_product\` (\`pro_code\`),
        CONSTRAINT \`FK_bundle_set_item_set\`
          FOREIGN KEY (\`set_code\`) REFERENCES \`bundle_set\` (\`set_code\`)
          ON DELETE CASCADE,
        CONSTRAINT \`FK_bundle_set_item_product\`
          FOREIGN KEY (\`pro_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `bundle_set_item`');
    await queryRunner.query('DROP TABLE `bundle_set`');
  }
}
