import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSessionsEntity } from './sessions.entity';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSessionsEntity)
    private readonly sessionsRepository: Repository<UserSessionsEntity>,
  ) {}

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
        session_token: sessionToken,
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
    await this.sessionsRepository.update(
      { session_token: sessionToken, is_active: true },
      { last_activity: new Date() },
    );
  }

  async logoutSession(sessionToken: string): Promise<void> {
    await this.sessionsRepository.update(
      { session_token: sessionToken },
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
  async logoutRecentUserSessions(
    memCode: string,
    withinMinutes: number,
  ): Promise<void> {
    const cutoff = dayjs().subtract(withinMinutes, 'minute').toDate();
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
