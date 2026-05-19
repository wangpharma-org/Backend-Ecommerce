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
  private isKafkaAvailable = true;
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(
    @Inject(COMPANY_DAY_ANALYTIC_KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {
    this.isKafkaAvailable = true;
    this.logger.log('Company Day Analytics service initialized');
  }

  emitEvent(
    event: CompanyDayAnalyticDto['event'],
    memCode: string,
    context: CompanyDayContextPayload,
  ) {
    setTimeout(() => void this.safeEmitEvent(event, memCode, context), 0);
  }

  private async safeEmitEvent(
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
      if (!this.isKafkaAvailable) {
        this.logger.warn('Kafka analytics unavailable, skipping event');
        return;
      }
      console.log('flag is false so emitting');
      const eventData = {
        ...context,
        mem_code: memCode,
        event: event,
      };
      await this.sendEventWithRetry(eventData);
      this.logger.debug('Company day event emitted successfully');
    } catch (error) {
      this.logger.error('Failed to emit company day event', error);
    }
  }

  private async sendEventWithRetry(eventData: any, attempt = 1): Promise<void> {
    try {
      this.kafkaClient.emit('company_day_analytic', eventData);
      this.retryCount = 0;
      this.isKafkaAvailable = true;
    } catch (error) {
      this.logger.warn(
        `Analytics emit failed (attempt ${attempt}/${this.maxRetries}):`,
        error,
      );
      if (attempt <= this.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendEventWithRetry(eventData, attempt + 1);
      } else {
        this.isKafkaAvailable = false;
        this.retryCount = attempt;
        this.scheduleReconnect();
        throw error;
      }
    }
  }

  private scheduleReconnect() {
    setTimeout(() => {
      this.logger.log('Re-enabling Kafka analytics after cooldown...');
      this.isKafkaAvailable = true;
    }, 60000);
  }
}
