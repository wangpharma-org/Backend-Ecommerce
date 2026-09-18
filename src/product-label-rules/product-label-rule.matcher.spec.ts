import { ProductLabelMatchType } from './product-label-match-type';
import { matchesProductLabelRule } from './product-label-rule.matcher';

describe('matchesProductLabelRule', () => {
  it('matches a keyword only at the start', () => {
    expect(
      matchesProductLabelRule('*ABC', '*', ProductLabelMatchType.STARTS_WITH),
    ).toBe(true);
    expect(
      matchesProductLabelRule('ABC*', '*', ProductLabelMatchType.STARTS_WITH),
    ).toBe(false);
  });

  it('matches a keyword anywhere by default mode', () => {
    expect(
      matchesProductLabelRule('*ABC', '*', ProductLabelMatchType.CONTAINS),
    ).toBe(true);
    expect(
      matchesProductLabelRule('A*BC', '*', ProductLabelMatchType.CONTAINS),
    ).toBe(true);
    expect(
      matchesProductLabelRule('ABC*', '*', ProductLabelMatchType.CONTAINS),
    ).toBe(true);
  });

  it('matches a keyword only at the end', () => {
    expect(
      matchesProductLabelRule('ABC*', '*', ProductLabelMatchType.ENDS_WITH),
    ).toBe(true);
    expect(
      matchesProductLabelRule('*ABC', '*', ProductLabelMatchType.ENDS_WITH),
    ).toBe(false);
  });

  it('matches without case sensitivity', () => {
    expect(
      matchesProductLabelRule(
        'Cold Chain Product',
        'cold chain',
        ProductLabelMatchType.STARTS_WITH,
      ),
    ).toBe(true);
  });
});
