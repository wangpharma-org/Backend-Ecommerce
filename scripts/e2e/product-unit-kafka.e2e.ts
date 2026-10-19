/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * E2E: เพิ่มหน่วยสินค้าผ่าน Kafka listener (ECWC-743)
 * เรียก ProductListner.addProduct / updateProduct ตัวจริง → ProductsService ตัวจริง → MySQL จริงจาก .env
 * ไม่ผ่าน broker: ถ้ามี backend อื่นฟัง group เดียวกัน ข้อความจะถูกแย่งไปประมวลผลด้วยโค้ดเก่า
 * Elasticsearch ถูก stub (ไม่ได้ทดสอบการ index)
 *
 * ใช้:
 *   E2E_ENV=local npx ts-node -r tsconfig-paths/register scripts/e2e/product-unit-kafka.e2e.ts
 *
 * เขียน DB: สร้างสินค้า E2E-UNIT-01..05 (ชื่อ "E2E <env> …") แล้วลบทิ้งตอนจบ (และตอนเริ่ม ถ้าค้างจากรอบก่อน)
 * ห้ามรันกับ prod — สคริปต์ปฏิเสธ E2E_ENV=prod
 * ผลเขียนลง docs/e2e/product-unit-kafka-<env>-<timestamp>.md
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../../src/data-source';
import { ProductsService } from '../../src/products/products.service';
import { ProductListner } from '../../src/products/product.listener';
import { ProductEntity } from '../../src/products/products.entity';
import { ProductUnitEntity } from '../../src/products/product-unit.entity';

const E2E_ENV = process.env.E2E_ENV ?? '';
if (!E2E_ENV || E2E_ENV === 'prod') {
  console.error(
    'ต้องตั้ง E2E_ENV (local/dev) — สคริปต์นี้เขียน DB จึงไม่รันกับ prod',
  );
  process.exit(2);
}

const PREFIX = 'E2E-UNIT-';
const NAME = `E2E ${E2E_ENV} ECWC-743`;

