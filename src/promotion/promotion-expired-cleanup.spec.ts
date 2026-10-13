import { Repository } from 'typeorm';
import { PromotionService } from './promotion.service';
import { PromotionEntity } from './promotion.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';

describe('PromotionService.cronCleanupExpiredPromotions', () => {
  it('clears cart rewards of expired promotions but does not delete the promotion (admin deletes it)', async () => {
    const promotionRepo = {
      find: jest.fn().mockResolvedValue([{ promo_id: 7 }]),
      softDelete: jest.fn(),
      delete: jest.fn(),
    };
    const cartRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PromotionService(
      promotionRepo as unknown as Repository<PromotionEntity>,
      {} as never,
      cartRepo as unknown as Repository<ShoppingCartEntity>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.cronCleanupExpiredPromotions();

    expect(cartRepo.update).toHaveBeenCalledWith(
      { use_code: false, promo_id: 7 },
      expect.objectContaining({ spc_checked: false }),
    );
    expect(promotionRepo.softDelete).not.toHaveBeenCalled();
    expect(promotionRepo.delete).not.toHaveBeenCalled();
  });
});
