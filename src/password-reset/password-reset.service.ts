import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SALT_ROUNDS } from '../constants/app.constants';
import { UserEntity } from '../users/users.entity';
import { EmployeeEntity } from '../employees/employees.entity';
import { RefreshTokenEntity } from '../auth/refresh-token.entity';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordResetRequestEntity } from './password-reset-request.entity';
import {
  MAX_REQUESTS_PER_ACCOUNT_24H,
  MAX_REQUESTS_PER_IP_1H,
  REQUEST_TTL_HOURS,
  TEMP_PASSWORD_TTL_HOURS,
  addHours,
  checkNewPassword,
  describeDevice,
  generateRefCode,
  generateTempPassword,
  isChecklistComplete,
  isRefCode,
  isRejectReason,
  maskPhone,
  normalizeAccount,
  normalizePhone,
} from './password-reset.rules';

/**
 * ผู้ทำรายการฝั่งพนักงาน — มาจาก sale service (wangpharma-sale-backend) ผ่าน internal token
 * sale service ตรวจ JWT ของ Wang Auth + สิทธิ์เองแล้วส่งมา: รหัสพนักงาน (employee.emp_code)
 * และขอบเขต — all_stores = เห็นทุกร้าน, supervisor = ปิด "บังคับตั้งรหัสใหม่" ได้
 */
export interface StaffActor {
  emp_code: string;
  name?: string;
  all_stores?: boolean;
  supervisor?: boolean;
}

export type ListTab = 'all' | 'pending' | 'mine' | 'closed';

