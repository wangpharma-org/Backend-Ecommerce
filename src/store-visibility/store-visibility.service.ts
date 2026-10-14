import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  CustomerStoreVisibilityEntity,
  StoreVisibilityStatus,
} from './customer-store-visibility.entity';
import {
  CustomerStoreVisibilityLogEntity,
  StoreVisibilityChannel,
  StoreVisibilityLogAction,
} from './customer-store-visibility-log.entity';
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  ConsentText,
  consentTextHash,
} from './store-visibility.consent';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

// เพดานจำนวนครั้งที่เอาการ์ดขอความยินยอมไปแสดงกับคนที่ไม่ตอบ — ถามเกินนี้คือรบกวน
export const MAX_ASK_COUNT = 3;

// ECWC-617: ปิดไว้จนกว่าจะเซ็น LIA + สเปกความยินยอม — ระหว่างปิดไม่ถาม ไม่รับคำตอบ
// และไม่แสดงชื่อร้านของใครเลย (ถือว่าทุกร้านยังไม่ยินยอม)
export const STORE_NAME_CONSENT_FLAG = 'store_name_consent';

export interface StoreVisibilityLogContext {
  channel: StoreVisibilityChannel;
  ip: string | null;
  user_agent: string | null;
}

export interface StoreVisibilitySetting {
  // flag store_name_consent — frontend/แอปซ่อนการ์ดและหน้าตั้งค่าเมื่อเป็น false
  enabled: boolean;
  status: StoreVisibilityStatus;
  // เก็บ field เดิมไว้ให้ frontend/แอปที่ยังอ่านค่านี้อยู่ไม่พัง
  show_store_name: boolean;
  should_ask: boolean;
  asked_count: number;
  consent: ConsentText;
}

interface VisibilityState {
  status: StoreVisibilityStatus;
  consent_version: number | null;
  asked_count: number;
}

const NOT_ASKED: VisibilityState = {
  status: 'NOT_ASKED',
  consent_version: null,
  asked_count: 0,
};

@Injectable()
export class StoreVisibilityService {
  constructor(
    @InjectRepository(CustomerStoreVisibilityEntity)
    private readonly visibilityRepo: Repository<CustomerStoreVisibilityEntity>,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async getSetting(mem_code: string): Promise<StoreVisibilitySetting> {
    const [enabled, row] = await Promise.all([
      this.isEnabled(),
      this.visibilityRepo.findOne({ where: { mem_code } }),
    ]);
    return this.toSetting(row ?? NOT_ASKED, enabled);
  }

  // สถานะกับ log ต้องเขียนใน transaction เดียว — ห้ามมีสถานะที่เปลี่ยนแล้วไม่มีหลักฐาน
  async setSetting(
    mem_code: string,
    show_store_name: boolean,
    context: StoreVisibilityLogContext,
  ): Promise<StoreVisibilitySetting> {
    await this.assertEnabled();
    return this.visibilityRepo.manager.transaction(async (manager) => {
      const current = await this.lockState(manager, mem_code);
      const next: VisibilityState = show_store_name
        ? {
            status: 'GRANTED',
            consent_version: CONSENT_VERSION,
            asked_count: current.asked_count,
          }
        : {
            status: 'DECLINED',
            consent_version: null,
            asked_count: current.asked_count,
          };

      const action = this.resolveAction(current, show_store_name);
      // กดซ้ำค่าเดิม = ไม่มีอะไรเปลี่ยน ไม่ต้องเขียน log ให้รก
      if (!action) return this.toSetting(current);

      await manager.upsert(
        CustomerStoreVisibilityEntity,
        { mem_code, ...next },
        ['mem_code'],
      );
      await this.writeLog(manager, mem_code, action, context);
      return this.toSetting(next);
    });
  }

  // ECWC-600: เอาการ์ดไปแสดงแล้วลูกค้าปัดทิ้ง — นับไว้เพื่อหยุดถามเมื่อครบเพดาน
  async markAsked(
    mem_code: string,
    context: StoreVisibilityLogContext,
  ): Promise<StoreVisibilitySetting> {
    await this.assertEnabled();
    return this.visibilityRepo.manager.transaction(async (manager) => {
      const current = await this.lockState(manager, mem_code);
      // ตอบไปแล้ว (ไม่ว่าตอบอะไร) หรือถามครบเพดานแล้ว → ไม่นับเพิ่ม ไม่ log
      if (!this.shouldAsk(current)) return this.toSetting(current);

      const next: VisibilityState = {
        ...current,
        asked_count: current.asked_count + 1,
      };
      await manager.upsert(
        CustomerStoreVisibilityEntity,
        { mem_code, ...next },
        ['mem_code'],
      );
      await this.writeLog(manager, mem_code, 'ASKED', context);
      return this.toSetting(next);
    });
  }

  // ร้านไหนในรายการยอมให้คนอื่นเห็นชื่อร้าน — ความยินยอมที่ผูกกับข้อความเวอร์ชันเก่าไม่นับ
  async findVisibleMemCodes(memCodes: string[]): Promise<Set<string>> {
    if (memCodes.length === 0) return new Set();
    if (!(await this.isEnabled())) return new Set();
    const rows = await this.visibilityRepo.find({
      where: {
        mem_code: In(memCodes),
        status: 'GRANTED',
        consent_version: CONSENT_VERSION,
      },
      select: { mem_code: true },
    });
    return new Set(rows.map((r) => r.mem_code));
  }

  private isEnabled(): Promise<boolean> {
    return this.featureFlags.getFlag(STORE_NAME_CONSENT_FLAG);
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new ForbiddenException('ฟีเจอร์แสดงชื่อร้านยังไม่เปิดใช้งาน');
    }
  }

