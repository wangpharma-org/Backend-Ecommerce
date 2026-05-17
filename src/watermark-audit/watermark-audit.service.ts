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
export const WATERMARK_DISPLAY_FLAG = 'watermark_display';
export const WATERMARK_AUDIT_FLAG = 'watermark_audit';
const RETENTION_DAYS = 90;
const ARCHIVE_BATCH_SIZE = 5000;

export interface IssuedToken {
  enabled: boolean;
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
    const [displayEnabled, auditEnabled] = await Promise.all([
      this.featureFlagsService.getFlag(WATERMARK_DISPLAY_FLAG),
      this.featureFlagsService.getFlag(WATERMARK_AUDIT_FLAG),
    ]);

    if (!displayEnabled && !auditEnabled) {
      return { enabled: false, token: null };
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

    // `enabled` drives the visible watermark on the client. Logging is
    // independent: it may have persisted above even when display is off.
    return {
      enabled: displayEnabled,
      token: displayEnabled ? token : null,
    };
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
