import { MigrationInterface, QueryRunner } from "typeorm";

export class Test1757668013528 implements MigrationInterface {
    name = 'Test1757668013528'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_promotion_amount\``);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_promotion_amount\` smallint NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_promotion_amount\``);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_promotion_amount\` int NULL DEFAULT '1'`);
    }

}
