import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { WatermarkAuditEntity } from './watermark-audit.entity';
import { WatermarkAuditArchiveEntity } from './watermark-audit-archive.entity';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

// Decoupled flags: display (visible watermark) and audit (forensic logging)
// can be toggled independently — logging keeps running even if the visible
// watermark is turned off, so trace data is not lost during an investigation.
// watermark_display = master switch for ALL visible watermark (text + QR).
// watermark_text and watermark_qr are independent sub-toggles under it, so
// text and QR can each be turned off while the other (and audit) stays on.
export const WATERMARK_DISPLAY_FLAG = 'watermark_display';
export const WATERMARK_TEXT_FLAG = 'watermark_text';
export const WATERMARK_QR_FLAG = 'watermark_qr';
export const WATERMARK_AUDIT_FLAG = 'watermark_audit';
const RETENTION_DAYS = 90;
const ARCHIVE_BATCH_SIZE = 5000;

export interface IssuedToken {
  enabled: boolean;
  text: boolean;
  qr: boolean;
  token: string | null;
}

@Injectable()
export class WatermarkAuditService {
  private readonly logger = new Logger(WatermarkAuditService.name);

  constructor(
    @InjectRepository(WatermarkAuditEntity)
    private readonly auditRepo: Repository<WatermarkAuditEntity>,
    @InjectRepository(WatermarkAuditArchiveEntity)
    private readonly archiveRepo: Repository<WatermarkAuditArchiveEntity>,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async issueToken(input: {
    mem_code: string;
    page: string;
    ip: string | null;
    user_agent: string | null;
  }): Promise<IssuedToken> {
    const [displayEnabled, textEnabled, qrEnabled, auditEnabled] =
      await Promise.all([
        this.featureFlagsService.getFlag(WATERMARK_DISPLAY_FLAG),
        this.featureFlagsService.getFlag(WATERMARK_TEXT_FLAG),
        this.featureFlagsService.getFlag(WATERMARK_QR_FLAG),
        this.featureFlagsService.getFlag(WATERMARK_AUDIT_FLAG),
      ]);

    const textOn = displayEnabled && textEnabled;
    const qrOn = displayEnabled && qrEnabled;

    if (!displayEnabled && !auditEnabled) {
      return { enabled: false, text: false, qr: false, token: null };
    }

    const token = randomBytes(12).toString('base64url');

    if (auditEnabled) {
      // Fire-and-forget: do not block the response on the audit write.
      this.persist({
        token,
        mem_code: input.mem_code,
        page: input.page,
        ip: input.ip,
        user_agent: input.user_agent,
      });
    }

    // `enabled` = master switch. text/qr are independent sub-toggles under
    // it. Logging is independent and may have persisted above even when the
    // visible watermark is off. Token is sent only if something is shown.
    const showAny = textOn || qrOn;
    return {
      enabled: displayEnabled,
      text: textOn,
      qr: qrOn,
      token: showAny ? token : null,
    };
  }

  // Admin lookup: resolve a leaked watermark token back to who saw it,
  // when, and on which page. Checks the hot table first, then the archive
  // (rows older than the retention window).
  async lookup(token: string): Promise<{
    found: boolean;
    source?: 'live' | 'archive';
    mem_code?: string;
    page?: string;
    ip?: string | null;
    user_agent?: string | null;
    created_at?: Date;
  }> {
    const live = await this.auditRepo.findOne({ where: { token } });
    if (live) {
      return {
        found: true,
        source: 'live',
        mem_code: live.mem_code,
        page: live.page,
        ip: live.ip,
        user_agent: live.user_agent,
        created_at: live.created_at,
      };
    }
    const archived = await this.archiveRepo.findOne({ where: { token } });
    if (archived) {
      return {
        found: true,
        source: 'archive',
        mem_code: archived.mem_code,
        page: archived.page,
        ip: archived.ip,
        user_agent: archived.user_agent,
        created_at: archived.created_at,
      };
    }
    return { found: false };
  }

  private persist(row: {
    token: string;
    mem_code: string;
    page: string;
    ip: string | null;
    user_agent: string | null;
  }): void {
    const entity = this.auditRepo.create(row);
    this.auditRepo.save(entity).catch((err) => {
      this.logger.error(
        `Failed to persist watermark audit: token=${row.token} mem_code=${row.mem_code} ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  // Retention: rows older than 90 days are moved to the archive table
  // (PDPA — archive, not delete) so the hot table stays lean.
  @Cron('0 3 * * *', { timeZone: 'Asia/Bangkok' })
  async archiveExpired(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    let totalArchived = 0;
    try {
      for (;;) {
        const batch = await this.auditRepo.find({
          where: { created_at: LessThan(cutoff) },
          order: { id: 'ASC' },
          take: ARCHIVE_BATCH_SIZE,
        });
        if (batch.length === 0) {
          break;
        }

        const archived = batch.map((row) =>
          this.archiveRepo.create({
            token: row.token,
            mem_code: row.mem_code,
            page: row.page,
            ip: row.ip,
            user_agent: row.user_agent,
            created_at: row.created_at,
          }),
        );
        await this.archiveRepo.save(archived);
        await this.auditRepo.delete(batch.map((row) => row.id));

        totalArchived += batch.length;
        if (batch.length < ARCHIVE_BATCH_SIZE) {
          break;
        }
      }

      if (totalArchived > 0) {
        this.logger.log(
          `Archived ${totalArchived} watermark audit rows older than ${RETENTION_DAYS} days`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to archive watermark audit rows: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
