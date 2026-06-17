import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestionnaireInputTypeAndTextAnswer1781686833458 implements MigrationInterface {
    name = 'AddQuestionnaireInputTypeAndTextAnswer1781686833458'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`questionnaire_config\` ADD \`input_type\` enum ('star', 'text') NOT NULL DEFAULT 'star'`);
        await queryRunner.query(`ALTER TABLE \`questionnaire\` ADD \`text_answer\` text NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`questionnaire\` DROP COLUMN \`text_answer\``);
        await queryRunner.query(`ALTER TABLE \`questionnaire_config\` DROP COLUMN \`input_type\``);
    }

}
