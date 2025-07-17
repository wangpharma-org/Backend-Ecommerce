import { Test, TestingModule } from '@nestjs/testing';
import { ShoppingOrderService } from './shopping-order.service';

describe('ShoppingOrderService', () => {
  let service: ShoppingOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShoppingOrderService],
    }).compile();

    service = module.get<ShoppingOrderService>(ShoppingOrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
