import { MigrationInterface, QueryRunner } from "typeorm";

export class Prod1780084387026 implements MigrationInterface {
    name = 'Prod1780084387026'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`happy_hour_slot_min_products\` (\`id\` int NOT NULL AUTO_INCREMENT, \`pro_code\` varchar(20) NOT NULL, \`pro_name\` varchar(255) NULL, \`slot_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot_reward\` ADD \`amount\` int NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` ADD \`reward_type\` enum ('card', 'bill_discount') NOT NULL DEFAULT 'card'`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` ADD \`reward_value\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` ADD \`min_order_scope\` enum ('all', 'specific', 'vendor') NOT NULL DEFAULT 'all'`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` ADD \`min_order_vendor_code\` varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot_min_products\` ADD CONSTRAINT \`FK_02d5f72ee52ce2c2c9aadb7626d\` FOREIGN KEY (\`slot_id\`) REFERENCES \`happy_hour_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot_min_products\` DROP FOREIGN KEY \`FK_02d5f72ee52ce2c2c9aadb7626d\``);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` DROP COLUMN \`min_order_vendor_code\``);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` DROP COLUMN \`min_order_scope\``);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` DROP COLUMN \`reward_value\``);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` DROP COLUMN \`reward_type\``);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot_reward\` DROP COLUMN \`amount\``);
        await queryRunner.query(`DROP TABLE \`happy_hour_slot_min_products\``);
    }

}
