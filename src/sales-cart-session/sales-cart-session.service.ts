import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

/// พนักงานขาย (Key ขาย) ขออนุญาตลูกค้าก่อนเข้าดูแลตะกร้า — Tim 18 ต.ค. 2569
/// ความยินยอมต่อร้านอยู่ 90 วัน (ถอนได้) · ลูกค้ายืนยันทางโทรศัพท์ = เซลส์บันทึกแทน (channel phone)
/// เวลาทั้งหมดคิดใน SQL (NOW) แล้วส่งออกเป็น "กี่วินาที/กี่วัน" — ไม่ส่งเวลาสัมบูรณ์ข้าม timezone
export const CONSENT_DAYS = 90;
export const IDLE_MINUTES = 30;
/// หลังเซลส์บันทึกใบ ลูกค้ายังเห็น "พนักงานขายสั่งสินค้าให้แล้ว" อีกช่วงหนึ่ง
export const SAVED_NOTICE_MINUTES = 10;
const MAX_LINES = 200;

export type SessionStatus = 'awaiting_consent' | 'active' | 'denied' | 'ended';
export type EndReason = 'saved' | 'discarded' | 'idle' | 'denied' | 'replaced';
export type ConsentChannel = 'app' | 'web' | 'phone';

export interface SessionLine {
  pro_code: string;
  unit: string | null;
  qty: number;
  name: string | null;
}

export interface SalesPerson {
  emp_code: string | null;
  sales_name: string | null;
  sales_nick: string | null;
}

export interface SessionView {
  id: string;
  mem_code: string;
  status: SessionStatus;
  end_reason: EndReason | null;
  sales_name: string | null;
  sales_nick: string | null;
  lines: SessionLine[];
  idle_seconds: number;
  consent: {
    id: number;
    status: string;
    channel: ConsentChannel | null;
    expires_in_days: number | null;
  } | null;
}

interface SessionRow {
  id: string;
  mem_code: string;
  emp_code: string | null;
  sales_name: string | null;
  sales_nick: string | null;
  draft_ref: string | null;
  status: SessionStatus;
  end_reason: EndReason | null;
  consent_id: number | null;
  lines: unknown;
  idle_seconds: number | string;
}

interface ConsentRow {
  id: number;
  status: string;
  channel: ConsentChannel | null;
  session_id: string | null;
  expires_in_days: number | string | null;
  sales_name: string | null;
  sales_nick: string | null;
  requested_seconds_ago?: number | string;
}

const OPEN: SessionStatus[] = ['awaiting_consent', 'active', 'denied'];

@Injectable()
export class SalesCartSessionService {
  constructor(private readonly db: DataSource) {}

  static lines(input: unknown): SessionLine[] {
    if (input === undefined || input === null) return [];
    if (!Array.isArray(input) || input.length > MAX_LINES)
      throw new BadRequestException(`lines ต้องเป็นรายการไม่เกิน ${MAX_LINES}`);
    return input.map((raw) => {
      const l = (raw ?? {}) as Record<string, unknown>;
      const code = typeof l.pro_code === 'string' ? l.pro_code.trim() : '';
      const qty = Number(l.qty);
      if (!code || code.length > 30 || !Number.isFinite(qty) || qty < 0)
        throw new BadRequestException('lines ไม่ถูกต้อง');
      const str = (v: unknown, max: number) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
      return {
        pro_code: code,
        unit: str(l.unit, 30),
        qty,
        name: str(l.name, 255),
      };
    });
  }

  private async q<T>(sql: string, args: unknown[] = []): Promise<T[]> {
    return await this.db.query(sql, args);
  }

  /// รอบที่ไม่มีความเคลื่อนไหวเกิน 30 นาที → จบเอง (ตรวจตอนอ่าน ไม่ต้องมี cron)
  private async expireIdle(memCode: string) {
    const idle = await this.q<{ id: string }>(
      `SELECT id FROM sales_cart_session WHERE mem_code = ? AND status IN (?)
         AND last_activity_at < NOW(6) - INTERVAL ${IDLE_MINUTES} MINUTE`,
      [memCode, OPEN],
    );
    if (!idle.length) return;
    const ids = idle.map((r) => r.id);
    await this.q(
      `UPDATE sales_cart_session SET status = 'ended', end_reason = 'idle', ended_at = NOW(6) WHERE id IN (?)`,
      [ids],
    );
    await this.expirePending(ids);
  }

