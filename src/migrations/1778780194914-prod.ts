import { MigrationInterface, QueryRunner } from "typeorm";

export class Prod1778780194914 implements MigrationInterface {
    name = 'Prod1778780194914'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`review_request\` (\`id\` int NOT NULL AUTO_INCREMENT, \`mem_code\` varchar(255) NOT NULL, \`sh_running\` json NOT NULL, \`is_completed\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_c87ad184bced30b006021903b6\` (\`mem_code\`), INDEX \`IDX_84f485736a8158e8a2b7fc2265\` (\`is_completed\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`product_requests\` (\`id\` int NOT NULL AUTO_INCREMENT, \`mem_code\` varchar(30) NOT NULL, \`keyword\` text NOT NULL, \`pro_name\` varchar(255) NOT NULL, \`note\` text NULL, \`img_url\` text NULL, \`source_page\` varchar(100) NULL, \`shown_products\` text NULL, \`current_page\` int NULL, \`status\` enum ('pending', 'resolved', 'rejected') NOT NULL DEFAULT 'pending', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_eedce1668e1249f8ffa355fae5\` (\`mem_code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`campaigns_poster_history\` (\`id\` varchar(36) NOT NULL, \`img_url\` text NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`rowId\` varchar(36) NULL, INDEX \`IDX_9bd089dc9fc9bd1f7488c586de\` (\`rowId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`campaigns_poster_banner_link\` (\`id\` varchar(36) NOT NULL, \`banner_id\` int NOT NULL, \`banner_location\` varchar(50) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`historyId\` varchar(36) NULL, INDEX \`IDX_aa67a94e32efd6d63438150aad\` (\`historyId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`campaigns_poster_history\` ADD CONSTRAINT \`FK_9bd089dc9fc9bd1f7488c586de1\` FOREIGN KEY (\`rowId\`) REFERENCES \`campaigns_row\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`campaigns_poster_banner_link\` ADD CONSTRAINT \`FK_aa67a94e32efd6d63438150aad3\` FOREIGN KEY (\`historyId\`) REFERENCES \`campaigns_poster_history\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`campaigns_poster_banner_link\` DROP FOREIGN KEY \`FK_aa67a94e32efd6d63438150aad3\``);
        await queryRunner.query(`ALTER TABLE \`campaigns_poster_history\` DROP FOREIGN KEY \`FK_9bd089dc9fc9bd1f7488c586de1\``);
        await queryRunner.query(`DROP INDEX \`IDX_aa67a94e32efd6d63438150aad\` ON \`campaigns_poster_banner_link\``);
        await queryRunner.query(`DROP TABLE \`campaigns_poster_banner_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_9bd089dc9fc9bd1f7488c586de\` ON \`campaigns_poster_history\``);
        await queryRunner.query(`DROP TABLE \`campaigns_poster_history\``);
        await queryRunner.query(`DROP INDEX \`IDX_eedce1668e1249f8ffa355fae5\` ON \`product_requests\``);
        await queryRunner.query(`DROP TABLE \`product_requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_84f485736a8158e8a2b7fc2265\` ON \`review_request\``);
        await queryRunner.query(`DROP INDEX \`IDX_c87ad184bced30b006021903b6\` ON \`review_request\``);
        await queryRunner.query(`DROP TABLE \`review_request\``);
    }

}
