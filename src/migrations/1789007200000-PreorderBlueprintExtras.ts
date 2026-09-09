import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ส่วนเพิ่มจาก Blueprint กลุ่ม 3
 * - preorder_products.min_per_member   : ขั้นต่ำต่อร้าน (null = ไม่กำหนด)
 * - preorder_products.pack_multiple    : ต้องจองเป็นทวีคูณของหีบห่อ เช่น 10 (null = ไม่กำหนด)
 * - preorder_products.price_tiers      : ราคาขั้นบันไดตามยอดรวมทั้งรอบ JSON [{min_total_qty, price}]
 * - preorder_campaigns.closing_reminded_at : เตือนก่อนปิดรอบไปแล้วเมื่อ (cron วันละครั้ง)
 * - preorder_items.cart_pushed_at      : ส่งจำนวนที่จัดสรรเข้าตะกร้าลูกค้าแล้วเมื่อ
 * - preorder_products.reason           : เหตุผลที่เปิดจอง (มติประชุม 9 ก.ย. 69) restock = สินค้ากำลังจะเข้า / price_increase = สินค้าจะมีการปรับราคา
 * - preorder_products.new_price / price_effective_date : ราคาใหม่หลังปรับ และวันที่มีผล (ลูกค้าจองได้ในราคาเดิมก่อนวันนั้น)
 * - preorder_item_logs.action          : เพิ่ม 'to_cart' และ 'staff_book'
 */
export class PreorderBlueprintExtras1789007200000 implements MigrationInterface {
  name = 'PreorderBlueprintExtras1789007200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`preorder_products\`
        ADD \`min_per_member\` int NULL AFTER \`limit_per_member\`,
        ADD \`pack_multiple\` int NULL AFTER \`min_per_member\`,
        ADD \`price_tiers\` json NULL AFTER \`estimated_price\`,
        ADD \`reason\` enum('restock','price_increase') NOT NULL DEFAULT 'restock' AFTER \`note\`,
        ADD \`new_price\` decimal(16,2) NULL AFTER \`reason\`,
        ADD \`price_effective_date\` date NULL AFTER \`new_price\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`preorder_campaigns\`
        ADD \`closing_reminded_at\` datetime NULL AFTER \`increase_grace_hours\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`preorder_items\`
        ADD \`cart_pushed_at\` datetime NULL AFTER \`is_paid\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`preorder_item_logs\`
        MODIFY \`action\` enum('create','update','lock','unlock','allocate','paid','unpaid','cancel','fulfill','arrived_notify','to_cart','staff_book') NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`preorder_item_logs\`
        MODIFY \`action\` enum('create','update','lock','unlock','allocate','paid','unpaid','cancel','fulfill','arrived_notify') NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE \`preorder_items\` DROP COLUMN \`cart_pushed_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`preorder_campaigns\` DROP COLUMN \`closing_reminded_at\``,
    );
    await queryRunner.query(`
      ALTER TABLE \`preorder_products\`
        DROP COLUMN \`price_effective_date\`, DROP COLUMN \`new_price\`, DROP COLUMN \`reason\`,
        DROP COLUMN \`price_tiers\`, DROP COLUMN \`pack_multiple\`, DROP COLUMN \`min_per_member\`
    `);
  }
}
