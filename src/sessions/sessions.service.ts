import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSessionsEntity } from './sessions.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSessionsEntity)
    private readonly sessionsRepository: Repository<UserSessionsEntity>,
  ) {}

  // สร้าง session ใหม่เมื่อ user login
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

  // ค้นหา session ที่ active โดยใช้ session token
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

  // ค้นหา session ทั้งหมดของ user ที่ active
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

  // อัพเดทเวลาการใช้งานล่าสุด
  async updateLastActivity(sessionToken: string): Promise<void> {
    await this.sessionsRepository.update(
      { session_token: sessionToken, is_active: true },
      { last_activity: new Date() },
    );
  }

  // Logout session เดียว
  async logoutSession(sessionToken: string): Promise<void> {
    await this.sessionsRepository.update(
      { session_token: sessionToken },
      {
        is_active: false,
        logout_at: new Date(),
      },
    );
  }

  // Logout session ทั้งหมดของ user
  async logoutAllUserSessions(memCode: string): Promise<void> {
    await this.sessionsRepository.update(
      { mem_code: memCode, is_active: true },
      {
        is_active: false,
        logout_at: new Date(),
      },
    );
  }

  // ลบ session ที่หมดอายุหรือไม่ active (สำหรับ cleanup)
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

  // ตรวจสอบว่า session ยังใช้งานได้หรือไม่
  async isSessionValid(sessionToken: string): Promise<boolean> {
    const session = await this.findActiveSession(sessionToken);
    return session !== null;
  }

  // นับจำนวน session ที่ active ของ user
  async countUserActiveSessions(memCode: string): Promise<number> {
    return await this.sessionsRepository.count({
      where: {
        mem_code: memCode,
        is_active: true,
      },
    });
  }
}
