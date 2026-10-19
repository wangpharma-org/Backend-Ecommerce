import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { SessionsService } from '../sessions/sessions.service';
import { RefreshTokenEntity } from '../auth/refresh-token.entity';
import { UserEntity } from '../users/users.entity';
import { MemberLoginBlockEntity } from './member-login-block.entity';
import {
  MemberLoginBlockAction,
  MemberLoginBlockLogEntity,
} from './member-login-block-log.entity';
import {
  LoginBlockedException,
  MEMBER_LOGIN_BLOCK_FLAG,
} from './member-login-block.policy';

// ทุก request ที่มี token ต้องเช็คสถานะ — อ่านจาก snapshot ในหน่วยความจำ ไม่ query ทุกครั้ง
// instance ที่รับคำสั่ง block จะอัปเดต snapshot ทันที · instance อื่นเห็นภายใน TTL นี้
const SNAPSHOT_TTL_MS = 30_000;
const LOG_LIMIT = 50;
const MEM_CODE_MAX_LENGTH = 30;

interface BlockSnapshot {
  enabled: boolean;
  // mem_code → เหตุผล (null = ไม่มีเหตุผล) — เก็บเฉพาะร้านที่ถูกระงับ
  blocked: Map<string, string | null>;
  loadedAt: number;
}

export interface MemberLoginBlockActor {
  actor_emp_code: string;
  actor_name?: string;
}

export interface MemberLoginBlockStatus {
  enabled: boolean;
  mem_code: string;
  has_account: boolean;
  is_blocked: boolean;
  reason: string | null;
  blocked_by_emp_code: string | null;
  blocked_by_name: string | null;
  blocked_at: Date | null;
  logs: MemberLoginBlockLogEntity[];
}

export interface MemberLoginBlockResult extends MemberLoginBlockStatus {
  // false = สถานะเดิมอยู่แล้ว (กดซ้ำ) ไม่มี log ใหม่
  changed: boolean;
}

@Injectable()
export class MemberLoginBlockService {
  private readonly logger = new Logger(MemberLoginBlockService.name);
  private snapshot: BlockSnapshot | null = null;
  private loading: Promise<BlockSnapshot> | null = null;

