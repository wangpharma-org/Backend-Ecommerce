import { MigrationInterface, QueryRunner } from "typeorm";

export class Prod1779538303994 implements MigrationInterface {
    name = 'Prod1779538303994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`shopping_order\` ADD \`spo_unit_enum\` enum ('1', '2', '3') NULL`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` ADD \`reward_unit_enum\` enum ('1', '2', '3') NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`shopping_order\` DROP COLUMN \`spo_unit_enum\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`uk_product_unit\` ON \`product_unit\` (\`pro_code\`, \`level\`)`);
    }

}
