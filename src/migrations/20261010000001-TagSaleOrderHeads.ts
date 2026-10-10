import { MigrationInterface, QueryRunner } from 'typeorm';

export class TagSaleOrderHeads20261010000001 implements MigrationInterface {
  name = 'TagSaleOrderHeads20261010000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE shopping_head ADD sale_order_request_id varchar(36) NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IDX_shopping_head_sale_order_request ON shopping_head (sale_order_request_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IDX_shopping_head_sale_order_request ON shopping_head',
    );
    await queryRunner.query(
      'ALTER TABLE shopping_head DROP COLUMN sale_order_request_id',
    );
  }
}
