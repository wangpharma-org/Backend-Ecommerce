import { MigrationInterface, QueryRunner } from "typeorm";

export class O1780914441980 implements MigrationInterface {
    name = 'O1780914441980'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`admin_action_log\` (\`id\` int NOT NULL AUTO_INCREMENT, \`admin_mem_code\` varchar(255) NOT NULL, \`admin_username\` varchar(255) NOT NULL, \`target_mem_code\` varchar(255) NOT NULL, \`target_username\` varchar(255) NOT NULL, \`action_type\` varchar(50) NOT NULL, \`old_value\` text NULL, \`new_value\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_d29ec3fb030b2ad812bbb1a8e3\` (\`admin_mem_code\`), INDEX \`IDX_4d239c538c1f2e498dbe83f66a\` (\`target_mem_code\`), INDEX \`IDX_89914283ed29a987de9709be17\` (\`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD \`promo_title\` varchar(120) NULL`);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD \`promo_body\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`admin_features\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP FOREIGN KEY \`FK_a5848859c3cbbf247db852e3236\``);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD UNIQUE INDEX \`IDX_a5848859c3cbbf247db852e323\` (\`pro_code1\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_a5848859c3cbbf247db852e323\` ON \`hotdeal_entity\` (\`pro_code1\`)`);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD CONSTRAINT \`FK_a5848859c3cbbf247db852e3236\` FOREIGN KEY (\`pro_code1\`) REFERENCES \`product\`(\`pro_code\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP FOREIGN KEY \`FK_a5848859c3cbbf247db852e3236\``);
        await queryRunner.query(`DROP INDEX \`REL_a5848859c3cbbf247db852e323\` ON \`hotdeal_entity\``);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP INDEX \`IDX_a5848859c3cbbf247db852e323\``);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD CONSTRAINT \`FK_a5848859c3cbbf247db852e3236\` FOREIGN KEY (\`pro_code1\`) REFERENCES \`product\`(\`pro_code\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`admin_features\``);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP COLUMN \`promo_body\``);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP COLUMN \`promo_title\``);
        await queryRunner.query(`DROP INDEX \`IDX_89914283ed29a987de9709be17\` ON \`admin_action_log\``);
        await queryRunner.query(`DROP INDEX \`IDX_4d239c538c1f2e498dbe83f66a\` ON \`admin_action_log\``);
        await queryRunner.query(`DROP INDEX \`IDX_d29ec3fb030b2ad812bbb1a8e3\` ON \`admin_action_log\``);
        await queryRunner.query(`DROP TABLE \`admin_action_log\``);
    }

}
