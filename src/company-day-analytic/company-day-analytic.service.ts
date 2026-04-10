import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

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
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async emitEvent(
    event: CompanyDayAnalyticDto['event'],
    memCode: string,
    context: CompanyDayContextPayload,
  ) {
    try {
      console.log('emitcalled');
      const isEnabled = await this.featureFlagsService.getFlag('comdayevent');
      if (!isEnabled) {
        this.logger.debug(
          'Company day event disabled by feature flag, skipping emit',
        );
        console.log('flag is true so not emitting');
        return;
      }
      console.log('flag is false so emitting');
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
