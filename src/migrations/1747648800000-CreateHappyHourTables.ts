import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHappyHourTables1747648800000 implements MigrationInterface {
  name = 'CreateHappyHourTables1747648800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE DATABASE IF NOT EXISTS \`e-commerce-database-other\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`e-commerce-database-other\`.\`happy_hour_config\` (
        \`id\` int NOT NULL,
        \`is_enabled\` tinyint NOT NULL DEFAULT 0,
        \`updated_at\` datetime NULL,
        \`updated_by\` varchar(100) NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`e-commerce-database-other\`.\`happy_hour_slot\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`start_time\` time NOT NULL,
        \`end_time\` time NOT NULL,
        \`min_order_amount\` decimal(10,2) NOT NULL,
        \`card_value\` decimal(10,2) NOT NULL,
        \`excess_threshold\` decimal(10,2) NOT NULL,
        \`discount_per_step\` decimal(10,2) NOT NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`reward_pro_code\` varchar(20) NULL,
        \`reward_unit\` varchar(30) NULL,
        \`reward_amount\` int NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS \`e-commerce-database-other\`.\`happy_hour_slot\``,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS \`e-commerce-database-other\`.\`happy_hour_config\``,
    );
  }
}
