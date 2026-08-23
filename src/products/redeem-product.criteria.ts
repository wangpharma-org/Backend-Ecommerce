import { Brackets, SelectQueryBuilder } from 'typeorm';
import { ProductEntity } from './products.entity';

/**
 * รหัส supplier ของสินค้าแลกแต้ม (ECWC-444)
 * NOTE: ticket ระบุ `pro_supplier = '00'` แต่คอลัมน์ `pro_supplier` เก็บ "ชื่อ" supplier
 * รหัสจริงอยู่ที่ `creditor_code` (FK -> CreditorEntity) จึงเช็คทั้งสองคอลัมน์ไว้ก่อน
 * เมื่อทีมเคาะแล้วให้แก้ที่ไฟล์นี้ที่เดียว
 */
export const REDEEM_SUPPLIER_CODE = '00';

export interface RedeemProductLike {
  pro_free?: boolean | number | null;
  pro_supplier?: string | null;
  creditor_code?: string | null;
  creditor?: { creditor_code?: string | null } | null;
}

/** เช็คสินค้าแลกแต้มจาก entity ที่โหลดมาแล้ว */
export function isRedeemProduct(product: RedeemProductLike): boolean {
  if (Number(product.pro_free ?? 0) === 1) return true;
  const supplierCode =
    product.creditor_code ?? product.creditor?.creditor_code ?? null;
  if (supplierCode === REDEEM_SUPPLIER_CODE) return true;
  return product.pro_supplier === REDEEM_SUPPLIER_CODE;
}

/** filter สินค้าแลกแต้มสำหรับ QueryBuilder (alias ต้อง select creditor_code มาด้วย) */
export function applyRedeemProductFilter(
  qb: SelectQueryBuilder<ProductEntity>,
  alias: string,
): SelectQueryBuilder<ProductEntity> {
  return qb.andWhere(
    new Brackets((qbInner) => {
      qbInner
        .where(`${alias}.pro_free = :redeemFree`, { redeemFree: true })
        .orWhere(`${alias}.creditor_code = :redeemSupplier`, {
          redeemSupplier: REDEEM_SUPPLIER_CODE,
        })
        .orWhere(`${alias}.pro_supplier = :redeemSupplier`, {
          redeemSupplier: REDEEM_SUPPLIER_CODE,
        });
    }),
  );
}
