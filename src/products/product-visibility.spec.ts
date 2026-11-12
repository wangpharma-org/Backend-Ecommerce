import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { isHiddenProduct, visibleProductSql } from './product-visibility.util';
import { DeleteCartEntity } from 'src/shopping-cart/delete-cart.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';

// WGDD-428: งดแสดงสินค้าบนหน้าร้าน
describe('WGDD-428 product visibility', () => {
  describe('util', () => {
    it('builds a null-safe SQL condition for the given alias', () => {
      expect(visibleProductSql('p')).toBe(
        '(p.pro_hidden = 0 OR p.pro_hidden IS NULL)',
      );
    });

    it('treats tinyint 1 / true as hidden and missing as visible', () => {
      expect(isHiddenProduct({ pro_hidden: 1 })).toBe(true);
      expect(isHiddenProduct({ pro_hidden: true })).toBe(true);
      expect(isHiddenProduct({ pro_hidden: 0 })).toBe(false);
      expect(isHiddenProduct(null)).toBe(false);
    });
  });

  describe('ProductsService.updateProductFromEasyAcc', () => {
    const createService = (existing: Record<string, unknown>) => {
      const productRepo = {
        findOne: jest.fn(() => Promise.resolve({ ...existing })),
        update: jest.fn(() => Promise.resolve({ affected: 1 })),
      };
      const elasticsearchService = {
        updateProductDoc: jest.fn(() => Promise.resolve()),
      };
      const removeHiddenProductFromCarts = jest.fn(() => Promise.resolve());
      const service: ProductsService = Object.assign(
        Object.create(ProductsService.prototype) as ProductsService,
        {
          productRepo,
          productUnitRepo: { find: jest.fn(() => Promise.resolve([])) },
          elasticsearchService,
          removeHiddenProductFromCarts,
          logger: { warn: jest.fn(), error: jest.fn() },
        },
      );
      return {
        service,
        productRepo,
        elasticsearchService,
        removeHiddenProductFromCarts,
      };
    };

    it('maps is_display=false to pro_hidden and clears carts once', async () => {
      const {
        service,
        productRepo,
        elasticsearchService,
        removeHiddenProductFromCarts,
      } = createService({ pro_code: 'A001', pro_hidden: false });

      await service.updateProductFromEasyAcc({
        product_code: 'A001',
        is_display: false,
      });

      expect(productRepo.update).toHaveBeenCalledWith(
        { pro_code: 'A001' },
        expect.objectContaining({ pro_hidden: true }),
      );
      expect(elasticsearchService.updateProductDoc).toHaveBeenCalledWith(
        'A001',
        { pro_hidden: true },
      );
      expect(removeHiddenProductFromCarts).toHaveBeenCalledWith('A001');
    });

    it('does not touch carts when the product was already hidden or is shown again', async () => {
      const hidden = createService({ pro_code: 'A001', pro_hidden: true });
      await hidden.service.updateProductFromEasyAcc({
        product_code: 'A001',
        is_display: false,
      });
      expect(hidden.removeHiddenProductFromCarts).not.toHaveBeenCalled();

      const shown = createService({ pro_code: 'A001', pro_hidden: true });
      await shown.service.updateProductFromEasyAcc({
        product_code: 'A001',
        is_display: true,
      });
      expect(shown.productRepo.update).toHaveBeenCalledWith(
        { pro_code: 'A001' },
        expect.objectContaining({ pro_hidden: false }),
      );
      expect(shown.removeHiddenProductFromCarts).not.toHaveBeenCalled();
    });

    it('leaves pro_hidden alone when is_display is not sent', async () => {
      const { service, productRepo } = createService({
        pro_code: 'A001',
        pro_hidden: true,
      });

      await service.updateProductFromEasyAcc({
        product_code: 'A001',
        product_name: 'renamed',
      });

      expect(productRepo.update).toHaveBeenCalledWith(
        { pro_code: 'A001' },
        expect.objectContaining({ pro_hidden: true, pro_name: 'renamed' }),
      );
    });
  });

  describe('ProductsService.getVisibleProductOne', () => {
    it('returns 404 for a hidden product', async () => {
      const service: ProductsService = Object.assign(
        Object.create(ProductsService.prototype) as ProductsService,
        {
          productRepo: {
            findOne: jest.fn(() =>
              Promise.resolve({ pro_code: 'A001', pro_hidden: true }),
            ),
          },
        },
      );

      await expect(service.getVisibleProductOne('A001')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('ShoppingCartService', () => {
    const queryBuilder = (rows: unknown[]) => {
      const qb: Record<string, jest.Mock> = {};
      for (const method of [
        'innerJoin',
        'select',
        'where',
        'andWhere',
        'delete',
        'from',
      ]) {
        qb[method] = jest.fn(() => qb);
      }
      qb.getMany = jest.fn(() => Promise.resolve(rows));
      qb.execute = jest.fn(() => Promise.resolve({ affected: 1 }));
      return qb;
    };

    it('removes hidden products from the cart and records a hidden notice', async () => {
      const rows = [
        {
          spc_id: 10,
          pro_code: 'A001',
          spc_unit_enum: '1',
          product: { pro_code: 'A001', pro_name: 'ยา A', pro_imgmain: 'a.jpg' },
        },
      ];
      const saveNotices = jest.fn(() => Promise.resolve());
      const deleteRows = jest.fn(() => Promise.resolve());
      const freebieQb = queryBuilder([]);
      const manager = {
        getRepository: jest.fn((entity: unknown) =>
          entity === DeleteCartEntity
            ? { save: saveNotices }
            : entity === ShoppingCartEntity
              ? { delete: deleteRows }
              : undefined,
        ),
        createQueryBuilder: jest.fn(() => freebieQb),
      };
      const incrementCartVersion = jest.fn(() => Promise.resolve());
      const checkPromotionReward = jest.fn(() => Promise.resolve());
      const service: ShoppingCartService = Object.assign(
        Object.create(ShoppingCartService.prototype) as ShoppingCartService,
        {
          shoppingCartRepo: {
            createQueryBuilder: () => queryBuilder(rows),
            manager: {
              transaction: (cb: (m: typeof manager) => Promise<void>) =>
                cb(manager),
            },
          },
          deleteCartRepo: { create: jest.fn((value: unknown) => value) },
          userRepo: {
            findOne: jest.fn(() => Promise.resolve({ mem_price: 'B' })),
          },
          incrementCartVersion,
          checkPromotionReward,
        },
      );

      await expect(service.removeHiddenItemsFromCart('M001')).resolves.toBe(
        true,
      );

      expect(saveNotices).toHaveBeenCalledWith([
        {
          mem_code: 'M001',
          product: { pro_code: 'A001' },
          data: {
            pro_imgmain: 'a.jpg',
            pro_name: 'ยา A',
            pro_unit_level: '1',
            reason: 'hidden',
          },
        },
      ]);
      expect(deleteRows).toHaveBeenCalled();
      expect(freebieQb.andWhere).toHaveBeenCalledWith(
        'hotdeal_promain IN (:...hiddenCodes)',
        { hiddenCodes: ['A001'] },
      );
      expect(incrementCartVersion).toHaveBeenCalledWith('M001');
      expect(checkPromotionReward).toHaveBeenCalledWith('M001', 'B');
    });

    it('does nothing when the cart has no hidden products', async () => {
      const incrementCartVersion = jest.fn();
      const service: ShoppingCartService = Object.assign(
        Object.create(ShoppingCartService.prototype) as ShoppingCartService,
        {
          shoppingCartRepo: { createQueryBuilder: () => queryBuilder([]) },
          incrementCartVersion,
        },
      );

      await expect(service.removeHiddenItemsFromCart('M001')).resolves.toBe(
        false,
      );
      expect(incrementCartVersion).not.toHaveBeenCalled();
    });

    it('rejects adding a hidden product with 404', async () => {
      const service: ShoppingCartService = Object.assign(
        Object.create(ShoppingCartService.prototype) as ShoppingCartService,
        {
          productRepo: {
            findOne: jest.fn(() =>
              Promise.resolve({ pro_code: 'A001', pro_hidden: true }),
            ),
          },
        },
      );

      await expect(
        (
          service as unknown as {
            ensureProductVisible: (code: string) => Promise<void>;
          }
        ).ensureProductVisible('A001'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
