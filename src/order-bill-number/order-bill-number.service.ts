import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpsertOrderBillNumberDto } from './dto/upsert-order-bill-number.dto';
import { OrderBillNumberEntity } from './order-bill-number.entity';

export interface UpsertOrderBillNumberResult {
  success: true;
  sh_running: string;
  bill_number: string;
}

@Injectable()
export class OrderBillNumberService {
  constructor(
    @InjectRepository(OrderBillNumberEntity)
    private readonly billNumberRepo: Repository<OrderBillNumberEntity>,
  ) {}

  /**
   * ไม่เช็คว่ามีใน shopping_head — บิลบางใบมีเฉพาะฝั่ง order-picking (บิลตกหล่น/เก่า)
   * ดู getOrderStatus ใน order-status-v2.service.ts
   */
  async upsert(
    dto: UpsertOrderBillNumberDto,
  ): Promise<UpsertOrderBillNumberResult> {
    await this.billNumberRepo.upsert(
      { soh_running: dto.sh_running, bill_number: dto.bill_number },
      ['soh_running'],
    );

    return {
      success: true,
      sh_running: dto.sh_running,
      bill_number: dto.bill_number,
    };
  }

  async findBySohRunning(soh_running: string): Promise<string | null> {
    const row = await this.billNumberRepo.findOne({
      where: { soh_running },
      select: { soh_running: true, bill_number: true },
    });
    return row?.bill_number ?? null;
  }
}
