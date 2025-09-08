import { MigrationInterface, QueryRunner } from "typeorm";

export class WangDay1757303089834 implements MigrationInterface {
    name = 'WangDay1757303089834'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ecommerce_db_backend\`.\`wangday_sumprice\` (\`wang_id\` int NOT NULL AUTO_INCREMENT, \`wang_code\` varchar(16) COLLATE "utf8_unicode_ci" NOT NULL, \`wang_yo\` decimal(10,2) NOT NULL, \`wang_tgpm\` decimal(10,2) NOT NULL, \`wang_tg9\` decimal(10,2) NOT NULL, \`wang_gif\` decimal(10,2) NOT NULL, PRIMARY KEY (\`wang_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ecommerce_db_backend\`.\`wangday\` ADD UNIQUE INDEX \`IDX_bda7f98ec77182cd3b1ac820e0\` (\`sh_running\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ecommerce_db_backend\`.\`wangday\` DROP INDEX \`IDX_bda7f98ec77182cd3b1ac820e0\``);
        await queryRunner.query(`DROP TABLE \`ecommerce_db_backend\`.\`wangday_sumprice\``);
    }

}
