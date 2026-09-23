import { ProductLabelMatchType } from './product-label-match-type';

export const matchesProductLabelRule = (
  productName: string,
  keyword: string,
  matchType: ProductLabelMatchType,
) => {
  const normalizedProductName = productName.toLocaleLowerCase();
  const normalizedKeyword = keyword.toLocaleLowerCase();

  switch (matchType) {
    case ProductLabelMatchType.STARTS_WITH:
      return normalizedProductName.startsWith(normalizedKeyword);
    case ProductLabelMatchType.ENDS_WITH:
      return normalizedProductName.endsWith(normalizedKeyword);
    case ProductLabelMatchType.CONTAINS:
      return normalizedProductName.includes(normalizedKeyword);
  }
};
