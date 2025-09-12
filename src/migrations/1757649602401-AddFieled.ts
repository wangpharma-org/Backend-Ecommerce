import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieled1757649602401 implements MigrationInterface {
    name = 'AddFieled1757649602401'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`shopping_cart\` ADD \`is_reward\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`shopping_cart\` DROP COLUMN \`is_reward\``);
    }

}
