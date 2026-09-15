import { MigrationInterface, QueryRunner } from "typeorm";

export class Prod1784240627151 implements MigrationInterface {
    name = 'Prod1784240627151'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`customer_delivery_preference\` (\`mem_code\` varchar(50) NOT NULL, \`preference\` varchar(30) NOT NULL, \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`mem_code\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`file_upload_type\` enum ('com', 'pass') NOT NULL DEFAULT 'com'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`file_upload_type\``);
        await queryRunner.query(`DROP TABLE \`customer_delivery_preference\``);
    }

}
