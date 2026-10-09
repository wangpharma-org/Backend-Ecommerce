import { BadRequestException } from '@nestjs/common';
import { parseCreditorCodes } from './creditor-codes.util';

describe('parseCreditorCodes', () => {
  it('accepts a single code, an array, or a JSON string', () => {
    expect(parseCreditorCodes('CRD001')).toEqual(['CRD001']);
    expect(parseCreditorCodes(['CRD001', 'CRD002'])).toEqual([
      'CRD001',
      'CRD002',
    ]);
    expect(parseCreditorCodes('["CRD001","CRD002"]')).toEqual([
      'CRD001',
      'CRD002',
    ]);
  });

  it('trims, drops blanks and duplicates, keeps order', () => {
    expect(parseCreditorCodes([' CRD002 ', '', 'CRD001', 'CRD002'])).toEqual([
      'CRD002',
      'CRD001',
    ]);
  });

  it('returns [] for empty input (Wang Day)', () => {
    expect(parseCreditorCodes(undefined)).toEqual([]);
    expect(parseCreditorCodes('')).toEqual([]);
    expect(parseCreditorCodes('[]')).toEqual([]);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseCreditorCodes('["CRD001"')).toThrow(BadRequestException);
  });
});
