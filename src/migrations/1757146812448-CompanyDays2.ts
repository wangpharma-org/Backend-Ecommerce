import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyDays21757146812448 implements MigrationInterface {
    name = 'CompanyDays21757146812448'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`flashsale\` (\`spc_id\` int NOT NULL AUTO_INCREMENT, \`pro_code\` varchar(20) NULL, PRIMARY KEY (\`spc_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP COLUMN \`start_date\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD \`start_date\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP COLUMN \`end_date\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD \`end_date\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`flashsale\` ADD CONSTRAINT \`FK_5a62b3268dcdd633fe141a0a8b1\` FOREIGN KEY (\`pro_code\`) REFERENCES \`product\`(\`pro_code\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`flashsale\` DROP FOREIGN KEY \`FK_5a62b3268dcdd633fe141a0a8b1\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP COLUMN \`end_date\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD \`end_date\` date NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`promotion\` DROP COLUMN \`start_date\``);
        await queryRunner.query(`ALTER TABLE \`promotion\` ADD \`start_date\` date NOT NULL`);
        await queryRunner.query(`DROP TABLE \`flashsale\``);
    }

}
