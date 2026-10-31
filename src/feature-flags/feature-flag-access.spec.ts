import { canManageFeatureFlags } from './feature-flag-access';

describe('canManageFeatureFlags (ECWC-749)', () => {
  it.each([
    ['Admin', { role: 'Admin' }, true],
    [
      'menu grant feature-flag',
      { role: 'Sales', admin_features: ['feature-flag'] },
      true,
    ],
    ['shop token (no role)', { mem_code: 'S1' }, false],
    ['User role', { role: 'User', permission: false }, false],
    [
      'Sales with back-office permission only',
      { role: 'Sales', permission: true },
      false,
    ],
    [
      'other menu grants only',
      { role: 'Sales', admin_features: ['hotdeal', 'preorder'] },
      false,
    ],
    ['admin_features not an array', { admin_features: 'feature-flag' }, false],
    [
      'Admin but limited-scope token',
      { role: 'Admin', scope: 'review' },
      false,
    ],
    ['no user', undefined, false],
  ])('%s → %s', (_label, user, expected) => {
    expect(canManageFeatureFlags(user as never)).toBe(expected);
  });
});
