#!/usr/bin/env node
/**
 * ตรวจจุดเชื่อม e-commerce → akitokung ก่อน/หลัง deploy กระเช้า (ECWC-496)
 *
 * ตรวจ 3 เรื่องที่อ่านโค้ดแล้วเห็นว่าเสี่ยง แต่พิสูจน์ด้วยตาไม่ได้:
 *
 *   1. ชื่อหน่วยไม่ตรงกันสองฝั่ง
 *      e-commerce ส่ง spo_unit เป็น "ชื่อหน่วย" จากตาราง product_unit ของตัวเอง
 *      akitokung (api/order/receive_order_cart.php:56-58) เอาไปเทียบกับ
 *      product.pro_unit1/2/3 ในฐานตัวเอง ถ้าไม่ตรงสักอัน spo_unit จะเป็นค่าว่าง
 *      เงียบๆ ไม่มี error — ฝ่ายจัดของจะได้บรรทัดที่ไม่รู้หน่วย
 *
 *   2. สินค้าที่ product_unit ไม่มี level นั้น
 *      convertEnumToUnitName คืนค่าเป็นตัวเลข "1"/"2"/"3" แทนชื่อหน่วย
 *      ส่งไปแล้วไม่มีทางตรงกับ pro_unit ใดๆ เลย
 *
 *   3. กระเช้าสำเร็จรูปที่ราคาต่อหน่วยห่างจาก price list มาก
 *      ราคาชุดถูกเฉลี่ยลงบรรทัด (spc_fixed_total) แล้วกลายเป็น spo_ppu ใน ERP
 *      ชุด ฿500 ที่ประกอบจากของ ฿15.90 จะได้ ppu 250 ต่อหน่วย
 *
 * ใช้:
 *   node scripts/check-order-handoff.js                 # ตรวจเท่าที่ฐาน e-commerce ตอบได้
 *   AKITOKUNG_DB_HOST=... AKITOKUNG_DB_USER=... AKITOKUNG_DB_PASSWORD=... \
 *   AKITOKUNG_DB_NAME=... node scripts/check-order-handoff.js   # ตรวจครบรวมข้อ 1
 *
 * ฐาน e-commerce อ่านจาก .env เดิม (DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME)
 * ห้ามใส่รหัสผ่านในคำสั่งที่ commit — ส่งผ่าน env เท่านั้น
 *
 * exit 0 = ไม่พบอะไร · exit 1 = พบจุดที่ต้องดู · exit 2 = ต่อฐานไม่ได้
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const LIMIT = Number(process.env.SAMPLE_LIMIT || 15);

const ecomConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommerce_db',
};

const akitokungConfig = process.env.AKITOKUNG_DB_HOST
  ? {
      host: process.env.AKITOKUNG_DB_HOST,
      port: Number(process.env.AKITOKUNG_DB_PORT || 3306),
      user: process.env.AKITOKUNG_DB_USER,
      password: process.env.AKITOKUNG_DB_PASSWORD,
      database: process.env.AKITOKUNG_DB_NAME,
    }
  : null;

const head = (title) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
const table = (rows) => (rows.length ? console.table(rows) : console.log('   ไม่พบ'));

async function main() {
  let ecom;
  try {
    ecom = await mysql.createConnection(ecomConfig);
  } catch (err) {
    console.error(`ต่อฐาน e-commerce ไม่ได้ (${ecomConfig.host}:${ecomConfig.port}/${ecomConfig.database}): ${err.message}`);
    process.exit(2);
  }

  let findings = 0;

  // ── 2. level ที่หายไปใน product_unit ────────────────────────────────────
  head('สินค้าที่ product_unit ไม่ครบ level (จะส่งหน่วยเป็นตัวเลขไป ERP)');
  const [gaps] = await ecom.query(`
    SELECT u.pro_code,
           GROUP_CONCAT(u.level ORDER BY u.level) AS levels_ที่มี,
           MAX(u.level) AS level_สูงสุด
    FROM product_unit u
    GROUP BY u.pro_code
    HAVING COUNT(*) <> MAX(u.level)
    LIMIT ?`, [LIMIT]);
  const [[gapCount]] = await ecom.query(`
    SELECT COUNT(*) AS n FROM (
      SELECT pro_code FROM product_unit GROUP BY pro_code HAVING COUNT(*) <> MAX(level)
    ) t`);
  console.log(`   รวม ${gapCount.n} สินค้า`);
  if (gapCount.n > 0) { findings++; table(gaps); }

  // ── 3. กระเช้าสำเร็จรูปที่ราคาต่อหน่วยห่างจาก price list ─────────────────
  head('กระเช้าสำเร็จรูป: ราคาต่อหน่วยที่จะส่งเข้า ERP เทียบ price list');
  const [sets] = await ecom.query(`
    SELECT s.set_code, s.set_name, s.price AS ราคาชุด,
           i.pro_code, i.qty,
           ROUND(p.pro_priceC, 2) AS price_list_C,
           ROUND(s.price / NULLIF(SUM(i.qty) OVER (PARTITION BY s.set_code), 0), 2) AS ppu_โดยประมาณ
    FROM bundle_set s
    JOIN bundle_set_item i ON i.set_code = s.set_code AND i.is_gift = 0
    JOIN product p ON p.pro_code = i.pro_code
    WHERE s.status = 1 AND s.deleted_at IS NULL
    LIMIT ?`, [LIMIT]);
  if (sets.length) {
    const risky = sets.filter((r) => {
      const list = Number(r.price_list_C) || 0;
      const ppu = Number(r.ppu_โดยประมาณ) || 0;
      return list > 0 && (ppu / list > 2 || ppu / list < 0.5);
    });
    table(sets);
    if (risky.length) {
      findings++;
      console.log(`   ⚠ ${risky.length} บรรทัดที่ราคาต่อหน่วยห่างจาก price list เกิน 2 เท่า — ERP จะเห็นเลขนี้`);
    }
  } else {
    console.log('   ไม่มีกระเช้าสำเร็จรูปที่เปิดใช้งาน');
  }

  // ── 1. ชื่อหน่วยสองฝั่ง (ต้องมีฐาน akitokung) ───────────────────────────
  head('ชื่อหน่วย: e-commerce ส่งไป vs akitokung รู้จัก');
  if (!akitokungConfig) {
    console.log('   ข้าม — ไม่ได้ตั้ง AKITOKUNG_DB_HOST');
    console.log('   ข้อนี้คือข้อที่สำคัญที่สุด ตั้ง env แล้วรันใหม่เพื่อตรวจให้ครบ');
  } else {
    let aki;
    try {
      aki = await mysql.createConnection(akitokungConfig);
    } catch (err) {
      console.error(`   ต่อฐาน akitokung ไม่ได้: ${err.message}`);
      await ecom.end();
      process.exit(2);
    }

    const [ecomUnits] = await ecom.query(
      'SELECT pro_code, level, unit_name FROM product_unit',
    );
    const [akiUnits] = await aki.query(
      'SELECT pro_code, pro_unit1, pro_unit2, pro_unit3 FROM product',
    );
    const akiMap = new Map(
      akiUnits.map((r) => [
        r.pro_code,
        [r.pro_unit1, r.pro_unit2, r.pro_unit3].filter(Boolean),
      ]),
    );

    const mismatched = [];
    let unknownProduct = 0;
    for (const u of ecomUnits) {
      const known = akiMap.get(u.pro_code);
      if (!known) { unknownProduct++; continue; }
      if (!known.includes(u.unit_name)) {
        mismatched.push({
          pro_code: u.pro_code,
          level: u.level,
          'ecom ส่งไป': u.unit_name,
          'akitokung รู้จัก': known.join(' / ') || '(ว่าง)',
        });
      }
    }

    console.log(`   หน่วยทั้งหมดฝั่ง e-commerce: ${ecomUnits.length}`);
    console.log(`   ไม่ตรงกับ pro_unit1/2/3: ${mismatched.length}  ← spo_unit จะเป็นค่าว่างที่ ERP`);
    console.log(`   ไม่พบสินค้าในฐาน akitokung: ${unknownProduct}`);
    if (mismatched.length) { findings++; table(mismatched.slice(0, LIMIT)); }
    await aki.end();
  }

  await ecom.end();

  head('สรุป');
  if (findings === 0) {
    console.log('   ไม่พบจุดที่ต้องดู');
  } else {
    console.log(`   พบ ${findings} หัวข้อที่ต้องดู — รายละเอียดด้านบน`);
  }
  process.exit(findings === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
