import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { FavoriteEntity } from './favorite.entity';
import { Repository } from 'typeorm';
import { stringify } from 'querystring';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(FavoriteEntity)
    private readonly favoriteRepo: Repository<FavoriteEntity>,
  ) {}

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
  ): Promise<FavoriteEntity[]> {
    try {
      const qb = this.favoriteRepo
        .createQueryBuilder('fav')
        .leftJoinAndSelect('fav.product', 'product')
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
        'product.pro_sale_amount',
        'product.pro_lowest_stock',
        'product.order_quantity',
      ]);

      const data = await qb.getMany();
      return data;
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
