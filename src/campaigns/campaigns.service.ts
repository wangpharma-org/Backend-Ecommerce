import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from './campaigns.entity';
import { CampaignRowEntity } from './campaigns-row.entity';
import { CampaignRewardEntity } from './campaigns-reward.entity';
import { CampaignsPromoRewardEntity } from './campaigns-promo-reward.entity';
import { PromoProductEntity } from './campaigns-product.entity';
import { ProductEntity } from '../products/products.entity';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(CampaignRowEntity)
    private readonly campaignRowRepository: Repository<CampaignRowEntity>,
    @InjectRepository(CampaignRewardEntity)
    private readonly campaignRewardRepository: Repository<CampaignRewardEntity>,
    @InjectRepository(CampaignsPromoRewardEntity)
    private readonly promoRewardRepository: Repository<CampaignsPromoRewardEntity>,
    @InjectRepository(PromoProductEntity)
    private readonly promoProductRepository: Repository<PromoProductEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  async getAllCampaigns() {
    return this.campaignRepository.find({
      select: ['id', 'name', 'description', 'progress', 'created_at'],
    });
  }

  async createCampaign(data: { name: string; description?: string }) {
    const campaign = this.campaignRepository.create(data);
    campaign.progress = 0;
    return this.campaignRepository.save(campaign);
  }

  async deleteCampaign(id: string) {
    const result = await this.campaignRepository.delete(id);
    if (result.affected === 0) {
      throw new HttpException('Campaign not found', HttpStatus.NOT_FOUND);
    }
  }

  async getCampaignData(campaignId: string) {
    const rows = await this.campaignRowRepository.find({
      where: { campaign: { id: campaignId } },
      relations: [
        'promo_rewards',
        'promo_rewards.reward_column',
        'promo_rewards.reward_column.linked_product',
        'promo_products',
        'promo_products.product',
      ],
    });

    return rows.map((row) => ({
      ...row,
      promo_rewards: row.promo_rewards.map((reward) => ({
        id: reward.id,
        quantity: reward.quantity,
        unit: reward.unit,
        price: reward.price,
        value: reward.value,
        reward_column: {
          ...reward.reward_column,
          linked_product: reward.reward_column.linked_product
            ? { pro_code: reward.reward_column.linked_product.pro_code }
            : null,
        },
      })),
      promo_products: row.promo_products.map(
        (promoProduct) => promoProduct.product,
      ),
    }));
  }

  async createRow(
    campaignId: string,
    data: {
      set_number: number;
      condition?: string;
      target?: string;
      con_percent?: string;
    },
  ) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new HttpException('Campaign not found', HttpStatus.NOT_FOUND);
    }

    const row = this.campaignRowRepository.create({
      ...data,
      campaign,
    });
    return this.campaignRowRepository.save(row);
  }

  async updateRow(
    campaignId: string,
    rowId: string,
    data: {
      target?: string;
      con_percent?: string;
      condition?: string;
      set_number?: number;
      price_per_set?: string;
      number_of_sets?: number;
      unit_price?: number;
      quantity?: number;
      discounted_price?: number;
    },
  ) {
    const row = await this.campaignRowRepository.findOne({
      where: { id: rowId, campaign: { id: campaignId } },
    });
    if (!row) {
      throw new HttpException('Row not found', HttpStatus.NOT_FOUND);
    }

    Object.assign(row, data);
    return this.campaignRowRepository.save(row);
  }

  async deleteRow(campaignId: string, rowId: string) {
    const result = await this.campaignRowRepository.delete({
      id: rowId,
      campaign: { id: campaignId },
    });
    if (result.affected === 0) {
      throw new HttpException('Row not found', HttpStatus.NOT_FOUND);
    }
  }

  async createRewardColumn(
    campaignId: string,
    data: { name: string; unit?: string; value_per_unit?: string },
  ) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new HttpException('Campaign not found', HttpStatus.NOT_FOUND);
    }

    const column = this.campaignRewardRepository.create({
      ...data,
      campaign,
    });
    return this.campaignRewardRepository.save(column);
  }

  async updateRewardColumn(reward_id: string, url?: string, pro_code?: string) {
    if (pro_code) {
      await this.campaignRewardRepository.update(reward_id, {
        img_url: url,
        linked_product: { pro_code: pro_code },
      });
    }
    if (url) {
      await this.campaignRewardRepository.update(reward_id, {
        img_url: url,
      });
    }
  }

  async deleteRewardColumn(campaignId: string, columnId: string) {
    const result = await this.campaignRewardRepository.delete({
      id: columnId,
      campaign: { id: campaignId },
    });
    if (result.affected === 0) {
      throw new HttpException('Reward column not found', HttpStatus.NOT_FOUND);
    }
  }

  async getProducts() {
    return this.productRepository.find({
      select: ['pro_code', 'pro_name', 'pro_imgmain'],
    });
  }

  async addProductToRow(campaignId: string, rowId: string, pro_code: string) {
    const row = await this.campaignRowRepository.findOne({
      where: { id: rowId, campaign: { id: campaignId } },
    });
    if (!row) {
      throw new HttpException('Row not found', HttpStatus.NOT_FOUND);
    }

    const product = await this.productRepository.findOne({
      where: { pro_code },
    });
    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    const promoProduct = this.promoProductRepository.create({
      promo_row: row,
      product,
    });
    return this.promoProductRepository.save(promoProduct);
  }

  async removeProductFromRow(
    campaignId: string,
    rowId: string,
    pro_code: string,
  ) {
    const result = await this.promoProductRepository.delete({
      promo_row: { id: rowId, campaign: { id: campaignId } },
      product: { pro_code },
    });
    if (result.affected === 0) {
      throw new HttpException('Promo product not found', HttpStatus.NOT_FOUND);
    }
  }

  async addPromoReward(
    campaignId: string,
    rowId: string,
    data: {
      reward_column_id: string;
      quantity?: string;
      unit?: string;
      price?: string;
      value?: string;
    },
  ) {
    const row = await this.campaignRowRepository.findOne({
      where: { id: rowId, campaign: { id: campaignId } },
    });
    if (!row) {
      throw new HttpException('Row not found', HttpStatus.NOT_FOUND);
    }

    const rewardColumn = await this.campaignRewardRepository.findOne({
      where: { id: data.reward_column_id, campaign: { id: campaignId } },
    });
    if (!rewardColumn) {
      throw new HttpException('Reward column not found', HttpStatus.NOT_FOUND);
    }

    const promoReward = this.promoRewardRepository.create({
      promo_row: row,
      reward_column: rewardColumn,
      quantity: data.quantity,
      unit: data.unit,
      price: data.price,
      value: data.value,
    });
    return this.promoRewardRepository.save(promoReward);
  }

  async updatePromoReward(
    campaignId: string,
    rowId: string,
    rewardId: string,
    data: {
      quantity?: string;
      unit?: string;
      price?: string;
      value?: string;
    },
  ) {
    const reward = await this.promoRewardRepository.findOne({
      where: {
        id: rewardId,
        promo_row: { id: rowId, campaign: { id: campaignId } },
      },
    });
    if (!reward) {
      throw new HttpException('Promo reward not found', HttpStatus.NOT_FOUND);
    }

    Object.assign(reward, data);
    return this.promoRewardRepository.save(reward);
  }

  async deletePromoReward(campaignId: string, rowId: string, rewardId: string) {
    const result = await this.promoRewardRepository.delete({
      id: rewardId,
      promo_row: { id: rowId, campaign: { id: campaignId } },
    });
    if (result.affected === 0) {
      throw new HttpException('Promo reward not found', HttpStatus.NOT_FOUND);
    }
  }
}
