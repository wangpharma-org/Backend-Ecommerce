import { ForbiddenException } from '@nestjs/common';
import { OrderAccessService } from './order-access.service';

type Users = Record<string, { emp_id_ref: string | null }>;

function make(users: Users, owners: Record<string, string>) {
  const userRepo = {
    findOne: jest.fn(({ where }: { where: { mem_code: string } }) => {
      const u = users[where.mem_code];
      return Promise.resolve(u ? { mem_code: where.mem_code, ...u } : null);
    }),
  };
  const qb = {
    sohRunning: '',
    select() {
      return this;
    },
    where(_: string, p: { sohRunning: string }) {
      this.sohRunning = p.sohRunning;
      return this;
    },
    getRawOne() {
      const owner = owners[this.sohRunning];
      return Promise.resolve(owner ? { owner } : undefined);
    },
  };
  const headRepo = { createQueryBuilder: jest.fn(() => qb) };
  return new OrderAccessService(userRepo as never, headRepo as never);
}

describe('OrderAccessService', () => {
  const users: Users = {
    '03103': { emp_id_ref: '0313' },
    '99001': { emp_id_ref: '0743' },
    S0313: { emp_id_ref: '0313' },
  };
  const svc = make(users, { 'SO-A': '03103', 'SO-B': '99001' });

  it('ร้านดูของตัวเองได้ (ไม่สนช่องว่าง/ตัวพิมพ์)', async () => {
    await expect(
      svc.assertShop({ mem_code: '03103' }, ' 03103 '),
    ).resolves.toBeUndefined();
  });

  it('ร้านดูของร้านอื่นไม่ได้ → 403', async () => {
    await expect(
      svc.assertShop({ mem_code: '03103' }, '99001'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('รหัสร้านว่าง → 403', async () => {
    await expect(
      svc.assertShop({ mem_code: '03103' }, ''),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin (permission หรือ role Admin) ดูได้ทุกร้าน', async () => {
    await expect(
      svc.assertShop({ mem_code: 'ADM', permission: true }, '99001'),
    ).resolves.toBeUndefined();
    await expect(
      svc.assertShop({ mem_code: 'ADM', role: 'Admin' }, '99001'),
    ).resolves.toBeUndefined();
  });

  it('เซลล์ดูได้เฉพาะร้านในความดูแล', async () => {
    const sales = { mem_code: 'S0313', role: 'Sales' };
    await expect(svc.assertShop(sales, '03103')).resolves.toBeUndefined();
    await expect(svc.assertShop(sales, '99001')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('บิลของร้านอื่น → 403 · บิลของตัวเอง → true · บิลที่ไม่มีในฐาน → false', async () => {
    await expect(
      svc.assertOrder({ mem_code: '03103' }, 'SO-B'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertOrder({ mem_code: '03103' }, 'SO-A')).resolves.toBe(
      true,
    );
    await expect(svc.assertOrder({ mem_code: '03103' }, 'SO-X')).resolves.toBe(
      false,
    );
  });
});
