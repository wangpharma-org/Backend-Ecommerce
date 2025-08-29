import { MigrationInterface, QueryRunner } from "typeorm";

export class ProNameEn1756448304599 implements MigrationInterface {
    name = 'ProNameEn1756448304599'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_nameEN\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_nameEN\``);
    }

}
