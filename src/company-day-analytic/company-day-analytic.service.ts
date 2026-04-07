import { Inject, Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ClientKafka } from '@nestjs/microservices';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';
import { PromotionService } from '../promotion/promotion.service';

export interface CompanyDayAnalyticDto {
  promo_id: number;
  promo_name: string;
  event: 'view' | 'addcart' | 'purchase';
  source: string;
  tier: string;
  mem_code: string;
}

export interface CompanyDayContextPayload {
  promo_id: number;
  promo_name: string;
  tier: string;
  source: string;
}

@Injectable()
export class CompanyDayAnalyticService {
  private readonly logger = new Logger(CompanyDayAnalyticService.name);

  constructor(
    @Inject(COMPANY_DAY_ANALYTIC_KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
    private readonly promotionService: PromotionService,
  ) {}

  async emitEvent(
    event: string,
    memCode: string,
    context: CompanyDayContextPayload,
  ) {
    this.logger.debug(`Emitting company day event: ${JSON.stringify(event)}`);
    try {
      const eventData = {
        ...context,
        mem_code: memCode,
        event: event,
      };
      await firstValueFrom(
        this.kafkaClient.emit('company_day_analytic', eventData),
      );
      this.logger.debug('Company day event emitted successfully');
    } catch (error) {
      this.logger.error('Failed to emit company day event', error);
    }
  }

}
