import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LotEntity } from './lot.entity';
import { EntityManager, In, Repository } from 'typeorm';
import { rethrowAsHttp } from 'src/common/http-error.util';

export type LotInput = {
  lot: string;
  mfg: string;
  exp: string;
  pro_code: string;
};

export type LotArrivalInput = LotInput & {
  amount: number; // หน่วยเล็กสุด
  received_at: Date;
};

@Injectable()
export class LotService {
  private readonly logger = new Logger(LotService.name);

  constructor(
    @InjectRepository(LotEntity)
    private readonly lotRepo: Repository<LotEntity>,
  ) {}

  // ECWC-643: สินค้า 1 ตัวมีได้หลาย lot — ข้อมูลที่ส่งมาคือ lot ปัจจุบันทั้งหมดของสินค้านั้น
  // ปิด lot ปัจจุบันของสินค้าทั้งหมดก่อน แล้ว upsert lot ที่ส่งมาให้กลับมาเปิด
  // lot ที่ไม่ได้ส่งมารอบนี้จึงค้างเป็น is_active = false เก็บเป็นประวัติแทนการลบทิ้ง
  async addLots(data: LotInput[]) {
    try {
      if (!data || data.length === 0) return;
      const proCodes = Array.from(new Set(data.map((item) => item.pro_code)));

      return await this.lotRepo.manager.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(LotEntity)
          .set({ is_active: false })
          .where('pro_code IN (:...proCodes)', { proCodes })
          .andWhere('is_active = 1')
          .execute();

        await this.upsertLots(data, manager);

        return manager.find(LotEntity, {
          where: { product: { pro_code: In(proCodes) }, is_active: true },
        });
      });
    } catch (error) {
      rethrowAsHttp(error, this.logger, 'Error Something in addLots');
    }
  }

  // ECWC-643: lot จากสินค้าเข้าใหม่ (new-arrivals) — เพิ่ม/เปิดเฉพาะ lot ที่ส่งมา
  // ไม่ปิด lot อื่นของสินค้า เพราะของเข้ารอบนี้ไม่ได้แปลว่า lot เดิมหมดแล้ว
  // เก็บ amount (หน่วยเล็กสุด) + received_at ไว้ให้ selectCurrentLots ใช้ตัดสินตอนแสดงผล
  //  - lot เดิมที่ยัง active รับเข้าซ้ำ → amount บวกเพิ่ม (ของทั้งสองรอบเป็น lot เดียวกัน)
  //  - lot ที่ถูกปิดไปแล้ว (ประวัติ) รับเข้าใหม่ → amount เริ่มนับใหม่ เพราะของรอบเก่าหมดไปแล้ว
  // เขียน SQL เองเพราะ upsert ของ TypeORM ทำ amount = amount + ใหม่ ไม่ได้
  // รับ manager จาก caller เพื่อให้อยู่ใน transaction เดียวกับการบันทึก new arrival
  async upsertArrivedLots(
    data: LotArrivalInput[],
    manager: EntityManager,
  ): Promise<void> {
    const rows = data
      .map((item) => ({
        ...this.normalize(item),
        amount: item.amount,
        received_at: item.received_at,
      }))
      .filter((row) => row.lot);
    if (rows.length === 0) return;

    // ลำดับใน ON DUPLICATE KEY UPDATE มีผล: amount ต้องอ่าน is_active ค่าเดิมก่อนถูกตั้งเป็น 1
    await manager.query(
      `INSERT INTO \`lot\` (\`pro_code\`, \`lot\`, \`mfg\`, \`exp\`, \`is_active\`, \`amount\`, \`received_at\`)
       VALUES ${rows.map(() => '(?, ?, ?, ?, 1, ?, ?)').join(', ')}
       ON DUPLICATE KEY UPDATE
         \`amount\` = IF(\`is_active\` = 1, COALESCE(\`amount\`, 0) + VALUES(\`amount\`), VALUES(\`amount\`)),
         \`received_at\` = GREATEST(COALESCE(\`received_at\`, VALUES(\`received_at\`)), VALUES(\`received_at\`)),
         \`is_active\` = 1`,
      rows.flatMap((r) => [
        r.pro_code,
        r.lot,
        r.mfg,
        r.exp,
        r.amount,
        r.received_at,
      ]),
    );
  }

  // key = pro_code + lot + mfg + exp (unique index UQ_lot_pro_code_lot_mfg_exp)
  // ซ้ำ → เปิด is_active กลับ, ไม่ซ้ำ → insert ใหม่ (ไม่แตะ amount/received_at)
  private async upsertLots(
    data: LotInput[],
    manager: EntityManager,
  ): Promise<void> {
    const rows = data
      .map((item) => this.normalize(item))
      .filter((row) => row.lot)
      .map(({ pro_code, ...row }) => ({
        ...row,
        is_active: true,
        product: { pro_code },
      }));
    if (rows.length === 0) return;

    await manager.upsert(LotEntity, rows, {
      conflictPaths: ['product', 'lot', 'mfg', 'exp'],
    });
  }

  private normalize(item: LotInput): LotInput {
    return {
      pro_code: item.pro_code,
      lot: item.lot?.trim() ?? '',
      mfg: item.mfg?.trim() ?? '',
      exp: item.exp?.trim() ?? '',
    };
  }
}
