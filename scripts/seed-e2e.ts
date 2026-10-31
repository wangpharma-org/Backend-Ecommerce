/**
 * Seed ข้อมูลขั้นต่ำที่ Playwright E2E suite ของ Ecommerce-Frontend ต้องใช้
 * (tests/e2e/utils/auth.ts, tests/e2e/happy-hour-manage.spec.ts) — รันเฉพาะตอนเตรียม
 * environment สำหรับ CI/E2E เท่านั้น ไม่ใช่ seed สำหรับ production
 *
 * idempotent: รันซ้ำได้ ถ้ามีข้อมูลอยู่แล้วจะ skip ไม่ทับของเดิม
 */
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/users/users.entity';
import { ProductEntity } from '../src/products/products.entity';
import { Modalmain } from '../src/modalmain/modalmain.entity';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// สร้าง DataSource ของตัวเองแยกจาก src/data-source.ts (อันนั้น synchronize: false เสมอ
// เพราะใช้ร่วมกับ migration CLI) — seed script นี้ตั้ง synchronize: true เพื่อสร้าง schema
// เองตรงนี้เลย ไม่ต้องพึ่ง timing ว่า backend process (อีก connection แยกกัน) sync ไปก่อนหรือยัง
const SeedDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  synchronize: true,
});

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

async function seedAdminUser(dataSource: DataSource) {
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

async function seedProducts(dataSource: DataSource) {
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

// ModalContentService.saveModalContent() ทำแค่ repository.update({id}, ...) ไม่เคย insert
// แถวใหม่เลย ถ้า table modalmain ว่างเปล่า (database สดใหม่) save จะ no-op เงียบๆตลอดไป
// (ไม่มี error แต่ก็ไม่เคยมีแถวให้ GET เจอ) ต้อง seed แถวเริ่มต้นไว้ก่อนให้ update มี row ให้แก้จริง
async function seedModalContent(dataSource: DataSource) {
  const modalRepo = dataSource.getRepository(Modalmain);
  const existing = await modalRepo.find();
  if (existing.length > 0) {
    console.log('seed-e2e: modalmain มีข้อมูลอยู่แล้ว — skip');
    return;
  }

  await modalRepo.save(
    modalRepo.create({
      title: 'Happy Hour',
      content: 'ทดสอบ',
      show: false,
    }),
  );
  console.log('seed-e2e: สร้าง modalmain แถวเริ่มต้นแล้ว');
}

async function main() {
  await SeedDataSource.initialize();
  try {
    await seedAdminUser(SeedDataSource);
    await seedProducts(SeedDataSource);
    await seedModalContent(SeedDataSource);
    console.log('seed-e2e: เสร็จสิ้น');
  } finally {
    await SeedDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('seed-e2e: ล้มเหลว', error);
  process.exit(1);
});
