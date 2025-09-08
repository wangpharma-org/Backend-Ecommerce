import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyDayRemoveIndex1757336165833 implements MigrationInterface {
    name = 'CompanyDayRemoveIndex1757336165833'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_0528c5697fa80104f5aedbadbb4\``);
        await queryRunner.query(`DROP INDEX \`IDX_0528c5697fa80104f5aedbadbb\` ON \`promotion\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP COLUMN \`creditor_code\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD \`creditor_code\` varchar(255) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_0528c5697fa80104f5aedbadbb\` ON \`promotion\` (\`creditor_code\`)`);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_0528c5697fa80104f5aedbadbb4\` FOREIGN KEY (\`creditor_code\`) REFERENCES \`creditor\`(\`creditor_code\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
