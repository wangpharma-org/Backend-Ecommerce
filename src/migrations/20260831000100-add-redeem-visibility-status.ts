import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRedeemVisibilityStatus20260831000100 implements MigrationInterface {
  name = 'AddRedeemVisibilityStatus20260831000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('product', 'pro_redeem_hidden'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_hidden` tinyint NOT NULL DEFAULT 0',
      );
    }
    if (!(await queryRunner.hasColumn('product', 'pro_redeem_coming_soon'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_coming_soon` tinyint NOT NULL DEFAULT 0',
      );
    }

    await queryRunner.query(
      'ALTER TABLE `redeem_product_backup` ADD UNIQUE INDEX `UQ_redeem_product_backup_code` (`backup_product_code`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `redeem_product_backup` DROP INDEX `UQ_redeem_product_backup_code`',
    );
    if (await queryRunner.hasColumn('product', 'pro_redeem_coming_soon')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_coming_soon`',
      );
    }
    if (await queryRunner.hasColumn('product', 'pro_redeem_hidden')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_hidden`',
      );
    }
  }
}
