import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { Cron } from '@nestjs/schedule';
import { CreditorEntity } from './creditor.entity';
import { LogFileEntity } from 'src/backend/logFile.entity';
import { BackendService } from 'src/backend/backend.service';
import { UserEntity } from 'src/users/users.entity';
import axios from 'axios';
import { UpdateProductImageDto } from './update-product-image.dto';
import { ElasticsearchService } from 'src/elasticsearch/elasticsearch.service';
import {
  ProductEasyAcc,
  UpdateProductImageEcommercePayload,
} from './product.listener';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { DeleteCartEntity } from 'src/shopping-cart/delete-cart.entity';
import { ProductUnitEntity } from './product-unit.entity';

interface OrderItem {
  pro_code: string;
  unit: string;
  quantity: number;
}

export interface ProductEntityWithUnitEntity extends ProductEntity {
  pro_unit1?: string;
  pro_unit2?: string;
  pro_unit3?: string;
  pro_ratio1?: number;
  pro_ratio2?: number;
  pro_ratio3?: number;
}

// interface UpdateProductInput {
//   pro_code: string;
//   pro_name: string;
//   pro_lowest_stock: number;
//   priceA: number;
//   priceB: number;
//   priceC: number;
//   ratio1: number;
//   ratio2: number;
//   ratio3: number;
//   unit1: string;
//   unit2: string;
//   unit3: string;
//   supplier: string;
// }

