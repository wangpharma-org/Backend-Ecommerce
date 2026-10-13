import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * คอลัมน์ที่ entity มีแต่ release 1.52.0 ไม่มี migration — prod (SYNCHRONIZE=false) จะ error Unknown column
 * - ECWC-682: product.eng_chiew (สถานะสินค้าใน dropdown ค้นหา)
 * - ECWC-683: edit_address.mem_moo / mem_building / mem_room (หมู่ที่ / อาคาร / ห้องเลขที่)
 */
export class AddEngChiewAndAddressDetail20261010000100 implements MigrationInterface {
  name = 'AddEngChiewAndAddressDetail20261010000100';

  private readonly addressColumns = ['mem_moo', 'mem_building', 'mem_room'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('product', 'eng_chiew'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD `eng_chiew` tinyint NOT NULL DEFAULT 0',
      );
    }

    for (const column of this.addressColumns) {
      if (!(await queryRunner.hasColumn('edit_address', column))) {
        await queryRunner.query(
          `ALTER TABLE \`edit_address\` ADD \`${column}\` varchar(120) NULL`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [...this.addressColumns].reverse()) {
      if (await queryRunner.hasColumn('edit_address', column)) {
        await queryRunner.query(
          `ALTER TABLE \`edit_address\` DROP COLUMN \`${column}\``,
        );
      }
    }

    if (await queryRunner.hasColumn('product', 'eng_chiew')) {
      await queryRunner.query('ALTER TABLE `product` DROP COLUMN `eng_chiew`');
    }
  }
}
