import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntity1756894046327 implements MigrationInterface {
    name = 'UserEntity1756894046327'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`line_id\` varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`mem_email\` varchar(80) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`website\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`facebook\` varchar(200) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`owner_title\` varchar(15) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`owner_name\` varchar(120) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`owner_tel\` varchar(15) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`owner_email\` varchar(60) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pharmacist_title\` varchar(15) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pharmacist_name\` varchar(120) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pharmacist_tel\` varchar(15) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pharmacist_email\` varchar(15) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pharmacist_email\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pharmacist_tel\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pharmacist_name\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pharmacist_title\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`owner_email\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`owner_tel\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`owner_name\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`owner_title\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`facebook\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`website\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mem_email\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`line_id\``);
    }

}
