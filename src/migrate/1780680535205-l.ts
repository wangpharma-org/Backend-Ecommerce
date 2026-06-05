import { MigrationInterface, QueryRunner } from "typeorm";

export class L1780680535205 implements MigrationInterface {
    name = 'L1780680535205'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD \`promo_title\` varchar(120) NULL`);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` ADD \`promo_body\` text NULL`);
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
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP COLUMN \`promo_body\``);
        await queryRunner.query(`ALTER TABLE \`hotdeal_entity\` DROP COLUMN \`promo_title\``);
    }

}
