import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyDays31757154877563 implements MigrationInterface {
    name = 'CompanyDays31757154877563'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_0528c5697fa80104f5aedbadbb\` ON \`promotion\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_0528c5697fa80104f5aedbadbb\` ON \`promotion\` (\`creditor_code\`)`);
    }

}