  constructor(
    @InjectRepository(MemberLoginBlockEntity)
    private readonly blockRepo: Repository<MemberLoginBlockEntity>,
    @InjectRepository(MemberLoginBlockLogEntity)
    private readonly logRepo: Repository<MemberLoginBlockLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly sessionsService: SessionsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  /// เรียกจากทุกทางที่ออก token (login / LINE / refresh) และ JwtStrategy ทุก request
  /// flag ปิด = ไม่มีใครถูกระงับ
  async assertNotBlocked(mem_code: string | null | undefined): Promise<void> {
    if (!mem_code) return;
    const snapshot = await this.getSnapshot();
    if (!snapshot.enabled || !snapshot.blocked.has(mem_code)) return;
    throw new LoginBlockedException(snapshot.blocked.get(mem_code) ?? null);
  }

  async getStatus(rawMemCode: string): Promise<MemberLoginBlockStatus> {
    const mem_code = this.normalizeMemCode(rawMemCode);
    const [enabled, user, row, logs] = await Promise.all([
      this.isEnabled(),
      this.userRepo.findOne({
        where: { mem_code },
        select: { mem_code: true },
      }),
      this.blockRepo.findOne({ where: { mem_code } }),
      this.logRepo.find({
        where: { mem_code },
        order: { log_id: 'DESC' },
        take: LOG_LIMIT,
      }),
    ]);
    return this.toStatus(mem_code, enabled, !!user, row, logs);
  }

  async block(
    rawMemCode: string,
    reason: string,
    actor: MemberLoginBlockActor,
  ): Promise<MemberLoginBlockResult> {
    return this.setBlocked(rawMemCode, true, reason, actor);
  }

  async unblock(
    rawMemCode: string,
    reason: string | undefined,
    actor: MemberLoginBlockActor,
  ): Promise<MemberLoginBlockResult> {
    return this.setBlocked(rawMemCode, false, reason ?? null, actor);
  }

  private async setBlocked(
    rawMemCode: string,
    blocked: boolean,
    reason: string | null,
    actor: MemberLoginBlockActor,
  ): Promise<MemberLoginBlockResult> {
    const mem_code = this.normalizeMemCode(rawMemCode);
    await this.assertEnabled();
    const user = await this.userRepo.findOne({
      where: { mem_code },
      select: { mem_code: true },
    });
    if (!user) {
      throw new NotFoundException(`ไม่พบบัญชี E-commerce ของร้าน ${mem_code}`);
    }

    // สถานะกับ log ต้องเขียนใน transaction เดียว — ห้ามมีสถานะที่เปลี่ยนแล้วไม่มีหลักฐาน
    const changed = await this.blockRepo.manager.transaction(
      async (manager) => {
        const current = await this.lockRow(manager, mem_code);
        if ((current?.is_blocked ?? false) === blocked) return false;

        await manager.upsert(
          MemberLoginBlockEntity,
          blocked
            ? {
                mem_code,
                is_blocked: true,
                reason,
                blocked_by_emp_code: actor.actor_emp_code,
                blocked_by_name: actor.actor_name ?? null,
                blocked_at: new Date(),
              }
            : {
                mem_code,
                is_blocked: false,
                reason: null,
                blocked_by_emp_code: null,
                blocked_by_name: null,
                blocked_at: null,
              },
          ['mem_code'],
        );
        await this.writeLog(
          manager,
          mem_code,
          blocked ? 'BLOCK' : 'UNBLOCK',
          reason,
          actor,
        );
        return true;
      },
    );

    this.applyToSnapshot(mem_code, blocked, reason);
    if (blocked) {
      // กดซ้ำก็เตะซ้ำ — เผื่อมี session ที่เกิดระหว่างที่ instance อื่นยังไม่เห็นสถานะ
      await this.revokeSessions(mem_code);
    }

    const status = await this.getStatus(mem_code);
    return { ...status, changed };
  }

  /// เตะออกทุกเครื่อง: ลบ refresh token (ต่ออายุไม่ได้) + ปิด session (หน้าเว็บที่ poll validate จะเด้งออก)
  /// access token ที่ยังไม่หมดอายุถูกกันที่ JwtStrategy ผ่าน assertNotBlocked
  private async revokeSessions(mem_code: string): Promise<void> {
    await Promise.all([
      this.refreshTokenRepo.delete({ mem_code }),
      this.sessionsService.logoutAllUserSessions(mem_code),
    ]);
  }

  private async lockRow(
    manager: EntityManager,
    mem_code: string,
  ): Promise<MemberLoginBlockEntity | null> {
    return manager.findOne(MemberLoginBlockEntity, {
      where: { mem_code },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async writeLog(
    manager: EntityManager,
    mem_code: string,
    action: MemberLoginBlockAction,
    reason: string | null,
    actor: MemberLoginBlockActor,
  ): Promise<void> {
    await manager.insert(MemberLoginBlockLogEntity, {
      mem_code,
      action,
      reason,
      actor_emp_code: actor.actor_emp_code,
      actor_name: actor.actor_name ?? null,
    });
  }

  private async getSnapshot(): Promise<BlockSnapshot> {
    if (
      this.snapshot &&
      Date.now() - this.snapshot.loadedAt < SNAPSHOT_TTL_MS
    ) {
      return this.snapshot;
    }
    // request ที่เข้ามาพร้อมกันตอน snapshot หมดอายุใช้การโหลดรอบเดียวกัน
    this.loading ??= this.loadSnapshot().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async loadSnapshot(): Promise<BlockSnapshot> {
    try {
      const enabled = await this.isEnabled();
      const rows = enabled
        ? await this.blockRepo.find({
            where: { is_blocked: true },
            select: { mem_code: true, reason: true },
          })
        : [];
      this.snapshot = {
        enabled,
        blocked: new Map(rows.map((r) => [r.mem_code, r.reason])),
        loadedAt: Date.now(),
      };
      return this.snapshot;
    } catch (error) {
      // เช็คนี้อยู่หน้าทุก request — DB สะดุดชั่วครู่ไม่ควรทำให้ทั้งเว็บ 500
      // ใช้ snapshot เดิมต่อ (ถ้ามี) แล้วลองโหลดใหม่ request ถัดไป · ไม่มีเลย = ยังไม่ระงับใคร
      this.logger.error(
        'โหลดรายการร้านที่ถูกระงับไม่สำเร็จ — ใช้ข้อมูลเดิมไปก่อน',
        error instanceof Error ? error.stack : String(error),
      );
      return (
        this.snapshot ?? { enabled: false, blocked: new Map(), loadedAt: 0 }
      );
    }
  }

  private applyToSnapshot(
    mem_code: string,
    blocked: boolean,
    reason: string | null,
  ): void {
    if (!this.snapshot) return;
    if (blocked) this.snapshot.blocked.set(mem_code, reason);
    else this.snapshot.blocked.delete(mem_code);
  }

  private async isEnabled(): Promise<boolean> {
    return this.featureFlags.getFlag(MEMBER_LOGIN_BLOCK_FLAG);
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FEATURE_DISABLED',
        message: 'ฟีเจอร์ระงับการเข้าใช้งาน E-commerce ยังไม่เปิด',
      });
    }
  }

  private normalizeMemCode(raw: string): string {
    const mem_code = typeof raw === 'string' ? raw.trim() : '';
    if (!mem_code || mem_code.length > MEM_CODE_MAX_LENGTH) {
      throw new BadRequestException('รหัสร้านไม่ถูกต้อง');
    }
    return mem_code;
  }

  private toStatus(
    mem_code: string,
    enabled: boolean,
    has_account: boolean,
    row: MemberLoginBlockEntity | null,
    logs: MemberLoginBlockLogEntity[],
  ): MemberLoginBlockStatus {
    const is_blocked = row?.is_blocked ?? false;
    return {
      enabled,
      mem_code,
      has_account,
      is_blocked,
      reason: is_blocked ? (row?.reason ?? null) : null,
      blocked_by_emp_code: is_blocked
        ? (row?.blocked_by_emp_code ?? null)
        : null,
      blocked_by_name: is_blocked ? (row?.blocked_by_name ?? null) : null,
      blocked_at: is_blocked ? (row?.blocked_at ?? null) : null,
      logs,
    };
  }
}
