import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { SEARCH_CART_TRACKING_KAFKA_CLIENT } from './search-cart-tracking.constants';
import { SEARCH_CART_TRACKING_TOPIC } from './search-cart-tracking.constants';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

export interface SearchTrackingEvent {
  event: 'search';
  mem_code: string;
  search_query: string;
  result_count: number;
  result_pro_codes: string[];
  created_at: string;
}

export interface AddToCartTrackingEvent {
  event: 'add_to_cart';
  mem_code: string;
  pro_code: string;
  pro_name?: string;
  pro_unit: string;
  amount: number;
  source?: string;
  search_query?: string;
  created_at: string;
}

export type SearchCartTrackingEvent =
  | SearchTrackingEvent
  | AddToCartTrackingEvent;

@Injectable()
export class SearchCartTrackingService {
  private readonly logger = new Logger(SearchCartTrackingService.name);
  private isKafkaAvailable = true;
  private readonly maxRetries = 3;

  constructor(
    @Inject(SEARCH_CART_TRACKING_KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  emitSearchEvent(
    memCode: string,
    payload: {
      search_query: string;
      result_count: number;
      result_pro_codes: string[];
    },
  ) {
    const eventData: SearchTrackingEvent = {
      event: 'search',
      mem_code: memCode,
      search_query: payload.search_query,
      result_count: payload.result_count,
      result_pro_codes: payload.result_pro_codes,
      created_at: new Date().toISOString(),
    };
    setTimeout(() => void this.safeEmitEvent(eventData), 0);
  }

  emitAddToCartEvent(
    memCode: string,
    payload: {
      pro_code: string;
      pro_name?: string;
      pro_unit: string;
      amount: number;
      source?: string;
      search_query?: string;
    },
  ) {
    const eventData: AddToCartTrackingEvent = {
      event: 'add_to_cart',
      mem_code: memCode,
      pro_code: payload.pro_code,
      pro_name: payload.pro_name,
      pro_unit: payload.pro_unit,
      amount: payload.amount,
      source: payload.source,
      search_query: payload.search_query,
      created_at: new Date().toISOString(),
    };
    setTimeout(() => void this.safeEmitEvent(eventData), 0);
  }

  private async safeEmitEvent(eventData: SearchCartTrackingEvent) {
    try {
      const isEnabled =
        await this.featureFlagsService.getFlag('searchcarttracking');
      if (!isEnabled) {
        this.logger.debug(
          'Search/cart tracking disabled by feature flag, skipping emit',
        );
        return;
      }
      if (!this.isKafkaAvailable) {
        this.logger.warn(
          'Kafka search/cart tracking unavailable, skipping event',
        );
        return;
      }
      await this.sendEventWithRetry(eventData);
    } catch (error) {
      this.logger.error('Failed to emit search/cart tracking event', error);
    }
  }

  private async sendEventWithRetry(
    eventData: SearchCartTrackingEvent,
    attempt = 1,
  ): Promise<void> {
    try {
      this.kafkaClient.emit(SEARCH_CART_TRACKING_TOPIC, eventData);
      this.isKafkaAvailable = true;
    } catch (error) {
      this.logger.warn(
        `Search/cart tracking emit failed (attempt ${attempt}/${this.maxRetries}):`,
        error,
      );
      if (attempt <= this.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendEventWithRetry(eventData, attempt + 1);
      } else {
        this.isKafkaAvailable = false;
        this.scheduleReconnect();
        throw error;
      }
    }
  }

  private scheduleReconnect() {
    setTimeout(() => {
      this.logger.log(
        'Re-enabling Kafka search/cart tracking after cooldown...',
      );
      this.isKafkaAvailable = true;
    }, 60000);
  }
}
