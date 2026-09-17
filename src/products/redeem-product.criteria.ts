import { FindOptionsWhere, MoreThan } from 'typeorm';
import { ProductEntity } from './products.entity';

// นิยามสินค้าแลกแต้มรวมไว้ที่เดียว (ECWC-444)
// สินค้าแลกแต้ม = (pro_free = 1 OR product_type = '00') AND pro_point > 0 AND pro_stock > 0
export const REDEEM_PRODUCT_TYPE = '00';
export const DEFAULT_PRODUCT_TYPE = '01';

type RedeemQueryBuilder = {
  andWhere: (sql: string, params?: Record<string, unknown>) => unknown;
};

// ใช้กับ QueryBuilder — เรียกได้แม้ยังไม่มี .where() มาก่อน
export function applyRedeemProductFilter(
  qb: RedeemQueryBuilder,
  alias: string,
): void {
  qb.andWhere(
    `(${alias}.pro_free = :redeemFree OR ${alias}.product_type = :redeemType)`,
    { redeemFree: true, redeemType: REDEEM_PRODUCT_TYPE },
  );
  qb.andWhere(`${alias}.pro_point > :redeemPoint`, { redeemPoint: 0 });
  qb.andWhere(`${alias}.pro_stock > :redeemStock`, { redeemStock: 0 });
}

// ใช้กับ repo.find() — array = OR ใน TypeORM จึงต้อง spread extra ลงทั้งสอง branch
export function buildRedeemProductWhere(
  extra: FindOptionsWhere<ProductEntity> = {},
): FindOptionsWhere<ProductEntity>[] {
  const base: FindOptionsWhere<ProductEntity> = {
    pro_point: MoreThan(0),
    pro_stock: MoreThan(0),
    ...extra,
  };
  return [
    { ...base, pro_free: true },
    { ...base, product_type: REDEEM_PRODUCT_TYPE },
  ];
}

// ใช้กับหน้าแอดมิน — คืนสินค้าในกลุ่มแลกแต้มทั้งหมด ไม่กรองแต้ม/สต็อก
export function buildRedeemCandidateWhere(
  extra: FindOptionsWhere<ProductEntity> = {},
): FindOptionsWhere<ProductEntity>[] {
  return [
    { ...extra, pro_free: true },
    { ...extra, product_type: REDEEM_PRODUCT_TYPE },
  ];
}

// สินค้าอยู่ในกลุ่มแลกแต้มไหม (ไม่สนใจแต้ม/สต็อก)
export function isRedeemProductType(
  product?: Pick<ProductEntity, 'pro_free' | 'product_type'> | null,
): boolean {
  if (!product) return false;
  return (
    product.pro_free === true || product.product_type === REDEEM_PRODUCT_TYPE
  );
}

// สินค้าโชว์ในหน้าแลกแต้มลูกค้าไหม — ใช้ทำ flag สถานะให้แอดมิน
export function isRedeemProductVisible(
  product?: Pick<
    ProductEntity,
    'pro_free' | 'product_type' | 'pro_point' | 'pro_stock'
  > | null,
): boolean {
  if (!isRedeemProductType(product)) return false;
  return (
    Number(product?.pro_point ?? 0) > 0 && Number(product?.pro_stock ?? 0) > 0
  );
}

// ใช้ตอน submit order — ไม่เช็ค stock เพื่อคงพฤติกรรมเดิมของ pro_free
// แต่ต้องมีแต้ม ไม่งั้นแลกได้ฟรีโดยไม่เสียแต้ม
export function canRedeemProduct(
  product?: Pick<
    ProductEntity,
    'pro_free' | 'product_type' | 'pro_point'
  > | null,
): boolean {
  if (!isRedeemProductType(product)) return false;
  return Number(product?.pro_point ?? 0) > 0;
}
