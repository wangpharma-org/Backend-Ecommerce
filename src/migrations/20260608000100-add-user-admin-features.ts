import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAdminFeatures20260608000100 implements MigrationInterface {
  name = 'AddUserAdminFeatures20260608000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `admin_features` text NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `users` DROP COLUMN `admin_features`');
  }
}