  private async expirePending(sessionIds: string[]) {
    if (!sessionIds.length) return;
    await this.q(
      `UPDATE sales_cart_consent SET status = 'expired', decided_at = NOW(6)
        WHERE status = 'pending' AND session_id IN (?)`,
      [sessionIds],
    );
  }

  private async validConsent(memCode: string): Promise<ConsentRow | null> {
    const rows = await this.q<ConsentRow>(
      `SELECT id, status, channel, session_id, sales_name, sales_nick,
              GREATEST(0, DATEDIFF(expires_at, NOW(6))) AS expires_in_days
         FROM sales_cart_consent
        WHERE mem_code = ? AND status = 'granted' AND expires_at > NOW(6)
        ORDER BY id DESC LIMIT 1`,
      [memCode],
    );
    return rows[0] ?? null;
  }

  private async row(id: string): Promise<SessionRow> {
    const rows = await this.q<SessionRow>(
      `SELECT id, mem_code, emp_code, sales_name, sales_nick, draft_ref, status, end_reason, consent_id, \`lines\`,
              TIMESTAMPDIFF(SECOND, last_activity_at, NOW(6)) AS idle_seconds
         FROM sales_cart_session WHERE id = ?`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('ไม่พบรอบดูแลตะกร้านี้');
    return rows[0];
  }

  private parseLines(v: unknown): SessionLine[] {
    const raw = typeof v === 'string' ? (JSON.parse(v) as unknown) : v;
    return Array.isArray(raw) ? (raw as SessionLine[]) : [];
  }

  private async view(row: SessionRow): Promise<SessionView> {
    let consent: SessionView['consent'] = null;
    const c = row.consent_id
      ? await this.q<ConsentRow>(
          `SELECT id, status, channel, session_id, sales_name, sales_nick,
                  IF(expires_at IS NULL, NULL, GREATEST(0, DATEDIFF(expires_at, NOW(6)))) AS expires_in_days
             FROM sales_cart_consent WHERE id = ?`,
          [row.consent_id],
        )
      : await this.q<ConsentRow>(
          `SELECT id, status, channel, session_id, sales_name, sales_nick, NULL AS expires_in_days
             FROM sales_cart_consent WHERE session_id = ? ORDER BY id DESC LIMIT 1`,
          [row.id],
        );
    if (c[0])
      consent = {
        id: c[0].id,
        status: c[0].status,
        channel: c[0].channel,
        expires_in_days:
          c[0].expires_in_days === null ? null : Number(c[0].expires_in_days),
      };
    return {
      id: row.id,
      mem_code: row.mem_code,
      status: row.status,
      end_reason: row.end_reason,
      sales_name: row.sales_name,
      sales_nick: row.sales_nick,
      lines: this.parseLines(row.lines),
      idle_seconds: Number(row.idle_seconds) || 0,
      consent,
    };
  }

  // ---------------- ระบบขาย (internal) ----------------

  /// เซลส์กด "ลูกค้าตกลง ใส่ในใบ" ครั้งแรกของใบนี้ → เปิดรอบดูแลตะกร้า
  /// มีความยินยอมที่ยังไม่หมดอายุ → ดูแลได้ทันที · ไม่มี → ส่งคำขอให้ลูกค้า (รอลูกค้าตอบ)
  async start(
    memCode: string,
    who: SalesPerson,
    draftRef: string | null,
    lines: SessionLine[],
  ): Promise<SessionView> {
    await this.expireIdle(memCode);
    const open = await this.q<SessionRow>(
      `SELECT id, emp_code, draft_ref FROM sales_cart_session WHERE mem_code = ? AND status IN (?) ORDER BY started_at DESC`,
      [memCode, OPEN],
    );
    const same = open.find(
      (s) => s.emp_code === who.emp_code && (s.draft_ref ?? null) === draftRef,
    );
    if (same) return this.touch(same.id, lines);
    // ร้านหนึ่งมีรอบเปิดได้ทีละรอบ — รอบเก่า (ใบอื่น/เซลส์คนอื่น) จบแบบ replaced
    if (open.length) {
      const ids = open.map((s) => s.id);
      await this.q(
        `UPDATE sales_cart_session SET status = 'ended', end_reason = 'replaced', ended_at = NOW(6) WHERE id IN (?)`,
        [ids],
      );
      await this.expirePending(ids);
    }
    const id = randomUUID();
    const consent = await this.validConsent(memCode);
    await this.q(
      `INSERT INTO sales_cart_session (id, mem_code, emp_code, sales_name, sales_nick, draft_ref, status, consent_id, \`lines\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        memCode,
        who.emp_code,
        who.sales_name,
        who.sales_nick,
        draftRef,
        consent ? 'active' : 'awaiting_consent',
        consent?.id ?? null,
        JSON.stringify(lines),
      ],
    );
    if (!consent)
      await this.q(
        `INSERT INTO sales_cart_consent (mem_code, status, session_id, emp_code, sales_name, sales_nick)
         VALUES (?, 'pending', ?, ?, ?, ?)`,
        [memCode, id, who.emp_code, who.sales_name, who.sales_nick],
      );
    return this.view(await this.row(id));
  }

  async get(id: string): Promise<SessionView> {
    const r = await this.row(id);
    await this.expireIdle(r.mem_code);
    return this.view(await this.row(id));
  }

  /// เซลส์อัปเดตรายการที่ลูกค้าตกลง (นับเป็นความเคลื่อนไหว)
  async touch(id: string, lines: SessionLine[] | null): Promise<SessionView> {
    const r = await this.row(id);
    await this.expireIdle(r.mem_code);
    const cur = await this.row(id);
    if (OPEN.includes(cur.status))
      await this.q(
        `UPDATE sales_cart_session SET last_activity_at = NOW(6)${lines ? ', `lines` = ?' : ''} WHERE id = ?`,
        lines ? [JSON.stringify(lines), id] : [id],
      );
    return this.view(await this.row(id));
  }

  /// ลูกค้ายืนยันทางโทรศัพท์ — เซลส์กดแทนได้ทุกเมื่อ (บันทึกว่าใคร/เมื่อไร · channel phone)
  async phoneConsent(id: string, empCode: string | null): Promise<SessionView> {
    const r = await this.get(id);
    if (r.status === 'ended')
      throw new ConflictException(
        'รอบดูแลตะกร้านี้จบแล้ว เริ่มใหม่จากการกดใส่ในใบ',
      );
    const pending = await this.q<{ id: number }>(
      `SELECT id FROM sales_cart_consent WHERE session_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`,
      [id],
    );
    let consentId: number;
    if (pending[0]) {
      consentId = pending[0].id;
      await this.q(
        `UPDATE sales_cart_consent SET status = 'granted', channel = 'phone', decided_by = ?, decided_at = NOW(6),
                expires_at = NOW(6) + INTERVAL ${CONSENT_DAYS} DAY WHERE id = ?`,
        [empCode, consentId],
      );
    } else {
      const s = await this.row(id);
      const res = (await this.db.query(
        `INSERT INTO sales_cart_consent (mem_code, status, channel, session_id, emp_code, sales_name, sales_nick, decided_by, decided_at, expires_at)
         VALUES (?, 'granted', 'phone', ?, ?, ?, ?, ?, NOW(6), NOW(6) + INTERVAL ${CONSENT_DAYS} DAY)`,
        [s.mem_code, id, s.emp_code, s.sales_name, s.sales_nick, empCode],
      )) as unknown as { insertId: number };
      consentId = res.insertId;
    }
    await this.q(
      `UPDATE sales_cart_session SET status = 'active', consent_id = ?, last_activity_at = NOW(6) WHERE id = ?`,
      [consentId, id],
    );
    return this.view(await this.row(id));
  }

  /// บันทึกใบแล้ว (saved) / ทิ้งใบร่าง (discarded) — จบแล้วเรียกซ้ำได้ ไม่เปลี่ยนอะไร
  async end(id: string, reason: 'saved' | 'discarded'): Promise<SessionView> {
    const r = await this.get(id);
    if (r.status !== 'ended') {
      await this.q(
        `UPDATE sales_cart_session SET status = 'ended', end_reason = ?, ended_at = NOW(6) WHERE id = ?`,
        [reason, id],
      );
      await this.expirePending([id]);
    }
    return this.view(await this.row(id));
  }

  // ---------------- ลูกค้า (เว็บ/แอป) ----------------

  async current(memCode: string) {
    await this.expireIdle(memCode);
    const request = (
      await this.q<ConsentRow>(
        `SELECT c.id, c.status, c.channel, c.session_id, c.sales_name, c.sales_nick, NULL AS expires_in_days,
                TIMESTAMPDIFF(SECOND, c.requested_at, NOW(6)) AS requested_seconds_ago
           FROM sales_cart_consent c JOIN sales_cart_session s ON s.id = c.session_id
          WHERE c.mem_code = ? AND c.status = 'pending' AND s.status = 'awaiting_consent'
          ORDER BY c.id DESC LIMIT 1`,
        [memCode],
      )
    )[0];
    const active = (
      await this.q<SessionRow>(
        `SELECT id, mem_code, emp_code, sales_name, sales_nick, draft_ref, status, end_reason, consent_id, \`lines\`,
                TIMESTAMPDIFF(SECOND, last_activity_at, NOW(6)) AS idle_seconds
           FROM sales_cart_session WHERE mem_code = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
        [memCode],
      )
    )[0];
    const saved = (
      await this.q<{
        id: string;
        sales_name: string | null;
        sales_nick: string | null;
        ended_seconds_ago: number | string;
      }>(
        `SELECT id, sales_name, sales_nick, TIMESTAMPDIFF(SECOND, ended_at, NOW(6)) AS ended_seconds_ago
           FROM sales_cart_session
          WHERE mem_code = ? AND status = 'ended' AND end_reason = 'saved'
            AND ended_at > NOW(6) - INTERVAL ${SAVED_NOTICE_MINUTES} MINUTE
          ORDER BY ended_at DESC LIMIT 1`,
        [memCode],
      )
    )[0];
    const consent = await this.validConsent(memCode);
    return {
      request: request
        ? {
            id: request.id,
            sales_name: request.sales_name,
            sales_nick: request.sales_nick,
            requested_seconds_ago: Number(request.requested_seconds_ago) || 0,
          }
        : null,
      session: active
        ? {
            id: active.id,
            sales_name: active.sales_name,
            sales_nick: active.sales_nick,
            lines: this.parseLines(active.lines),
          }
        : null,
      saved: saved
        ? {
            id: saved.id,
            sales_name: saved.sales_name,
            sales_nick: saved.sales_nick,
            ended_seconds_ago: Number(saved.ended_seconds_ago) || 0,
          }
        : null,
      consent: consent
        ? {
            granted: true,
            channel: consent.channel,
            expires_in_days: Number(consent.expires_in_days),
          }
        : { granted: false, channel: null, expires_in_days: null },
    };
  }

  /// ลูกค้ากดอนุญาต/ไม่อนุญาต
  async decide(
    memCode: string,
    consentId: number,
    decision: 'allow' | 'deny',
    channel: 'app' | 'web',
  ) {
    await this.expireIdle(memCode);
    const rows = await this.q<{
      id: number;
      session_id: string | null;
      status: string;
    }>(
      `SELECT id, session_id, status FROM sales_cart_consent WHERE id = ? AND mem_code = ?`,
      [consentId, memCode],
    );
    const c = rows[0];
    if (!c) throw new NotFoundException('ไม่พบคำขอนี้');
    if (c.status !== 'pending')
      throw new ConflictException('คำขอนี้ตอบไปแล้วหรือหมดเวลาแล้ว');
    if (decision === 'allow') {
      await this.q(
        `UPDATE sales_cart_consent SET status = 'granted', channel = ?, decided_at = NOW(6),
                expires_at = NOW(6) + INTERVAL ${CONSENT_DAYS} DAY WHERE id = ?`,
        [channel, c.id],
      );
      if (c.session_id)
        await this.q(
          `UPDATE sales_cart_session SET status = 'active', consent_id = ?, last_activity_at = NOW(6)
            WHERE id = ? AND status = 'awaiting_consent'`,
          [c.id, c.session_id],
        );
    } else {
      await this.q(
        `UPDATE sales_cart_consent SET status = 'denied', channel = ?, decided_at = NOW(6) WHERE id = ?`,
        [channel, c.id],
      );
      if (c.session_id)
        await this.q(
          `UPDATE sales_cart_session SET status = 'denied', consent_id = ?, last_activity_at = NOW(6)
            WHERE id = ? AND status = 'awaiting_consent'`,
          [c.id, c.session_id],
        );
    }
    return this.current(memCode);
  }

  /// ลูกค้าถอนความยินยอม — รอบที่กำลังดูแลอยู่หยุดทันที (เซลส์เห็นเป็น "ไม่อนุญาต")
  async withdraw(memCode: string) {
    const granted = await this.q<{ id: number }>(
      `SELECT id FROM sales_cart_consent WHERE mem_code = ? AND status = 'granted'`,
      [memCode],
    );
    if (granted.length) {
      const ids = granted.map((g) => g.id);
      await this.q(
        `UPDATE sales_cart_consent SET status = 'withdrawn', withdrawn_at = NOW(6) WHERE id IN (?)`,
        [ids],
      );
      await this.q(
        `UPDATE sales_cart_session SET status = 'denied', last_activity_at = NOW(6)
          WHERE mem_code = ? AND status = 'active' AND consent_id IN (?)`,
        [memCode, ids],
      );
    }
    return this.current(memCode);
  }
}
