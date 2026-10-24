import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from '../failed-api/feature_flag.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FeatureFlagLogEntity } from './feature-flag-log.entity';
import { rethrowAsHttp } from '../common/http-error.util';

/** ผู้เปลี่ยน flag (มาจาก token) — ECWC-749 */
export interface FeatureFlagActor {
  mem_code: string;
  username?: string | null;
  role?: string | null;
}

// ECWC-545: flag เหล่านี้ต้อง default ปิดไว้ก่อนเสมอถ้ายังไม่เคย seed มาก่อน (รอ QA เทียบ response
// กับแอปจริง) — ต่างจาก flag อื่นๆ ในระบบที่ default ให้เปิด (is_enabled: true) ตาม behavior เดิม
const DEFAULT_DISABLED_FLAGS = new Set([
  'new_order_list_api',
  'new_order_detail_api',
  // ECWC-643: lot ในหน้ารายละเอียดสินค้าเป็นของใหม่ — ปิดไว้จนกว่าแอดมินจะเปิดเอง
  // (lot_display_cart ไม่อยู่ในนี้ เพราะตะกร้าแสดง lot อยู่แล้ว default เปิดเหมือนเดิม)
  'lot_display_product_detail',
  // ECWC-697: สติ๊กเกอร์ฉลากยา — เปิดเมื่อ ERP สร้างสินค้า -05/-07 และราคาพร้อม
  'sticker_label',
  // ECWC-617: แสดงชื่อร้านต้องรอเซ็น LIA + สเปกความยินยอมก่อน
  'store_name_consent',
]);

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly flagRepo: Repository<FeatureFlagEntity>,
    @InjectRepository(FeatureFlagLogEntity)
    private readonly logRepo: Repository<FeatureFlagLogEntity>,
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

  async updateFlag(
    data: { flag: string; status: boolean },
    actor?: FeatureFlagActor,
  ) {
    let oldValue: boolean | null;
    try {
      const existing = await this.flagRepo.findOne({
        where: { feature_key: data.flag },
      });
      oldValue = existing ? existing.is_enabled : null;
      if (existing) {
        await this.flagRepo.update(
          { feature_key: data.flag },
          { is_enabled: data.status },
        );
      } else {
        // ไม่มี flag นี้อยู่ก่อน — insert ใหม่แทนที่จะปล่อยให้ update เงียบๆ ไม่มีผลอะไร
        await this.flagRepo.save(
          this.flagRepo.create({
            feature_key: data.flag,
            is_enabled: data.status,
          }),
        );
      }
    } catch (error) {
      rethrowAsHttp(error, this.logger, 'Error in updateFlag');
    }
    if (actor) await this.logChange(data, oldValue, actor);
    return 'Success';
  }

  /// ECWC-749: บันทึกทุกครั้งที่มีคนตั้งค่า flag (รวมตั้งค่าเดิมซ้ำ) — บันทึกไม่สำเร็จไม่ทำให้การตั้งค่าล้ม
  /// (กลางเหตุการณ์ต้องปิด/เปิด flag ได้เสมอ) แต่ log ระดับ error ให้เห็น
  private async logChange(
    data: { flag: string; status: boolean },
    oldValue: boolean | null,
    actor: FeatureFlagActor,
  ): Promise<void> {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          feature_key: data.flag,
          old_value: oldValue,
          new_value: data.status,
          actor_mem_code: actor.mem_code,
          actor_username: actor.username ?? null,
          actor_role: actor.role ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(
        `feature_flag_log save failed (${data.flag} → ${String(data.status)} by ${actor.mem_code})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getChangeLogs(flag: string | undefined, limit: number) {
    return this.logRepo.find({
      where: flag ? { feature_key: flag } : {},
      order: { created_at: 'DESC', id: 'DESC' },
      take: limit,
    });
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
