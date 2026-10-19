import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MemberLoginBlockService } from './member-login-block.service';
import { MemberLoginBlockEntity } from './member-login-block.entity';
import { MemberLoginBlockLogEntity } from './member-login-block-log.entity';
import {
  LOGIN_BLOCKED_CODE,
  LoginBlockedException,
  loginBlockedMessage,
  normalizeReason,
} from './member-login-block.policy';
import { UserEntity } from '../users/users.entity';
import { RefreshTokenEntity } from '../auth/refresh-token.entity';
import { SessionsService } from '../sessions/sessions.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const MEM_CODE = 'M0001';
const ACTOR = { actor_emp_code: 'E001', actor_name: 'Sale One' };

describe('member-login-block.policy', () => {
  it('normalizeReason ยุบช่องว่าง/บรรทัด และคืน null เมื่อว่างหรือไม่ใช่ string', () => {
    expect(normalizeReason('  ค้าง\n\nชำระ   เกินกำหนด ')).toBe(
      'ค้าง ชำระ เกินกำหนด',
    );
    expect(normalizeReason('   ')).toBeNull();
    expect(normalizeReason(123)).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
  });

  it('ข้อความแจ้งลูกค้ามีเหตุผลเมื่อมี และไม่มีวงเล็บว่างเมื่อไม่มี', () => {
    expect(loginBlockedMessage('ค้างชำระ')).toContain('(ค้างชำระ)');
    expect(loginBlockedMessage(null)).not.toContain('(');
  });

  it('LoginBlockedException เป็น 403 พร้อม code LOGIN_BLOCKED', () => {
    const error = new LoginBlockedException('ค้างชำระ');
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getStatus()).toBe(403);
    expect(error.getResponse()).toMatchObject({
      code: LOGIN_BLOCKED_CODE,
      reason: 'ค้างชำระ',
    });
  });
});

