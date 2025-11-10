import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignEntity } from './campaigns.entity';
import { CampaignRowEntity } from './campaigns-row.entity';
import { ProductEntity } from '../products/products.entity';

@Controller('/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async getAllCampaigns() {
    try {
      const campaigns: Partial<CampaignEntity>[] =
        await this.campaignsService.getAllCampaigns();
      return { success: true, data: campaigns };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'GET_CAMPAIGNS_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post()
  async createCampaign(@Body() body: { name: string; description?: string }) {
    try {
      const campaign = await this.campaignsService.createCampaign(body);
      return { success: true, data: campaign };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'CREATE_CAMPAIGN_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async deleteCampaign(@Param('id') id: string) {
    try {
      await this.campaignsService.deleteCampaign(id);
      return {
        success: true,
        data: { message: 'Campaign deleted successfully' },
      };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'DELETE_CAMPAIGN_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':campaignId/data')
  async getCampaignData(@Param('campaignId') campaignId: string) {
    try {
      const data = await this.campaignsService.getCampaignData(campaignId);
      return { success: true, data };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'GET_CAMPAIGN_DATA_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':campaignId/data')
  async createRow(
    @Param('campaignId') campaignId: string,
    @Body()
    body: {
      set_number: number;
      condition?: string;
      target?: string;
      con_percent?: string;
    },
  ) {
    try {
      const row = await this.campaignsService.createRow(campaignId, body);
      return { success: true, data: row };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'CREATE_ROW_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':campaignId/data/:rowId')
  async updateRow(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Body()
    body: {
      target?: string;
      con_percent?: string;
      condition?: string;
      set_number?: number;
      price_per_set?: string;
      number_of_sets?: number;
    },
  ) {
    try {
      const updatedRow: CampaignRowEntity =
        await this.campaignsService.updateRow(campaignId, rowId, body);
      return { success: true, data: updatedRow };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'UPDATE_ROW_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':campaignId/data/:rowId')
  async deleteRow(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
  ) {
    try {
      await this.campaignsService.deleteRow(campaignId, rowId);
      return { success: true, data: { message: 'Row deleted successfully' } };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'DELETE_ROW_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':campaignId/columns')
  async createRewardColumn(
    @Param('campaignId') campaignId: string,
    @Body()
    body: { name: string; unit?: string; value_per_unit?: string },
  ) {
    try {
      const column = await this.campaignsService.createRewardColumn(
        campaignId,
        body,
      );
      return { success: true, data: column };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'CREATE_REWARD_COLUMN_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':campaignId/columns/:columnId')
  async deleteRewardColumn(
    @Param('campaignId') campaignId: string,
    @Param('columnId') columnId: string,
  ) {
    try {
      await this.campaignsService.deleteRewardColumn(campaignId, columnId);
      return {
        success: true,
        data: { message: 'Reward column deleted successfully' },
      };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'DELETE_REWARD_COLUMN_FAILED',
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('/products')
  async getProducts() {
    try {
      const products: Partial<ProductEntity>[] =
        await this.campaignsService.getProducts();
      return { success: true, data: products };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'GET_PRODUCTS_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':campaignId/data/:rowId/products')
  async addProductToRow(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Body() body: { pro_code: string },
  ) {
    try {
      console.log('Adding product to row:', {
        campaignId,
        rowId,
        pro_code: body.pro_code,
      });
      const product = await this.campaignsService.addProductToRow(
        campaignId,
        rowId,
        body.pro_code,
      );
      return { success: true, data: product };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'ADD_PRODUCT_TO_ROW_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':campaignId/data/:rowId/rewards')
  async addPromoReward(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Body()
    body: {
      reward_column_id: string;
      quantity?: string;
      unit?: string;
      price?: string;
      value?: string;
    },
  ) {
    try {
      const reward = await this.campaignsService.addPromoReward(
        campaignId,
        rowId,
        body,
      );
      return { success: true, data: reward };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'ADD_PROMO_REWARD_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':campaignId/data/:rowId/rewards/:rewardId')
  async updatePromoReward(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Param('rewardId') rewardId: string,
    @Body()
    body: {
      quantity?: string;
      unit?: string;
      price?: string;
      value?: string;
    },
  ) {
    try {
      console.log('Updating promo reward:', {
        campaignId,
        rowId,
        rewardId,
        body,
      });
      const updatedReward = await this.campaignsService.updatePromoReward(
        campaignId,
        rowId,
        rewardId,
        body,
      );
      return { success: true, data: updatedReward };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'UPDATE_PROMO_REWARD_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':campaignId/data/:rowId/rewards/:rewardId')
  async deletePromoReward(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Param('rewardId') rewardId: string,
  ) {
    try {
      await this.campaignsService.deletePromoReward(
        campaignId,
        rowId,
        rewardId,
      );
      return {
        success: true,
        data: { message: 'Promo reward deleted successfully' },
      };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'DELETE_PROMO_REWARD_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('/update-collumn-reward')
  async updateRewardColumn(
    @Body() data: { reward_id: string; url: string; pro_code: string },
  ) {
    try {
      await this.campaignsService.updateRewardColumn(
        data.reward_id,
        data.url,
        data.pro_code,
      );
      return {
        success: true,
        data: { message: 'Reward column updated successfully'},
      };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'DELETE_PROMO_REWARD_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
