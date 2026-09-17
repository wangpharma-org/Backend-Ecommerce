import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ECWC-571 — พักกระเช้าสำเร็จรูปไว้ก่อน
 *
 * ยังไม่เคาะสองเรื่อง: ราคาชุดเดียวแต่ระบบมีราคา 3 เกรด (ร้านเกรด A อาจจ่าย
 * แพงกว่าซื้อแยกชิ้นโดยไม่มีใครรู้) และวิธีแสดงส่วนลดบนบิลที่คนคีย์เข้าบัญชี
 * อ่านแล้วไม่สับสน จนกว่าจะจบสองเรื่องนี้ แอดมินไม่ควรสร้างกระเช้าได้
 *
 * ต้อง seed แถวนี้ให้เป็น false เอง เพราะ FeatureFlagsService.getFlag
 * สร้าง key ที่ยังไม่มีให้อัตโนมัติด้วย is_enabled = true — ถ้าไม่ seed
 * แท็บจะโผล่บน production ทันทีที่ deploy
 */
export class ParkBundleSetAdmin20260914000100 implements MigrationInterface {
  name = 'ParkBundleSetAdmin20260914000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `feature_flag` (`feature_key`, `is_enabled`) SELECT 'bundle_set_admin', 0 WHERE NOT EXISTS (SELECT 1 FROM `feature_flag` WHERE `feature_key` = 'bundle_set_admin')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'bundle_set_admin'",
    );
  }
}
