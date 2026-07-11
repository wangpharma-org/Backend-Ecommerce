import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSessionsEntity } from './sessions.entity';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { createHash } from 'crypto';
import { ExpireSessionResponse } from '../auth/auth.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const UPDATE_LAST_ACTIVITY_FLAG = 'session_update_last_activity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSessionsEntity)
    private readonly sessionsRepository: Repository<UserSessionsEntity>,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  // ค้นหาด้วย hash แทน session_token ตรงๆ — คอลัมน์เดิมยาว 1024 ทำ index เต็มไม่ได้ (ECWC-381)
  private hashToken(sessionToken: string): string {
    return createHash('sha256').update(sessionToken).digest('hex');
  }

  async createSession(
    memCode: string,
    sessionToken: string,
    ipAddress?: string,
    userAgent?: string,
    deviceType?: string,
  ): Promise<UserSessionsEntity> {
    const session = this.sessionsRepository.create({
      mem_code: memCode,
      session_token: sessionToken,
      token_hash: this.hashToken(sessionToken),
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: deviceType,
      login_at: new Date(),
      last_activity: new Date(),
      is_active: true,
    });

    return await this.sessionsRepository.save(session);
  }

  async findActiveSession(
    sessionToken: string,
  ): Promise<UserSessionsEntity | null> {
    return await this.sessionsRepository.findOne({
      where: {
        token_hash: this.hashToken(sessionToken),
        is_active: true,
      },
      relations: ['user'],
    });
  }

  async findUserActiveSessions(memCode: string): Promise<UserSessionsEntity[]> {
    return await this.sessionsRepository.find({
      where: {
        mem_code: memCode,
        is_active: true,
      },
      order: {
        login_at: 'DESC',
      },
    });
  }

  async updateLastActivity(sessionToken: string): Promise<void> {
    const isEnabled = await this.featureFlagsService.getFlag(
      UPDATE_LAST_ACTIVITY_FLAG,
    );
    if (!isEnabled) {
      return;
    }

    await this.sessionsRepository.update(
      { token_hash: this.hashToken(sessionToken), is_active: true },
      { last_activity: new Date() },
    );
  }

  async logoutSession(sessionToken: string): Promise<void> {
    await this.sessionsRepository.update(
      { token_hash: this.hashToken(sessionToken) },
      {
        is_active: false,
        logout_at: new Date(),
      },
    );
  }

  async logoutAllUserSessions(memCode: string): Promise<void> {
    await this.sessionsRepository.update(
      { mem_code: memCode, is_active: true },
      {
        is_active: false,
        logout_at: new Date(),
      },
    );
  }

  // Logs out only sessions that are still actively refreshing (last_activity
  // within `withinMinutes`), instead of every session for the user. The
  // client refreshes its token every 15 minutes, so idle sessions older than
  // that will pick up the new role/permissions on their own next refresh.
  async logoutRecentUserSessions(memCode: string): Promise<void> {
    const cutoff = dayjs().subtract(ExpireSessionResponse, 'minute').toDate();
    await this.sessionsRepository
      .createQueryBuilder()
      .update(UserSessionsEntity)
      .set({ is_active: false, logout_at: new Date() })
      .where('mem_code = :memCode', { memCode })
      .andWhere('is_active = :isActive', { isActive: true })
      .andWhere('last_activity >= :cutoff', { cutoff })
      .execute();
  }

  @Cron('0 0 * * *')
  async cleanupInactiveSessions(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.sessionsRepository
      .createQueryBuilder()
      .delete()
      .where('is_active = :isActive', { isActive: false })
      .andWhere('logout_at < :cutoffDate', { cutoffDate })
      .execute();
  }

  async isSessionValid(sessionToken: string): Promise<boolean> {
    const session = await this.findActiveSession(sessionToken);
    return session !== null;
  }

  async countUserActiveSessions(memCode: string): Promise<number> {
    return await this.sessionsRepository.count({
      where: {
        mem_code: memCode,
        is_active: true,
      },
    });
  }
}
