import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';

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
  ) {}

  emitEvent(
    event: CompanyDayAnalyticDto['event'],
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
      this.kafkaClient.emit('company_day_analytic', eventData);
      this.logger.debug('Company day event emitted successfully');
    } catch (error) {
      this.logger.error('Failed to emit company day event', error);
    }
  }
}
