import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRedeemProductSettings20260826000100 implements MigrationInterface {
  name = 'AddRedeemProductSettings20260826000100';

  private async hasIndex(
    queryRunner: QueryRunner,
    indexName: string,
  ): Promise<boolean> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND INDEX_NAME = ?`,
      [indexName],
    )) as { total: number | string }[];
    return Number(rows[0]?.total ?? 0) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasColumn('product', 'pro_redeem_display_quantity'))
    ) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_display_quantity` int NULL DEFAULT NULL',
      );
    }
    if (!(await queryRunner.hasColumn('product', 'pro_redeem_rank'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_rank` int NULL DEFAULT NULL',
      );
    }
    if (!(await this.hasIndex(queryRunner, 'IDX_product_redeem_supplier'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_redeem_supplier` ON `product` (`pro_supplier`, `pro_point`, `pro_stock`)',
      );
    }
    if (!(await this.hasIndex(queryRunner, 'IDX_product_redeem_rank'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_redeem_rank` ON `product` (`pro_redeem_rank`)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasIndex(queryRunner, 'IDX_product_redeem_rank')) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_redeem_rank` ON `product`',
      );
    }
    if (await this.hasIndex(queryRunner, 'IDX_product_redeem_supplier')) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_redeem_supplier` ON `product`',
      );
    }
    if (await queryRunner.hasColumn('product', 'pro_redeem_rank')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_rank`',
      );
    }
    if (await queryRunner.hasColumn('product', 'pro_redeem_display_quantity')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_display_quantity`',
      );
    }
  }
}