describe('MemberLoginBlockService', () => {
  let service: MemberLoginBlockService;
  let manager: {
    findOne: jest.Mock;
    upsert: jest.Mock;
    insert: jest.Mock;
    transaction: jest.Mock;
  };
  let blockRepo: { findOne: jest.Mock; find: jest.Mock; manager: unknown };
  let logRepo: { find: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let refreshTokenRepo: { delete: jest.Mock };
  let sessions: { logoutAllUserSessions: jest.Mock };
  let featureFlags: { getFlag: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn((cb: (m: unknown) => unknown): unknown =>
        cb(manager),
      ),
    };
    blockRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      manager,
    };
    logRepo = { find: jest.fn().mockResolvedValue([]) };
    userRepo = { findOne: jest.fn().mockResolvedValue({ mem_code: MEM_CODE }) };
    refreshTokenRepo = { delete: jest.fn().mockResolvedValue(undefined) };
    sessions = {
      logoutAllUserSessions: jest.fn().mockResolvedValue(undefined),
    };
    featureFlags = { getFlag: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberLoginBlockService,
        {
          provide: getRepositoryToken(MemberLoginBlockEntity),
          useValue: blockRepo,
        },
        {
          provide: getRepositoryToken(MemberLoginBlockLogEntity),
          useValue: logRepo,
        },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: refreshTokenRepo,
        },
        { provide: SessionsService, useValue: sessions },
        { provide: FeatureFlagsService, useValue: featureFlags },
      ],
    }).compile();

    service = module.get(MemberLoginBlockService);
  });

  describe('assertNotBlocked', () => {
    it('ร้านที่ถูกระงับ → LoginBlockedException พร้อมเหตุผล', async () => {
      blockRepo.find.mockResolvedValue([
        { mem_code: MEM_CODE, reason: 'ค้างชำระ' },
      ]);
      await expect(service.assertNotBlocked(MEM_CODE)).rejects.toMatchObject({
        response: { code: LOGIN_BLOCKED_CODE, reason: 'ค้างชำระ' },
      });
    });

    it('ร้านที่ไม่ถูกระงับ / ไม่มี mem_code → ผ่าน', async () => {
      blockRepo.find.mockResolvedValue([{ mem_code: 'OTHER', reason: null }]);
      await expect(service.assertNotBlocked(MEM_CODE)).resolves.toBeUndefined();
      await expect(
        service.assertNotBlocked(undefined),
      ).resolves.toBeUndefined();
    });

    it('flag ปิด → ไม่ระงับใครเลย และไม่ query รายการ', async () => {
      featureFlags.getFlag.mockResolvedValue(false);
      blockRepo.find.mockResolvedValue([{ mem_code: MEM_CODE, reason: null }]);
      await expect(service.assertNotBlocked(MEM_CODE)).resolves.toBeUndefined();
      expect(blockRepo.find).not.toHaveBeenCalled();
    });

    it('โหลด snapshot ครั้งเดียวภายใน TTL (ไม่ query ทุก request)', async () => {
      await service.assertNotBlocked(MEM_CODE);
      await service.assertNotBlocked(MEM_CODE);
      await Promise.all([
        service.assertNotBlocked('A'),
        service.assertNotBlocked('B'),
      ]);
      expect(blockRepo.find).toHaveBeenCalledTimes(1);
    });

    it('DB ล่มตอนโหลดครั้งแรก → ไม่ทำให้ request พัง (fail-open + log)', async () => {
      featureFlags.getFlag.mockRejectedValue(new Error('db down'));
      await expect(service.assertNotBlocked(MEM_CODE)).resolves.toBeUndefined();
    });
  });

  describe('block', () => {
    it('เขียนสถานะ + log ใน transaction แล้วเตะ session/refresh token', async () => {
      const result = await service.block(MEM_CODE, 'ค้างชำระ', ACTOR);

      expect(manager.upsert).toHaveBeenCalledWith(
        MemberLoginBlockEntity,
        expect.objectContaining({
          mem_code: MEM_CODE,
          is_blocked: true,
          reason: 'ค้างชำระ',
          blocked_by_emp_code: 'E001',
        }),
        ['mem_code'],
      );
      expect(manager.insert).toHaveBeenCalledWith(MemberLoginBlockLogEntity, {
        mem_code: MEM_CODE,
        action: 'BLOCK',
        reason: 'ค้างชำระ',
        actor_emp_code: 'E001',
        actor_name: 'Sale One',
      });
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        mem_code: MEM_CODE,
      });
      expect(sessions.logoutAllUserSessions).toHaveBeenCalledWith(MEM_CODE);
      expect(result.changed).toBe(true);
    });

    it('มีผลกับ instance นี้ทันที (ไม่ต้องรอ TTL)', async () => {
      await service.assertNotBlocked(MEM_CODE); // โหลด snapshot ว่าง
      await service.block(MEM_CODE, 'ค้างชำระ', ACTOR);
      await expect(service.assertNotBlocked(MEM_CODE)).rejects.toBeInstanceOf(
        LoginBlockedException,
      );
      manager.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        is_blocked: true,
      });
      await service.unblock(MEM_CODE, undefined, ACTOR);
      await expect(service.assertNotBlocked(MEM_CODE)).resolves.toBeUndefined();
    });

    it('ถูกระงับอยู่แล้ว → ไม่เขียน log ซ้ำ แต่ยังเตะ session', async () => {
      manager.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        is_blocked: true,
      });
      const result = await service.block(MEM_CODE, 'ค้างชำระ', ACTOR);
      expect(manager.insert).not.toHaveBeenCalled();
      expect(sessions.logoutAllUserSessions).toHaveBeenCalled();
      expect(result.changed).toBe(false);
    });

    it('ไม่มีบัญชี E-commerce → 404', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.block(MEM_CODE, 'ค้างชำระ', ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('flag ปิด → 403 FEATURE_DISABLED และไม่เขียนอะไร', async () => {
      featureFlags.getFlag.mockResolvedValue(false);
      await expect(
        service.block(MEM_CODE, 'ค้างชำระ', ACTOR),
      ).rejects.toMatchObject({ response: { code: 'FEATURE_DISABLED' } });
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('mem_code ว่าง/ยาวเกิน → 400', async () => {
      await expect(service.block('  ', 'x', ACTOR)).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        service.block('X'.repeat(31), 'x', ACTOR),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('unblock', () => {
    it('ล้างเหตุผล/ผู้ระงับ เขียน log UNBLOCK และไม่เตะ session', async () => {
      manager.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        is_blocked: true,
      });
      const result = await service.unblock(MEM_CODE, 'ชำระแล้ว', ACTOR);
      expect(manager.upsert).toHaveBeenCalledWith(
        MemberLoginBlockEntity,
        expect.objectContaining({
          is_blocked: false,
          reason: null,
          blocked_by_emp_code: null,
        }),
        ['mem_code'],
      );
      expect(manager.insert).toHaveBeenCalledWith(
        MemberLoginBlockLogEntity,
        expect.objectContaining({ action: 'UNBLOCK', reason: 'ชำระแล้ว' }),
      );
      expect(sessions.logoutAllUserSessions).not.toHaveBeenCalled();
      expect(result.changed).toBe(true);
    });

    it('ไม่ได้ถูกระงับอยู่ → ไม่มีอะไรเปลี่ยน', async () => {
      const result = await service.unblock(MEM_CODE, undefined, ACTOR);
      expect(manager.insert).not.toHaveBeenCalled();
      expect(result.changed).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('ร้านที่ไม่มีบัญชี → has_account false (ไม่ throw ให้หน้า sale แสดงได้)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const status = await service.getStatus(MEM_CODE);
      expect(status).toMatchObject({ has_account: false, is_blocked: false });
    });

    it('แถวที่ยกเลิกระงับแล้วไม่ส่งเหตุผลเก่าออกไป', async () => {
      blockRepo.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        is_blocked: false,
        reason: 'เก่า',
      });
      const status = await service.getStatus(MEM_CODE);
      expect(status.reason).toBeNull();
    });
  });
});
