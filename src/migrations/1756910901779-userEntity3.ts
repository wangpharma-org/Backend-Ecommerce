import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntity31756910901779 implements MigrationInterface {
    name = 'UserEntity31756910901779'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pharmacist_email\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pharmacist_email\` varchar(60) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pharmacist_email\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pharmacist_email\` varchar(15) NULL`);
    }

}