interface ApiResponse {
  status: string;
  row_data?: number;
  data: {
    pro_code: string;
    pro_name: string;
    pro_priceA: number;
    pro_priceB: number;
    pro_priceC: number;
    pro_imgmain: string;
    pro_genericname: string;
    pro_unit1: string;
    pro_nameSale: string;
    pro_nameEN: string;
    pro_keysearch: string;
  }[];
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CreditorEntity)
    private readonly creditorRepo: Repository<CreditorEntity>,
    @InjectRepository(ProductPharmaEntity)
    private readonly productPharmaEntity: Repository<ProductPharmaEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly backendService: BackendService,
    private readonly elasticsearchService: ElasticsearchService,
    @InjectRepository(ShoppingCartEntity)
    private readonly shoppingCartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(DeleteCartEntity)
    private readonly deleteCartRepo: Repository<DeleteCartEntity>,
    @Inject(forwardRef(() => ShoppingCartService))
    private readonly shoppingCartService: ShoppingCartService,
    @InjectRepository(ProductUnitEntity)
    private readonly productUnitRepo: Repository<ProductUnitEntity>,
  ) {}

  private convertEnumToUnitName(
    unitEnum: 1 | 2 | 3 | string | undefined,
    productUnits?: { level: number; unit_name: string; ratio: number }[],
  ): string {
    if (!unitEnum || !productUnits || productUnits.length === 0) {
      return unitEnum ? String(unitEnum) : '';
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.unit_name || '';
  }

  private getRatioFromUnits(
    unitEnum: 1 | 2 | 3 | string | undefined,
    productUnits?: { level: number; unit_name: string; ratio: number }[],
  ): number {
    if (!unitEnum || !productUnits || productUnits.length === 0) {
      return 1;
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.ratio || 1;
  }

  async transformProductWithUnits<T extends { pro_code: string }>(
    product: T,
  ): Promise<
    T & {
      pro_unit1: string;
      pro_unit2: string;
      pro_unit3: string;
      pro_ratio1: number;
      pro_ratio2: number;
      pro_ratio3: number;
    }
  > {
    const units = await this.productUnitRepo.find({
      where: { product: { pro_code: product.pro_code } },
      select: ['level', 'unit_name', 'ratio'],
      order: { level: 'ASC' },
    });

    return {
      ...product,
      pro_unit1: this.convertEnumToUnitName(1, units),
      pro_unit2: this.convertEnumToUnitName(2, units),
      pro_unit3: this.convertEnumToUnitName(3, units),
      pro_ratio1: this.getRatioFromUnits(1, units),
      pro_ratio2: this.getRatioFromUnits(2, units),
      pro_ratio3: this.getRatioFromUnits(3, units),
    };
  }

  private async isL16Member(
    mem_code?: string,
    mem_route?: string,
  ): Promise<boolean> {
    if (mem_route !== undefined && mem_route !== null) {
      return mem_route.toUpperCase() === 'L16';
    }
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: { mem_route: true },
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  private applyL16Filter(
    qb: { andWhere: (sql: string, params?: Record<string, unknown>) => void },
    alias: string,
  ) {
    qb.andWhere(`(${alias}.pro_l16_only = 0 OR ${alias}.pro_l16_only IS NULL)`);
  }

  async addCreditor(data: { creditor_code: string; creditor_name: string }) {
    try {
      const newCreditor = this.creditorRepo.create(data);
      await this.creditorRepo.save(newCreditor);
    } catch (error) {
      this.logger.error('Error creating creditor:', error);
      throw new Error('Error creating creditor');
    }
  }

  async getProductByCreditor(creditor_code: string) {
    try {
      const qb = this.productRepo.createQueryBuilder('product');

      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
        ])
        .where('product.creditor_code = :creditor_code', { creditor_code })
        .andWhere('product.pro_name NOT LIKE :p1', { p1: 'ฟรี%' })
        .andWhere('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .andWhere('product.pro_priceA > 0')
        .andWhere('product.pro_priceB > 0')
        .andWhere('product.pro_priceC > 0')
        .getMany();

      return data;
    } catch (error) {
      this.logger.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async searchProducts(query: {
    keyword?: string;
    in_stock?: boolean;
    supplier?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .select([
        'product.pro_code',
        'product.pro_name',
        'product.pro_imgmain',
        'product.pro_priceA',
        'product.pro_priceB',
        'product.pro_priceC',
        'product.pro_unit1',
        'product.pro_unit2',
        'product.pro_unit3',
        'product.pro_ratio1',
        'product.pro_ratio2',
        'product.pro_ratio3',
        'product.pro_stock',
        'product.pro_supplier',
      ]);

    if (query.keyword?.trim()) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere(
        '(product.pro_name LIKE :kw OR product.pro_code LIKE :kw OR product.pro_keysearch LIKE :kw)',
        { kw },
      );
    }

    if (query.in_stock) {
      qb.andWhere('product.pro_stock > 0');
    }

    if (query.supplier?.trim()) {
      qb.andWhere('product.pro_supplier = :supplier', {
        supplier: query.supplier.trim(),
      });
    }

    const [data, total] = await qb
      .orderBy('product.pro_name', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async getProductForKeySearch() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .andWhere('product.pro_name NOT LIKE :p8', { p8: 'โอน%' })
        .andWhere('product.pro_code NOT LIKE :p9', { p9: '@%' })
        .getMany();

      const proCodes = data.map((p) => p.pro_code);
      const allUnits = await this.productUnitRepo.find({
        where: { pro_code: In(proCodes) },
        select: ['pro_code', 'level', 'unit_name', 'ratio'],
      });
      const unitsMap = new Map<string, typeof allUnits>();
      for (const u of allUnits) {
        if (!unitsMap.has(u.pro_code)) unitsMap.set(u.pro_code, []);
        unitsMap.get(u.pro_code)!.push(u);
      }

      return data.map((p) => {
        const units = unitsMap.get(p.pro_code) ?? [];
        return {
          ...p,
          pro_unit1: units.find((u) => u.level === 1)?.unit_name ?? '',
          pro_unit2: units.find((u) => u.level === 2)?.unit_name ?? '',
          pro_unit3: units.find((u) => u.level === 3)?.unit_name ?? '',
          pro_ratio1: units.find((u) => u.level === 1)?.ratio ?? 1,
          pro_ratio2: units.find((u) => u.level === 2)?.ratio ?? 1,
          pro_ratio3: units.find((u) => u.level === 3)?.ratio ?? 1,
        };
      });
    } catch (error) {
      this.logger.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductForKeySearchForFlashSale() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
          'product.pro_imgmain',
          'product.pro_stock',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .getMany();
      return data;
    } catch (error) {
      this.logger.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductForKeySearchForRecommend() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
          'product.pro_imgmain',
          'product.pro_stock',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .andWhere('product.pro_name NOT LIKE :p8', { p8: 'ฟรี%' })
        .andWhere('product.recommend_id IS NULL')
        .getMany();
      return data;
    } catch (error) {
      this.logger.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductForKeySearchForReplace() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
          'product.pro_imgmain',
          'product.pro_stock',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .andWhere('product.pro_name NOT LIKE :p8', { p8: 'ฟรี%' })
        .getMany();
      return data;
    } catch (error) {
      this.logger.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductOne(pro_code: string) {
    try {
      const dataProduct: ProductEntityWithUnitEntity | null =
        await this.productRepo.findOne({
          relations: {
            flashsale: {
              flashsale: true,
            },
          },
          where: {
            pro_code: pro_code,
          },
        });

      if (!dataProduct) {
        throw new Error('Product not found');
      }

      return await this.transformProductWithUnits(dataProduct);
    } catch {
      throw new Error('Something Error in getProductOne');
    }
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  async resetFlashSale() {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (tomorrow.getDate() !== 1) {
      return;
    }
    try {
      await this.productRepo.update(
        { pro_promotion_month: Not(IsNull()) },
        {
          pro_promotion_month: null,
          pro_promotion_amount: null,
          is_detect_amount: false,
        },
      );
    } catch (error) {
      this.logger.error('Error Reset FlashSale', error);
      throw new Error('Error Reset FlashSale');
    }
  }

  async searchLotusCards(): Promise<
    { pro_code: string; pro_name: string; pro_unit1: string }[]
  > {
    const products = await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.units', 'units')
      .where('product.pro_name LIKE :name', { name: 'บัตรโลตั%' })
      .select([
        'product.pro_code',
        'product.pro_name',
        'units.level',
        'units.unit_name',
      ])
      .orderBy('product.pro_name', 'ASC')
      .getMany();

    return products.map((p) => {
      const units = p.units as
        | { level: number; unit_name: string }[]
        | undefined;
      return {
        pro_code: p.pro_code,
        pro_name: p.pro_name,
        pro_unit1: units?.find((u) => u.level === 1)?.unit_name ?? '',
      };
    });
  }

  async listProcodeFlashSale() {
    try {
      const data = await this.productRepo.find({
        where: {
          pro_promotion_month: Not(IsNull()),
        },
        select: {
          pro_code: true,
        },
      });
      return data;
    } catch (error) {
      throw new Error('Error in listProcodeFlashSale: ' + String(error));
    }
  }

  async getFlashSale(limit: number, mem_code: string, mem_route?: string) {
    try {
      const isL16 = await this.isL16Member(mem_code, mem_route);
      const numberOfMonth = new Date().getMonth() + 1;
      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', mem_code)
        .where('product.pro_promotion_month = :month', {
          month: numberOfMonth,
        });

      if (isL16) {
        this.applyL16Filter(qb, 'product');
      }

      const data = await qb
        .innerJoinAndSelect('product.units', 'units')
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_imgmain',
          'product.pro_promotion_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.viwers',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.mem_code',
          'units.id',
          'units.level',
          'units.unit_name',
          'units.ratio',
        ])
        .take(Number(limit))
        .getMany();

      type UnitDef = { level: number; unit_name: string; ratio: number };

      return data.map((product) => {
        const units = (product.units ?? []) as unknown as UnitDef[];
        const unit1 = units.find((u) => u.level === 1);
        const unit2 = units.find((u) => u.level === 2);
        const unit3 = units.find((u) => u.level === 3);

        const resolvedCarts = (product.inCarts ?? []).map((cart) => {
          const found = units.find(
            (u) => u.level === Number(cart.spc_unit_enum),
          );
          const cartObj = {
            ...(cart as unknown as Record<string, unknown>),
          };
          delete cartObj['spc_unit_enum'];
          return { ...cartObj, spc_unit: found?.unit_name ?? '' };
        });

        const productObj = {
          ...(product as unknown as Record<string, unknown>),
        };
        delete productObj['units'];

        return {
          ...productObj,
          pro_unit1: unit1?.unit_name ?? '',
          pro_unit2: unit2?.unit_name ?? '',
          pro_unit3: unit3?.unit_name ?? '',
          pro_ratio1: unit1?.ratio ?? 1,
          pro_ratio2: unit2?.ratio ?? 1,
          pro_ratio3: unit3?.ratio ?? 1,
          inCarts: resolvedCarts,
        };
      });
    } catch (error) {
      this.logger.error('Error in getFlashSale:', error);
      throw new Error('Error in getFlashSale');
    }
  }

  async uploadProductFlashSale(
    data: {
      productCode: string;
      quantity: number;
    }[],
  ) {
    try {
      const rows = Object.values(data);
      const numberOfMonth = new Date().getMonth() + 1;
      await Promise.all(
        rows.map(async (item) => {
          await this.productRepo.update(
            { pro_code: item.productCode },
            {
              pro_promotion_month: numberOfMonth,
              pro_promotion_amount: item.quantity === 0 ? 1 : item.quantity,
              is_detect_amount: item.quantity === 0 ? false : true,
            },
          );
        }),
      );
      const responseData = this.productRepo.find({
        where: {
          pro_promotion_month: numberOfMonth,
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_promotion_month: true,
          pro_promotion_amount: true,
          is_detect_amount: true,
        },
      });
      return responseData;
    } catch (error) {
      this.logger.error('Error uploading product flash sale:', error);
      throw new Error('Error uploading product flash sale');
    }
  }

  async uploadPO(data: { pro_code: string; month: number }[]) {
    try {
      await this.productRepo.update(
        { pro_promotion_month: Not(IsNull()) },
        {
          pro_promotion_month: null,
          pro_promotion_amount: null,
          is_detect_amount: false,
        },
      );

      const rows = Object.values(data);
      await Promise.all(
        rows.map(async (item) => {
          await this.productRepo.update(
            { pro_code: item.pro_code },
            {
              pro_promotion_month: item.month,
              pro_promotion_amount: 1,
            },
          );
        }),
      );
      return 'Product Promotion Month Update Success (PO File)';
    } catch (error) {
      this.logger.error('Error updating product promotion month', error);
      throw new Error('Error updating product promotion month');
    }
  }

  async createProduct(
    product: ProductEntity & {
      pro_unit1?: string;
      pro_unit2?: string;
      pro_unit3?: string;
      pro_ratio1?: number;
      pro_ratio2?: number;
      pro_ratio3?: number;
    },
  ) {
    try {
      const {
        pro_unit1,
        pro_unit2,
        pro_unit3,
        pro_ratio1,
        pro_ratio2,
        pro_ratio3,
        ...productData
      } = product;

      const newProduct = this.productRepo.create({
        ...productData,
        pro_keysearch: Array.isArray(productData.pro_keysearch)
          ? (productData.pro_keysearch as string[]).join(',')
          : productData.pro_keysearch,
      });
      await this.productRepo.save(newProduct);

      const unitsToSave = [
        { level: 1, unit_name: pro_unit1, ratio: pro_ratio1 ?? 1 },
        { level: 2, unit_name: pro_unit2, ratio: pro_ratio2 ?? 1 },
        { level: 3, unit_name: pro_unit3, ratio: pro_ratio3 ?? 1 },
      ].filter((u) => u.unit_name);

      if (unitsToSave.length > 0) {
        await this.productUnitRepo.save(
          unitsToSave.map((u) =>
            this.productUnitRepo.create({
              pro_code: product.pro_code,
              unit_name: u.unit_name,
              ratio: u.ratio,
              level: u.level,
            }),
          ),
        );
      }
    } catch (error) {
      this.logger.error('Error creating product:', error);
      throw new Error('Error creating product');
    }
  }

  async createProductPharmaRepo(detail: ProductPharmaEntity) {
    try {
      const newDetail = this.productPharmaEntity.create(detail);
      await this.productPharmaEntity.save(newDetail);
    } catch (error) {
      this.logger.error('Error creating product detail:', error);
      throw new Error('Error creating product detail');
    }
  }

  async updateProductDetail(product: ProductPharmaEntity) {
    try {
      await this.productPharmaEntity.update(
        { product: { pro_code: product.product.pro_code } },
        product,
      );
    } catch (error) {
      this.logger.error('Error updating product detail:', error);
    }
  }

  async updateProduct(
    product: ProductEntity & {
      pro_unit1?: string;
      pro_unit2?: string;
      pro_unit3?: string;
      pro_ratio1?: number;
      pro_ratio2?: number;
      pro_ratio3?: number;
    },
  ) {
    try {
      const {
        pro_unit1,
        pro_unit2,
        pro_unit3,
        pro_ratio1,
        pro_ratio2,
        pro_ratio3,
        ...productData
      } = product;

      await this.productRepo.update(
        { pro_code: product.pro_code },
        {
          ...productData,
          pro_keysearch: Array.isArray(productData.pro_keysearch)
            ? (productData.pro_keysearch as string[]).join(',')
            : productData.pro_keysearch,
        },
      );

      const hasUnitData =
        pro_unit1 !== undefined ||
        pro_unit2 !== undefined ||
        pro_unit3 !== undefined ||
        pro_ratio1 !== undefined ||
        pro_ratio2 !== undefined ||
        pro_ratio3 !== undefined;

      if (hasUnitData) {
        const existingUnits = await this.productUnitRepo.find({
          where: { pro_code: product.pro_code },
        });

        const processUnit = async (
          level: number,
          unitName?: string,
          ratio?: number,
        ) => {
          if (unitName === undefined && ratio === undefined) return;
          const existing = existingUnits.find((u) => u.level === level);
          if (existing) {
            await this.productUnitRepo.update(
              { id: existing.id },
              {
                ...(unitName !== undefined && { unit_name: unitName }),
                ...(ratio !== undefined && { ratio }),
              },
            );
          } else if (unitName) {
            await this.productUnitRepo.save(
              this.productUnitRepo.create({
                pro_code: product.pro_code,
                unit_name: unitName,
                ratio: ratio ?? 1,
                level,
              }),
            );
          }
        };

        await Promise.all([
          processUnit(1, pro_unit1, pro_ratio1),
          processUnit(2, pro_unit2, pro_ratio2),
          processUnit(3, pro_unit3, pro_ratio3),
        ]);
      }
    } catch (error) {
      this.logger.error('Error updating product:', error);
    }
  }

  async getProductDetail(data: {
    pro_code: string;
    mem_code: string;
    mem_route?: string;
  }): Promise<ProductEntityWithUnitEntity> {
    try {
      const isL16 = await this.isL16Member(data.mem_code, data.mem_route);
      const replaceCondition = isL16
        ? 'replace.pro_l16_only = 0 OR replace.pro_l16_only IS NULL'
        : undefined;
      const recommendCondition = isL16
        ? 'products.pro_stock > 0 AND (products.pro_l16_only = 0 OR products.pro_l16_only IS NULL)'
        : 'products.pro_stock > 0';
      const replaceInRecommendCondition = isL16
        ? 'replaceInRecommend.pro_l16_only = 0 OR replaceInRecommend.pro_l16_only IS NULL'
        : undefined;

      await this.productRepo.increment(
        { pro_code: data.pro_code },
        'viwers',
        1,
      );
      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.pharmaDetails', 'pharma')
        .leftJoinAndSelect(
          'product.inFavorite',
          'favorite',
          'favorite.mem_code = :mem_code',
          { mem_code: data.mem_code },
        )
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .leftJoinAndSelect('product.replace', 'replace', replaceCondition)
        .leftJoinAndSelect('product.recommend', 'recommend')
        .leftJoinAndSelect('recommend.products', 'products', recommendCondition)
        .leftJoinAndSelect(
          'products.replace',
          'replaceInRecommend',
          replaceInRecommendCondition,
        )
        .leftJoinAndSelect(
          'replace.inCarts',
          'inCartsInReplace',
          'inCartsInReplace.mem_code = :mem_code',
          { mem_code: data.mem_code },
        )
        .leftJoinAndSelect(
          'products.inCarts',
          'inCarts',
          'inCarts.mem_code = :mem_code',
          { mem_code: data.mem_code },
        )
        .leftJoinAndSelect('products.flashsale', 'fsp_products')
        .leftJoinAndSelect('fsp_products.flashsale', 'fs_products')
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_barcode1',
          'product.pro_barcode2',
          'product.pro_barcode3',
          'product.pro_imgmain',
          'product.pro_img2',
          'product.pro_img3',
          'product.pro_img4',
          'product.pro_img5',
          'product.pro_promotion_month',
          'product.pro_promotion_amount',
          'product.pro_keysearch',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.sale_amount_day',
          'product.pro_drugregister',
          'pharma.pro_code',
          'pharma.pp_properties',
          'pharma.pp_properties',
          'pharma.pp_how_to_use',
          'pharma.pp_caution',
          'pharma.pp_suggestion',
          'favorite.fav_id',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
          'recommend.id',
          'products.pro_code',
          'products.pro_name',
          'products.pro_imgmain',
          'products.pro_priceA',
          'products.pro_priceB',
          'products.pro_priceC',
          'products.pro_stock',
          'products.pro_lowest_stock',
          'products.order_quantity',
          'products.pro_promotion_amount',
          'products.pro_promotion_month',
          'products.recommend_rank',
          'replaceInRecommend.pro_code',
          'replace.pro_code',
          'replace.pro_name',
          'replace.pro_imgmain',
          'replace.pro_priceA',
          'replace.pro_priceB',
          'replace.pro_priceC',
          'replace.pro_stock',
          'replace.pro_lowest_stock',
          'replace.order_quantity',
          'replace.pro_promotion_amount',
          'replace.pro_promotion_month',
          'inCartsInReplace.mem_code',
          'inCartsInReplace.spc_amount',
          'inCartsInReplace.spc_unit_enum',
          'inCartsInReplace.pro_code',
          'inCarts.pro_code',
          'inCarts.mem_code',
          'inCarts.spc_amount',
          'inCarts.spc_unit_enum',
          'inCarts.pro_code',
          'fsp_products.limit',
          'fsp_products.id',
          'fs_products.promotion_id',
          'fs_products.time_start',
          'fs_products.time_end',
          'fs_products.date',
        ])
        .where('product.pro_code = :pro_code', { pro_code: data.pro_code });

      if (isL16) {
        this.applyL16Filter(qb, 'product');
      }

      // Query หลักเพื่อได้ relationships
      const product: ProductEntityWithUnitEntity | null = await qb.getOne();

      if (!product) {
        throw new Error('Not found Product');
      }

      return await this.transformProductWithUnits(product);
    } catch (error) {
      this.logger.error(error);
      throw new Error('Something Error in Product Detail');
    }
  }

  async productForYou(data: {
    keyword: string;
    pro_code: string;
    mem_code: string;
    mem_route?: string;
  }): Promise<ProductEntity[]> {
    try {
      const isL16 = await this.isL16Member(data.mem_code, data.mem_route);
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            }).orWhere('product.pro_keysearch LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            });
          }),
        )
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_code != :pro_code', {
              pro_code: data.pro_code,
            })
              .andWhere('product.pro_name NOT LIKE :prefix1', {
                prefix1: 'ฟรี%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', { prefix4: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix5', {
                prefix5: '/%',
              })
              .andWhere('product.pro_name NOT LIKE :rebase', {
                rebase: 'รีเบท%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix6', {
                prefix6: '/%',
              })
              .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
              .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
              .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
              .andWhere('product.pro_name NOT LIKE :prefix7', {
                prefix7: 'ค่า%',
              })
              .andWhere('product.pro_code NOT LIKE :message', {
                message: '@%',
              });
          }),
        );

      if (isL16) {
        this.applyL16Filter(qb, 'product');
      }

      const products = await qb
        .take(6)
        .select([
          // 'product.pro_id',
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
        ])
        .getMany();
      return products;
    } catch (error) {
      this.logger.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async searchCategoryProducts(data: {
    keyword: string;
    category: number;
    offset: number;
    mem_code: string;
    mem_route?: string;
    sort_by?: number;
    limit: number;
  }): Promise<{ products: ProductEntity[]; totalCount: number }> {
    try {
      const isL16 = await this.isL16Member(data.mem_code, data.mem_route);
      const now = new Date();
      const monthNumber = now.getMonth() + 1;
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0];

      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', data.mem_code)
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .innerJoinAndSelect('product.units', 'units');

      if (data.category === 8) {
        qb.where('product.pro_free = :free', { free: true })
          .andWhere('product.pro_point > :point', { point: 0 })
          .andWhere('product.pro_stock > :stock', { stock: 0 });
      } else {
        qb.where('product.pro_priceA != 0')
          .andWhere(
            new Brackets((qb) => {
              qb.where('product.pro_name LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
                .orWhere('product.pro_keysearch LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_barcode1 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_barcode2 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_barcode3 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_code LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_nameMain LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain2 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain3 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain4 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_nameTH LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                });
            }),
          )
          .andWhere(
            new Brackets((qb) => {
              qb.where('product.pro_name NOT LIKE :prefix1', {
                prefix1: 'ฟรี%',
              })
                .andWhere('product.pro_name NOT LIKE :prefix2', {
                  prefix2: '@%',
                })
                .andWhere('product.pro_name NOT LIKE :prefix3', {
                  prefix3: 'ส่งเสริม%',
                })
                .andWhere('product.invisible_id IS NULL')
                .andWhere('product.pro_name NOT LIKE :prefix4', {
                  prefix4: 'รีเบท%',
                })
                .andWhere('product.pro_name NOT LIKE :prefix5', {
                  prefix5: '-%',
                })
                .andWhere('product.pro_name NOT LIKE :prefix6', {
                  prefix6: '/%',
                })
                .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
                .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
                .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
                .andWhere('product.pro_name NOT LIKE :prefix7', {
                  prefix7: 'ค่า%',
                });

              if (data.category === 7) {
                qb.andWhere('product.pro_promotion_month = :month', {
                  month: monthNumber,
                });
              } else if (data.category === 9) {
                qb.andWhere('fs.date = :date', { date: currentDate });
                qb.andWhere(':nowTime BETWEEN fs.time_start AND fs.time_end', {
                  nowTime: currentTime,
                });
              } else {
                qb.andWhere('product.pro_category = :category', {
                  category: data.category,
                });
              }
            }),
          );
      }

      if (isL16) {
        this.applyL16Filter(qb, 'product');
      }

      if (data.sort_by && data.category === 8) {
        switch (data.sort_by) {
          case 1:
            qb.orderBy('product.pro_stock', 'DESC');
            break;
          case 2:
            qb.orderBy('product.pro_stock', 'ASC');
            break;
          case 3:
            qb.orderBy('product.pro_point', 'DESC');
            break;
          case 4:
            qb.orderBy('product.pro_point', 'ASC');
            break;
          case 5:
            qb.orderBy('product.pro_sale_amount', 'DESC');
            break;
          default:
            qb.orderBy('product.pro_name', 'ASC');
        }
      } else if (data.sort_by) {
        switch (data.sort_by) {
          case 1:
            qb.orderBy('product.pro_stock', 'DESC');
            break;
          case 2:
            qb.orderBy('product.pro_stock', 'ASC');
            break;
          case 3:
            qb.orderBy('product.pro_priceA', 'DESC');
            break;
          case 4:
            qb.orderBy('product.pro_priceA', 'ASC');
            break;
          case 5:
            qb.orderBy('product.pro_sale_amount', 'DESC');
            break;
          default:
            qb.orderBy('product.pro_name', 'ASC');
        }
      } else {
        qb.orderBy('product.pro_name', 'ASC');
      }

      const totalCount = await qb.getCount();
      const products = await qb
        .take(data.limit)
        .skip(data.offset)
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_point',
          'product.pro_promotion_amount',
          'product.pro_promotion_month',
          'product.pro_sale_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.viwers',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.mem_code',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
        ])
        .getMany();

      return { products, totalCount };
    } catch (error) {
      this.logger.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  // async searchProducts(data: {
  //   keyword: string;
  //   offset: number;
  //   mem_code: string;
  //   mem_route?: string;
  //   sort_by?: number;
  //   limit: number;
  // }): Promise<{ products: ProductEntity[]; totalCount: number }> {
  //   try {
  //     const keyword = data.keyword.trim();
  //     const isL16 = await this.isL16Member(data.mem_code, data.mem_route);
  //     const qb = this.productRepo
  //       .createQueryBuilder('product')
  //       .leftJoinAndSelect(
  //         'product.inCarts',
  //         'cart',
  //         'cart.mem_code = :memCode AND cart.is_reward = false',
  //       )
  //       .setParameter('memCode', data.mem_code)
  //       .leftJoinAndSelect('product.flashsale', 'fsp')
  //       .leftJoinAndSelect('fsp.flashsale', 'fs')
  //       .where('product.pro_priceA != 0')
  //       .andWhere(
  //         new Brackets((qb) => {
  //           qb.where('product.pro_name LIKE :keyword', {
  //             keyword: `%${keyword}%`,
  //           })
  //             .orWhere('product.pro_keysearch LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_nameEN LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_barcode1 LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_barcode2 LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_barcode3 LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_code LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_nameMain LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_drugmain LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_drugmain2 LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_drugmain3 LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_drugmain4 LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             })
  //             .orWhere('product.pro_nameTH LIKE :keyword', {
  //               keyword: `%${keyword}%`,
  //             });
  //         }),
  //       )
  //       .andWhere(
  //         new Brackets((qb) => {
  //           qb.where('product.pro_name NOT LIKE :prefix1', { prefix1: 'ฟรี%' })
  //             .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
  //             .andWhere('product.invisible_id IS NULL')
  //             .andWhere('product.pro_name NOT LIKE :prefix3', {
  //               prefix3: 'ส่งเสริม%',
  //             })
  //             .andWhere('product.pro_name NOT LIKE :prefix4', {
  //               prefix4: 'รีเบท%',
  //             })
  //             .andWhere('product.pro_name NOT LIKE :prefix5', { prefix5: '-%' })
  //             .andWhere('product.pro_name NOT LIKE :prefix6', {
  //               prefix6: '/%',
  //             })
  //             .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
  //             .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
  //             .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
  //             .andWhere('product.pro_name NOT LIKE :prefix7', {
  //               prefix7: 'ค่า%',
  //             })
  //             .andWhere('product.pro_code NOT LIKE :prefix8', {
  //               prefix8: '@M%',
  //             });
  //         }),
  //       );

  //     if (isL16) {
  //       this.applyL16Filter(qb, 'product');
  //     }

  //     if (data.sort_by) {
  //       switch (data.sort_by) {
  //         case 1:
  //           qb.orderBy('product.pro_stock', 'DESC');
  //           break;
  //         case 2:
  //           qb.orderBy('product.pro_stock', 'ASC');
  //           break;
  //         case 3:
  //           qb.orderBy('product.pro_priceA', 'DESC');
  //           break;
  //         case 4:
  //           qb.orderBy('product.pro_priceA', 'ASC');
  //           break;
  //         case 5:
  //           qb.orderBy('product.pro_sale_amount', 'DESC');
  //           break;
  //         default:
  //           qb.orderBy('product.pro_name', 'ASC');
  //       }
  //     } else {
  //       qb.orderBy('product.pro_name', 'ASC');
  //     }

  //     const totalCount = await qb.getCount();
  //     const products = await qb
  //       .take(data.limit)
  //       .skip(data.offset)
  //       .select([
  //         'product.pro_code',
  //         'product.pro_name',
  //         'product.pro_priceA',
  //         'product.pro_priceB',
  //         'product.pro_priceC',
  //         'product.pro_imgmain',
  //         'product.pro_unit1',
  //         'product.pro_unit2',
  //         'product.pro_unit3',
  //         'product.pro_sale_amount',
  //         'product.pro_stock',
  //         'product.pro_lowest_stock',
  //         'product.order_quantity',
  //         'product.viwers',
  //         'cart.spc_id',
  //         'cart.spc_amount',
  //         'cart.spc_unit',
  //         'cart.mem_code',
  //         'fsp.limit',
  //         'fsp.id',
  //         'fs.promotion_id',
  //         'fs.time_start',
  //         'fs.time_end',
  //         'fs.date',
  //       ])
  //       .getMany();
  //     return { products, totalCount };
  //   } catch (error) {
  //     console.error('Error searching products:', error);
  //     throw new Error('Error searching products');
  //   }
  // }

  async searchProductsElastic(data: {
    keyword: string;
    offset: number;
    mem_code: string;
    mem_route?: string;
    sort_by?: number;
    limit: number;
    creditor_codes?: string[];
  }): Promise<{ products: ProductEntity[]; totalCount: number }> {
    interface EsProductSource {
      pro_code: string;
      pro_name: string;
      pro_nameSale: string;
      pro_keysearch: string;
    }

    let proCodes: string[] = [];
    let totalCount = 0;

    try {
      const keyword = data.keyword?.trim();

      if (!keyword && !data.creditor_codes?.length) {
        return { products: [], totalCount: 0 };
      }

      const isL16 = await this.isL16Member(data.mem_code, data.mem_route);

      try {
        const esResult =
          await this.elasticsearchService.search<EsProductSource>({
            from: data.offset,
            size: data.limit,
            track_total_hits: true,
            sort: keyword
              ? [{ _score: { order: 'desc' } }]
              : [{ 'pro_code.keyword': { order: 'asc' } }],
            _source: ['pro_code', 'pro_name', 'pro_nameSale', 'pro_keysearch'],
            query: {
              bool: {
                filter: [
                  { range: { pro_priceA: { gt: 0 } } },
                  { range: { pro_priceB: { gt: 0 } } },
                  { range: { pro_priceC: { gt: 0 } } },
                  ...(data.creditor_codes?.length
                    ? [
                        {
                          terms: {
                            'creditor_code.keyword': data.creditor_codes,
                          },
                        },
                      ]
                    : []),
                ],
                must_not: [
                  { prefix: { 'pro_code.keyword': '@MESSAGE' } },
                  { prefix: { 'pro_code.keyword': '@MAESSAGE' } },
                  { prefix: { 'pro_code.keyword': '@M' } },
                  { prefix: { 'pro_name.keyword': 'ฟรี' } },
                  { prefix: { 'pro_name.keyword': '@' } },
                  { prefix: { 'pro_name.keyword': 'ส่งเสริม' } },
                  { prefix: { 'pro_name.keyword': 'รีเบท' } },
                  { prefix: { 'pro_name.keyword': '-' } },
                  { prefix: { 'pro_name.keyword': '/' } },
                  { prefix: { 'pro_name.keyword': 'ค่า' } },
                  { exists: { field: 'invisible_id' } },
                  ...(isL16
                    ? []
                    : [
                        {
                          term: {
                            pro_l16_only: 1,
                          },
                        },
                      ]),
                ],
                ...(keyword
                  ? {
                      should: [
                        {
                          term: {
                            'pro_code.keyword': {
                              value: keyword,
                              boost: 200,
                            },
                          },
                        },
                        {
                          term: {
                            'pro_barcode1.keyword': {
                              value: keyword,
                              boost: 180,
                            },
                          },
                        },
                        {
                          term: {
                            'pro_barcode2.keyword': {
                              value: keyword,
                              boost: 160,
                            },
                          },
                        },
                        {
                          term: {
                            'pro_barcode3.keyword': {
                              value: keyword,
                              boost: 160,
                            },
                          },
                        },
                        {
                          term: {
                            'pro_keysearch.keyword': {
                              value: keyword,
                              boost: 100,
                            },
                          },
                        },
                        {
                          match_phrase: {
                            pro_keysearch: {
                              query: keyword,
                              boost: 80,
                            },
                          },
                        },
                        {
                          match_phrase: {
                            pro_name: {
                              query: keyword,
                              boost: 70,
                            },
                          },
                        },
                        {
                          match_phrase: {
                            pro_nameSale: {
                              query: keyword,
                              boost: 70,
                            },
                          },
                        },
                        {
                          match: {
                            pro_keysearch: {
                              query: keyword,
                              operator: 'and',
                              fuzziness: 'AUTO',
                              boost: 50,
                            },
                          },
                        },
                        {
                          multi_match: {
                            query: keyword,
                            fields: [
                              'pro_keysearch^20',
                              'pro_name^10',
                              'pro_nameSale^10',
                              'pro_nameEN^5',
                              'pro_nameMain^5',
                              'pro_nameTH^5',
                              'pro_genericname^5',
                              'pro_drugmain^3',
                              'pro_drugmain2^3',
                              'pro_drugmain3^3',
                              'pro_drugmain4^3',
                            ],
                            type: 'best_fields',
                            operator: 'and',
                            // fuzziness: 'AUTO',
                            boost: 30,
                          },
                        },
                        {
                          wildcard: {
                            'pro_keysearch.keyword': {
                              value: `*${keyword}*`,
                              case_insensitive: true,
                              boost: 70,
                            },
                          },
                        },
                        {
                          wildcard: {
                            'pro_name.keyword': {
                              value: `*${keyword}*`,
                              case_insensitive: true,
                              boost: 40,
                            },
                          },
                        },
                        {
                          wildcard: {
                            'pro_nameSale.keyword': {
                              value: `*${keyword}*`,
                              case_insensitive: true,
                              boost: 40,
                            },
                          },
                        },
                        {
                          regexp: {
                            'pro_keysearch.keyword': {
                              value: `.*${keyword.split('').join('.*')}.*`,
                              case_insensitive: true,
                              boost: 20,
                            },
                          },
                        },
                      ],
                      minimum_should_match: 1,
                    }
                  : {}),
              },
            },
          });

        const hits = esResult?.hits?.hits;
        totalCount =
          typeof esResult.hits.total === 'number'
            ? esResult.hits.total
            : (esResult.hits.total?.value ?? 0);

        proCodes = hits.map((hit) => hit._source?.pro_code).filter(Boolean);
      } catch {
        this.logger.warn(
          'Elasticsearch search failed, falling back to DB search',
        );
      }

      const fetchExternalAndEnter = async () => {
        const [external, enter] = await Promise.all([
          this.searchExternalProducts(data.keyword),
          this.searchEnterProducts(data.keyword),
        ]);
        return { external, enter };
      };

      let additionalProCodes: string[] = [];

      if (totalCount === 0) {
        try {
          const result = await fetchExternalAndEnter();
          const externalCodes = result.external.map((p) => p.pro_code);
          additionalProCodes = [...externalCodes, ...result.enter];
        } catch {
          this.logger.warn('Search external/enter products failed');
        }
      }

      if (additionalProCodes.length > 0) {
        const uniqueNewCodes = Array.from(new Set(additionalProCodes)).filter(
          (code) => !proCodes.includes(code),
        );

        const esTotalCount = totalCount;
        totalCount += uniqueNewCodes.length;

        const localOffset = Math.max(0, data.offset - esTotalCount);
        const esConsumed = Math.max(
          0,
          Math.min(data.limit, esTotalCount - data.offset),
        );
        const neededFromNewCodes = data.limit - esConsumed;

        if (neededFromNewCodes > 0) {
          const paginatedNewCodes = uniqueNewCodes.slice(
            localOffset,
            localOffset + neededFromNewCodes,
          );
          proCodes.push(...paginatedNewCodes);
        }
      }

      if (proCodes.length === 0) {
        return { products: [], totalCount };
      }

      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', data.mem_code)
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .innerJoinAndSelect('product.units', 'units')
        .where('product.pro_code IN (:...proCodes)', { proCodes })
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_sale_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.viwers',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.mem_code',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
        ]);

      const products = await qb.getMany();

      const productMap = new Map(products.map((p) => [p.pro_code, p]));

      const sortedProducts = proCodes
        .map((code) => productMap.get(code))
        .filter(Boolean) as ProductEntity[];
      const productEntity: ProductEntity[] = [];

      for (const product of sortedProducts) {
        const detailedProduct = await this.transformProductWithUnits(product);
        productEntity.push(detailedProduct);
      }
      return {
        products: productEntity,
        totalCount,
      };
    } catch (error) {
      console.error('Error searching products with Elasticsearch:', error);
      throw new Error('Error searching products with Elasticsearch');
    }
  }

  async listFree(sort_by?: string, mem_code?: string, mem_route?: string) {
    try {
      let order: Record<string, 'ASC' | 'DESC'>;

      switch (sort_by) {
        case '1':
          order = { pro_stock: 'DESC' };
          break;
        case '2':
          order = { pro_stock: 'ASC' };
          break;
        case '3':
          order = { pro_point: 'DESC' };
          break;
        case '4':
          order = { pro_point: 'ASC' };
          break;
        case '5':
          order = { pro_sale_amount: 'DESC' };
          break;
        default:
          order = { pro_name: 'ASC' };
      }

      const isL16 = await this.isL16Member(mem_code, mem_route);
      const data = await this.productRepo.find({
        where: {
          pro_free: true,
          pro_stock: MoreThan(0),
          pro_point: MoreThan(0),
          ...(isL16
            ? {
                pro_l16_only: In([0, null]),
              }
            : {}),
        },
        relations: ['units'],
        select: {
          pro_code: true,
          pro_name: true,
          pro_point: true,
          pro_imgmain: true,
          pro_sale_amount: true,
          pro_stock: true,
        },
        order,
      });

      return data;
    } catch (error) {
      this.logger.error('Error free products:', error);
      throw new Error('Error free products');
    }
  }

  // ฟังก์ชันดึงข้อมูลสินค้าพร้อมหน่วยจากฐานข้อมูล
  private async getProductsWithUnits(pro_code: string) {
    const products = await this.productRepo
      .createQueryBuilder('product')
      .where('product.pro_code = :pro_code', { pro_code })
      .select(['product.pro_code'])
      .innerJoinAndSelect('product.units', 'units')
      .getMany();

    // แปลงข้อมูลให้อยู่ในรูปแบบ units array
    return products.map((product: ProductEntity) => ({
      ...product,
      units: product.units
        ? product.units.map((u) => ({ unit: u.unit_name, ratio: u.ratio }))
        : [],
    }));
  }

  async calculateSmallestUnit(order: OrderItem[]): Promise<number> {
    let total = 0;
    try {
      // ลูปผ่านทุก orderItem
      for (const orderItem of order) {
        const { unit, quantity, pro_code } = orderItem;

        const productsWithUnits = await this.getProductsWithUnits(pro_code);

        const product:
          | {
              pro_code: string;
              units: { unit: string; ratio: number }[];
            }
          | undefined = productsWithUnits.find((p) => p.pro_code === pro_code);
        if (!product) {
          throw new Error(`Product with code ${pro_code} not found`);
        }

        // หา ratio จาก product.units โดยใช้ unit string ที่ส่งมา
        const unitData = product.units.find((u) => u.unit === unit);
        if (unitData) {
          const totalForItem = quantity * unitData.ratio;
          total += totalForItem;
        }
      }

      return total; // ส่งผลลัพธ์ที่เป็นตัวเลข
    } catch (error) {
      this.logger.error('Error calculating smallest unit:', error);
      throw new Error('Error calculating smallest unit');
    }
  }

  async searchByCodeOrSupplier(keyword: string): Promise<ProductEntity[]> {
    try {
      const products = await this.productRepo
        .createQueryBuilder('product')
        .where(
          new Brackets((qb) => {
            qb.where('product.pro_code LIKE :keyword', {
              keyword: `%${keyword}%`,
            }).orWhere('product.pro_supplier LIKE :keyword', {
              keyword: `%${keyword}%`,
            });
          }),
        )
        .andWhere('product.pro_priceA != :price', { price: 1 })
        .andWhere('product.pro_code NOT LIKE :at1', { at1: '@M%' })
        .andWhere('product.pro_code NOT LIKE :at2', { at2: '%@%' })
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :n1', { n1: '%โอน%' })
              .andWhere('product.pro_name NOT LIKE :n2', { n2: '%ค่า%' })
              .andWhere('product.pro_name NOT LIKE :n3', { n3: '%ขนส่ง%' })
              .andWhere('product.pro_name NOT LIKE :n4', { n4: '%โปรโมชั่น%' });
          }),
        )
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_barcode1',
          'product.pro_barcode2',
          'product.pro_barcode3',
          'product.pro_imgmain',
        ])
        .take(10)
        .getMany();

      const proCodes = products.map((p) => p.pro_code);
      const allUnits = await this.productUnitRepo.find({
        where: { pro_code: In(proCodes) },
        select: ['pro_code', 'level', 'unit_name', 'ratio'],
      });
      const unitsMap = new Map<string, typeof allUnits>();
      for (const u of allUnits) {
        if (!unitsMap.has(u.pro_code)) unitsMap.set(u.pro_code, []);
        unitsMap.get(u.pro_code)!.push(u);
      }

      return products.map((p) => {
        const units = unitsMap.get(p.pro_code) ?? [];
        return {
          ...p,
          pro_unit1: units.find((u) => u.level === 1)?.unit_name ?? '',
          pro_unit2: units.find((u) => u.level === 2)?.unit_name ?? '',
          pro_unit3: units.find((u) => u.level === 3)?.unit_name ?? '',
          pro_ratio1: units.find((u) => u.level === 1)?.ratio ?? 1,
          pro_ratio2: units.find((u) => u.level === 2)?.ratio ?? 1,
          pro_ratio3: units.find((u) => u.level === 3)?.ratio ?? 1,
        };
      });
    } catch (error) {
      this.logger.error('Error searching by code or supplier:', error);
      throw new Error('Error searching by code or supplier');
    }
  }

  async getAllProducts(): Promise<ProductEntity[]> {
    try {
      const products = await this.productRepo.find({
        order: { pro_code: 'ASC' },
      });
      return products;
    } catch (error) {
      this.logger.error('Error fetching all products:', error);
      throw new Error('Error fetching all products');
    }
  }

  async updateProductFromBackOffice(body: {
    group: {
      pro_code: string;
      pro_name: string;
      priceA: number;
      priceB: number;
      priceC: number;
      ratio1: number;
      ratio2: number;
      ratio3: number;
      unit1: string;
      unit2: string;
      unit3: string;
      supplier: string;
      pro_lowest_stock: number;
      order_quantity: number;
    }[];
    filename: string;
  }): Promise<string> {
    const queryRunner = this.productRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const item of body.group) {
        const hasValueNonZero = (v) =>
          v !== undefined && v !== null && v !== '' && Number(v) !== 0;
        let ratio2 = 1;
        let ratio3 = 1;

        const ratio1 = 1;

        if (!item.unit2) {
          ratio2 = 1;
        } else {
          ratio2 = hasValueNonZero(item.ratio2)
            ? Math.trunc(Number(item.ratio1) / Number(item.ratio2))
            : 0;
        }

        if (!item.unit3) {
          ratio3 = 1;
        } else {
          ratio3 = hasValueNonZero(item.ratio3)
            ? Math.trunc(Number(item.ratio1) / Number(item.ratio3))
            : 0;
        }

        const updateData: Partial<ProductEntity> = {
          pro_code: item?.pro_code,
          pro_name: item?.pro_name || '',
          pro_lowest_stock: item?.pro_lowest_stock || 0,
          pro_priceA: item?.priceA || 0,
          pro_priceB: item?.priceB || 0,
          pro_priceC: item?.priceC || 0,
          creditor: null,
          order_quantity: item.order_quantity || 0,
        };
        // Assign creditor as entity or null if not found or error
        if (item?.supplier) {
          let supplierCode = item.supplier;
          if (supplierCode.startsWith('N')) {
            supplierCode = supplierCode.substring(1);
          }
          try {
            const foundCreditor = await this.creditorRepo.findOne({
              where: { creditor_code: supplierCode },
            });
            if (foundCreditor) {
              updateData.creditor = foundCreditor;
            } else {
              updateData.creditor = null;
            }
          } catch {
            updateData.creditor = null;
          }
        }
        const existing = await queryRunner.manager.findOne(ProductEntity, {
          where: { pro_code: item?.pro_code },
        });
        if (existing) {
          await queryRunner.manager.update(
            ProductEntity,
            { pro_code: item?.pro_code },
            updateData,
          );
        } else {
          await queryRunner.manager.save(ProductEntity, updateData);
        }
        // จัดการตาราง product_unit โดยตรง (ลบของเก่าและ Insert ของใหม่)
        await queryRunner.manager.delete(ProductUnitEntity, {
          pro_code: item.pro_code,
        });

        const newUnits: ProductUnitEntity[] = [];
        if (item.unit1 && item.unit1.trim() !== '') {
          newUnits.push(
            queryRunner.manager.create(ProductUnitEntity, {
              pro_code: item.pro_code,
              unit_name: item.unit1.trim(),
              ratio: ratio1 || 1,
              level: 1,
            }),
          );
        }
        if (item.unit2 && item.unit2.trim() !== '') {
          newUnits.push(
            queryRunner.manager.create(ProductUnitEntity, {
              pro_code: item.pro_code,
              unit_name: item.unit2.trim(),
              ratio: ratio2 || 1,
              level: 2,
            }),
          );
        }
        if (item.unit3 && item.unit3.trim() !== '') {
          newUnits.push(
            queryRunner.manager.create(ProductUnitEntity, {
              pro_code: item.pro_code,
              unit_name: item.unit3.trim(),
              ratio: ratio3 || 1,
              level: 3,
            }),
          );
        }
        if (newUnits.length > 0) {
          await queryRunner.manager.save(ProductUnitEntity, newUnits);
        }
      }
      await queryRunner.manager.update(
        LogFileEntity,
        { feature: `UpdateProduct` },
        {
          filename: body.filename,
          uploadedAt: new Date(),
        },
      );
      await queryRunner.commitTransaction();
      return `Products updated/inserted successfully.`;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error updating/inserting products:`, error);
      throw new Error(`Error updating/inserting products`);
    } finally {
      await queryRunner.release();
    }
  }

  async updateStock(body: {
    group: { pro_code: string; stock: number }[];
    filename: string;
  }): Promise<string> {
    try {
      for (const item of body.group) {
        await this.productRepo.update(
          { pro_code: item.pro_code },
          { pro_stock: item.stock },
        );
      }
      await this.backendService.updateLogFile(
        { feature: 'UpdateStock' },
        { filename: body.filename, uploadedAt: new Date() },
      );
      return 'Stock updated successfully';
    } catch (error) {
      this.logger.error('Error updating stock:', error);
      throw new Error('Error updating stock');
    }
  }

  async updateProductL16OnlyFromUpload(body: {
    data: { pro_code: string; status: number | string }[];
    filename: string;
  }): Promise<{ message: string; total: number }> {
    const rows = (body.data || [])
      .map((row) => {
        const code = String(row.pro_code ?? '').trim();
        const status = Number(row.status ?? 0) === 1 ? 1 : 0;
        return { code, status };
      })
      .filter((row) => row.code.length > 0);

    if (rows.length === 0) {
      throw new BadRequestException('ไม่พบรหัสสินค้าในไฟล์');
    }

    const uniqueCodes = Array.from(new Set(rows.map((row) => row.code)));
    const existingCodes = new Set<string>();
    const chunkSize = 1000;

    for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
      const chunk = uniqueCodes.slice(i, i + chunkSize);
      const found = await this.productRepo.find({
        where: { pro_code: In(chunk) },
        select: { pro_code: true },
      });
      for (const product of found) {
        existingCodes.add(product.pro_code);
      }
    }

    const missingCodes = uniqueCodes.filter((code) => !existingCodes.has(code));
    if (missingCodes.length > 0) {
      throw new BadRequestException({
        message: 'พบรหัสสินค้าที่ไม่อยู่ในระบบ',
        missingCodes,
        totalMissing: missingCodes.length,
      });
    }

    const codesToEnable = Array.from(
      new Set(rows.filter((row) => row.status === 1).map((row) => row.code)),
    );

    const queryRunner = this.productRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ pro_l16_only: 0 })
        .execute();

      if (codesToEnable.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(ProductEntity)
          .set({ pro_l16_only: 1 })
          .where('pro_code IN (:...codes)', { codes: codesToEnable })
          .execute();
      }

      const feature = 'upload-product-l16';
      const existingLog = await queryRunner.manager.findOne(LogFileEntity, {
        where: { feature },
      });

      if (existingLog) {
        existingLog.filename = body.filename;
        existingLog.uploadedAt = new Date();
        await queryRunner.manager.save(existingLog);
      } else {
        const newLog = queryRunner.manager.create(LogFileEntity, {
          feature,
          filename: body.filename,
          uploadedAt: new Date(),
        });
        await queryRunner.manager.save(newLog);
      }

      await queryRunner.commitTransaction();
      return {
        message: 'L16 visibility updated',
        total: rows.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error updating L16 visibility:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Error updating L16 visibility');
    } finally {
      await queryRunner.release();
    }
  }

  async getProductL16Status(): Promise<
    { pro_code: string; pro_name: string; pro_l16_only: number }[]
  > {
    return this.productRepo
      .createQueryBuilder('product')
      .select(['product.pro_code', 'product.pro_name', 'product.pro_l16_only'])
      .where('product.pro_name NOT LIKE :p1', { p1: 'ฟรี%' })
      .andWhere('product.pro_name NOT LIKE :p2', { p2: '@%' })
      .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
      .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
      .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
      .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
      .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
      .andWhere('product.pro_code NOT LIKE :p8', { p8: '@%' })
      .andWhere('product.pro_priceA > 0')
      .andWhere('product.pro_priceB > 0')
      .andWhere('product.pro_priceC > 0')
      .getMany();
  }

  async keySearchProducts(mem_code?: string, mem_route?: string) {
    try {
      const isL16 = await this.isL16Member(mem_code, mem_route);
      const qb = this.productRepo
        .createQueryBuilder('product')
        .innerJoinAndSelect('product.units', 'units')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :prefix1', { prefix1: 'ฟรี%' })
              .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', {
                prefix4: 'รีเบท%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix5', { prefix5: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix6', {
                prefix6: '/%',
              })
              .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
              .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
              .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
              .andWhere('product.invisible_id IS NULL')
              .andWhere('product.pro_name NOT LIKE :prefix7', {
                prefix7: 'ค่า%',
              })
              .andWhere('product.pro_code NOT LIKE :prefix8', {
                prefix8: '@M%',
              });
          }),
        );

      if (isL16) {
        this.applyL16Filter(qb, 'product');
      }

      const products = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_genericname',
          'product.pro_nameSale',
          'product.pro_nameEN',
          'product.pro_keysearch',
        ])
        .getMany();
      return products;
    } catch (error) {
      this.logger.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async findProductFree(): Promise<
    { pro_code: string; pro_name: string; pro_point: number }[]
  > {
    try {
      const products = await this.productRepo.find({
        where: { pro_free: true },
      });
      return products.map((product) => ({
        pro_code: product.pro_code,
        pro_name: product.pro_name,
        pro_point: product.pro_point,
      }));
    } catch (error) {
      this.logger.error('Error finding free products:', error);
      throw new Error('Error finding free products');
    }
  }

  async findProductPromotion(): Promise<
    {
      pro_code: string;
      pro_promotion_month: number;
      pro_promotion_amount: number;
    }[]
  > {
    try {
      const products = await this.productRepo.find({
        where: { pro_promotion_month: MoreThan(0) },
        select: {
          pro_code: true,
          pro_promotion_month: true,
          pro_promotion_amount: true,
        },
      });
      return products.map((product) => ({
        pro_code: product.pro_code,
        pro_promotion_month: product.pro_promotion_month || 0,
        pro_promotion_amount: product.pro_promotion_amount || 0,
      }));
    } catch (error) {
      this.logger.error('Error finding promotion products:', error);
      throw new Error('Error finding promotion products');
    }
  }
  async updateSaleDayly(data: { pro_code: string; amount: number }[]) {
    try {
      await this.productRepo.update(
        { pro_code: Not(IsNull()) },
        { sale_amount_day: null },
      );

      for (const item of data) {
        await this.productRepo.update(
          { pro_code: item.pro_code },
          { sale_amount_day: item.amount },
        );
      }
    } catch (error) {
      this.logger.error('Error updating sale amount day:', error);
      throw new Error('Error updating sale amount day');
    }
  }

  async getDataCreditor(keyword?: string): Promise<CreditorEntity[] | []> {
    try {
      const creditors = await this.creditorRepo
        .createQueryBuilder('creditor')
        .where(
          'creditor.creditor_code LIKE :kw OR creditor.creditor_name LIKE :kw',
          { kw: `%${keyword}%` },
        )
        .take(10)
        .getMany();
      return creditors;
    } catch (error) {
      this.logger.error('Error fetching creditor data:', error);
      throw new Error('Error fetching creditor data');
    }
  }

  async saveAddress(creditor: string, address?: string): Promise<void> {
    try {
      const findCreditor = await this.creditorRepo.findOne({
        where: { creditor_code: creditor, creditor_address: address },
      });
      if (address && !findCreditor) {
        await this.creditorRepo.update(
          { creditor_code: creditor },
          { creditor_address: address },
        );
      }
    } catch (error) {
      this.logger.error('Error saving address:', error);
      throw new Error('Error saving address');
    }
  }

  async searchProductsBanner() {
    try {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoin('product.creditor', 'creditor')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :prefix1', { prefix1: 'ฟรี%' })
              .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', {
                prefix4: 'รีเบท%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix5', { prefix5: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix6', {
                prefix6: '/%',
              })
              .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
              .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
              .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
              .andWhere('product.invisible_id IS NULL')
              .andWhere('product.pro_name NOT LIKE :prefix7', {
                prefix7: 'ค่า%',
              })
              .andWhere('product.pro_code NOT LIKE :prefix8', {
                prefix8: '@M%',
              });
          }),
        );

      const products = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_genericname',
          'product.pro_nameSale',
          'product.pro_nameEN',
          'product.pro_keysearch',
          'creditor.creditor_code',
        ])
        .getMany();
      return products;
    } catch (error) {
      this.logger.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async getCreditors(): Promise<CreditorEntity[]> {
    try {
      const creditors = await this.creditorRepo.find({
        order: { creditor_code: 'ASC' },
      });
      return creditors;
    } catch (error) {
      this.logger.error('Error fetching creditors:', error);
      throw new Error('Error fetching creditors');
    }
  }

  async getProductImageByCode(pro_code: string): Promise<ProductEntity | null> {
    try {
      const product = await this.productRepo.findOne({
        where: { pro_code },
        select: {
          pro_imgmain: true,
          pro_code: true,
          pro_img2: true,
          pro_img3: true,
          pro_img4: true,
          pro_img5: true,
        },
      });
      return product;
    } catch (error) {
      this.logger.error('Error fetching product image:', error);
      throw new Error('Error fetching product image');
    }
  }

  async handleProductImageUpdate(data: UpdateProductImageDto): Promise<void> {
    try {
      const updateData: Partial<ProductEntity> = {
        pro_imgmain: data.img_main,
        pro_img2: data.image_other[0] ?? null,
        pro_img3: data.image_other[1] ?? null,
        pro_img4: data.image_other[2] ?? null,
        pro_img5: data.image_other[3] ?? null,
      };

      await this.productRepo.update({ pro_code: data.pro_code }, updateData);
    } catch (error) {
      this.logger.error(
        `Error updating product images for ${data.pro_code}:`,
        error,
      );
      throw new Error(`Error updating product images for ${data.pro_code}`);
    }
  }

  async deleteProductImage(image: string[]): Promise<void> {
    try {
      for (const img of image) {
        const product = await this.productRepo.findOne({
          where: [
            { pro_imgmain: img },
            { pro_img2: img },
            { pro_img3: img },
            { pro_img4: img },
            { pro_img5: img },
          ],
          select: {
            pro_code: true,
            pro_imgmain: true,
            pro_img2: true,
            pro_img3: true,
            pro_img4: true,
            pro_img5: true,
          },
        });
        if (!product) continue;

        const updateData: Partial<ProductEntity> = {};
        if (product.pro_imgmain === img) updateData.pro_imgmain = '';
        if (product.pro_img2 === img) updateData.pro_img2 = '';
        if (product.pro_img3 === img) updateData.pro_img3 = '';
        if (product.pro_img4 === img) updateData.pro_img4 = '';
        if (product.pro_img5 === img) updateData.pro_img5 = '';

        if (Object.keys(updateData).length > 0) {
          await this.productRepo.update(
            { pro_code: product.pro_code },
            updateData,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error deleting product images:', error);
    }
  }

  async searchExternalProducts(search: string): Promise<ProductEntity[]> {
    try {
      const response = await axios.get<ApiResponse>(
        `${process.env.OLD_WEBSITE_URL}/API/appV3/search_auto.php`,
        {
          params: { search },
        },
      );

      if (!response.data) {
        return [];
      }

      const datafromAPI = response.data;

      if (
        datafromAPI?.status !== 'success' ||
        !Array.isArray(datafromAPI?.data)
      ) {
        return [];
      }

      const proCodes = datafromAPI?.data
        .map((item) => item.pro_code)
        .filter(Boolean);

      if (!proCodes.length) {
        return [];
      }

      const product = await this.productRepo
        .createQueryBuilder('product')
        .where('product.pro_code IN (:...proCodes)', { proCodes })
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_genericname',
          'product.pro_nameSale',
          'product.pro_nameEN',
          'product.pro_keysearch',
          'creditor.creditor_code',
        ])
        .leftJoin('product.creditor', 'creditor')
        .getMany();

      return product;
    } catch (error) {
      this.logger.error('Error searching external products:', error);
      return [];
    }
  }

  async searchEnterProducts(search: string): Promise<string[]> {
    try {
      if (!search) {
        return [];
      }

      const response = await axios.get<ApiResponse>(
        `${process.env.OLD_WEBSITE_URL}/API/appV3/search_enter.php`,
        {
          params: { search },
        },
      );

      if (
        response.data?.status !== 'success' ||
        !Array.isArray(response.data.data)
      ) {
        return [];
      }

      const proCodes = response.data.data
        .map((item) => item.pro_code)
        .filter(Boolean);

      return proCodes;
    } catch (error) {
      this.logger.error('Error searching enter products:', error);
      return [];
    }
  }

  async updateProductFromEasyAcc(data: ProductEasyAcc) {
    try {
      const productData = await this.productRepo.findOne({
        where: { pro_code: data.product_code },
      });

      if (!productData) {
        this.logger.warn(
          `Product with code ${data.product_code} not found for EasyAcc update`,
        );
        return;
      }

      const productUnitsData = await this.productUnitRepo.find({
        where: { pro_code: data.product_code },
      });

      const isDeleting = (name?: string | null) =>
        name !== undefined && (!name || name.trim() === '');

      const deletedLevels: Array<'1' | '2' | '3'> = [];
      if (
        isDeleting(data.product_unit2) &&
        productUnitsData.some((u) => u.level === 2)
      )
        deletedLevels.push('2');
      if (
        isDeleting(data.product_unit3) &&
        productUnitsData.some((u) => u.level === 3)
      )
        deletedLevels.push('3');

      if (deletedLevels.length > 0) {
        const cartItems = await this.checkCartByProcode(data.product_code);
        const affectedItems = cartItems.filter(
          (item) =>
            item.spc_unit_enum !== null &&
            deletedLevels.includes(item.spc_unit_enum),
        );
        for (const item of affectedItems) {
          await this.createDeleteCartByProcode(
            item.product.pro_code,
            item.product.pro_imgmain,
            item.product.pro_name,
            item.spc_unit_enum as string,
            item.mem_code,
          );
        }
      }

      if (data.product_name !== undefined)
        productData.pro_name = data.product_name;
      if (data.product_nameEN !== undefined)
        productData.pro_nameEN = data.product_nameEN as string;
      if (data.product_nameSale !== undefined)
        productData.pro_nameSale = data.product_nameSale as string;
      if (data.product_genericname !== undefined)
        productData.pro_genericname = data.product_genericname as string;
      if (data.product_barcode !== undefined)
        productData.pro_barcode1 = data.product_barcode as string;
      if (data.product_barcode2 !== undefined)
        productData.pro_barcode2 = data.product_barcode2 as string;
      if (data.product_barcode3 !== undefined)
        productData.pro_barcode3 = data.product_barcode3 as string;
      if (data.product_keysearch !== undefined)
        productData.pro_keysearch = data.product_keysearch as string;
      if (data.product_stock !== undefined)
        productData.pro_stock = data.product_stock as number;
      if (data.product_lowest_stock !== undefined)
        productData.pro_lowest_stock = data.product_lowest_stock as number;
      if (data.creditor_code !== undefined)
        productData.creditor = data.creditor_code
          ? ({ creditor_code: data.creditor_code } as CreditorEntity)
          : null;
      if (data.product_price_a !== undefined)
        productData.pro_priceA = data.product_price_a as number;
      if (data.product_price_b !== undefined)
        productData.pro_priceB = data.product_price_b as number;
      if (data.product_price_c !== undefined)
        productData.pro_priceC = data.product_price_c as number;
      if (data.pro_category !== undefined)
        productData.pro_category = data.pro_category as number;
      if (data.drugregister !== undefined)
        productData.pro_drugregister = data.drugregister as string;

      if (Object.keys(productData).length === 0) return;

      await this.productRepo.update(
        { pro_code: data.product_code },
        productData,
      );

      if (
        data.product_unit1 !== undefined ||
        data.product_unit2 !== undefined ||
        data.product_unit3 !== undefined ||
        data.product_ratio_1 !== undefined ||
        data.product_ratio_2 !== undefined ||
        data.product_ratio_3 !== undefined
      ) {
        const existingUnits = await this.productUnitRepo.find({
          where: { pro_code: data.product_code },
        });

        const processUnit = async (
          level: number,
          unitNameData?: string | null,
          ratioData?: number | null,
        ) => {
          let unit = existingUnits.find((u) => u.level === level);

          const unitName =
            unitNameData !== undefined ? unitNameData : unit?.unit_name;
          const ratio = ratioData !== undefined ? ratioData : unit?.ratio;

          if (unitName && unitName.trim() !== '') {
            if (!unit) {
              unit = this.productUnitRepo.create({
                pro_code: data.product_code,
                level,
              });
            }
            unit.unit_name = unitName.trim();
            unit.ratio = ratio ?? 1;
            await this.productUnitRepo.save(unit);
          } else if (
            unit &&
            unitNameData !== undefined &&
            (!unitNameData || unitNameData.trim() === '')
          ) {
            await this.productUnitRepo.delete(unit.id);
          }
        };

        await processUnit(1, data.product_unit1, data.product_ratio_1);
        await processUnit(2, data.product_unit2, data.product_ratio_2);
        await processUnit(3, data.product_unit3, data.product_ratio_3);
      }
    } catch (error) {
      console.error('Error updating product from EasyAcc:', error);
    }
  }

  async updateProductImageFromCentral(
    data: UpdateProductImageEcommercePayload,
  ): Promise<void> {
    try {
      const updateData: Record<string, string | null> = {};
      if (data.pro_imgmain !== undefined)
        updateData.pro_imgmain = data.pro_imgmain;
      if (data.pro_img2 !== undefined) updateData.pro_img2 = data.pro_img2;
      if (data.pro_img3 !== undefined) updateData.pro_img3 = data.pro_img3;
      if (data.pro_img4 !== undefined) updateData.pro_img4 = data.pro_img4;
      if (data.pro_img5 !== undefined) updateData.pro_img5 = data.pro_img5;

      if (Object.keys(updateData).length === 0) return;

      await this.productRepo.update(
        { pro_code: data.product_code },
        updateData,
      );
    } catch (error) {
      this.logger.error('Error updating product image from central:', error);
    }
  }

  async createDeleteCartByProcode(
    pro_code: string,
    pro_imgmain: string,
    pro_name: string,
    pro_unit_level: string,
    mem_code: string,
  ) {
    try {
      const cartItem = this.deleteCartRepo.create({
        mem_code: mem_code,
        product: { pro_code },
        data: {
          pro_imgmain,
          pro_name,
          pro_unit_level,
        },
      });
      await this.deleteCartRepo.save(cartItem);
      await this.shoppingCartRepo.delete({
        pro_code,
        spc_unit_enum: pro_unit_level as ShoppingCartEntity['spc_unit_enum'],
      });
      const member = await this.userRepo.findOne({ where: { mem_code } });
      await this.shoppingCartService.checkPromotionReward(
        mem_code,
        member?.mem_price ?? 'C',
      );
      await this.shoppingCartService.checkHotdealByProCode(mem_code, pro_code);
    } catch (error) {
      console.log(error);
      throw new Error('Error in createDeleteCartByProcode');
    }
  }

  async checkCartByProcode(pro_code: string) {
    try {
      const cartItems = await this.shoppingCartRepo.find({
        where: { pro_code },
        relations: {
          product: true,
        },
        select: {
          spc_unit_enum: true,
          spc_amount: true,
          mem_code: true,
          product: {
            pro_code: true,
            pro_imgmain: true,
            pro_name: true,
          },
        },
      });
      return cartItems;
    } catch {
      throw new Error('Error in checkCartByProcode');
    }
  }

  async getProductImageUrls(pro_code: string): Promise<{
    pro_imgmain: string | null;
    pro_img2: string | null;
    pro_img3: string | null;
    pro_img4: string | null;
    pro_img5: string | null;
  } | null> {
    const product = await this.productRepo.findOne({
      where: { pro_code },
      select: {
        pro_imgmain: true,
        pro_img2: true,
        pro_img3: true,
        pro_img4: true,
        pro_img5: true,
      },
    });
    if (!product) return null;
    return {
      pro_imgmain: product.pro_imgmain ?? null,
      pro_img2: product.pro_img2 ?? null,
      pro_img3: product.pro_img3 ?? null,
      pro_img4: product.pro_img4 ?? null,
      pro_img5: product.pro_img5 ?? null,
    };
  }

  async productSearchProductName(
    search: string,
  ): Promise<{ pro_code: string; pro_name: string }[]> {
    try {
      search = search.trim();
      const products = await this.productRepo
        .createQueryBuilder('product')
        .where(
          new Brackets((qb) =>
            qb
              .where('product.pro_name LIKE :search', {
                search: `%${search}%`,
              })
              .orWhere('product.pro_code LIKE :search', {
                search: `%${search}%`,
              }),
          ),
        )
        .andWhere('product.pro_name NOT LIKE :p1', { p1: 'ฟรี%' })
        .andWhere('product.pro_code NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .select(['product.pro_code', 'product.pro_name'])
        .take(10)
        .getMany();
      return products;
    } catch (error) {
      this.logger.error('Error searching product by name:', error);
      throw new Error('Error searching product by name');
    }
  }
}
