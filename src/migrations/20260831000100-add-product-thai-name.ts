import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductThaiName20260831000100 implements MigrationInterface {
  name = 'AddProductThaiName20260831000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasProductThaiName = await queryRunner.hasColumn(
      'product',
      'pro_nameTH',
    );

    if (!hasProductThaiName) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD `pro_nameTH` varchar(255) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasProductThaiName = await queryRunner.hasColumn(
      'product',
      'pro_nameTH',
    );

    if (hasProductThaiName) {
      await queryRunner.query('ALTER TABLE `product` DROP COLUMN `pro_nameTH`');
    }
  }
}
