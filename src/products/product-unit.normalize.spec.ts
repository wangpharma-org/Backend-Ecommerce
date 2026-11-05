import {
  buildUnitRows,
  normalizeUnitName,
  parseUnitRatio,
} from './product-unit.normalize';

describe('product-unit.normalize (ECWC-743)', () => {
  it('normalizeUnitName trims and maps empty values to ""', () => {
    expect(normalizeUnitName(' ชิ้น ')).toBe('ชิ้น');
    expect(normalizeUnitName('   ')).toBe('');
    expect(normalizeUnitName(null)).toBe('');
    expect(normalizeUnitName(undefined)).toBe('');
  });

  it.each([
    [12, 12],
    ['12', 12],
    [1, 1],
    [0, null],
    [-3, null],
    [2.5, null],
    ['12a', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('parseUnitRatio(%p) → %p', (input, expected) => {
    expect(parseUnitRatio(input as never)).toBe(expected);
  });

  it('skips levels without a name and defaults ratio to 1', () => {
    const { rows, warnings } = buildUnitRows([
      { level: 1, unit_name: ' ชิ้น ', ratio: undefined },
      { level: 2, unit_name: '  ', ratio: 12 },
      { level: 3, unit_name: 'ลัง', ratio: '144' },
    ]);
    expect(rows).toEqual([
      { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      { level: 3, unit_name: 'ลัง', ratio: 144 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('warns on an invalid ratio and on a name longer than the column', () => {
    const { rows, warnings } = buildUnitRows([
      { level: 1, unit_name: 'ชิ้น', ratio: 0 },
      { level: 2, unit_name: 'ก'.repeat(31), ratio: 10 },
    ]);
    expect(rows[0]).toEqual({ level: 1, unit_name: 'ชิ้น', ratio: 1 });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('level 1');
    expect(warnings[1]).toContain('31');
  });
});