type Step = { name: string; result: 'ผ่าน' | 'ไม่ผ่าน'; observed: string };
const steps: Step[] = [];
const check = (name: string, pass: boolean, observed: string) => {
  steps.push({ name, result: pass ? 'ผ่าน' : 'ไม่ผ่าน', observed });
  console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`);
};

const warnings: string[] = [];
const errors: string[] = [];

async function main() {
  await AppDataSource.initialize();
  const productRepo = AppDataSource.getRepository(ProductEntity);
  const unitRepo = AppDataSource.getRepository(ProductUnitEntity);

  const service = Object.create(ProductsService.prototype) as ProductsService;
  Object.assign(service, {
    productRepo,
    productUnitRepo: unitRepo,
    logger: {
      log: () => undefined,
      warn: (m: string) => warnings.push(m),
      error: (m: string, e: unknown) => errors.push(`${m} ${String(e)}`),
    },
    elasticsearchService: {
      indexProduct: () => Promise.resolve(),
      updateProductDoc: () => Promise.resolve(),
    },
  });
  const listener = new ProductListner(service, {} as never);
  Object.assign(listener, {
    logger: { log: () => undefined, error: () => undefined },
  });

  const cleanup = async () => {
    await AppDataSource.query(
      'DELETE FROM product_unit WHERE pro_code LIKE ?',
      [`${PREFIX}%`],
    );
    await AppDataSource.query('DELETE FROM product WHERE pro_code LIKE ?', [
      `${PREFIX}%`,
    ]);
  };
  const unitsOf = async (code: string) =>
    (
      await unitRepo.find({
        where: { pro_code: code },
        order: { level: 'ASC' },
      })
    )
      .map((u) => `${u.level}:${u.unit_name}:${u.ratio}`)
      .join(', ');
  const productExists = async (code: string) =>
    (await productRepo.count({ where: { pro_code: code } })) > 0;
  const kafkaCreate = (code: string, extra: Record<string, unknown>) =>
    listener.addProduct({
      pro_code: code,
      pro_name: `${NAME} ${code}`,
      pro_priceA: 10,
      pro_priceB: 10,
      pro_priceC: 10,
      ...extra,
    } as never);
  const kafkaUpdate = (code: string, extra: Record<string, unknown>) =>
    listener.updateProduct({ pro_code: code, ...extra } as never);

  try {
    await cleanup();

    const idx: { Non_unique: number; Column_name: string }[] =
      await AppDataSource.query(
        "SHOW INDEX FROM product_unit WHERE Key_name = 'uk_product_unit'",
      );
    check(
      '0. DB มี unique index uk_product_unit (pro_code, level) ที่ upsert ต้องใช้',
      idx.length === 2 && idx.every((r) => Number(r.Non_unique) === 0),
      idx.length ? idx.map((r) => r.Column_name).join(',') : 'ไม่มี index',
    );

    // 1. สร้างสินค้า 3 หน่วย
    await kafkaCreate(`${PREFIX}01`, {
      pro_unit1: 'ชิ้น',
      pro_unit2: 'กล่อง',
      pro_unit3: 'ลัง',
      pro_ratio1: 1,
      pro_ratio2: 12,
      pro_ratio3: 144,
    });
    let u = await unitsOf(`${PREFIX}01`);
    check(
      '1. สร้างสินค้าใหม่ 3 หน่วย',
      u === '1:ชิ้น:1, 2:กล่อง:12, 3:ลัง:144',
      u,
    );

    // 2. ข้อความเดิมส่งซ้ำ + เปลี่ยน ratio หน่วย 2
    const errBefore = errors.length;
    await kafkaCreate(`${PREFIX}01`, {
      pro_unit1: 'ชิ้น',
      pro_unit2: 'กล่อง',
      pro_unit3: 'ลัง',
      pro_ratio1: 1,
      pro_ratio2: 10,
      pro_ratio3: 144,
    });
    u = await unitsOf(`${PREFIX}01`);
    check(
      '2. ข้อความ Kafka ส่งซ้ำ → upsert ไม่ซ้ำแถว ไม่ error',
      u === '1:ชิ้น:1, 2:กล่อง:10, 3:ลัง:144' && errors.length === errBefore,
      `${u} · error ใหม่ ${errors.length - errBefore}`,
    );

    // 3. ไม่มีหน่วย → มีสินค้า + warn
    await kafkaCreate(`${PREFIX}02`, {});
    u = await unitsOf(`${PREFIX}02`);
    const warned = warnings.some((w) =>
      w.includes(`${PREFIX}02 ไม่มีหน่วยสินค้า`),
    );
    check(
      '3. สินค้าไม่มีหน่วย → บันทึกสินค้า + logger.warn ระบุรหัส',
      (await productExists(`${PREFIX}02`)) && u === '' && warned,
      `หน่วย [${u}] · warn ${warned ? 'มี' : 'ไม่มี'}`,
    );

    // 4. ชื่อหน่วยยาวเกินคอลัมน์ → ต้องไม่เหลือสินค้าที่ไม่มีหน่วย
    await kafkaCreate(`${PREFIX}03`, { pro_unit1: 'ก'.repeat(31) });
    const exists3 = await productExists(`${PREFIX}03`);
    u = await unitsOf(`${PREFIX}03`);
    check(
      '4. ชื่อหน่วย 31 ตัว → rollback ไม่เหลือสินค้าค้างแบบไม่มีหน่วย',
      (!exists3 && u === '') || (exists3 && u !== ''),
      exists3
        ? `สินค้ามีอยู่ หน่วย [${u}] (MySQL ไม่ strict — ตัดชื่อให้เอง)`
        : `ไม่มีสินค้า · error log: ${errors.some((e) => e.includes(`${PREFIX}03`)) ? 'มี' : 'ไม่มี'}`,
    );

    // 5. trim / ข้ามค่าว่าง / ratio 0
    await kafkaCreate(`${PREFIX}04`, {
      pro_unit1: ' ชิ้น ',
      pro_ratio1: 0,
      pro_unit2: '   ',
      pro_ratio2: 12,
      pro_unit3: 'กล่อง',
      pro_ratio3: '12',
    });
    u = await unitsOf(`${PREFIX}04`);
    check(
      '5. trim ชื่อ, ข้ามหน่วยว่าง, ratio 0 → 1, ratio "12" → 12',
      u === '1:ชิ้น:1, 3:กล่อง:12',
      u,
    );

    // 6. product_update_ecom เติมหน่วยให้สินค้าที่ไม่มีหน่วย
    await kafkaUpdate(`${PREFIX}02`, { pro_unit1: 'ขวด', pro_ratio1: 1 });
    u = await unitsOf(`${PREFIX}02`);
    check('6. update เติมหน่วยให้สินค้าที่ไม่มีหน่วย', u === '1:ขวด:1', u);

    // 7. update ส่งชื่อหน่วยว่าง → ไม่ทับชื่อเดิม แต่ ratio ยังอัปเดต
    await kafkaUpdate(`${PREFIX}01`, { pro_unit2: '', pro_ratio2: 24 });
    u = await unitsOf(`${PREFIX}01`);
    check(
      '7. update ชื่อหน่วย "" → ไม่ทับชื่อเดิม, ratio อัปเดต',
      u === '1:ชิ้น:1, 2:กล่อง:24, 3:ลัง:144',
      u,
    );

    // 8. update เพิ่มหน่วย 2 ให้สินค้าที่มีหน่วย 1
    await kafkaUpdate(`${PREFIX}02`, { pro_unit2: 'แพ็ค', pro_ratio2: 6 });
    u = await unitsOf(`${PREFIX}02`);
    check('8. update เพิ่มหน่วยระดับ 2', u === '1:ขวด:1, 2:แพ็ค:6', u);
  } finally {
    await cleanup();
    const left: { n: string }[] = await AppDataSource.query(
      'SELECT COUNT(*) AS n FROM product WHERE pro_code LIKE ?',
      [`${PREFIX}%`],
    );
    check(
      '9. ล้างข้อมูลทดสอบ',
      Number(left[0].n) === 0,
      `สินค้าค้าง ${left[0].n}`,
    );
    await AppDataSource.destroy();
  }
}

function writeReport(failure?: string): boolean {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (
      execSync('git status --porcelain -- src', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim()
    ) {
      commit += ' + แก้ไขที่ยังไม่ commit';
    }
  } catch {
    /* รันนอก git ได้ */
  }
  const failed = steps.filter((s) => s.result === 'ไม่ผ่าน').length;
  const ok = !failure && failed === 0 && steps.length > 0;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '');
  const lines = [
    '# E2E — เพิ่มหน่วยสินค้าผ่าน Kafka listener (ECWC-743)',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **DB:** ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **ข้อมูลทดสอบ:** สินค้า \`${PREFIX}01..04\` สร้างแล้วลบทิ้งตอนจบ`,
    '- **ขอบเขต:** เรียก ProductListner → ProductsService → MySQL จริง · ไม่ผ่าน Kafka broker · Elasticsearch ถูก stub',
    `- **ผลรวม:** ${ok ? 'ผ่าน' : 'ไม่ผ่าน'} — ${steps.length - failed}/${steps.length} ขั้นผ่าน`,
    ...(E2E_ENV === 'local'
      ? [
          '- **หมายเหตุ:** ผล `local` นับแค่ "ผ่านก่อน merge" ต้องรันซ้ำกับ deployed code หลัง deploy',
        ]
      : []),
    '',
    '| ขั้น | ผล | สิ่งที่ได้ |',
    '|---|---|---|',
    ...steps.map(
      (s) =>
        `| ${s.name} | ${s.result} | ${s.observed.replace(/\|/g, '\\|')} |`,
    ),
    ...(failure ? ['', `สคริปต์หยุดกลางทาง: ${failure}`] : []),
    '',
  ];
  const dir = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const name = `product-unit-kafka-${E2E_ENV}-${stamp}.md`;
  writeFileSync(join(dir, name), lines.join('\n'));
  console.error(`รายงาน: docs/e2e/${name}`);
  return ok;
}

void main()
  .then(() => process.exit(writeReport() ? 0 : 1))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(writeReport(String(err)) ? 0 : 1);
  });
