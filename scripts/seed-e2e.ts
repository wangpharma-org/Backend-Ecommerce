/**
 * Seed ข้อมูลขั้นต่ำที่ Playwright E2E suite ของ Ecommerce-Frontend ต้องใช้
 * (tests/e2e/utils/auth.ts, tests/e2e/happy-hour-manage.spec.ts) — รันเฉพาะตอนเตรียม
 * environment สำหรับ CI/E2E เท่านั้น ไม่ใช่ seed สำหรับ production
 *
 * idempotent: รันซ้ำได้ ถ้ามีข้อมูลอยู่แล้วจะ skip ไม่ทับของเดิม
 */
import { AppDataSource } from '../src/data-source';
import { UserEntity } from '../src/users/users.entity';
import { ProductEntity } from '../src/products/products.entity';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// ตรงกับ E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD ที่ Ecommerce-Frontend ใช้ login ผ่าน loginAsAdmin()
const ADMIN_CODE = process.env.E2E_SEED_ADMIN_CODE ?? '0539';
const ADMIN_PASSWORD = process.env.E2E_SEED_ADMIN_PASSWORD ?? '0539';

// pro_code 92020405 ตรงกับที่ tests/e2e/happy-hour-manage.spec.ts เลือกเป็นของแถมโดยตรง
// ส่วนตัวอื่นมีคำว่า "โลตัส" ให้ debounce search ของ Lotus Card picker เจอผลลัพธ์
const SEED_PRODUCTS: Partial<ProductEntity>[] = [
  { pro_code: '92020405', pro_name: 'บัตรโลตัส100บ/ใบ' },
  { pro_code: 'E2E-LOTUS-050', pro_name: 'บัตรโลตัส50บ/ใบ' },
  { pro_code: 'E2E-LOTUS-200', pro_name: 'บัตรโลตัส200บ/ใบ' },
];

async function seedAdminUser(dataSource: typeof AppDataSource) {
  const userRepo = dataSource.getRepository(UserEntity);
  const existing = await userRepo.findOne({
    where: { mem_username: ADMIN_CODE },
  });
  if (existing) {
    console.log(`seed-e2e: admin user "${ADMIN_CODE}" มีอยู่แล้ว — skip`);
    return;
  }

  await userRepo.save(
    userRepo.create({
      mem_code: ADMIN_CODE,
      mem_username: ADMIN_CODE,
      mem_password: await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS),
      mem_nameSite: 'E2E Test Admin',
      permision_admin: true,
      role: 'Admin',
    }),
  );
  console.log(`seed-e2e: สร้าง admin user "${ADMIN_CODE}" แล้ว`);
}

async function seedProducts(dataSource: typeof AppDataSource) {
  const productRepo = dataSource.getRepository(ProductEntity);

  for (const product of SEED_PRODUCTS) {
    const existing = await productRepo.findOne({
      where: { pro_code: product.pro_code },
    });
    if (existing) {
      console.log(`seed-e2e: product "${product.pro_code}" มีอยู่แล้ว — skip`);
      continue;
    }
    await productRepo.save(productRepo.create(product));
    console.log(`seed-e2e: สร้าง product "${product.pro_code}" แล้ว`);
  }
}

async function main() {
  await AppDataSource.initialize();
  try {
    await seedAdminUser(AppDataSource);
    await seedProducts(AppDataSource);
    console.log('seed-e2e: เสร็จสิ้น');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('seed-e2e: ล้มเหลว', error);
  process.exit(1);
});
