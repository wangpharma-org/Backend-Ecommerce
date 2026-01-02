import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecommendEntity } from './recommend.entity';
import { Repository, In, Not, MoreThan } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';

@Injectable()
export class RecommendService {
  constructor(
    @InjectRepository(RecommendEntity)
    private readonly recommendEntity: Repository<RecommendEntity>,
    @InjectRepository(ProductEntity)
    private readonly productEntity: Repository<ProductEntity>,
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

  async insertTag(tag: string) {
    try {
      const newTag = this.recommendEntity.create({ tag });
      return this.recommendEntity.save(newTag);
    } catch (error) {
      throw new Error(`Failed to insert tag: ${error}`);
    }
  }

  async deleteTag(id: number) {
    try {
      await this.productEntity.update(
        { recommend: { id } },
        { recommend: { id: undefined }, recommend_rank: undefined },
      );
      return this.recommendEntity.delete(id);
    } catch (error) {
      throw new Error(`Failed to delete tag: ${error}`);
    }
  }

  async getAllTags() {
    try {
      return this.recommendEntity.find();
    } catch (error) {
      throw new Error(`Failed to get all tags: ${error}`);
    }
  }

  async getProductsByTag(tag_id: number) {
    try {
      return this.recommendEntity.findOne({
        where: { id: tag_id },
        relations: {
          products: true,
        },
        select: {
          products: {
            pro_code: true,
            pro_name: true,
            pro_nameEN: true,
            pro_genericname: true,
            pro_priceA: true,
            pro_priceB: true,
            pro_priceC: true,
            pro_barcode1: true,
            pro_barcode2: true,
            pro_barcode3: true,
            pro_imgmain: true,
            recommend_rank: true,
            creditor: {
              creditor_code: true,
            },
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to get products by tag: ${error}`);
    }
  }

  async DeleteRank(pro_code: string) {
    try {
      return this.productEntity.update({ pro_code }, { recommend_rank: null });
    } catch (error) {
      throw new Error(`Failed to delete rank: ${error}`);
    }
  }

  async UpdateRank(pro_code: string, rank: number) {
    try {
      return this.productEntity.update({ pro_code }, { recommend_rank: rank });
    } catch (error) {
      throw new Error(`Failed to update rank: ${error}`);
    }
  }

  async DeleteTagFromProduct(pro_code: string) {
    try {
      console.log('Deleting tag from product with code:', pro_code);
      return this.productEntity.update(
        { pro_code },
        { recommend: { id: undefined }, recommend_rank: undefined },
      );
    } catch (error) {
      throw new Error(`Failed to delete tag from product: ${error}`);
    }
  }

  async UpdateTagToProduct(pro_code: string, tag_id: number) {
    try {
      const tag = await this.recommendEntity.findOneBy({ id: tag_id });
      if (!tag) {
        throw new Error(`Tag with id ${tag_id} not found`);
      }
      return this.productEntity.update({ pro_code }, { recommend: tag });
    } catch (error) {
      throw new Error(`Failed to update tag to product: ${error}`);
    }
  }

  async GetProductRecommendByCode(recommend_id: number[], mem_code: string) {
    try {
      const isL16 = await this.isL16Member(mem_code);
      const replacedProducts: Array<{
        pro_code: string;
        pro_name: string;
        pro_genericname: string;
        pro_priceA: number;
        pro_priceB: number;
        pro_priceC: number;
        pro_imgmain: string;
        pro_unit1: string;
        pro_unit2: string;
        pro_unit3: string;
        pro_stock: number;
        pro_promotion_month: string;
        creditor_code: string;
        mem_code: string;
        spc_amount: number;
        spc_unit: string;
        flashsale_id: number;
        flashsale_limit: number;
        promotion_id: number;
        flashsale_date: string;
        flashsale_time_start: string;
        flashsale_time_end: string;
      }> = await this.productEntity
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.replace', 'mainProduct')
        .leftJoin(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .leftJoinAndSelect('mainProduct.creditor', 'creditor')
        .leftJoinAndSelect('mainProduct.flashsale', 'product_flashsale')
        .leftJoinAndSelect('product_flashsale.flashsale', 'flashsale')
        .where('cart.spc_id IS NOT NULL')
        .andWhere('mainProduct.pro_stock > 0')
        .andWhere(
          isL16
            ? '1=1'
            : '(mainProduct.pro_l16_only = 0 OR mainProduct.pro_l16_only IS NULL)',
        )
        .setParameter('memCode', mem_code)
        .select([
          'mainProduct.pro_code AS pro_code',
          'mainProduct.pro_name AS pro_name',
          'mainProduct.pro_genericname AS pro_genericname',
          'mainProduct.pro_priceA AS pro_priceA',
          'mainProduct.pro_priceB AS pro_priceB',
          'mainProduct.pro_priceC AS pro_priceC',
          'mainProduct.pro_imgmain AS pro_imgmain',
          'mainProduct.pro_unit1 AS pro_unit1',
          'mainProduct.pro_unit2 AS pro_unit2',
          'mainProduct.pro_unit3 AS pro_unit3',
          'mainProduct.pro_stock AS pro_stock',
          'mainProduct.pro_promotion_month AS pro_promotion_month',
          'creditor.creditor_code AS creditor_code',
          'cart.mem_code AS mem_code',
          'cart.spc_amount AS spc_amount',
          'cart.spc_unit AS spc_unit',
          'product_flashsale.id AS flashsale_id',
          'product_flashsale.limit AS flashsale_limit',
          'flashsale.promotion_id AS promotion_id',
          'flashsale.date AS flashsale_date',
          'flashsale.time_start AS flashsale_time_start',
          'flashsale.time_end AS flashsale_time_end',
        ])
        .getRawMany();

      const RecommendMany: Array<{
        pro_code: string;
        pro_name: string;
        pro_genericname: string;
        pro_priceA: number;
        pro_priceB: number;
        pro_priceC: number;
        pro_imgmain: string;
        pro_unit1: string;
        pro_unit2: string;
        pro_unit3: string;
        pro_stock: number;
        pro_promotion_month: string;
        recommend_rank: number;
        creditor_code: string;
        mem_code: string;
        spc_amount: number;
        spc_unit: string;
        flashsale_id: number;
        flashsale_limit: number;
        promotion_id: number;
        flashsale_date: string;
        flashsale_time_start: string;
        flashsale_time_end: string;
      }> = await this.productEntity
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.recommend', 'recommend')
        .leftJoinAndSelect('product.creditor', 'creditor')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', mem_code)
        .leftJoinAndSelect('product.flashsale', 'product_flashsale')
        .leftJoinAndSelect('product_flashsale.flashsale', 'flashsale')
        .where('recommend.id IN (:...recommend_id)', { recommend_id })
        .andWhere('product.pro_stock > 0')
        .andWhere('product.recommend_rank IS NOT NULL')
        .andWhere(
          isL16
            ? '1=1'
            : '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)',
        )
        .select([
          'product.pro_code AS pro_code',
          'product.pro_name AS pro_name',
          'product.pro_genericname AS pro_genericname',
          'product.pro_priceA AS pro_priceA',
          'product.pro_priceB AS pro_priceB',
          'product.pro_priceC AS pro_priceC',
          'product.pro_imgmain AS pro_imgmain',
          'product.pro_unit1 AS pro_unit1',
          'product.pro_unit2 AS pro_unit2',
          'product.pro_unit3 AS pro_unit3',
          'product.pro_stock AS pro_stock',
          'product.pro_promotion_month AS pro_promotion_month',
          'product.recommend_rank AS recommend_rank',
          'creditor.creditor_code AS creditor_code',
          'cart.mem_code AS mem_code',
          'cart.spc_amount AS spc_amount',
          'cart.spc_unit AS spc_unit',
          'product_flashsale.id AS flashsale_id',
          'product_flashsale.limit AS flashsale_limit',
          'flashsale.promotion_id AS promotion_id',
          'flashsale.date AS flashsale_date',
          'flashsale.time_start AS flashsale_time_start',
          'flashsale.time_end AS flashsale_time_end',
        ])
        .getRawMany();

      const allRecommend = [...replacedProducts, ...RecommendMany];
      return allRecommend;
    } catch (error) {
      throw new Error(`Failed to get product recommend by code: ${error}`);
    }
  }

  async AddReplaceProduct(pro_code: string, replace_pro_code: string) {
    try {
      await this.productEntity.update(
        { pro_code },
        {
          replace: { pro_code: replace_pro_code },
        },
      );
    } catch (error) {
      throw new Error(`Failed to add/replace product: ${error}`);
    }
  }

  async GetProductAndReplace(pro_code: string) {
    try {
      return this.productEntity.findOne({
        where: { pro_code },
        relations: {
          replace: true,
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_genericname: true,
          pro_imgmain: true,
          replace: {
            pro_code: true,
            pro_name: true,
            pro_genericname: true,
            pro_imgmain: true,
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to get product and replace: ${error}`);
    }
  }

  async RemoveReplaceProduct(pro_code: string) {
    try {
      await this.productEntity.update({ pro_code }, { replace: null });
    } catch (error) {
      throw new Error(`Failed to remove replace product: ${error}`);
    }
  }
}
