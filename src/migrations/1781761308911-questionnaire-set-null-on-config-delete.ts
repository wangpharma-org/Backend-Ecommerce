import { MigrationInterface, QueryRunner } from "typeorm";

export class QuestionnaireSetNullOnConfigDelete1781761308911 implements MigrationInterface {
    name = 'QuestionnaireSetNullOnConfigDelete1781761308911'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`questionnaire\` DROP FOREIGN KEY \`FK_eae0e95bd5a0ba7fe0fc1e3470b\``);
        await queryRunner.query(`ALTER TABLE \`questionnaire\` CHANGE \`question_id\` \`question_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`questionnaire\` ADD CONSTRAINT \`FK_eae0e95bd5a0ba7fe0fc1e3470b\` FOREIGN KEY (\`question_id\`) REFERENCES \`questionnaire_config\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`questionnaire\` DROP FOREIGN KEY \`FK_eae0e95bd5a0ba7fe0fc1e3470b\``);
        await queryRunner.query(`ALTER TABLE \`questionnaire\` CHANGE \`question_id\` \`question_id\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`questionnaire\` ADD CONSTRAINT \`FK_eae0e95bd5a0ba7fe0fc1e3470b\` FOREIGN KEY (\`question_id\`) REFERENCES \`questionnaire_config\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
