import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { UserEntity } from '../users/users.entity';

export interface LineOaMemberDto {
  mem_code: string;
  mem_nameSite: string | null;
  emp_id_ref: string | null;
  isRegistered: boolean;
}

export interface LineOaMonitorResponse {
  total: number;
  registered: number;
  unregistered: number;
  members: LineOaMemberDto[];
}

@Injectable()
export class LineOaMonitorService {
  private readonly notificationServiceUrl =
    process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async getMonitorData(): Promise<LineOaMonitorResponse> {
    const [registeredResult, users] = await Promise.all([
      axios.get<{ memCodes: string[] }>(
        `${this.notificationServiceUrl}/api/notifications/admin/users/line-registered`,
      ),
      this.userRepo.find({
        select: {
          mem_code: true,
          mem_nameSite: true,
          emp_id_ref: true,
        },
      }),
    ]);

    const registeredSet = new Set(registeredResult.data.memCodes);

    const members: LineOaMemberDto[] = users.map((u) => ({
      mem_code: u.mem_code,
      mem_nameSite: u.mem_nameSite,
      emp_id_ref: u.emp_id_ref,
      isRegistered: registeredSet.has(u.mem_code),
    }));

    return {
      total: members.length,
      registered: members.filter((m) => m.isRegistered).length,
      unregistered: members.filter((m) => !m.isRegistered).length,
      members,
    };
  }
}
