import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { FavoriteEntity } from './favorite.entity';
import { Repository } from 'typeorm';
import { stringify } from 'querystring';
import { UserEntity } from 'src/users/users.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(FavoriteEntity)
    private readonly favoriteRepo: Repository<FavoriteEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private async isL16Member(mem_code?: string): Promise<boolean> {
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  private async removeL16Favorites(
    mem_code: string,
    isL16: boolean,
  ): Promise<void> {
    if (isL16) {
      return;
    }
    await this.favoriteRepo.query(
      'DELETE FROM `favorite` WHERE `mem_code` = ? AND `pro_code` IN (SELECT `pro_code` FROM `product` WHERE `pro_l16_only` = 1)',
      [mem_code],
    );
  }

  async addToFavorite(data: { mem_code: string; pro_code: string }) {
    try {
      const favorite = this.favoriteRepo.create({
        member: { mem_code: data.mem_code },
        product: { pro_code: data.pro_code },
      });
      return await this.favoriteRepo.save(favorite);
    } catch (error) {
      console.log(`${Date()} Error Something in addToFavorite`);
      console.log(error);
      throw new Error('Error Something in addToFavorite');
    }
  }

  async deleteFavorite(data: {
    fav_id: number;
    mem_code: string;
    sort_by?: number;
  }) {
    try {
      await this.favoriteRepo.delete(data.fav_id);
      return this.getListFavorite(data.mem_code, data.sort_by?.toString());
    } catch {
      throw new Error('Error Something in deleteFavorite');
    }
  }

  async getListFavorite(
    mem_code: string,
    sort_by?: string,
  ): Promise<
    (FavoriteEntity & {
      isMonthlyDeal: boolean;
      hasHotdeal: boolean;
      promotionDetail: {
        hotdeal?: {
          id: number;
          pro1_amount: string;
          pro1_unit: string;
          pro2_amount: string;
          pro2_unit: string;
          product2: {
            pro_code: string;
            pro_name: string;
            pro_imgmain: string;
            pro_unit1: string;
            pro_unit2: string;
            pro_unit3: string;
          } | null;
        };
        monthly?: {
          month: number | null;
          amount: number | null;
        };
      };
    })[]
  > {
    try {
      const isL16 = await this.isL16Member(mem_code);
      await this.removeL16Favorites(mem_code, isL16);
      const currentMonth = new Date().getMonth() + 1;

      const qb = this.favoriteRepo
        .createQueryBuilder('fav')
        .leftJoinAndSelect('fav.product', 'product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .leftJoinAndSelect('product.inHotdeals', 'hotdeal')
        .leftJoinAndSelect('hotdeal.product2', 'hotdealProduct2')
        .setParameter('memCode', mem_code)
        .where('fav.member.mem_code = :mem_code', { mem_code });

      if (!isL16) {
        qb.andWhere(
          '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)',
        );
      }

      switch (sort_by) {
        case '1':
          qb.orderBy('product.pro_stock', 'DESC');
          break;
        case '2':
          qb.orderBy('product.pro_stock', 'ASC');
          break;
        case '3':
          qb.orderBy('product.pro_priceA', 'DESC');
          break;
        case '4':
          qb.orderBy('product.pro_priceA', 'ASC');
          break;
        case '5':
          qb.orderBy('product.pro_sale_amount', 'DESC');
          break;
        default:
          qb.orderBy('product.pro_name', 'ASC');
      }

      qb.select([
        'fav.fav_id',
        'product.pro_code',
        'product.pro_name',
        'product.pro_imgmain',
        'product.pro_priceA',
        'product.pro_priceB',
        'product.pro_priceC',
        'product.pro_stock',
        'product.pro_point',
        'product.pro_unit1',
        'product.pro_unit2',
        'product.pro_unit3',
        'product.pro_promotion_month',
        'product.pro_promotion_amount',
        'product.pro_sale_amount',
        'product.pro_lowest_stock',
        'product.order_quantity',
        'cart.spc_id',
        'cart.spc_amount',
        'cart.spc_unit',
        'cart.mem_code',
        'hotdeal.id',
        'hotdeal.pro1_amount',
        'hotdeal.pro1_unit',
        'hotdeal.pro2_amount',
        'hotdeal.pro2_unit',
        'hotdealProduct2.pro_code',
        'hotdealProduct2.pro_name',
        'hotdealProduct2.pro_imgmain',
        'hotdealProduct2.pro_unit1',
        'hotdealProduct2.pro_unit2',
        'hotdealProduct2.pro_unit3',
      ]);

      const data = await qb.getMany();
      return data.map((favorite) => {
        const favWithFlag = favorite as FavoriteEntity & {
          isMonthlyDeal: boolean;
          hasHotdeal: boolean;
          promotionDetail: {
            type: 'hotdeal' | 'monthly' | null;
            hotdeal?: {
              id: number;
              pro1_amount: string;
              pro1_unit: string;
              pro2_amount: string;
              pro2_unit: string;
              product2: {
                pro_code: string;
                pro_name: string;
                pro_imgmain: string;
                pro_unit1: string;
                pro_unit2: string;
                pro_unit3: string;
              } | null;
            };
            monthly?: {
              month: number | null;
              amount: number | null;
            };
          };
        };
        return favWithFlag;
      });
    } catch (error) {
      console.error(error);
      throw new Error('Error Something in getListFavorite');
    }
  }

  async getCountFavorite(mem_code: string): Promise<number> {
    try {
      return await this.favoriteRepo.count({
        where: { member: { mem_code } },
      });
    } catch {
      throw new Error('Error Something in getCountFavorite');
    }
  }
}
