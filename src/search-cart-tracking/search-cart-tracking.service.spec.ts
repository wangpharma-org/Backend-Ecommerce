import { Test, TestingModule } from '@nestjs/testing';
import { SearchCartTrackingService } from './search-cart-tracking.service';
import {
  SEARCH_CART_TRACKING_KAFKA_CLIENT,
  SEARCH_CART_TRACKING_TOPIC,
} from './search-cart-tracking.constants';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

describe('SearchCartTrackingService', () => {
  let service: SearchCartTrackingService;
  let kafkaClient: { emit: jest.Mock };
  let featureFlagsService: { getFlag: jest.Mock };

  beforeEach(async () => {
    kafkaClient = { emit: jest.fn() };
    featureFlagsService = { getFlag: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchCartTrackingService,
        { provide: SEARCH_CART_TRACKING_KAFKA_CLIENT, useValue: kafkaClient },
        { provide: FeatureFlagsService, useValue: featureFlagsService },
      ],
    }).compile();

    service = module.get<SearchCartTrackingService>(
      SearchCartTrackingService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitSearchEvent', () => {
    it('emits a search event to Kafka when the feature flag is enabled', async () => {
      jest.useFakeTimers();

      service.emitSearchEvent('MEM001', {
        search_query: 'พารา',
        result_count: 5,
        result_pro_codes: ['P001', 'P002'],
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(featureFlagsService.getFlag).toHaveBeenCalledWith(
        'searchcarttracking',
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        SEARCH_CART_TRACKING_TOPIC,
        expect.objectContaining({
          event: 'search',
          mem_code: 'MEM001',
          search_query: 'พารา',
          result_count: 5,
          result_pro_codes: ['P001', 'P002'],
        }),
      );
    });

    it('still emits when result_count is 0 (zero-result search)', async () => {
      jest.useFakeTimers();

      service.emitSearchEvent('MEM001', {
        search_query: 'zzznotfound123',
        result_count: 0,
        result_pro_codes: [],
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(kafkaClient.emit).toHaveBeenCalledWith(
        SEARCH_CART_TRACKING_TOPIC,
        expect.objectContaining({
          event: 'search',
          search_query: 'zzznotfound123',
          result_count: 0,
          result_pro_codes: [],
        }),
      );
    });

    it('does not emit when the feature flag is disabled', async () => {
      jest.useFakeTimers();
      featureFlagsService.getFlag.mockResolvedValue(false);

      service.emitSearchEvent('MEM001', {
        search_query: 'พารา',
        result_count: 5,
        result_pro_codes: ['P001'],
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });
  });

  describe('emitAddToCartEvent', () => {
    it('includes source and search_query when add-to-cart originates from search', async () => {
      jest.useFakeTimers();

      service.emitAddToCartEvent('MEM001', {
        pro_code: 'P001',
        pro_name: 'พาราเซตามอล',
        pro_unit: 'ขวด',
        amount: 2,
        source: 'search',
        search_query: 'พารา',
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(kafkaClient.emit).toHaveBeenCalledWith(
        SEARCH_CART_TRACKING_TOPIC,
        expect.objectContaining({
          event: 'add_to_cart',
          mem_code: 'MEM001',
          pro_code: 'P001',
          pro_name: 'พาราเซตามอล',
          pro_unit: 'ขวด',
          amount: 2,
          source: 'search',
          search_query: 'พารา',
        }),
      );
    });

    it('omits source and search_query when add-to-cart did not originate from search', async () => {
      jest.useFakeTimers();

      service.emitAddToCartEvent('MEM001', {
        pro_code: 'P001',
        pro_unit: 'ขวด',
        amount: 1,
      });
      await jest.advanceTimersByTimeAsync(0);

      const [, payload] = kafkaClient.emit.mock.calls[0];
      expect(payload.source).toBeUndefined();
      expect(payload.search_query).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('does not throw when the feature flag lookup fails', async () => {
      jest.useFakeTimers();
      featureFlagsService.getFlag.mockRejectedValue(new Error('db down'));

      expect(() =>
        service.emitSearchEvent('MEM001', {
          search_query: 'พารา',
          result_count: 1,
          result_pro_codes: ['P001'],
        }),
      ).not.toThrow();
      await jest.advanceTimersByTimeAsync(0);

      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });

    it('retries with exponential backoff then marks Kafka unavailable after maxRetries', async () => {
      jest.useFakeTimers();
      kafkaClient.emit.mockImplementation(() => {
        throw new Error('kafka unreachable');
      });

      service.emitSearchEvent('MEM001', {
        search_query: 'พารา',
        result_count: 1,
        result_pro_codes: ['P001'],
      });

      // initial attempt + 3 retries with 2s/4s/8s backoff
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);
      await jest.advanceTimersByTimeAsync(8000);

      expect(kafkaClient.emit).toHaveBeenCalledTimes(4);

      // subsequent events are skipped while Kafka is marked unavailable
      kafkaClient.emit.mockClear();
      service.emitSearchEvent('MEM001', {
        search_query: 'ฟ้าทะลายโจร',
        result_count: 2,
        result_pro_codes: ['P002'],
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });
  });
});
