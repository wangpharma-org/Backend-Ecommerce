import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from '../failed-api/feature_flag.entity';
import { InjectRepository } from '@nestjs/typeorm';

// ECWC-545: flag เหล่านี้ต้อง default ปิดไว้ก่อนเสมอถ้ายังไม่เคย seed มาก่อน (รอ QA เทียบ response
// กับแอปจริง) — ต่างจาก flag อื่นๆ ในระบบที่ default ให้เปิด (is_enabled: true) ตาม behavior เดิม
const DEFAULT_DISABLED_FLAGS = new Set([
  'new_order_list_api',
  'new_order_detail_api',
]);

@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly flagRepo: Repository<FeatureFlagEntity>,
  ) {}

  async getFlag(flag: string) {
    try {
      const status = await this.flagRepo.findOne({
        where: {
          feature_key: flag,
        },
      });
      if (status) {
        return status.is_enabled;
      } else {
        const status = this.flagRepo.create({
          feature_key: flag,
          is_enabled: !DEFAULT_DISABLED_FLAGS.has(flag),
        });
        await this.flagRepo.save(status);
        return status.is_enabled;
      }
    } catch {
      throw new Error('Something Error in getFlag');
    }
  }

  async updateFlag(data: { flag: string; status: boolean }) {
    try {
      const result = await this.flagRepo.update(
        {
          feature_key: data.flag,
        },
        {
          is_enabled: data.status,
        },
      );
      // UpdateResult เป็น object เสมอไม่ว่าจะอัปเดตกี่แถว ต้องเช็ค affected ไม่ใช่ truthiness ของ
      // ตัว result เอง (บั๊กเดิม: if (status) เป็นจริงเสมอ รายงาน Success ทั้งที่ 0 แถวถูกอัปเดต)
      if (result.affected && result.affected > 0) {
        return 'Success';
      }
      // ไม่มี flag นี้อยู่ก่อน — insert ใหม่แทนที่จะปล่อยให้ update เงียบๆ ไม่มีผลอะไร
      const created = this.flagRepo.create({
        feature_key: data.flag,
        is_enabled: data.status,
      });
      await this.flagRepo.save(created);
      return 'Success';
    } catch {
      throw new Error('Something Error in updateFlag');
    }
  }

  async getAllFlags() {
    try {
      const flags = await this.flagRepo.find({
        order: {
          feature_key: 'ASC',
        },
      });
      return flags;
    } catch {
      throw new Error('Something Error in getAllFlags');
    }
  }
}