  private async lockState(
    manager: EntityManager,
    mem_code: string,
  ): Promise<VisibilityState> {
    const row = await manager.findOne(CustomerStoreVisibilityEntity, {
      where: { mem_code },
      lock: { mode: 'pessimistic_write' },
    });
    return row
      ? {
          status: row.status,
          consent_version: row.consent_version,
          asked_count: row.asked_count,
        }
      : NOT_ASKED;
  }

  // null = ไม่มีอะไรเปลี่ยน (กดค่าเดิมซ้ำ)
  private resolveAction(
    current: VisibilityState,
    show_store_name: boolean,
  ): StoreVisibilityLogAction | null {
    if (show_store_name) {
      return this.isGranted(current) ? null : 'GRANTED';
    }
    if (current.status === 'DECLINED') return null;
    // เคยเปิดไว้แล้วมาปิด = ถอนความยินยอม ต้องแยกจากการปฏิเสธตั้งแต่แรก
    return current.status === 'GRANTED' ? 'WITHDRAWN' : 'DECLINED';
  }

  // ยินยอมจริงต้องเป็นข้อความเวอร์ชันปัจจุบันเท่านั้น
  private isGranted(state: VisibilityState): boolean {
    return (
      state.status === 'GRANTED' && state.consent_version === CONSENT_VERSION
    );
  }

  // ยังไม่ปฏิเสธ ยังไม่ยินยอม (หรือยินยอมไว้กับข้อความเวอร์ชันเก่า) และยังถามไม่ครบเพดาน
  private shouldAsk(state: VisibilityState): boolean {
    if (state.status === 'DECLINED') return false;
    if (this.isGranted(state)) return false;
    return state.asked_count < MAX_ASK_COUNT;
  }

  private async writeLog(
    manager: EntityManager,
    mem_code: string,
    action: StoreVisibilityLogAction,
    context: StoreVisibilityLogContext,
  ): Promise<void> {
    await manager.insert(CustomerStoreVisibilityLogEntity, {
      mem_code,
      action,
      consent_version: CONSENT_VERSION,
      text_hash: consentTextHash(),
      channel: context.channel,
      ip: context.ip,
      user_agent: context.user_agent,
    });
  }

  // enabled = true ในเส้นที่ผ่าน assertEnabled มาแล้ว
  private toSetting(
    state: VisibilityState,
    enabled = true,
  ): StoreVisibilitySetting {
    return {
      enabled,
      status: state.status,
      show_store_name: enabled && this.isGranted(state),
      should_ask: enabled && this.shouldAsk(state),
      asked_count: state.asked_count,
      consent: CONSENT_TEXT,
    };
  }
}
