// WGDD-428: งดแสดงสินค้าบนหน้าร้าน — product.pro_hidden = 1 ต้องไม่ถูกส่งให้ลูกค้าเห็น/สั่งซื้อ
// ใช้ร่วมทุก service ที่ query สินค้าฝั่งลูกค้า (C-002: อย่าก๊อป logic ไปหลายที่)

export const HIDDEN_PRODUCT_MESSAGE = 'สินค้านี้งดจำหน่ายชั่วคราว';

/** SQL condition: สินค้าที่แสดงบนหน้าร้านได้ (alias = alias ของ product ใน query builder) */
export const visibleProductSql = (alias: string): string =>
  `(${alias}.pro_hidden = 0 OR ${alias}.pro_hidden IS NULL)`;

export function applyVisibleProductFilter(
  qb: { andWhere: (sql: string, params?: Record<string, unknown>) => unknown },
  alias: string,
): void {
  qb.andWhere(visibleProductSql(alias));
}

export const isHiddenProduct = (
  product?: { pro_hidden?: boolean | number | null } | null,
): boolean => Boolean(product?.pro_hidden);
