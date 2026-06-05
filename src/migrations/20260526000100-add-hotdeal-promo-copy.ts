import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotdealPromoCopy20260526000100 implements MigrationInterface {
  name = 'AddHotdealPromoCopy20260526000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `hotdeal_entity` ADD `promo_title` varchar(120) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `hotdeal_entity` ADD `promo_body` text NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `hotdeal_entity` DROP COLUMN `promo_body`',
    );
    await queryRunner.query(
      'ALTER TABLE `hotdeal_entity` DROP COLUMN `promo_title`',
    );
  }
}
