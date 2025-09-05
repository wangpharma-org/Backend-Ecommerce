import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntity21756894665976 implements MigrationInterface {
    name = 'UserEntity21756894665976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`mem_sgroup\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`mem_invoice_type\` varchar(150) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mem_invoice_type\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mem_sgroup\``);
    }

}
