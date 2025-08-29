import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateDB1756501823047 implements MigrationInterface {
    name = 'MigrateDB1756501823047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`banner\` (\`banner_id\` int NOT NULL AUTO_INCREMENT, \`banner_image\` varchar(255) NOT NULL, \`date_start\` datetime NULL, \`date_end\` datetime NULL, PRIMARY KEY (\`banner_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_category\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_promotion_month\` tinyint NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`pro_promotion_amount\` tinyint NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`is_detect_amount\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`permision_admin\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`permision_admin\``);
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`is_detect_amount\``);
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_promotion_amount\``);
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_promotion_month\``);
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`pro_category\``);
        await queryRunner.query(`DROP TABLE \`banner\``);
    }

}
