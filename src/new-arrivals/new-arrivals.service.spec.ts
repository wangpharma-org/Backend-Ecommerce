import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NewArrivalsService } from './new-arrivals.service';
import { NewArrival } from './new-arrival.entity';
import { UserEntity } from 'src/users/users.entity';
import { PreorderService } from 'src/preorder/preorder.service';

describe('NewArrivalsService', () => {
  let service: NewArrivalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewArrivalsService,
        { provide: getRepositoryToken(NewArrival), useValue: {} },
        { provide: getRepositoryToken(UserEntity), useValue: {} },
        { provide: 'OrderPickingService', useValue: { emit: jest.fn() } },
        {
          provide: PreorderService,
          useValue: { handleArrivals: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<NewArrivalsService>(NewArrivalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
