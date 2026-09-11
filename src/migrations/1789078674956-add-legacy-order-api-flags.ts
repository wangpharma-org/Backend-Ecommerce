import { MigrationInterface, QueryRunner } from 'typeorm';

// ECWC-545: flag ควบคุมว่า mobile app จะสลับมาเรียก /ecom/legacy/order-list และ
// /ecom/legacy/order-detail (clone ของ Akitokung/api/order/order_list.php และ order_detial.php)
// แทนของเดิมหรือยัง — default ปิดไว้ก่อนจนกว่าจะ QA เทียบ response กับแอปจริงแล้ว
export class AddLegacyOrderApiFlags1789078674956
  implements MigrationInterface
{
  name = 'AddLegacyOrderApiFlags1789078674956';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `feature_flag` (`feature_key`, `is_enabled`) VALUES ('new_order_list_api', false)",
    );
    await queryRunner.query(
      "INSERT INTO `feature_flag` (`feature_key`, `is_enabled`) VALUES ('new_order_detail_api', false)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'new_order_detail_api'",
    );
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'new_order_list_api'",
    );
  }
}
