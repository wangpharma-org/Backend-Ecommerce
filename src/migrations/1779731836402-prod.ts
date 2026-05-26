import { MigrationInterface, QueryRunner } from "typeorm";

export class Prod1779731836402 implements MigrationInterface {
    name = 'Prod1779731836402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`shopping_order\` ADD \`spo_unit_enum\` enum ('1', '2', '3') NULL`);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` ADD \`reward_unit_enum\` enum ('1', '2', '3') NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_146ffc1c2005ceee8b8db184fe\` ON \`reflesh-token\` (\`refresh_token\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_146ffc1c2005ceee8b8db184fe\` ON \`reflesh-token\``);
        await queryRunner.query(`ALTER TABLE \`happy_hour_slot\` DROP COLUMN \`reward_unit_enum\``);
        await queryRunner.query(`ALTER TABLE \`shopping_order\` DROP COLUMN \`spo_unit_enum\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`uk_product_unit\` ON \`product_unit\` (\`pro_code\`, \`level\`)`);
    }

}
