import { MigrationInterface, QueryRunner } from "typeorm";

export class SmallInt1756504912647 implements MigrationInterface {
    name = 'SmallInt1756504912647'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_promotion_amount\``);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_promotion_amount\` smallint NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_promotion_amount\``);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_promotion_amount\` tinyint NULL DEFAULT '1'`);
    }

}
