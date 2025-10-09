import { Test, TestingModule } from '@nestjs/testing';
import { ReductionInvoiceService } from './reduction-invoice.service';

describe('ReductionInvoiceService', () => {
  let service: ReductionInvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReductionInvoiceService],
    }).compile();

    service = module.get<ReductionInvoiceService>(ReductionInvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
