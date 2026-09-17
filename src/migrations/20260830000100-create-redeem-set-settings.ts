import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRedeemSetSettings20260830000100 implements MigrationInterface {
  name = 'CreateRedeemSetSettings20260830000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`redeem_settings\` (
        \`id\` tinyint unsigned NOT NULL,
        \`display_limit\` int unsigned NOT NULL DEFAULT 50,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`CHK_redeem_settings_display_limit\` CHECK (\`display_limit\` > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(
      'INSERT INTO `redeem_settings` (`id`, `display_limit`) VALUES (1, 50)',
    );
    await queryRunner.query(`
      CREATE TABLE \`redeem_product_backup\` (
        \`redeem_product_code\` varchar(20) NOT NULL,
        \`backup_product_code\` varchar(20) NOT NULL,
        PRIMARY KEY (\`redeem_product_code\`),
        KEY \`IDX_redeem_product_backup_code\` (\`backup_product_code\`),
        CONSTRAINT \`FK_redeem_product_backup_primary\`
          FOREIGN KEY (\`redeem_product_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`FK_redeem_product_backup_backup\`
          FOREIGN KEY (\`backup_product_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `redeem_product_backup`');
    await queryRunner.query('DROP TABLE `redeem_settings`');
  }
}
