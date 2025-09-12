import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyDayRemoveIndex1757497861081 implements MigrationInterface {
    name = 'CompanyDayRemoveIndex1757497861081'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_0528c5697fa80104f5aedbadbb4\` FOREIGN KEY (\`creditor_code\`) REFERENCES \`creditor\`(\`creditor_code\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_0528c5697fa80104f5aedbadbb4\``);
    }

}
