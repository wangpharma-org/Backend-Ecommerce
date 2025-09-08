import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyDays1757146044328 implements MigrationInterface {
    name = 'CompanyDays1757146044328'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`creditor\` ADD UNIQUE INDEX \`IDX_58317cf9080a5985d6b517e96f\` (\`creditor_code\`)`);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_0528c5697fa80104f5aedbadbb4\` FOREIGN KEY (\`creditor_code\`) REFERENCES \`creditor\`(\`creditor_code\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`product\` ADD CONSTRAINT \`FK_f90a0d543d3b8c6eaac530eb286\` FOREIGN KEY (\`creditor_code\`) REFERENCES \`creditor\`(\`creditor_code\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`product\` DROP FOREIGN KEY \`FK_f90a0d543d3b8c6eaac530eb286\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_0528c5697fa80104f5aedbadbb4\``);
        await queryRunner.query(`ALTER TABLE \`creditor\` DROP INDEX \`IDX_58317cf9080a5985d6b517e96f\``);
    }

}
