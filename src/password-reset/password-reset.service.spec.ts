import { PasswordResetService } from './password-reset.service';

/** tempLoginState ตัดสินจาก hash ที่ตั้งตอนรีเซ็ต — ไม่ต้องแตะ DB จริง */
describe('PasswordResetService.tempLoginState', () => {
  const user = { mem_code: 'E2E706', mem_password: '$2b$10$temp-hash' };
  const make = (row: Record<string, unknown> | null) =>
    new PasswordResetService(
      { findOne: jest.fn().mockResolvedValue(row) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  const approved = (over: Record<string, unknown> = {}) => ({
    id: 1,
    ref_code: 'PR-AAAAAAA',
    status: 'approved',
    force_change: true,
    temp_password_hash: user.mem_password,
    temp_expires_at: new Date(Date.now() + 3600_000),
    password_changed_at: null,
    ...over,
  });

  it('ไม่มีคำขอที่รีเซ็ต → none', async () => {
    await expect(make(null).tempLoginState(user)).resolves.toBe('none');
  });

  it('ยังใช้รหัสชั่วคราว และยังไม่หมดอายุ → active', async () => {
    await expect(make(approved()).tempLoginState(user)).resolves.toBe('active');
  });

  it('รหัสชั่วคราวหมดอายุแล้ว → expired', async () => {
    await expect(
      make(
        approved({ temp_expires_at: new Date(Date.now() - 1000) }),
      ).tempLoginState(user),
    ).resolves.toBe('expired');
  });

  it('ลูกค้าเปลี่ยนรหัสผ่านทางอื่นไปแล้ว (hash ไม่ตรง) → none', async () => {
    await expect(
      make(approved({ temp_password_hash: '$2b$10$other' })).tempLoginState(
        user,
      ),
    ).resolves.toBe('none');
  });

  it('ตั้งรหัสใหม่ไปแล้ว → none', async () => {
    await expect(
      make(approved({ password_changed_at: new Date() })).tempLoginState(user),
    ).resolves.toBe('none');
  });
});
