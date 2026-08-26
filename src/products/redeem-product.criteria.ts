import { FindOptionsWhere, MoreThan, Raw } from 'typeorm';
import { ProductEntity } from './products.entity';

// นิยามสินค้าแลกแต้มรวมไว้ที่เดียว (ECWC-448)
// สินค้าแลกแต้ม = (pro_free = 1 OR pro_supplier = '00') AND pro_point > 0
// และมีทั้ง stock จริง/จำนวนที่เปิดให้ลูกค้าเห็น
export const REDEEM_PRODUCT_SUPPLIER = '00';

type RedeemQueryBuilder = {
  andWhere: (sql: string, params?: Record<string, unknown>) => unknown;
};

// ใช้กับ QueryBuilder — เรียกได้แม้ยังไม่มี .where() มาก่อน
export function applyRedeemProductFilter(
  qb: RedeemQueryBuilder,
  alias: string,
): void {
  qb.andWhere(
    `(${alias}.pro_free = :redeemFree OR ${alias}.pro_supplier = :redeemSupplier)`,
    { redeemFree: true, redeemSupplier: REDEEM_PRODUCT_SUPPLIER },
  );
  qb.andWhere(`${alias}.pro_point > :redeemPoint`, { redeemPoint: 0 });
  qb.andWhere(`${alias}.pro_stock > :redeemStock`, { redeemStock: 0 });
  qb.andWhere(
    `(${alias}.pro_redeem_display_quantity IS NULL OR ${alias}.pro_redeem_display_quantity > :redeemDisplayQuantity)`,
    { redeemDisplayQuantity: 0 },
  );
}

// ใช้กับ repo.find() — array = OR ใน TypeORM จึงต้อง spread extra ลงทั้งสอง branch
export function buildRedeemProductWhere(
  extra: FindOptionsWhere<ProductEntity> = {},
): FindOptionsWhere<ProductEntity>[] {
  const base: FindOptionsWhere<ProductEntity> = {
    pro_point: MoreThan(0),
    pro_stock: MoreThan(0),
    pro_redeem_display_quantity: Raw(
      (alias) => `(${alias} IS NULL OR ${alias} > 0)`,
    ),
    ...extra,
  };
  return [
    { ...base, pro_free: true },
    { ...base, pro_supplier: REDEEM_PRODUCT_SUPPLIER },
  ];
}

// ใช้กับหน้าแอดมิน — คืนสินค้าในกลุ่มแลกแต้มทั้งหมด ไม่กรองแต้ม/สต็อก
export function buildRedeemCandidateWhere(
  extra: FindOptionsWhere<ProductEntity> = {},
): FindOptionsWhere<ProductEntity>[] {
  return [
    { ...extra, pro_free: true },
    { ...extra, pro_supplier: REDEEM_PRODUCT_SUPPLIER },
  ];
}

// สินค้าอยู่ในกลุ่มแลกแต้มไหม (ไม่สนใจแต้ม/สต็อก)
export function isRedeemProductType(
  product?: Pick<ProductEntity, 'pro_free' | 'pro_supplier'> | null,
): boolean {
  if (!product) return false;
  return (
    product.pro_free === true ||
    product.pro_supplier === REDEEM_PRODUCT_SUPPLIER
  );
}

export function getRedeemDisplayQuantity(
  product?: Pick<
    ProductEntity,
    'pro_stock' | 'pro_redeem_display_quantity'
  > | null,
): number {
  const stock = Math.max(0, Number(product?.pro_stock ?? 0));
  const configured = product?.pro_redeem_display_quantity;
  if (configured === null || configured === undefined) return stock;
  return Math.min(stock, Math.max(0, Number(configured)));
}

export function sortRedeemProductsByRank<
  T extends Pick<ProductEntity, 'pro_redeem_rank'>,
>(products: T[]): T[] {
  return products
    .map((product, originalIndex) => ({ product, originalIndex }))
    .sort((left, right) => {
      const leftRank = left.product.pro_redeem_rank;
      const rightRank = right.product.pro_redeem_rank;
      if (leftRank !== null && rightRank !== null) return leftRank - rightRank;
      if (leftRank !== null) return -1;
      if (rightRank !== null) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ product }) => product);
}

// สินค้าโชว์ในหน้าแลกแต้มลูกค้าไหม — ใช้ทำ flag สถานะให้แอดมิน
export function isRedeemProductVisible(
  product?: Pick<
    ProductEntity,
    | 'pro_free'
    | 'pro_supplier'
    | 'pro_point'
    | 'pro_stock'
    | 'pro_redeem_display_quantity'
  > | null,
): boolean {
  if (!isRedeemProductType(product)) return false;
  return (
    Number(product?.pro_point ?? 0) > 0 && getRedeemDisplayQuantity(product) > 0
  );
}

// ใช้ตอน submit order — ต้องมีแต้ม, stock และจำนวนที่เปิดให้ลูกค้าเห็น
export function canRedeemProduct(
  product?: Pick<
    ProductEntity,
    | 'pro_free'
    | 'pro_supplier'
    | 'pro_point'
    | 'pro_stock'
    | 'pro_redeem_display_quantity'
  > | null,
): boolean {
  if (!isRedeemProductType(product)) return false;
  return (
    Number(product?.pro_point ?? 0) > 0 && getRedeemDisplayQuantity(product) > 0
  );
}
