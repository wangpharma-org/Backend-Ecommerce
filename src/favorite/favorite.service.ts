import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { FavoriteEntity } from './favorite.entity';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/users/users.entity';
import { ProductEntity } from 'src/products/products.entity';

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name);
  constructor(
    @InjectRepository(FavoriteEntity)
    private readonly favoriteRepo: Repository<FavoriteEntity>,
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

  private async removeL16Favorites(
    mem_code: string,
    isL16: boolean,
  ): Promise<void> {
    if (!isL16) {
      return;
    }
    const l16SubQuery = this.favoriteRepo
      .createQueryBuilder()
      .subQuery()
      .select('product.pro_code')
      .from(ProductEntity, 'product')
      .where('product.pro_l16_only = :l16')
      .getQuery();

    await this.favoriteRepo
      .createQueryBuilder()
      .delete()
      .from(FavoriteEntity)
      .where('mem_code = :mem_code', { mem_code })
      .andWhere(`pro_code IN ${l16SubQuery}`)
      .setParameter('l16', 1)
      .execute();
  }

  async addToFavorite(data: { mem_code: string; pro_code: string }) {
    try {
      const favorite = this.favoriteRepo.create({
        member: { mem_code: data.mem_code },
        product: { pro_code: data.pro_code },
      });
      return await this.favoriteRepo.save(favorite);
    } catch (error) {
      this.logger.error(`Error Something in addToFavorite: ${error}`);
      throw new Error('Error Something in addToFavorite');
    }
  }

  async deleteFavorite(data: {
    fav_id: number;
    mem_code: string;
    sort_by?: number;
    mem_route?: string;
  }) {
    try {
      await this.favoriteRepo.delete(data.fav_id);
      return this.getListFavorite(
        data.mem_code,
        data.sort_by?.toString(),
        data.mem_route,
      );
    } catch {
      throw new Error('Error Something in deleteFavorite');
    }
  }

  async getListFavorite(
    mem_code: string,
    sort_by?: string,
    mem_route?: string,
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
      const isL16 = await this.isL16Member(mem_code, mem_route);
      await this.removeL16Favorites(mem_code, isL16);

      const qb = this.favoriteRepo
        .createQueryBuilder('fav')
        .leftJoinAndSelect('fav.product', 'product')
        .leftJoin('product.units', 'units')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .leftJoinAndSelect('product.inHotdeals', 'hotdeal')
        .leftJoinAndSelect('hotdeal.product2', 'hotdealProduct2')
        .setParameter('memCode', mem_code)
        .where('fav.member.mem_code = :mem_code', { mem_code });

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
        'product.pro_promotion_month',
        'product.pro_promotion_amount',
        'product.pro_sale_amount',
        'product.pro_lowest_stock',
        'product.order_quantity',
        'units.id',
        'units.unit_name',
        'units.level',
        'units.ratio',
        'cart.spc_id',
        'cart.spc_amount',
        'cart.spc_unit_enum',
        'cart.mem_code',
        'hotdeal.id',
        'hotdeal.pro1_amount',
        'hotdeal.pro1_unit',
        'hotdeal.pro2_amount',
        'hotdeal.pro2_unit',
        'hotdealProduct2.pro_code',
        'hotdealProduct2.pro_name',
        'hotdealProduct2.pro_imgmain',
      ]);

      const data = await qb.getMany();
      return data.map((favorite) => {
        const units = (favorite.product?.units ?? []) as {
          level: number;
          unit_name: string;
          ratio: number;
        }[];
        const unit1 = units.find((u) => u.level === 1);
        const unit2 = units.find((u) => u.level === 2);
        const unit3 = units.find((u) => u.level === 3);
        const inCarts = (favorite.product?.inCarts ?? []).map((cart) => ({
          ...cart,
          spc_unit:
            units.find((u) => u.level === Number(cart.spc_unit_enum))
              ?.unit_name ?? '',
        }));
        const favWithFlag = {
          ...favorite,
          product: {
            ...favorite.product,
            pro_unit1: unit1?.unit_name ?? '',
            pro_unit2: unit2?.unit_name ?? '',
            pro_unit3: unit3?.unit_name ?? '',
            pro_ratio1: unit1?.ratio ?? 1,
            pro_ratio2: unit2?.ratio ?? 1,
            pro_ratio3: unit3?.ratio ?? 1,
            inCarts,
          },
        } as unknown as FavoriteEntity & {
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
      this.logger.error(error);
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
