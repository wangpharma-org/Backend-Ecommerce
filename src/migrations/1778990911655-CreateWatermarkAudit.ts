import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWatermarkAudit1778990911655 implements MigrationInterface {
    name = 'CreateWatermarkAudit1778990911655'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`watermark_audit\` (\`id\` int NOT NULL AUTO_INCREMENT, \`token\` varchar(32) NOT NULL, \`mem_code\` varchar(255) NOT NULL, \`page\` varchar(255) NOT NULL, \`ip\` varchar(64) NULL, \`user_agent\` varchar(512) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_623fb3ab6de0c18a6607bffc90\` (\`token\`), INDEX \`IDX_eb46f33b18a535b402245b43b2\` (\`mem_code\`), INDEX \`IDX_7bc5e96d65d95b675a1fbe0723\` (\`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`watermark_audit_archive\` (\`id\` int NOT NULL AUTO_INCREMENT, \`token\` varchar(32) NOT NULL, \`mem_code\` varchar(255) NOT NULL, \`page\` varchar(255) NOT NULL, \`ip\` varchar(64) NULL, \`user_agent\` varchar(512) NULL, \`created_at\` datetime NOT NULL, \`archived_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_5aa1467c7df6ce82b32d86e3af\` (\`token\`), INDEX \`IDX_55987e5082dfea4f69f27c76d3\` (\`mem_code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_55987e5082dfea4f69f27c76d3\` ON \`watermark_audit_archive\``);
        await queryRunner.query(`DROP INDEX \`IDX_5aa1467c7df6ce82b32d86e3af\` ON \`watermark_audit_archive\``);
        await queryRunner.query(`DROP TABLE \`watermark_audit_archive\``);
        await queryRunner.query(`DROP INDEX \`IDX_7bc5e96d65d95b675a1fbe0723\` ON \`watermark_audit\``);
        await queryRunner.query(`DROP INDEX \`IDX_eb46f33b18a535b402245b43b2\` ON \`watermark_audit\``);
        await queryRunner.query(`DROP INDEX \`IDX_623fb3ab6de0c18a6607bffc90\` ON \`watermark_audit\``);
        await queryRunner.query(`DROP TABLE \`watermark_audit\``);
    }

}
