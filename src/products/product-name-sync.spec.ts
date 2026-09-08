import { ProductsService } from './products.service';

describe('ECWC-421 Thai-name Kafka consumer', () => {
  const setup = () => {
    const product = {
      pro_code: 'P001',
      pro_name: 'EasyAcc original',
      pro_nameTH: 'ชื่อเดิม',
      pro_priceA: 50,
      pro_stock: 10,
    };
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const updateProductDoc = jest.fn().mockResolvedValue(undefined);
    const service: ProductsService = Object.assign(
      Object.create(ProductsService.prototype) as ProductsService,
      {
        productRepo: { findOne: jest.fn().mockResolvedValue(product), update },
        productUnitRepo: { find: jest.fn().mockResolvedValue([]) },
        elasticsearchService: { updateProductDoc },
        logger: { error: jest.fn(), warn: jest.fn() },
      },
    );
    return { product, service, update, updateProductDoc };
  };

  it.each(['ชื่อใหม่', '', '   ', null])(
    'updates Thai names in the database and search index (%s)',
    async (name) => {
      const { service, update, updateProductDoc } = setup();
      await service.updateProductFromEasyAcc({
        product_code: 'P001',
        product_nameTH: name,
      });
      expect(update).toHaveBeenCalledWith(
        { pro_code: 'P001' },
        expect.objectContaining({
          pro_nameTH: name,
          pro_name: 'EasyAcc original',
          pro_priceA: 50,
          pro_stock: 10,
        }),
      );
      expect(updateProductDoc).toHaveBeenCalledWith('P001', {
        pro_nameTH: name,
      });
    },
  );

  it('preserves the current Thai name when an older producer omits it', async () => {
    const { service, update, updateProductDoc } = setup();
    await service.updateProductFromEasyAcc({
      product_code: 'P001',
      product_nameEN: 'English name',
    });
    expect(update).toHaveBeenCalledWith(
      { pro_code: 'P001' },
      expect.objectContaining({ pro_nameTH: 'ชื่อเดิม' }),
    );
    expect(updateProductDoc).toHaveBeenCalledWith('P001', {
      pro_nameEN: 'English name',
    });
  });
});
