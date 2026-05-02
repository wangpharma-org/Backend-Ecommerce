import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from './campaigns.entity';
import { CampaignRowEntity } from './campaigns-row.entity';
import { CampaignRewardEntity } from './campaigns-reward.entity';
import { CampaignsPromoRewardEntity } from './campaigns-promo-reward.entity';
import { PromoProductEntity } from './campaigns-product.entity';
import { CampaignPurchaseProductEntity } from './campaigns-purchase-product.entity';
import { ProductEntity } from '../products/products.entity';
import axios, { AxiosResponse } from 'axios';
import { IdeogramBrowserService } from './ideogram-browser.service';
import * as AWS from 'aws-sdk';

export interface UploadResponse {
  success: boolean;
  id: string;
  file_name: string;
}

export interface GeneratePosterResponse {
  user_id: string;
  caption: string;
  request_id: string;
}

export interface GetAllResultsResponse {
  results: Result[];
  next_cursor: any;
}

export interface Result {
  user: User;
  user_prompt?: string;
  user_negative_prompt?: string;
  private: boolean;
  request_id?: string;
  request_type?: string;
  responses?: Response[];
  creation_time_float: number;
  resolution?: number;
  height: number;
  width: number;
  user_hparams?: UserHparams;
  aspect_ratio: string;
  model_version?: string;
  model_uri?: string;
  cover_response_id?: string;
  autoprompt_loading?: boolean;
  use_autoprompt?: boolean;
  is_completed?: boolean;
  is_errored?: boolean;
  max_upscale_factor: number;
  can_upscale: boolean;
  image_resolution: string;
  reference_parents?: ReferenceParent[];
  expected_number_of_final_responses?: number;
  character_reference_collection_ids?: any[];
  product_reference_collection_ids?: any[];
  references?: References;
  style_reference_collection_ids?: any[];
  use_random_style_codes?: boolean;
  caption?: string;
  image_id?: string;
  upload_type?: string;
  format?: string;
  tags?: any[];
}

export interface User {
  user_id: string;
  photo_url: string;
  display_handle: string;
  subscription_plan_id: any;
  badge: any;
}

export interface Response {
  response_id: string;
  prompt: string;
  self_like: boolean;
  num_likes: number;
  highest_fidelity: boolean;
  pin_on_profile: boolean;
  cover: boolean;
  is_autoprompt: boolean;
  private: boolean;
  descriptions: any[];
  tags: any[];
  response_index: number;
}

export interface UserHparams {
  aspect_ratio: string;
}

export interface ReferenceParent {
  reference_type: string;
  variation_parents: any[];
  upload_parents: UploadParent[];
}

export interface UploadParent {
  image_id: string;
  height?: number;
  width?: number;
  aspect_ratio?: string;
  user: User2;
  private: boolean;
  upload_type: string;
}

export interface User2 {
  user_id?: string;
  photo_url?: string;
  display_handle?: string;
  subscription_plan_id: any;
  badge: any;
}

export interface References {
  edit: Edit[];
}

export interface Edit {
  reference_parents: ReferenceParents;
}

export interface ReferenceParents {
  reference_collection_id: string;
  reference_collection_version_id: string;
  asset_identifiers: AssetIdentifier[];
}

export interface AssetIdentifier {
  asset_type: string;
  asset_id: string;
  metadata: Metadata;
}

export interface Metadata {
  representation: string;
  request_id: any;
  response_index: any;
}

@Injectable()
export class CampaignsService {
  private s3: AWS.S3;

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
    @InjectRepository(CampaignPurchaseProductEntity)
    private readonly purchaseProductRepository: Repository<CampaignPurchaseProductEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly ideogramBrowser: IdeogramBrowserService,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

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

  async getRewardColumns(campaignId: string) {
    return this.campaignRewardRepository.find({
      where: { campaign: { id: campaignId } },
      relations: ['linked_product'],
    });
  }

