import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-567 — บรรทัดออเดอร์ต้องบอก "ราคาปกติ" กับ "ส่วนลด" แยกกัน
 *
 * บิลที่ส่งลูกค้าต้องตรงกับบิลที่คีย์เข้าระบบบัญชี ซึ่งเก็บได้แค่
 * รหัสสินค้า / ชื่อสินค้า / ส่วนลด / มูลค่าสินค้า จึงเฉลี่ยราคาลงบรรทัดไม่ได้
 * ของเดิมกระเช้าสำเร็จรูปยัดส่วนลดลงไปใน spo_price_unit ทำให้ปลายทางไม่มีทาง
 * รู้ราคาจริงและส่วนลด ส่วนของแถมส่ง 0/0 แล้วให้ปลายทางเดาเอาว่าลด 100%
 *
 * เพิ่มสองคอลัมน์แบบไม่แตะของเดิม เพื่อให้ย้ายทีละฝั่งได้ ไม่ต้อง deploy พร้อมกัน
 * ปลายทางอ่านของเดิมต่อไปได้จนกว่าจะพร้อมย้ายมาอ่านสองตัวนี้
 */
export class AddDiscountToShoppingOrder20260913000100
  implements MigrationInterface
{
  name = 'AddDiscountToShoppingOrder20260913000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_order` ADD COLUMN `spo_price_list` decimal(16,2) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_order` ADD COLUMN `spo_discount` decimal(5,2) NULL DEFAULT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_order` DROP COLUMN `spo_discount`',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_order` DROP COLUMN `spo_price_list`',
    );
  }
}
