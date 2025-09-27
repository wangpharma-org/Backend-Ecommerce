import { Test, TestingModule } from '@nestjs/testing';
import { NewArrivalsService } from './new-arrivals.service';

describe('NewArrivalsService', () => {
  let service: NewArrivalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NewArrivalsService],
    }).compile();

    service = module.get<NewArrivalsService>(NewArrivalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
