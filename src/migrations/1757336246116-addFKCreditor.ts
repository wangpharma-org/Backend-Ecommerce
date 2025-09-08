import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFKCreditor1757336246116 implements MigrationInterface {
    name = 'AddFKCreditor1757336246116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD \`creditor_code\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_0528c5697fa80104f5aedbadbb4\` FOREIGN KEY (\`creditor_code\`) REFERENCES \`creditor\`(\`creditor_code\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_0528c5697fa80104f5aedbadbb4\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP COLUMN \`creditor_code\``);
    }

}
