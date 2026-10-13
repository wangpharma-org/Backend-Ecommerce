import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { lastValueFrom } from 'rxjs';
import { IsNull, Not, Repository } from 'typeorm';
import { ProductEntity } from './products.entity';

export const MONTHLY_DEAL_KAFKA_CLIENT = 'MONTHLY_DEAL_KAFKA_SERVICE';
export const MONTHLY_DEAL_TOPIC = 'product_monthly_deal_ecom';

export interface MonthlyDealSnapshotEvent {
  items: {
    pro_code: string;
    pro_promotion_month: number;
    pro_promotion_amount: number;
  }[];
}

@Injectable()
export class MonthlyDealPublisherService {
  private readonly logger = new Logger(MonthlyDealPublisherService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @Inject(MONTHLY_DEAL_KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
  ) {}

  // ส่งดีลประจำเดือนทั้งชุด (ไม่ใช่เฉพาะที่เพิ่งแก้) ให้ฝั่งรับแทนที่ของเดิมได้เลย — event ตกหล่นครั้งหนึ่งก็หายเองในรอบถัดไป
  async publishSnapshot(): Promise<void> {
    try {
      const products = await this.productRepo.find({
        where: { pro_promotion_month: Not(IsNull()) },
        select: {
          pro_code: true,
          pro_promotion_month: true,
          pro_promotion_amount: true,
        },
      });
      const event: MonthlyDealSnapshotEvent = {
        items: products.map((product) => ({
          pro_code: product.pro_code,
          pro_promotion_month: Number(product.pro_promotion_month),
          pro_promotion_amount: Number(product.pro_promotion_amount ?? 0),
        })),
      };
      await lastValueFrom(this.kafkaClient.emit(MONTHLY_DEAL_TOPIC, event));
      this.logger.log(`${MONTHLY_DEAL_TOPIC} emitted: ${event.items.length}`);
    } catch (error: unknown) {
      // ดีลถูกบันทึกลง DB ไปแล้ว — ส่ง event ไม่ได้ไม่ควรทำให้การอัปโหลดล้ม
      this.logger.error(
        `${MONTHLY_DEAL_TOPIC} emit failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
