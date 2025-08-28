import { MigrationInterface, QueryRunner } from "typeorm";

export class FeatureFlag1756299580103 implements MigrationInterface {
    name = 'FeatureFlag1756299580103'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`feature-flag\` (\`flag_id\` int NOT NULL AUTO_INCREMENT, \`flag_name\` tinyint NOT NULL DEFAULT 1, PRIMARY KEY (\`flag_id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`feature-flag\``);
    }

}
