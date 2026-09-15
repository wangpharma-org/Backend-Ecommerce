export const REDEEM_PRODUCT_SUPPLIER = '00';

type RedeemIdentityQueryBuilder = {
  andWhere: (sql: string, parameters?: Record<string, unknown>) => unknown;
};

/**
 * Identifies products that belong to the redeem catalogue.
 * Stock is intentionally excluded because it controls customer visibility,
 * not whether the product is a redeem product.
 */
export function applyRedeemProductIdentityFilter(
  queryBuilder: RedeemIdentityQueryBuilder,
  alias: string,
): void {
  queryBuilder.andWhere(
    `(${alias}.pro_free = :redeemFree OR ${alias}.pro_supplier = :redeemSupplier)`,
    {
      redeemFree: true,
      redeemSupplier: REDEEM_PRODUCT_SUPPLIER,
    },
  );
}
