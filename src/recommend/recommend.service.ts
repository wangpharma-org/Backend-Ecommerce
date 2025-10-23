import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecommendEntity } from './recommend.entity';
import { Repository } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Injectable()
export class RecommendService {
  constructor(
    @InjectRepository(RecommendEntity)
    private readonly recommendEntity: Repository<RecommendEntity>,
    @InjectRepository(ProductEntity)
    private readonly productEntity: Repository<ProductEntity>,
  ) {}

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
}
