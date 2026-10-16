import {
  checkNewPassword,
  describeDevice,
  generateRefCode,
  generateTempPassword,
  isChecklistComplete,
  isRefCode,
  isRejectReason,
  maskAccount,
  maskPhone,
  normalizeAccount,
  normalizePhone,
} from './password-reset.rules';

describe('password-reset rules', () => {
  it('ref code มีรูปแบบ PR-XXXXXXX และไม่มีตัวที่อ่านสับสน', () => {
    for (let i = 0; i < 200; i++) {
      const r = generateRefCode();
      expect(isRefCode(r)).toBe(true);
      expect(r.slice(3)).not.toMatch(/[01OIL]/);
    }
  });

  it('isRefCode ปฏิเสธค่าที่ไม่ใช่รูปแบบ', () => {
    expect(isRefCode('PR-7K2M9QA')).toBe(true);
    expect(isRefCode('pr-7k2m9qa')).toBe(false);
    expect(isRefCode('PR-7K2M9Q')).toBe(false);
    expect(isRefCode(123)).toBe(false);
    expect(isRefCode('toString')).toBe(false);
  });

  it('รหัสชั่วคราวผ่านเงื่อนไขรหัสผ่านใหม่เสมอ', () => {
    for (let i = 0; i < 500; i++) {
      const p = generateTempPassword();
      expect(p).toMatch(/^[A-Za-z0-9]{3}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/\d/);
      expect(checkNewPassword(p).ok).toBe(true);
    }
  });

  it('normalizeAccount', () => {
    expect(normalizeAccount('  M0012345 ')).toBe('M0012345');
    expect(normalizeAccount('')).toBeNull();
    expect(normalizeAccount('   ')).toBeNull();
    expect(normalizeAccount('a b')).toBeNull();
    expect(normalizeAccount('<script>')).toBeNull();
    expect(normalizeAccount('x'.repeat(61))).toBeNull();
    expect(normalizeAccount(12345)).toBeNull();
  });

  it('normalizePhone', () => {
    expect(normalizePhone('081-234-9907')).toBe('0812349907');
    expect(normalizePhone('074 366 681')).toBe('074366681');
    expect(normalizePhone('81234990')).toBeNull();
    expect(normalizePhone('0812a49907')).toBeNull();
    expect(normalizePhone('08123499071')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('mask', () => {
    expect(maskPhone('0812349907')).toBe('08X-XXX-9907');
    expect(maskPhone(null)).toBeNull();
    expect(maskAccount('M0012345')).toBe('M00•••45');
    expect(maskAccount('A1')).toBe('A•••');
  });

  it('checkNewPassword', () => {
    expect(checkNewPassword('abc12345').ok).toBe(true);
    expect(checkNewPassword('abc1234').min_length).toBe(false);
    expect(checkNewPassword('abcdefgh').letter_and_digit).toBe(false);
    expect(checkNewPassword('12345678').letter_and_digit).toBe(false);
    expect(checkNewPassword('abc12345', false).ok).toBe(false);
    expect(checkNewPassword(undefined).ok).toBe(false);
    expect(checkNewPassword('a1'.repeat(33)).min_length).toBe(false);
  });

  it('checklist ต้องเป็น true ครบทุกข้อ', () => {
    expect(
      isChecklistComplete({ called: true, ref_ok: true, info_ok: true }),
    ).toBe(true);
    expect(isChecklistComplete({ called: true, ref_ok: true })).toBe(false);
    expect(
      isChecklistComplete({ called: true, ref_ok: 'true', info_ok: true }),
    ).toBe(false);
    expect(isChecklistComplete([true, true, true])).toBe(false);
    expect(isChecklistComplete(null)).toBe(false);
  });

  it('reject reason', () => {
    expect(isRejectReason('unreachable')).toBe(true);
    expect(isRejectReason('toString')).toBe(false);
    expect(isRejectReason(1)).toBe(false);
  });

  it('describeDevice', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome บน Android');
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari บน iOS');
    expect(describeDevice(null)).toBeNull();
    expect(describeDevice('curl/8.0')).toBe('ไม่ทราบ');
  });
});
