import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromotionDateChangeLog20261003000200
  implements MigrationInterface
{
  name = 'CreatePromotionDateChangeLog20261003000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('promotion', 'updated_at')) {
      await queryRunner.query('ALTER TABLE `promotion` DROP COLUMN `updated_at`');
    }

    if (!(await queryRunner.hasTable('promotion_date_change_log'))) {
      await queryRunner.query(
        'CREATE TABLE `promotion_date_change_log` (`id` int NOT NULL AUTO_INCREMENT, `promo_id` int NOT NULL, `admin_mem_code` varchar(100) NOT NULL, `admin_username` varchar(255) NOT NULL, `old_start_date` datetime NOT NULL, `old_end_date` datetime NOT NULL, `new_start_date` datetime NOT NULL, `new_end_date` datetime NOT NULL, `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX `IDX_promo_date_log_promo_created_at` (`promo_id`, `created_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('promotion_date_change_log')) {
      await queryRunner.query('DROP TABLE `promotion_date_change_log`');
    }

    if (!(await queryRunner.hasColumn('promotion', 'updated_at'))) {
      await queryRunner.query(
        'ALTER TABLE `promotion` ADD `updated_at` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP',
      );
    }
  }
}
