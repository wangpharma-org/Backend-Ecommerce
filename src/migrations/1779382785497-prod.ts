import { MigrationInterface, QueryRunner } from "typeorm";

export class Prod1779382785497 implements MigrationInterface {
    name = 'Prod1779382785497'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`watermark_audit\` (\`id\` int NOT NULL AUTO_INCREMENT, \`token\` varchar(32) NOT NULL, \`mem_code\` varchar(255) NOT NULL, \`page\` varchar(255) NOT NULL, \`ip\` varchar(64) NULL, \`user_agent\` varchar(512) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_623fb3ab6de0c18a6607bffc90\` (\`token\`), INDEX \`IDX_eb46f33b18a535b402245b43b2\` (\`mem_code\`), INDEX \`IDX_7bc5e96d65d95b675a1fbe0723\` (\`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`watermark_audit_archive\` (\`id\` int NOT NULL AUTO_INCREMENT, \`token\` varchar(32) NOT NULL, \`mem_code\` varchar(255) NOT NULL, \`page\` varchar(255) NOT NULL, \`ip\` varchar(64) NULL, \`user_agent\` varchar(512) NULL, \`created_at\` datetime NOT NULL, \`archived_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_5aa1467c7df6ce82b32d86e3af\` (\`token\`), INDEX \`IDX_55987e5082dfea4f69f27c76d3\` (\`mem_code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`happy_hour_slot\` (\`id\` int NOT NULL AUTO_INCREMENT, \`start_time\` time NOT NULL, \`end_time\` time NOT NULL, \`min_order_amount\` decimal(10,2) NOT NULL, \`card_value\` decimal(10,2) NOT NULL, \`excess_threshold\` decimal(10,2) NOT NULL, \`discount_per_step\` decimal(10,2) NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`reward_pro_code\` varchar(20) NULL, \`reward_unit\` varchar(30) NULL, \`reward_amount\` int NOT NULL DEFAULT '1', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`happy_hour_config\` (\`id\` int NOT NULL, \`is_enabled\` tinyint NOT NULL DEFAULT 0, \`updated_at\` datetime NULL, \`updated_by\` varchar(100) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`shopping_order\` ADD \`is_happy_hour\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`shopping_head\` ADD \`discount\` decimal(16,2) NULL DEFAULT '0.00'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`shopping_head\` DROP COLUMN \`discount\``);
        await queryRunner.query(`ALTER TABLE \`shopping_order\` DROP COLUMN \`is_happy_hour\``);
        await queryRunner.query(`DROP TABLE \`happy_hour_config\``);
        await queryRunner.query(`DROP TABLE \`happy_hour_slot\``);
        await queryRunner.query(`DROP INDEX \`IDX_55987e5082dfea4f69f27c76d3\` ON \`watermark_audit_archive\``);
        await queryRunner.query(`DROP INDEX \`IDX_5aa1467c7df6ce82b32d86e3af\` ON \`watermark_audit_archive\``);
        await queryRunner.query(`DROP TABLE \`watermark_audit_archive\``);
        await queryRunner.query(`DROP INDEX \`IDX_7bc5e96d65d95b675a1fbe0723\` ON \`watermark_audit\``);
        await queryRunner.query(`DROP INDEX \`IDX_eb46f33b18a535b402245b43b2\` ON \`watermark_audit\``);
        await queryRunner.query(`DROP INDEX \`IDX_623fb3ab6de0c18a6607bffc90\` ON \`watermark_audit\``);
        await queryRunner.query(`DROP TABLE \`watermark_audit\``);
    }

}
