import { MigrationInterface, QueryRunner } from 'typeorm';

export class Unit1777869005107 implements MigrationInterface {
  name = 'Unit1777869005107';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`shopping_cart\` ADD \`spc_unit_enum\` enum ('1', '2', '3') NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE \`product_unit\` (\`id\` int NOT NULL AUTO_INCREMENT, \`pro_code\` varchar(20) NOT NULL, \`unit_name\` varchar(30) NOT NULL, \`ratio\` int NOT NULL DEFAULT '1', \`level\` int NOT NULL, PRIMARY KEY (\`id\`), UNIQUE KEY \`uk_product_unit\` (\`pro_code\`, \`level\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_unit\` ADD CONSTRAINT \`FK_86e4bbe0fb61335628ca7601fde\` FOREIGN KEY (\`pro_code\`) REFERENCES \`product\`(\`pro_code\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO product_unit (pro_code, unit_name, ratio, \`level\`) 
   SELECT pro_code, pro_unit1, pro_ratio1, 1
   FROM product 
   WHERE pro_unit1 IS NOT NULL AND pro_unit1 != ""`,
    );

    await queryRunner.query(
      `INSERT INTO product_unit (pro_code, unit_name, ratio, \`level\`) 
   SELECT pro_code, pro_unit2, pro_ratio2, 2
   FROM product 
   WHERE pro_unit2 IS NOT NULL AND pro_unit2 != ""`,
    );

    await queryRunner.query(
      `INSERT INTO product_unit (pro_code, unit_name, ratio, \`level\`) 
   SELECT pro_code, pro_unit3, pro_ratio3, 3
   FROM product 
   WHERE pro_unit3 IS NOT NULL AND pro_unit3 != ""`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`pro_ratio1\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`pro_ratio2\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`pro_ratio3\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`pro_unit1\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`pro_unit2\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`pro_unit3\``,
    );

    // Pre-flight: log rows ที่ spc_unit ไม่ match unit_name ใด — จะถูก set เป็น NULL
    const [{ orphanCount }] = await queryRunner.query(`
      SELECT COUNT(*) AS orphanCount
      FROM shopping_cart sc
      LEFT JOIN product_unit pu
        ON TRIM(sc.pro_code) COLLATE utf8mb4_unicode_ci = TRIM(pu.pro_code) COLLATE utf8mb4_unicode_ci
        AND TRIM(sc.spc_unit) COLLATE utf8mb4_unicode_ci = TRIM(pu.unit_name) COLLATE utf8mb4_unicode_ci
      WHERE pu.level IS NULL
        AND sc.spc_unit IS NOT NULL
        AND TRIM(sc.spc_unit) != ''
    `);
    if (Number(orphanCount) > 0) {
      console.warn(
        `[Migration] WARNING: ${orphanCount} shopping_cart row(s) have spc_unit that does not match any product_unit.unit_name — spc_unit_enum will be NULL for these rows. Review data before proceeding.`,
      );
    }

    await queryRunner.query(`
      UPDATE shopping_cart sc
      LEFT JOIN product_unit pu
        ON TRIM(sc.pro_code) COLLATE utf8mb4_unicode_ci = TRIM(pu.pro_code) COLLATE utf8mb4_unicode_ci
        AND TRIM(sc.spc_unit) COLLATE utf8mb4_unicode_ci = TRIM(pu.unit_name) COLLATE utf8mb4_unicode_ci
      SET sc.spc_unit_enum = CAST(pu.level AS CHAR)
    `);

    await queryRunner.query(
      `ALTER TABLE \`shopping_cart\` DROP COLUMN \`spc_unit\``,
    );

    // อัพเดท hotdeal_entity pro1_unit (แยกตาม level เหมือน shopping_cart)
    await queryRunner.query(`
      UPDATE hotdeal_entity hd
      LEFT JOIN product_unit pu ON hd.pro_code1 COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND hd.pro1_unit COLLATE utf8mb4_unicode_ci = pu.unit_name COLLATE utf8mb4_unicode_ci
      SET hd.pro1_unit = IFNULL(CAST(pu.level AS CHAR), 1)
    `);

    // อัพเดท hotdeal_entity pro2_unit (แยกตาม level เหมือน shopping_cart)
    await queryRunner.query(`
      UPDATE hotdeal_entity hd
      LEFT JOIN product_unit pu ON hd.pro_code2 COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND hd.pro2_unit COLLATE utf8mb4_unicode_ci = pu.unit_name COLLATE utf8mb4_unicode_ci
      SET hd.pro2_unit = IFNULL(CAST(pu.level AS CHAR), 1)
    `);

    // อัพเดท promotion_reward unit (แยกตาม level เหมือน shopping_cart)
    await queryRunner.query(`
      UPDATE promotion_reward pr
      LEFT JOIN product_unit pu ON pr.product_gcode COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND pr.unit COLLATE utf8mb4_unicode_ci = pu.unit_name COLLATE utf8mb4_unicode_ci
      SET pr.unit = IFNULL(CAST(pu.level AS CHAR), 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // เพิ่ม columns กลับคืนใน product table ก่อน
    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`pro_unit1\` varchar(30) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`pro_unit2\` varchar(30) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`pro_unit3\` varchar(30) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`pro_ratio1\` int NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`pro_ratio2\` int NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`pro_ratio3\` int NULL`,
    );

    // กู้คืนข้อมูลจาก product_unit กลับไป product
    await queryRunner.query(`
      UPDATE product p 
      SET pro_unit1 = (SELECT unit_name FROM product_unit pu WHERE pu.pro_code = p.pro_code AND pu.level = 1 LIMIT 1),
          pro_ratio1 = (SELECT ratio FROM product_unit pu WHERE pu.pro_code = p.pro_code AND pu.level = 1 LIMIT 1)
    `);

    await queryRunner.query(`
      UPDATE product p 
      SET pro_unit2 = (SELECT unit_name FROM product_unit pu WHERE pu.pro_code = p.pro_code AND pu.level = 2 LIMIT 1),
          pro_ratio2 = (SELECT ratio FROM product_unit pu WHERE pu.pro_code = p.pro_code AND pu.level = 2 LIMIT 1)
    `);

    await queryRunner.query(`
      UPDATE product p 
      SET pro_unit3 = (SELECT unit_name FROM product_unit pu WHERE pu.pro_code = p.pro_code AND pu.level = 3 LIMIT 1),
          pro_ratio3 = (SELECT ratio FROM product_unit pu WHERE pu.pro_code = p.pro_code AND pu.level = 3 LIMIT 1)
    `);

    // เพิ่ม column spc_unit กลับมา
    await queryRunner.query(
      `ALTER TABLE \`shopping_cart\` ADD \`spc_unit\` varchar(50) NULL`,
    );

    // กู้คืนข้อมูล shopping_cart
    await queryRunner.query(`
      UPDATE shopping_cart sc
      LEFT JOIN product_unit pu ON sc.pro_code COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND sc.spc_unit_enum COLLATE utf8mb4_unicode_ci = CAST(pu.level AS CHAR) COLLATE utf8mb4_unicode_ci
      SET sc.spc_unit = pu.unit_name
    `);

    // กู้คืน hotdeal_entity pro1_unit และ pro2_unit
    await queryRunner.query(`
      UPDATE hotdeal_entity hd
      LEFT JOIN product_unit pu ON hd.pro_code1 COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND hd.pro1_unit COLLATE utf8mb4_unicode_ci = CAST(pu.level AS CHAR) COLLATE utf8mb4_unicode_ci
      SET hd.pro1_unit = pu.unit_name
    `);

    await queryRunner.query(`
      UPDATE hotdeal_entity hd
      LEFT JOIN product_unit pu ON hd.pro_code2 COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND hd.pro2_unit COLLATE utf8mb4_unicode_ci = CAST(pu.level AS CHAR) COLLATE utf8mb4_unicode_ci
      SET hd.pro2_unit = pu.unit_name
    `);

    // กู้คืน promotion_reward unit
    await queryRunner.query(`
      UPDATE promotion_reward pr
      LEFT JOIN product_unit pu ON pr.product_gcode COLLATE utf8mb4_unicode_ci = pu.pro_code COLLATE utf8mb4_unicode_ci
        AND pr.unit COLLATE utf8mb4_unicode_ci = CAST(pu.level AS CHAR) COLLATE utf8mb4_unicode_ci
      SET pr.unit = pu.unit_name
    `);

    // ลบ product_unit table
    await queryRunner.query(
      `ALTER TABLE \`product_unit\` DROP FOREIGN KEY \`FK_86e4bbe0fb61335628ca7601fde\``,
    );

    await queryRunner.query(`DROP TABLE \`product_unit\``);

    // ลบ spc_unit_enum และเหลือแค่ spc_unit
    await queryRunner.query(
      `ALTER TABLE \`shopping_cart\` DROP COLUMN \`spc_unit_enum\``,
    );
  }
}
