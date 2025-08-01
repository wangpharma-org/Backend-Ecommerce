import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { FavoriteEntity } from './favorite.entity';
import { Repository } from 'typeorm';

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

  async deleteFavorite(data: { fav_id: number; mem_code: string }) {
    try {
      await this.favoriteRepo.delete(data.fav_id);
      return this.getListFavorite(data.mem_code);
    } catch {
      throw new Error('Error Something in deleteFavorite');
    }
  }

  async getListFavorite(mem_code: string): Promise<FavoriteEntity[] | []> {
    try {
      const data = await this.favoriteRepo.find({
        where: {
          member: { mem_code: mem_code },
        },
        relations: {
          product: true,
        },
        select: {
          product: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
            pro_priceA: true,
            pro_priceB: true,
            pro_priceC: true,
          },
        },
      });

      console.log(data);

      return data;
    } catch {
      throw new Error('Error Something in getListFavorite');
    }
  }
}
