import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestionnaireInputTypeAndTextAnswer1781686833458 implements MigrationInterface {
    name = 'AddQuestionnaireInputTypeAndTextAnswer1781686833458'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_a5848859c3cbbf247db852e323\` ON \`hotdeal_entity\``);
        await queryRunner.query(`ALTER TABLE \`questionnaire_config\` ADD \`input_type\` enum ('star', 'text') NOT NULL DEFAULT 'star'`);
        await queryRunner.query(`ALTER TABLE \`questionnaire\` ADD \`text_answer\` text NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`questionnaire\` DROP COLUMN \`text_answer\``);
        await queryRunner.query(`ALTER TABLE \`questionnaire_config\` DROP COLUMN \`input_type\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_a5848859c3cbbf247db852e323\` ON \`hotdeal_entity\` (\`pro_code1\`)`);
    }

}
