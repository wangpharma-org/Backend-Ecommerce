import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * นโยบายการเพิ่มจำนวนต่อรอบ + ล็อตของรายการจอง
 * - preorder_campaigns.increase_policy: keep (ส่วนที่เพิ่มได้คิวเดิม) / split (ส่วนที่เพิ่มเป็นคิวใหม่) / reset (ทั้งรายการไปท้ายคิว)
 * - preorder_campaigns.increase_grace_hours: ภายใน N ชม. หลังจองครั้งแรก เพิ่มได้โดยไม่เสียคิว (null = ไม่มีช่วงผ่อนผัน)
 * - preorder_item_lots: จำนวนแต่ละก้อนพร้อมเวลาเข้าคิว backfill จาก preorder_items เดิม 1 ล็อตต่อรายการ
 */
export class AddPreorderLotsAndIncreasePolicy1789003600000 implements MigrationInterface {
  name = 'AddPreorderLotsAndIncreasePolicy1789003600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`preorder_campaigns\`
        ADD \`increase_policy\` enum('keep','split','reset') NOT NULL DEFAULT 'keep' AFTER \`allow_cancel\`,
        ADD \`increase_grace_hours\` int NULL AFTER \`increase_policy\`
    `);
    await queryRunner.query(`
      CREATE TABLE \`preorder_item_lots\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`item_id\` int NOT NULL,
        \`qty\` int NOT NULL,
        \`ordered_at\` datetime(6) NOT NULL,
        \`allocated_qty\` int NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_preorder_item_lots_item\` (\`item_id\`),
        INDEX \`IDX_preorder_item_lots_queue\` (\`ordered_at\`, \`id\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_preorder_item_lots_item\` FOREIGN KEY (\`item_id\`)
          REFERENCES \`preorder_items\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      INSERT INTO \`preorder_item_lots\` (\`item_id\`, \`qty\`, \`ordered_at\`, \`allocated_qty\`)
      SELECT \`id\`, \`amount\`, \`ordered_at\`, \`allocated_qty\` FROM \`preorder_items\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`preorder_item_lots\``);
    await queryRunner.query(
      `ALTER TABLE \`preorder_campaigns\` DROP COLUMN \`increase_grace_hours\`, DROP COLUMN \`increase_policy\``,
    );
  }
}
