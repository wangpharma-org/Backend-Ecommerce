import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpecialCollection20260906000100
  implements MigrationInterface
{
  name = 'CreateSpecialCollection20260906000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`special_collection\` (
        \`collection_id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(200) NOT NULL,
        \`description\` varchar(500) NULL,
        \`status\` tinyint NOT NULL DEFAULT 0,
        \`start_date\` datetime NULL,
        \`end_date\` datetime NULL,
        \`audience_scope\` varchar(10) NOT NULL DEFAULT 'all',
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`deleted_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`collection_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`special_collection_item\` (
        \`item_id\` int NOT NULL AUTO_INCREMENT,
        \`collection_id\` int NOT NULL,
        \`ref_type\` varchar(20) NOT NULL,
        \`ref_id\` varchar(50) NOT NULL,
        \`title_override\` varchar(200) NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`item_id\`),
        KEY \`IDX_special_collection_item_order\` (\`collection_id\`, \`sort_order\`),
        KEY \`IDX_special_collection_item_ref\` (\`ref_type\`, \`ref_id\`),
        CONSTRAINT \`FK_special_collection_item_collection\`
          FOREIGN KEY (\`collection_id\`) REFERENCES \`special_collection\` (\`collection_id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`special_collection_audience\` (
        \`audience_id\` int NOT NULL AUTO_INCREMENT,
        \`collection_id\` int NOT NULL,
        \`mem_code\` varchar(30) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`audience_id\`),
        UNIQUE KEY \`UQ_special_collection_audience\` (\`collection_id\`, \`mem_code\`),
        KEY \`IDX_special_collection_audience_mem\` (\`mem_code\`),
        CONSTRAINT \`FK_special_collection_audience_collection\`
          FOREIGN KEY (\`collection_id\`) REFERENCES \`special_collection\` (\`collection_id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `special_collection_audience`');
    await queryRunner.query('DROP TABLE `special_collection_item`');
    await queryRunner.query('DROP TABLE `special_collection`');
  }
}