  async updateRewardColumnValuePerUnit(
    campaignId: string,
    columnId: string,
    value_per_unit: number,
  ) {
    const result = await this.campaignRewardRepository.update(
      { id: columnId, campaign: { id: campaignId } },
      { value_per_unit: value_per_unit.toString() },
    );
    if (result.affected === 0) {
      throw new HttpException('Reward column not found', HttpStatus.NOT_FOUND);
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

  async downloadImageAsBuffer(url: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const response: AxiosResponse<ArrayBuffer> = await axios.get<ArrayBuffer>(
      url,
      {
        responseType: 'arraybuffer',
      },
    );

    const contentType =
      (response.headers?.['content-type'] as string | undefined) ??
      'image/jpeg';
    const mimeType =
      typeof contentType === 'string' ? contentType : 'image/jpeg';

    const filename = url.split('/').pop() || `image_${Date.now()}.jpg`;

    const buffer = Buffer.from(response.data);

    return {
      buffer,
      filename,
      mimeType,
    };
  }

  async generatePoster(
    prompt: string,
    aspectRatio: string,
    imageItems: {
      url: string;
      name: string;
      quantity: number;
      unit: string;
      type?: 'gift' | 'purchase' | 'reference';
    }[] = [],
    session_cookies: string,
  ) {
    try {
      const uploaded: { id: string; label: string; type?: string }[] = [];

      for (const item of imageItems) {
        const { buffer, filename, mimeType } = await this.downloadImageAsBuffer(
          item.url,
        );
        const id = await this.ideogramBrowser.uploadImage(
          buffer,
          filename,
          mimeType,
          session_cookies,
        );
        if (id) {
          uploaded.push({
            id,
            label: `${item.name} ${item.quantity} ${item.unit}`.trim(),
            type: item.type,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const giftItems = uploaded.filter((u) => !u.type || u.type === 'gift');
      const purchaseItems = uploaded.filter((u) => u.type === 'purchase');
      const referenceItems = uploaded.filter((u) => u.type === 'reference');

      let finalPrompt = prompt;

      if (purchaseItems.length > 0) {
        finalPrompt += `\n\nภาพสินค้าที่ลูกค้าซื้อ (แสดงในส่วนหลักของโปสเตอร์ให้โดดเด่น):`;
        purchaseItems.forEach(({ label }, i) => {
          finalPrompt += `\n- สินค้าที่ซื้อ ${i + 1}: "${label}"`;
        });
      }

      if (giftItems.length > 0) {
        finalPrompt += `\n\nภาพของแถม (แสดงในส่วน "ของแถม / FREE GIFT" ให้ชัดเจน):`;
        giftItems.forEach(({ label }, i) => {
          finalPrompt += `\n- ของแถม ${i + 1}: "${label}"`;
        });
        finalPrompt += `\nต้องแสดงของแถมทั้ง ${giftItems.length} ชิ้นครบทุกชิ้น แต่ละชิ้นแสดงภาพสินค้าถูกต้อง จำนวนถูกต้อง ชัดเจน ไม่ตกหล่น`;
      }

      if (referenceItems.length > 0) {
        finalPrompt += `\n\nภาพอ้างอิงสไตล์โปสเตอร์ (ใช้เป็น style reference เท่านั้น อ้างอิงโทนสี layout และสไตล์ อย่า copy ข้อความหรือสินค้าจากภาพนี้):`;
        referenceItems.forEach((_, i) => {
          finalPrompt += `\n- Style Reference ${i + 1}`;
        });
      }

      return (await this.ideogramBrowser.generatePosterRequest(
        finalPrompt,
        aspectRatio,
        uploaded.map((u) => u.id),
        session_cookies,
      )) as GeneratePosterResponse;
    } catch (error) {
      console.error('Error generating poster via Ideogram:', error);
    }
  }

  async getAllResults(request_id: string, session_cookies?: string) {
    try {
      return (await this.ideogramBrowser.getAllResults(
        request_id,
        session_cookies,
      )) as unknown;
    } catch (error) {
      console.error('Error fetching all results from Ideogram:', error);
    }
  }

  async uploadRewardImage(
    file: Express.Multer.File,
    rewardId: string,
  ): Promise<string> {
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET || 'wang-storage',
      Key: `campaign-rewards/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };

    const result = await this.s3.upload(params).promise();
    await this.campaignRewardRepository.update(rewardId, {
      img_url: result.Location,
    });
    return result.Location;
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET || 'wang-storage',
      Key: `campaign-images/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  async getPurchaseProducts(campaignId: string) {
    return this.purchaseProductRepository.find({
      where: { campaign: { id: campaignId } },
      select: ['id', 'name', 'img_url', 'created_at'],
      order: { created_at: 'ASC' },
    });
  }

  async createPurchaseProduct(campaignId: string, name: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new HttpException('Campaign not found', HttpStatus.NOT_FOUND);
    }
    const item = this.purchaseProductRepository.create({ campaign, name });
    return this.purchaseProductRepository.save(item);
  }

  async updatePurchaseProduct(
    campaignId: string,
    productId: string,
    data: { name?: string; img_url?: string },
  ) {
    const item = await this.purchaseProductRepository.findOne({
      where: { id: productId, campaign: { id: campaignId } },
    });
    if (!item) {
      throw new HttpException('Purchase product not found', HttpStatus.NOT_FOUND);
    }
    await this.purchaseProductRepository.update(productId, data);
  }

  async deletePurchaseProduct(campaignId: string, productId: string) {
    const result = await this.purchaseProductRepository.delete({
      id: productId,
      campaign: { id: campaignId },
    });
    if (result.affected === 0) {
      throw new HttpException('Purchase product not found', HttpStatus.NOT_FOUND);
    }
  }

  async uploadPurchaseProductImage(
    campaignId: string,
    productId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET || 'wang-storage',
      Key: `campaign-purchase/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };
    const result = await this.s3.upload(params).promise();
    await this.purchaseProductRepository.update(productId, {
      img_url: result.Location,
    });
    return result.Location;
  }
}
