import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCartBasket20260906000300 implements MigrationInterface {
  name = 'CreateCartBasket20260906000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`cart_basket\` (
        \`basket_id\` int NOT NULL AUTO_INCREMENT,
        \`mem_code\` varchar(30) NOT NULL,
        \`promo_id\` int NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`basket_id\`),
        KEY \`IDX_cart_basket_member\` (\`mem_code\`),
        KEY \`IDX_cart_basket_promo\` (\`promo_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ตั้งใจไม่ผูก FOREIGN KEY กับ shopping_cart — ตารางนั้นใหญ่มากบน production
    // การเพิ่ม FK ต้อง scan ทั้งตารางและล็อกยาว จัดการ cascade ในโค้ดแทน
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` ADD COLUMN `basket_id` int NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` ADD INDEX `IDX_shopping_cart_basket` (`basket_id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` DROP INDEX `IDX_shopping_cart_basket`',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` DROP COLUMN `basket_id`',
    );
    await queryRunner.query('DROP TABLE `cart_basket`');
  }
}
