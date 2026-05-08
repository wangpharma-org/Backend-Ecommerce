import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FlashSaleEntity } from './flashsale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FlashSaleProductsEntity } from './flashsale-product.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { UserEntity } from 'src/users/users.entity';

@Injectable()
export class FlashsaleService {
  private readonly logger = new Logger(FlashsaleService.name);

  constructor(
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepo: Repository<FlashSaleEntity>,
    @InjectRepository(FlashSaleProductsEntity)
    private readonly flashSaleProductsRepo: Repository<FlashSaleProductsEntity>,
    @InjectRepository(ShoppingCartEntity)
    private readonly shoppingCartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

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
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  async addFlashSale(data: {
    promotion_name: string;
    date: string;
    time_start: string;
    time_end: string;
    is_active: boolean;
  }) {
    try {
      const overlap = await this.flashSaleRepo
        .createQueryBuilder('f')
        .where('f.date = :date', { date: data.date })
        .andWhere(
          `
        (f.time_start < :time_end AND f.time_end > :time_start)
        `,
          {
            time_start: data.time_start,
            time_end: data.time_end,
          },
        )
        .getOne();

      if (overlap) {
        throw new BadRequestException(
          `มี Flash Sale ที่วันที่ ${data.date} และเวลา ${data.time_start} - ${data.time_end} อยู่แล้ว`,
        );
      }
      this.flashSaleRepo.create(data);
      return await this.flashSaleRepo.save(data);
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error Something in addFlashSale');
    }
  }

  async EditFlashSale(data: {
    promotion_id: number;
    promotion_name: string;
    date: string;
    time_start: string;
    time_end: string;
    is_active: boolean;
  }) {
    try {
      const overlap = await this.flashSaleRepo
        .createQueryBuilder('f')
        .where('f.date = :date', { date: data.date })
        .andWhere(
          `
        (f.time_start < :time_end AND f.time_end > :time_start)
        `,
          {
            time_start: data.time_start,
            time_end: data.time_end,
          },
        )
        .andWhere('f.promotion_id != :promotion_id', {
          promotion_id: data.promotion_id,
        })
        .getOne();
      if (overlap) {
        throw new BadRequestException(
          `มี Flash Sale ที่วันที่ ${data.date} และเวลา ${data.time_start} - ${data.time_end} อยู่แล้ว`,
        );
      }

      return await this.flashSaleRepo.update(data.promotion_id, {
        promotion_name: data.promotion_name,
        date: data.date,
        time_start: data.time_start,
        time_end: data.time_end,
        is_active: data.is_active,
      });
    } catch (error) {
      this.logger.error(`Error Something in EditFlashSale: ${error}`);
      throw new Error('Error Something in EditFlashSale');
    }
  }

  async addProductToFlashSale(data: {
    promotion_id: number;
    pro_code: string;
    limit: number;
  }) {
    try {
      const now = new Date();
      const payload = this.flashSaleProductsRepo.create({
        flashsale: { promotion_id: data.promotion_id },
        product: { pro_code: data.pro_code },
        limit: data.limit,
      });
      const flashSale = await this.flashSaleRepo.findOne({
        where: { promotion_id: data.promotion_id },
      });
      if (
        flashSale?.is_active &&
        flashSale.date === now.toISOString().split('T')[0] &&
        flashSale.time_end >= now.toTimeString().split(' ')[0] &&
        flashSale.time_start <= now.toTimeString().split(' ')[0]
      ) {
        await this.shoppingCartRepo.update(
          {
            pro_code: data.pro_code,
          },
          {
            flashsale_end: flashSale?.date + ' ' + flashSale?.time_end,
          },
        );
      }
      return await this.flashSaleProductsRepo.save(payload);
    } catch (error) {
      this.logger.error(`Error Something in addProductToFlashSale: ${error}`);
      throw new Error('Error Something in addProductToFlashSale');
    }
  }

  async getAllFlashSales() {
    try {
      return await this.flashSaleRepo.find();
    } catch (error) {
      this.logger.error(`Error Something in getAllFlashSales: ${error}`);
      throw new Error('Error Something in getAllFlashSales');
    }
  }

  async getProductsInFlashSale(promotion_id: number) {
    try {
      return await this.flashSaleProductsRepo.find({
        where: { flashsale: { promotion_id } },
        relations: {
          product: true,
        },
        select: {
          id: true,
          product: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
            pro_genericname: true,
          },
          limit: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error Something in getProductsInFlashSale: ${error}`);
      throw new Error('Error Something in getProductsInFlashSale');
    }
  }

  async deleteProduct(id: number) {
    try {
      return await this.flashSaleProductsRepo.delete(id);
    } catch (error) {
      this.logger.error(`Error Something in deleteProduct: ${error}`);
      throw new Error('Error Something in deleteProduct');
    }
  }

  async editProductInFlashSale(data: { id: number; limit: number | null }) {
    try {
      await this.flashSaleProductsRepo.update(data.id, {
        limit: data.limit,
      });
      return await this.flashSaleProductsRepo.findOne({
        where: { id: data.id },
        relations: {
          product: true,
        },
        select: {
          id: true,
          product: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
            pro_genericname: true,
          },
          limit: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error Something in editProductInFlashSale: ${error}`);
      throw new Error('Error Something in editProductInFlashSale');
    }
  }

  async getFlashSale(limit: number, mem_code: string, mem_route?: string) {
    try {
      const isL16 = await this.isL16Member(mem_code, mem_route);
      const now = new Date();
      const currentDate = now.toLocaleDateString('sv-SE');
      const currentTime = now.toTimeString().split(' ')[0];

      const data = await this.flashSaleRepo
        .createQueryBuilder('flash')
        .leftJoinAndSelect('flash.flashsaleProducts', 'fsp')
        .leftJoinAndSelect('fsp.product', 'product')
        .leftJoinAndSelect('product.units', 'units')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', mem_code)
        .leftJoin('product.units', 'u1', 'u1.level = 1')
        .leftJoin('product.units', 'u2', 'u2.level = 2')
        .leftJoin('product.units', 'u3', 'u3.level = 3')
        .where('flash.date = :date', { date: currentDate })
        .andWhere(':nowTime BETWEEN flash.time_start AND flash.time_end', {
          nowTime: currentTime,
        })
        .andWhere('flash.is_active = :active', { active: true })
        .andWhere(
          isL16
            ? '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)'
            : '1=1',
        )
        .select([
          'flash.promotion_id',
          'flash.promotion_name',
          'flash.date',
          'flash.time_start',
          'flash.time_end',
          'flash.is_active',
          'fsp.id',
          'fsp.limit',
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'u1.unit_name as pro_unit1',
          'u2.unit_name as pro_unit2',
          'u3.unit_name as pro_unit3',
          'product.pro_imgmain',
          'product.pro_promotion_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.mem_code',
        ])
        .take(Number(limit))
        .getMany();

      return data;
    } catch (error) {
      this.logger.error(`Error in getFlashSale: ${error}`);
      throw new Error('Error in getFlashSale');
    }
  }

  async changeStatus(data: { promotion_id: number; is_active: boolean }) {
    try {
      const now = new Date();
      await this.flashSaleRepo.update(data.promotion_id, {
        is_active: data.is_active,
      });
      const flashsale = await this.flashSaleRepo.findOne({
        relations: {
          flashsaleProducts: {
            product: true,
          },
        },
        where: { promotion_id: data.promotion_id },
      });
      if (
        flashsale?.is_active &&
        flashsale.date === now.toISOString().split('T')[0] &&
        flashsale.time_end >= now.toTimeString().split(' ')[0] &&
        flashsale.time_start <= now.toTimeString().split(' ')[0]
      ) {
        await this.shoppingCartRepo.update(
          {
            pro_code: In(
              flashsale.flashsaleProducts.map((item) => item.product.pro_code),
            ),
          },
          {
            flashsale_end: flashsale.date + ' ' + flashsale.time_end,
          },
        );
      } else {
        await this.shoppingCartRepo.update(
          {
            pro_code: In(
              flashsale?.flashsaleProducts.map(
                (item) => item.product.pro_code,
              ) || [],
            ),
          },
          {
            flashsale_end: null,
          },
        );
      }
    } catch (error) {
      this.logger.error(`Error Something in changeStatus: ${error}`);
      throw new Error('Error Something in changeStatus');
    }
  }

  async deleteFlashSale(promotion_id: number) {
    try {
      await this.flashSaleProductsRepo.delete({ flashsale: { promotion_id } });
      return await this.flashSaleRepo.delete(promotion_id);
    } catch (error) {
      this.logger.error(`Error Something in deleteFlashSale: ${error}`);
      throw new Error('Error Something in deleteFlashSale');
    }
  }

  async findAllFlashSales() {
    try {
      return await this.flashSaleRepo.find({
        relations: {
          flashsaleProducts: {
            product: true,
          },
        },
        select: {
          promotion_id: true,
          promotion_name: true,
          date: true,
          time_start: true,
          time_end: true,
          is_active: true,
          flashsaleProducts: {
            id: true,
            limit: true,
            product: {
              pro_code: true,
              pro_name: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Error Something in findAllFlashSales: ${error}`);
      throw new Error('Error Something in findAllFlashSales');
    }
  }
}
