import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionUpdatedAt20261003000100 implements MigrationInterface {
  name = 'AddPromotionUpdatedAt20261003000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('promotion', 'updated_at'))) {
      await queryRunner.query(
        'ALTER TABLE `promotion` ADD `updated_at` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('promotion', 'updated_at')) {
      await queryRunner.query('ALTER TABLE `promotion` DROP COLUMN `updated_at`');
    }
  }
}