/** ชื่อที่ลูกค้าเห็นแทนชื่อพนักงานจริง (หน้า 4 ของ mockup) */
const VERIFIED_BY_LABEL = 'พนักงานขาย Wangpharma';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetRequestEntity)
    private readonly requestRepo: Repository<PasswordResetRequestEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeeRepo: Repository<EmployeeEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly sessionsService: SessionsService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CUSTOMER (ไม่ต้อง login) ====================

  async createRequest(
    body: {
      account?: unknown;
      phone_changed?: unknown;
      callback_phone?: unknown;
    },
    meta: { ip: string | null; userAgent: string | null },
  ) {
    const account = normalizeAccount(body?.account);
    if (!account) {
      throw new BadRequestException('กรุณากรอกรหัสสมาชิกหรือชื่อบัญชีผู้ใช้');
    }
    const phoneChanged = body?.phone_changed === true;
    let callbackPhone: string | null = null;
    if (phoneChanged) {
      callbackPhone = normalizePhone(body?.callback_phone);
      if (!callbackPhone) {
        throw new BadRequestException(
          'กรุณากรอกเบอร์โทรที่ติดต่อกลับได้ให้ถูกต้อง',
        );
      }
    }
    const key = account.toLowerCase();
    const now = new Date();
    await this.expireStale();

    if (meta.ip) {
      const perIp = await this.requestRepo.count({
        where: {
          ip_address: meta.ip,
          created_at: MoreThan(addHours(now, -1)),
        },
      });
      if (perIp >= MAX_REQUESTS_PER_IP_1H) {
        throw new HttpException(
          'ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // คำขอที่ยังรออยู่ของบัญชีเดียวกัน → คืนคำขอเดิม (ทั้งบัญชีที่มีและไม่มีจริง ให้ผลเหมือนกัน)
    const pending = await this.requestRepo.findOne({
      where: {
        input_account: key,
        status: 'pending',
        expires_at: MoreThan(now),
      },
      order: { created_at: 'DESC' },
    });
    if (pending) {
      if (phoneChanged && callbackPhone !== pending.callback_phone) {
        pending.phone_changed = true;
        pending.callback_phone = callbackPhone;
        await this.requestRepo.save(pending);
      }
      return this.publicView(pending);
    }

    const perAccount = await this.requestRepo.count({
      where: { input_account: key, created_at: MoreThan(addHours(now, -24)) },
    });
    if (perAccount >= MAX_REQUESTS_PER_ACCOUNT_24H) {
      throw new HttpException(
        'ส่งคำขอครบจำนวนที่กำหนดใน 24 ชั่วโมงแล้ว กรุณาติดต่อ 074-366681 ถึง 5',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userRepo.findOne({
      where: [{ mem_code: account }, { mem_username: account }],
      select: ['mem_code', 'role', 'permision_admin'],
    });
    // บัญชีพนักงาน/ผู้ดูแลรีเซ็ตผ่านช่องทางนี้ไม่ได้ (กันเซลล์รีเซ็ตแล้วได้สิทธิ์ admin)
    const eligible =
      !!user &&
      (user.role ?? 'User') === 'User' &&
      user.permision_admin !== true;

    const saved = await this.saveWithUniqueRef({
      mem_code: eligible ? user.mem_code : null,
      input_account: key,
      phone_changed: phoneChanged,
      callback_phone: callbackPhone,
      ip_address: meta.ip,
      user_agent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
      status: 'pending',
      expires_at: addHours(now, REQUEST_TTL_HOURS),
    });
    return this.publicView(saved);
  }

  async getStatus(ref: string) {
    if (!isRefCode(ref)) throw new NotFoundException('ไม่พบคำขอ');
    await this.expireStale();
    const r = await this.requestRepo.findOne({ where: { ref_code: ref } });
    if (!r) throw new NotFoundException('ไม่พบคำขอ');
    return this.publicView(r);
  }

  private publicView(r: PasswordResetRequestEntity) {
    return {
      ref_code: r.ref_code,
      status: r.status,
      created_at: r.created_at,
      expires_at: r.expires_at,
      phone_changed: r.phone_changed,
      callback_phone_masked: maskPhone(r.callback_phone),
      handled_at: r.status === 'pending' ? null : r.handled_at,
      verified_by: r.status === 'approved' ? VERIFIED_BY_LABEL : null,
      password_changed_at: r.password_changed_at,
    };
  }

  // ==================== CUSTOMER (login ด้วยรหัสชั่วคราว) ====================

  /** คำขอที่รีเซ็ตแล้วและบัญชียังใช้รหัสชั่วคราวอยู่ (hash ยังตรงกับที่ตั้งให้) */
  private async activeTempRequest(
    user: Pick<UserEntity, 'mem_code' | 'mem_password'>,
  ) {
    if (!user?.mem_code || !user.mem_password) return null;
    const r = await this.requestRepo.findOne({
      where: {
        mem_code: user.mem_code,
        status: 'approved',
        force_change: true,
      },
      order: { handled_at: 'DESC' },
    });
    if (!r || r.password_changed_at) return null;
    if (r.temp_password_hash !== user.mem_password) return null;
    return r;
  }

  /** ใช้ตอน login: none = ปกติ · active = ต้องตั้งรหัสใหม่ · expired = รหัสชั่วคราวหมดอายุ */
  async tempLoginState(
    user: Pick<UserEntity, 'mem_code' | 'mem_password'>,
  ): Promise<'none' | 'active' | 'expired'> {
    const r = await this.activeTempRequest(user);
    if (!r) return 'none';
    if (r.temp_expires_at && r.temp_expires_at.getTime() < Date.now()) {
      return 'expired';
    }
    return 'active';
  }

  async setNewPassword(
    memCode: string,
    body: {
      new_password?: unknown;
      confirm_password?: unknown;
      logout_all_devices?: unknown;
    },
  ) {
    const user = await this.userRepo.findOne({
      where: { mem_code: memCode },
      select: ['mem_code', 'mem_username', 'mem_password'],
    });
    if (!user) throw new NotFoundException('ไม่พบบัญชี');
    const r = await this.activeTempRequest(user);
    if (!r) {
      throw new BadRequestException(
        'บัญชีนี้ไม่ได้อยู่ในขั้นตอนตั้งรหัสผ่านใหม่',
      );
    }
    if (r.temp_expires_at && r.temp_expires_at.getTime() < Date.now()) {
      throw new BadRequestException(
        'รหัสผ่านชั่วคราวหมดอายุ กรุณาส่งคำขอรีเซ็ตรหัสผ่านใหม่',
      );
    }
    const pw = body?.new_password;
    if (typeof pw !== 'string' || pw !== body?.confirm_password) {
      throw new BadRequestException('ยืนยันรหัสผ่านไม่ตรงกัน');
    }
    const sameAsTemp = await bcrypt.compare(pw, user.mem_password);
    const rules = checkNewPassword(pw, !sameAsTemp);
    if (!rules.ok) {
      throw new BadRequestException({
        message: !rules.not_temp
          ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านชั่วคราว'
          : 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข',
        rules,
      });
    }

    const hash = await bcrypt.hash(pw, SALT_ROUNDS);
    const changedAt = new Date();
    await this.dataSource.transaction(async (m) => {
      await m.update(UserEntity, { mem_code: memCode }, { mem_password: hash });
      await m.update(
        PasswordResetRequestEntity,
        { id: r.id },
        { password_changed_at: changedAt },
      );
      // token ขอบเขตตั้งรหัสใช้ต่อไม่ได้แล้ว — ฝั่งเว็บเข้าสู่ระบบใหม่ด้วยรหัสใหม่
      await m.delete(RefreshTokenEntity, { mem_code: memCode });
    });
    if (body?.logout_all_devices !== false) {
      await this.sessionsService.logoutAllUserSessions(memCode);
    }
    this.logger.log(`password set after reset ${r.ref_code} mem=${memCode}`);
    return {
      success: true,
      ref_code: r.ref_code,
      verified_by: VERIFIED_BY_LABEL,
      password_changed_at: changedAt,
    };
  }

  // ==================== STAFF (ผ่าน sale service) ====================

  /** เห็นทุกร้าน → null (ไม่จำกัด) · ปกติ → เฉพาะร้านที่ users.emp_id_ref = รหัสพนักงาน */
  private salesCodeOf(actor: StaffActor): string | null {
    return actor.all_stores ? null : actor.emp_code;
  }

  private baseStaffQuery(salesCode: string | null) {
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .innerJoin(UserEntity, 'u', 'u.mem_code = r.mem_code')
      .leftJoin(EmployeeEntity, 'e', 'e.emp_code = u.emp_id_ref')
      .where('r.mem_code IS NOT NULL');
    if (salesCode) qb.andWhere('u.emp_id_ref = :sc', { sc: salesCode });
    return qb;
  }

  async list(actor: StaffActor, tab: unknown, q: unknown) {
    const sc = this.salesCodeOf(actor);
    const myCode = actor.emp_code;
    await this.expireStale();
    const t: ListTab =
      tab === 'pending' || tab === 'mine' || tab === 'closed' ? tab : 'all';
    const search = typeof q === 'string' ? q.trim().slice(0, 60) : '';

    const applyTab = (
      qb: ReturnType<PasswordResetService['baseStaffQuery']>,
      which: ListTab,
    ) => {
      if (which === 'pending') qb.andWhere("r.status = 'pending'");
      if (which === 'closed') qb.andWhere("r.status <> 'pending'");
      if (which === 'mine') qb.andWhere('u.emp_id_ref = :my', { my: myCode });
      return qb;
    };

    const qb = applyTab(this.baseStaffQuery(sc), t)
      .select([
        'r.id AS id',
        'r.ref_code AS ref_code',
        'r.mem_code AS mem_code',
        'r.status AS status',
        'r.created_at AS created_at',
        'r.expires_at AS expires_at',
        'r.phone_changed AS phone_changed',
        'r.handled_by_name AS handled_by_name',
        'r.handled_at AS handled_at',
        'r.reject_reason AS reject_reason',
        'r.note AS note',
        'u.mem_nameSite AS shop_name',
        'u.mem_amphur AS amphur',
        'u.mem_province AS province',
        'u.emp_id_ref AS rep_code',
        'e.emp_nickname AS rep_nickname',
        'e.emp_firstname AS rep_firstname',
      ])
      .orderBy("CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('r.created_at', 'DESC')
      .limit(200);
    if (search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('r.ref_code LIKE :s', { s: `%${search}%` })
            .orWhere('r.mem_code LIKE :s', { s: `%${search}%` })
            .orWhere('u.mem_nameSite LIKE :s', { s: `%${search}%` }),
        ),
      );
    }
    const rows: Array<Record<string, unknown>> = await qb.getRawMany();

    const [all, pending, mine, closed] = await Promise.all(
      (['all', 'pending', 'mine', 'closed'] as ListTab[]).map((w) =>
        applyTab(this.baseStaffQuery(sc), w).getCount(),
      ),
    );

    return {
      counts: { all, pending, mine, closed },
      items: rows.map((x) => ({
        id: Number(x.id),
        ref_code: x.ref_code,
        mem_code: x.mem_code,
        shop_name: x.shop_name ?? null,
        area: [x.amphur, x.province].filter(Boolean).join(' ') || null,
        rep_code: x.rep_code ?? null,
        rep_name: repName(x.rep_nickname, x.rep_firstname),
        status: x.status,
        created_at: x.created_at,
        expires_at: x.expires_at,
        phone_changed: Number(x.phone_changed) === 1,
        handled_by_name: x.handled_by_name ?? null,
        handled_at: x.handled_at ?? null,
        reject_reason: x.reject_reason ?? null,
        // หมายเหตุภายใน (พนักงานเห็นเท่านั้น) — เช่น "ปิดอัตโนมัติ: รีเซ็ตแล้วจากคำขอ PR-…"
        note: x.note ?? null,
      })),
    };
  }

  async pendingCount(actor: StaffActor) {
    const sc = this.salesCodeOf(actor);
    await this.expireStale();
    const pending = await this.baseStaffQuery(sc)
      .andWhere("r.status = 'pending'")
      .getCount();
    return { pending };
  }

  private async loadInScope(actor: StaffActor, id: number) {
    const sc = this.salesCodeOf(actor);
    const r = await this.requestRepo.findOne({ where: { id } });
    if (!r || !r.mem_code) throw new NotFoundException('ไม่พบคำขอ');
    const user = await this.userRepo.findOne({
      where: { mem_code: r.mem_code },
      select: [
        'mem_code',
        'mem_username',
        'mem_nameSite',
        'mem_phone',
        'mem_license',
        'mem_amphur',
        'mem_province',
        'emp_id_ref',
        'latest_purchase',
        'role',
        'permision_admin',
      ],
    });
    if (!user) throw new NotFoundException('ไม่พบร้าน');
    if (sc && (user.emp_id_ref ?? '') !== sc) {
      throw new ForbiddenException('ร้านนี้ไม่อยู่ในความดูแลของท่าน');
    }
    return { r, user };
  }

  async detail(actor: StaffActor, id: number) {
    await this.expireStale();
    const { r, user } = await this.loadInScope(actor, id);
    const emp = user.emp_id_ref
      ? await this.employeeRepo.findOne({
          where: { emp_code: user.emp_id_ref },
        })
      : null;
    const requests30d = await this.requestRepo.count({
      where: {
        mem_code: r.mem_code!,
        created_at: MoreThan(addHours(new Date(), -24 * 30)),
      },
    });
    return {
      id: r.id,
      ref_code: r.ref_code,
      status: r.status,
      created_at: r.created_at,
      expires_at: r.expires_at,
      handled_by_name: r.handled_by_name,
      handled_at: r.handled_at,
      reject_reason: r.reject_reason,
      note: r.note,
      checklist: r.checklist,
      force_change: r.force_change,
      temp_expires_at: r.temp_expires_at,
      password_changed_at: r.password_changed_at,
      store: {
        mem_code: user.mem_code,
        shop_name: user.mem_nameSite ?? null,
        area:
          [user.mem_amphur, user.mem_province].filter(Boolean).join(' ') ||
          null,
        // พนักงานต้องโทรเบอร์นี้ จึงส่งเต็ม (หน้าจอแสดงแบบ mask แล้วกดดูได้)
        phone: user.mem_phone ?? null,
        phone_masked: maskPhone(user.mem_phone),
        license: user.mem_license ?? null,
        rep_code: user.emp_id_ref ?? null,
        rep_name: repName(emp?.emp_nickname, emp?.emp_firstname),
        latest_purchase: user.latest_purchase ?? null,
      },
      request: {
        input_account: r.input_account,
        phone_changed: r.phone_changed,
        callback_phone: r.callback_phone,
        callback_phone_masked: maskPhone(r.callback_phone),
        device: describeDevice(r.user_agent),
        requests_30d: requests30d,
      },
      can_disable_force_change: actor.supervisor === true,
    };
  }

  async approve(
    actor: StaffActor,
    id: number,
    body: {
      checklist?: unknown;
      mode?: unknown;
      password?: unknown;
      force_change?: unknown;
      note?: unknown;
    },
  ) {
    await this.expireStale();
    const { r, user } = await this.loadInScope(actor, id);
    if (r.status !== 'pending') {
      throw new ConflictException('คำขอนี้ปิดแล้ว');
    }
    if (!isChecklistComplete(body?.checklist)) {
      throw new BadRequestException('ต้องตรวจสอบครบทุกข้อก่อนรีเซ็ต');
    }
    if ((user.role ?? 'User') !== 'User' || user.permision_admin === true) {
      throw new ForbiddenException('บัญชีนี้รีเซ็ตผ่านช่องทางนี้ไม่ได้');
    }
    const mode = body?.mode;
    if (mode !== 'auto' && mode !== 'manual') {
      throw new BadRequestException('mode ต้องเป็น auto หรือ manual');
    }
    let temp: string;
    if (mode === 'manual') {
      if (
        typeof body.password !== 'string' ||
        !checkNewPassword(body.password).ok
      ) {
        throw new BadRequestException(
          'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข',
        );
      }
      temp = body.password;
    } else {
      temp = generateTempPassword();
    }
    let forceChange = true;
    if (body?.force_change === false) {
      if (actor.supervisor !== true) {
        throw new ForbiddenException(
          'ปิด "ให้ลูกค้าตั้งรหัสผ่านใหม่" ได้เฉพาะผู้มีสิทธิ์ระดับหัวหน้า',
        );
      }
      forceChange = false;
    }
    const note = optionalNote(body?.note);

    const hash = await bcrypt.hash(temp, SALT_ROUNDS);
    const now = new Date();
    const tempExpiresAt = addHours(now, TEMP_PASSWORD_TTL_HOURS);
    const handledByName = staffName(actor);
    await this.dataSource.transaction(async (m) => {
      // อัปเดตแบบมีเงื่อนไข — กันพนักงาน 2 คนกดพร้อมกัน
      const claimed = await m
        .createQueryBuilder()
        .update(PasswordResetRequestEntity)
        .set({
          status: 'approved',
          handled_by: actor.emp_code,
          handled_by_name: handledByName,
          handled_at: now,
          checklist: { called: true, ref_ok: true, info_ok: true },
          note,
          password_mode: mode,
          force_change: forceChange,
          temp_password_hash: hash,
          temp_expires_at: tempExpiresAt,
        })
        .where('id = :id AND status = :st', { id: r.id, st: 'pending' })
        .execute();
      if (!claimed.affected) throw new ConflictException('คำขอนี้ปิดแล้ว');
      await m.update(
        UserEntity,
        { mem_code: user.mem_code },
        { mem_password: hash },
      );
      // คำขออื่นที่ยังรออยู่ของร้านเดียวกันไม่ต้องทำซ้ำ
      await m
        .createQueryBuilder()
        .update(PasswordResetRequestEntity)
        .set({
          status: 'expired',
          note: `ปิดอัตโนมัติ: รีเซ็ตแล้วจากคำขอ ${r.ref_code}`,
        })
        .where('mem_code = :mc AND status = :st AND id <> :id', {
          mc: user.mem_code,
          st: 'pending',
          id: r.id,
        })
        .execute();
      await m.delete(RefreshTokenEntity, { mem_code: user.mem_code });
    });
    await this.sessionsService.logoutAllUserSessions(user.mem_code);
    this.logger.log(
      `password reset ${r.ref_code} mem=${user.mem_code} by=${actor.emp_code} mode=${mode} force=${forceChange}`,
    );
    return {
      ref_code: r.ref_code,
      mem_code: user.mem_code,
      shop_name: user.mem_nameSite ?? null,
      temp_password: temp,
      temp_expires_at: tempExpiresAt,
      force_change: forceChange,
      handled_by_name: handledByName,
      sessions_revoked: true,
    };
  }

  async reject(
    actor: StaffActor,
    id: number,
    body: { reason?: unknown; note?: unknown },
  ) {
    await this.expireStale();
    const { r } = await this.loadInScope(actor, id);
    if (r.status !== 'pending') throw new ConflictException('คำขอนี้ปิดแล้ว');
    if (!isRejectReason(body?.reason)) {
      throw new BadRequestException('กรุณาเลือกสาเหตุ');
    }
    const note = optionalNote(body?.note);
    if (body.reason === 'other' && !note) {
      throw new BadRequestException('กรุณาระบุเหตุผล');
    }
    const now = new Date();
    const res = await this.requestRepo
      .createQueryBuilder()
      .update(PasswordResetRequestEntity)
      .set({
        status: 'rejected',
        reject_reason: body.reason,
        note,
        handled_by: actor.emp_code,
        handled_by_name: staffName(actor),
        handled_at: now,
      })
      .where('id = :id AND status = :st', { id: r.id, st: 'pending' })
      .execute();
    if (!res.affected) throw new ConflictException('คำขอนี้ปิดแล้ว');
    this.logger.log(
      `password reset rejected ${r.ref_code} by=${actor.emp_code} reason=${body.reason}`,
    );
    return {
      ref_code: r.ref_code,
      status: 'rejected' as const,
      handled_at: now,
    };
  }

  // ==================== helpers ====================

  /** คำขอที่เลยเวลาแล้วยังไม่มีคนยืนยัน → expired (ทำตอนอ่าน ไม่ต้องพึ่ง cron) */
  private async expireStale() {
    await this.requestRepo.update(
      { status: 'pending', expires_at: LessThan(new Date()) },
      { status: 'expired' },
    );
  }

  private async saveWithUniqueRef(
    data: Partial<PasswordResetRequestEntity>,
  ): Promise<PasswordResetRequestEntity> {
    for (let i = 0; i < 5; i++) {
      try {
        return await this.requestRepo.save(
          this.requestRepo.create({ ...data, ref_code: generateRefCode() }),
        );
      } catch (err: unknown) {
        if ((err as { code?: string })?.code !== 'ER_DUP_ENTRY') throw err;
      }
    }
    throw new ConflictException('สร้างรหัสอ้างอิงไม่สำเร็จ กรุณาลองใหม่');
  }
}

function repName(nick: unknown, first: unknown): string | null {
  const n = typeof nick === 'string' ? nick.trim() : '';
  const f = typeof first === 'string' ? first.trim() : '';
  return n || f || null;
}

function staffName(actor: StaffActor): string {
  const name = (actor.name ?? '').trim();
  return name ? `${name} (${actor.emp_code})` : actor.emp_code;
}

function optionalNote(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== 'string')
    throw new BadRequestException('หมายเหตุไม่ถูกต้อง');
  const s = v.trim();
  if (s.length > 500)
    throw new BadRequestException('หมายเหตุยาวเกิน 500 ตัวอักษร');
  return s || null;
}
