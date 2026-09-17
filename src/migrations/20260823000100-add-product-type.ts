import { MigrationInterface, QueryRunner } from 'typeorm';

// ECWC-444 — คอลัมน์ระบุประเภทสินค้า '00' = สินค้าแลกแต้ม, '01' = สินค้าขายปกติ
export class AddProductType20260823000100 implements MigrationInterface {
  name = 'AddProductType20260823000100';

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
    // env ที่เปิด SYNCHRONIZE=true อาจมีคอลัมน์อยู่แล้วจาก entity
    if (!(await queryRunner.hasColumn('product', 'product_type'))) {
      await queryRunner.query(
        "ALTER TABLE `product` ADD COLUMN `product_type` varchar(10) NOT NULL DEFAULT '01'",
      );
    }

    // ไม่ backfill — ทุกแถวเป็น '01' ไปก่อน ค่อยมาเซ็ต '00' ทีหลัง

    if (!(await this.hasIndex(queryRunner, 'IDX_product_redeem'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_redeem` ON `product` (`product_type`, `pro_point`, `pro_stock`)',
      );
    }
    if (!(await this.hasIndex(queryRunner, 'IDX_product_free_redeem'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_free_redeem` ON `product` (`pro_free`, `pro_point`, `pro_stock`)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasIndex(queryRunner, 'IDX_product_free_redeem')) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_free_redeem` ON `product`',
      );
    }
    if (await this.hasIndex(queryRunner, 'IDX_product_redeem')) {
      await queryRunner.query('DROP INDEX `IDX_product_redeem` ON `product`');
    }
    if (await queryRunner.hasColumn('product', 'product_type')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `product_type`',
      );
    }
  }
}
