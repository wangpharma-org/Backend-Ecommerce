import { Test, TestingModule } from '@nestjs/testing';
import { HotdealService } from './hotdeal.service';

describe('HotdealService', () => {
  let service: HotdealService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HotdealService],
    }).compile();

    service = module.get<HotdealService>(HotdealService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
