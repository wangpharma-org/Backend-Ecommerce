import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { Repository, Not, IsNull } from 'typeorm';
import { ProductEntity } from './products.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepo: jest.Mocked<Repository<ProductEntity>>;

  beforeEach(async () => {
    productRepo = {
      update: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ProductEntity>>;

    const productPharmaRepo = {
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: productRepo,
        },
        {
          provide: 'ProductPharmaEntityRepository',
          useValue: productPharmaRepo,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should update promotion month successfully', async () => {
    const data = [
      { pro_code: 'P001', month: 7 },
      { pro_code: 'P002', month: 8 },
    ];

    productRepo.update.mockResolvedValue({ affected: 1 } as any);

    const result = await service.uploadPO(data);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const update = productRepo.update;

    expect(update).toHaveBeenCalledTimes(3); // 1 reset + 2 updates

    expect(update).toHaveBeenNthCalledWith(
      1,
      { pro_promotion_month: Not(IsNull()) },
      {
        pro_promotion_month: null,
        pro_promotion_amount: null,
        is_detect_amount: false,
      },
    );

    expect(update).toHaveBeenNthCalledWith(
      2,
      { pro_code: 'P001' },
      {
        pro_promotion_month: 7,
        pro_promotion_amount: 1,
      },
    );

    expect(update).toHaveBeenNthCalledWith(
      3,
      { pro_code: 'P002' },
      {
        pro_promotion_month: 8,
        pro_promotion_amount: 1,
      },
    );

    expect(result).toBe('Product Promotion Month Update Success (PO File)');
  });

  it('should throw error if update fails', async () => {
    const data = [{ pro_code: 'P001', month: 7 }];
    productRepo.update.mockRejectedValue(new Error('DB Error'));

    await expect(service.uploadPO(data)).rejects.toThrow(
      'Error updating product promotion month',
    );
  });

  it('should do nothing if tomorrow is not the 1st', async () => {
    // mock วันที่ปกติ (ไม่ใช่สิ้นเดือน)
    jest.useFakeTimers().setSystemTime(new Date('2025-08-28'));

    await service.resetFlashSale();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const update = productRepo.update;

    expect(update).not.toHaveBeenCalled();
  });

  it('should reset flash sale if tomorrow is the 1st', async () => {
    // mock วันที่ 31 ให้พรุ่งนี้เป็นวันที่ 1
    jest.useFakeTimers().setSystemTime(new Date('2025-08-31'));

    await service.resetFlashSale();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const update = productRepo.update;

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      { pro_promotion_month: Not(IsNull()) },
      {
        pro_promotion_month: null,
        pro_promotion_amount: null,
        is_detect_amount: false,
      },
    );
  });

  it('should throw error if update fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-08-31'));

    productRepo.update.mockRejectedValue(new Error('DB error'));

    await expect(service.resetFlashSale()).rejects.toThrow(
      'Error Reset FlashSale',
    );
  });

  it('ควรอัปเดตสินค้าตามข้อมูลที่ส่งมาและคืนค่าผลลัพธ์จาก find', async () => {
    const mockData = [
      { productCode: 'P001', quantity: 10 },
      { productCode: 'P002', quantity: 0 },
    ];

    const mockResponse = [
      {
        pro_code: 'P001',
        pro_name: 'Test Product',
        pro_promotion_month: 8,
        pro_promotion_amount: 10,
        is_detect_amount: true,
      },
      {
        pro_code: 'P002',
        pro_name: 'Test Product',
        pro_promotion_month: 8,
        pro_promotion_amount: 10,
        is_detect_amount: true,
      },
    ] as ProductEntity[];

    productRepo.find.mockResolvedValue(mockResponse);

    const result = await service.uploadProductFlashSale(mockData);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const update = productRepo.update;
    // ตรวจสอบว่า update ถูกเรียกตามจำนวนสินค้า
    expect(update).toHaveBeenCalledTimes(2);

    expect(update).toHaveBeenCalledWith(
      { pro_code: 'P001' },
      {
        pro_promotion_month: new Date().getMonth() + 1,
        pro_promotion_amount: 10,
        is_detect_amount: true,
      },
    );

    expect(update).toHaveBeenCalledWith(
      { pro_code: 'P002' },
      {
        pro_promotion_month: new Date().getMonth() + 1,
        pro_promotion_amount: 1,
        is_detect_amount: false,
      },
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const find = productRepo.find;
    // ตรวจสอบว่า find ถูกเรียก
    expect(find).toHaveBeenCalledWith({
      where: { pro_promotion_month: new Date().getMonth() + 1 },
      select: {
        pro_code: true,
        pro_name: true,
        pro_promotion_month: true,
        pro_promotion_amount: true,
        is_detect_amount: true,
      },
    });

    // ตรวจสอบผลลัพธ์สุดท้าย
    expect(result).toEqual(mockResponse);
  });

  it('ควร throw error ถ้า update หรือ find มีปัญหา', async () => {
    const mockData = [{ productCode: 'P001', quantity: 5 }];
    productRepo.update.mockRejectedValue(new Error('DB error'));

    await expect(service.uploadProductFlashSale(mockData)).rejects.toThrow(
      'Error uploading product flash sale',
    );
  });

  it('should return flash sale products', async () => {
    const limit = 2;
    const currentMonth = new Date().getMonth() + 1;

    const mockProducts = [
      {
        pro_code: 'P001',
        pro_name: 'Product 1',
        pro_priceA: 100,
        pro_imgmain: 'img1.jpg',
        pro_unit1: 'pcs',
        pro_promotion_amount: 5,
      },
      {
        pro_code: 'P002',
        pro_name: 'Product 2',
        pro_priceA: 200,
        pro_imgmain: 'img2.jpg',
        pro_unit1: 'pcs',
        pro_promotion_amount: 10,
      },
    ] as ProductEntity[];

    productRepo.find = jest.fn().mockResolvedValue(mockProducts);

    const result = await service.getFlashSale(limit);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(productRepo.find).toHaveBeenCalledWith({
      where: { pro_promotion_month: currentMonth },
      select: {
        pro_code: true,
        pro_name: true,
        pro_priceA: true,
        pro_imgmain: true,
        pro_unit1: true,
        pro_promotion_amount: true,
      },
      take: limit,
    });

    expect(result).toEqual(mockProducts);
  });

  it('should throw error if find fails', async () => {
    const limit = 2;

    productRepo.find = jest.fn().mockRejectedValue(new Error('DB error'));

    await expect(service.getFlashSale(limit)).rejects.toThrow(
      'Error in getFlashSale',
    );
  });

  it('should return product codes with promotion month', async () => {
    const mockData = [
      { pro_code: 'P001' },
      { pro_code: 'P002' },
    ] as ProductEntity[];

    productRepo.find = jest.fn().mockResolvedValue(mockData);

    const result = await service.listProcodeFlashSale();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(productRepo.find).toHaveBeenCalledWith({
      where: { pro_promotion_month: Not(IsNull()) },
      select: { pro_code: true },
    });

    expect(result).toEqual(mockData);
  });

  it('should throw error if find fails', async () => {
    productRepo.find = jest.fn().mockRejectedValue(new Error('DB error'));

    await expect(service.listProcodeFlashSale()).rejects.toThrow(
      'Error in listProcodeFlashSale: ',
    );
  });
});
