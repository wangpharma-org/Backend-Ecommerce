import { WangdayService } from './wangday/wangday.service';
import {
  BadGatewayException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import axios from 'axios';
import { AppService } from './app.service';
import { AuthService, SigninResponse } from './auth/auth.service';
import { ProductsService } from './products/products.service';
import { ShoppingOrderEntity } from './shopping-order/shopping-order.entity';
import { ShoppingCartService } from './shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from './shopping-head/shopping-head.entity';
import { ShoppingHeadService } from './shopping-head/shopping-head.service';
import { ShoppingOrderService } from './shopping-order/shopping-order.service';
import { AllOrderByMemberRes } from './shopping-head/types/AllOrderByMemberRes.type';
import { FavoriteService } from './favorite/favorite.service';
import { FlashsaleService } from './flashsale/flashsale.service';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';
import { BannerService } from './banner/banner.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { HotdealInput, HotdealService } from './hotdeal/hotdeal.service';
import { PromotionService } from './promotion/promotion.service';
import type { PromotionEntityWithTransformedData } from './promotion/promotion.service';
import { UserEntity } from 'src/users/users.entity';
import { BackendService } from './backend/backend.service';
import { DebtorService } from './debtor/debtor.service';
import { LotService } from './lot/lot.service';
import { EditAddressService } from './edit-address/edit-address.service';
import { EditAddress } from './edit-address/edit-address.entity';
import { ModalContentService } from './modalmain/modalmain.service';
import { InvisibleProductService } from './invisible-product/invisible-product.service';
import { NewArrivalsService } from './new-arrivals/new-arrivals.service';
import { UsersService } from './users/users.service';
import { ChangePasswordService } from './change-password/change-password.service';
import { FixFreeService } from './fix-free/fix-free.service';
import type {
  ImportDataRequestInvoice,
  ImportDataRequestRT,
} from './debtor/debtor.service';
import { DebtorEntity } from './debtor/debtor.entity';
import { ReductionRT } from './debtor/reduct-rt.entity';
import { SessionsService } from './sessions/sessions.service';
import { EmployeesService } from './employees/employees.service';
import { EmployeeEntity } from './employees/employees.entity';
import { ProductKeywordService } from './product-keyword/product-keyword.service';
import { BannerEntity } from './banner/banner.entity';
import { HotdealEntity } from './hotdeal/hotdeal.entity';
import { RecommendService } from './recommend/recommend.service';
import { PolicyDocService } from './policy-doc/policy-doc.service';
import { PolicyDocMember } from './policy-doc/policy-doc-member.entity';
import { ContractLogService } from './contract-log/contract-log.service';
import { ContractLogBanner } from './contract-log/contract-log-banner.entity';
import { ContractLogPerson } from './contract-log/contract-log-person.entity';
import { CreditorEntity } from './products/creditor.entity';
import { ContractLogCompanyDay } from './contract-log/contract-log-company-day.entity';
import { ImagedebugService } from './imagedebug/imagedebug.service';
import { CampaignsService } from './campaigns/campaigns.service';
import { CampaignRowEntity } from './campaigns/campaigns-row.entity';
import { ProductEntity } from './products/products.entity';
import { CampaignEntity } from './campaigns/campaigns.entity';
import { ProductReturnService } from './product-return/product-return.service';
import {
  ReturnStatus,
  ReturnReason,
  ResolutionType,
  InitiatorType,
} from './product-return/return-enums';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { BehaviorTrackingService } from './behavior-tracking/behavior-tracking.service';
import { TrackOrderService } from './track-order/track-order.service';
import { NotifyRtService } from './notifyapp/notifyapp.service';
import { CompanyDayAnalyticService } from './company-day-analytic/company-day-analytic.service';

export interface JwtPayload {
  username: string;
  name: string;
  mem_code: string;
  price_option?: string;
  mem_address?: string;
  mem_village?: string;
  mem_alley?: string;
  mem_tumbon?: string;
  mem_amphur?: string;
  mem_province?: string;
  mem_post?: string;
  mem_phone?: string;
  mem_route?: string;
  permission?: boolean;
  role?: string;
  admin_features?: string[] | null;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  // Add simple lock to prevent race condition
  private isHashingInProgress = false;

  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly productsService: ProductsService,
    private readonly shoppingCartService: ShoppingCartService,
    private readonly shoppingOrderService: ShoppingOrderService,
    private readonly shoppingHeadService: ShoppingHeadService,
    private readonly favoriteService: FavoriteService,
    private readonly flashsaleService: FlashsaleService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly bannerService: BannerService,
    private readonly promotionService: PromotionService,
    private readonly wangdayService: WangdayService,
    private readonly hotdealService: HotdealService,
    private readonly backendService: BackendService,
    private readonly debtorService: DebtorService,
    private readonly lotService: LotService,
    private readonly invisibleService: InvisibleProductService,
    private readonly editAddressService: EditAddressService,
    private readonly modalContentService: ModalContentService,
    private readonly newArrivalsService: NewArrivalsService,
    private readonly fixFreeService: FixFreeService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly employeesService: EmployeesService,
    private readonly productKeySearch: ProductKeywordService,
    private readonly recommendService: RecommendService,
    private readonly policyDocService: PolicyDocService,
    private readonly contractLogService: ContractLogService,
    private readonly imagedebugService: ImagedebugService,
    private readonly campaignsService: CampaignsService,
    private readonly productReturnService: ProductReturnService,
    private readonly behaviorTrackingService: BehaviorTrackingService,
    private readonly notifyRtService: NotifyRtService,
    private readonly trackOrderService: TrackOrderService,
    private readonly companyDayAnalyticService: CompanyDayAnalyticService,
  ) {}

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Send order data to old system' })
  @ApiParam({ name: 'soh_running', description: 'Order running number', example: 'SO-67010001' })
  @ApiResponse({ status: 200, description: 'Data sent to old system' })
  @Get('/ecom/get-data/:soh_running')
  async apiForOldSystem(@Param('soh_running') soh_running: string) {
    return this.shoppingOrderService.sendDataToOldSystem(soh_running);
  }

  @ApiTags('Banner & Contract Log')
  @ApiOperation({ summary: 'Get banner image URLs by location' })
  @ApiQuery({
    name: 'location',
    required: false,
    description: 'Banner placement location. Omit to get banners for all locations.',
    enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
    example: 'landing_hero',
  })
  @ApiResponse({ status: 200, description: 'Banner image URLs' })
  @Get('/ecom/image-banner')
  async getImageUrl(
    @Query('location')
    location?: 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar',
  ) {
    return this.bannerService.GetImageUrl(location);
  }

  @ApiTags('Banner & Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a banner by id' })
  @ApiParam({ name: 'id', description: 'Banner id', example: '12' })
  @ApiResponse({ status: 200, description: 'Banner deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/banner/:id')
  async deleteBanner(@Param('id') id: string) {
    return this.bannerService.deleteBannerById(Number(id));
  }

  @ApiTags('Banner & Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a banner by id' })
  @ApiParam({ name: 'id', description: 'Banner id', example: '12' })
  @ApiBody({
    description: 'Partial banner fields to update — any subset of BannerEntity columns; omitted fields are left unchanged.',
    type: BannerEntity,
  })
  @ApiResponse({ status: 200, description: 'Banner updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('/ecom/banner/:id')
  async updateBanner(
    @Param('id') id: string,
    @Body() data: Partial<BannerEntity>,
  ) {
    return this.bannerService.updateBanner(Number(id), data);
  }

  @ApiTags('User & Employee Management')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user data by member code' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/user-data/:mem_code')
  async getUserData(@Param('mem_code') mem_code: string) {
    return this.authService.fetchUserData(mem_code);
  }

  @ApiTags('User & Employee Management')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user data' })
  @ApiBody({ description: 'Full UserEntity payload (must include mem_code to identify the user)', type: UserEntity })
  @ApiResponse({ status: 201, description: 'User data updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/user-data/update')
  async updateUserData(@Body() data: UserEntity) {
    return this.authService.updateUserData(data);
  }

  @ApiTags('Banner & Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload banner image with metadata' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Banner image file (required)' },
        date_start: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00Z', description: 'Required' },
        date_end: { type: 'string', format: 'date-time', example: '2026-07-31T23:59:59Z', description: 'Required' },
        banner_name: { type: 'string', example: 'Summer Sale', description: 'Optional; empty string allowed' },
        banner_location: {
          type: 'string',
          enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
          example: 'landing_hero',
          description: 'Optional',
        },
        link_url: { type: 'string', example: 'https://wangpharma.com/promo', description: 'Optional; empty string allowed' },
        display_type: {
          type: 'string',
          enum: ['image_only', 'text_only', 'image_with_text'],
          example: 'image_with_text',
          description: 'Optional',
        },
        title: { type: 'string', example: 'ลดราคาช่วงซัมเมอร์', description: 'Optional; empty string allowed' },
        subtitle: { type: 'string', example: 'สูงสุด 50%', description: 'Optional; empty string allowed' },
        description: { type: 'string', example: 'โปรโมชั่นพิเศษเฉพาะเดือนนี้', description: 'Optional; empty string allowed' },
        cta_text: { type: 'string', example: 'ดูเพิ่มเติม', description: 'Optional; empty string allowed' },
        cta_url: { type: 'string', example: 'https://wangpharma.com/promo', description: 'Optional; empty string allowed' },
        cta_secondary_text: { type: 'string', example: 'ปิด', description: 'Optional; empty string allowed' },
        cta_secondary_url: { type: 'string', example: '', description: 'Optional; empty string allowed' },
        text_color: { type: 'string', enum: ['light', 'dark'], example: 'light', description: 'Optional' },
        text_position: { type: 'string', enum: ['left', 'center', 'right'], example: 'center', description: 'Optional' },
        bg_gradient: { type: 'string', example: 'linear-gradient(90deg,#000,#fff)', description: 'Optional; empty string allowed' },
        is_drug: { type: 'boolean', example: false, description: 'Optional' },
        advertise_code: { type: 'string', example: 'ADV001', description: 'Optional; empty string allowed' },
        creditor: { type: 'string', example: 'C001', description: 'Optional; empty string allowed' },
        product_list: { type: 'string', example: 'P00123,P00124', description: 'Optional comma-separated product codes; empty string allowed' },
      },
      required: ['file', 'date_start', 'date_end'],
    },
  })
  @ApiResponse({ status: 201, description: 'Banner uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    data: {
      date_start: Date;
      date_end: Date;
      banner_name?: string;
      banner_location?: 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar';
      link_url?: string;
      display_type?: 'image_only' | 'text_only' | 'image_with_text';
      title?: string;
      subtitle?: string;
      description?: string;
      cta_text?: string;
      cta_url?: string;
      cta_secondary_text?: string;
      cta_secondary_url?: string;
      text_color?: 'light' | 'dark';
      text_position?: 'left' | 'center' | 'right';
      bg_gradient?: string;
      is_drug?: boolean;
      advertise_code?: string;
      creditor?: string;
      product_list?: string;
    },
  ) {
    this.logger.log('=== Controller uploadBanner ===');
    this.logger.log('File:', file ? file.originalname : 'No file');
    this.logger.log('Data:', JSON.stringify(data, null, 2));
    const result = await this.bannerService.UploadImage(file, data);
    return result;
  }

  @ApiTags('Banner & Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create banner from image URL' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        img_url: { type: 'string', example: 'https://cdn.wangpharma.com/banners/abc.jpg', description: 'Required' },
        banner_name: { type: 'string', example: 'Summer Sale', description: 'Optional; empty string allowed' },
        banner_location: {
          type: 'string',
          enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
          example: 'landing_hero',
          description: 'Optional',
        },
        date_start: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00Z', description: 'Required' },
        date_end: { type: 'string', format: 'date-time', example: '2026-07-31T23:59:59Z', description: 'Required' },
      },
      required: ['img_url', 'date_start', 'date_end'],
    },
  })
  @ApiResponse({ status: 201, description: 'Banner created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/banner/from-url')
  async createBannerFromUrl(
    @Body()
    body: {
      img_url: string;
      banner_name?: string;
      banner_location?: 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar';
      date_start: Date;
      date_end: Date;
    },
  ) {
    const banner = await this.bannerService.createBannerFromUrl(body.img_url, {
      date_start: body.date_start,
      date_end: body.date_end,
      banner_name: body.banner_name,
      banner_location: body.banner_location,
    });
    return { success: true, data: banner };
  }

  @ApiTags('User & Employee Management')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload user profile image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required' },
        type: { type: 'string', example: 'profile', description: 'Required; image category/usage tag' },
        old_url: { type: 'string', example: 'https://cdn.wangpharma.com/users/old.jpg', description: 'Required; pass empty string if there is no previous image to remove' },
      },
      required: ['file', 'mem_code', 'type', 'old_url'],
    },
  })
  @ApiResponse({ status: 201, description: 'User image uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/user/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImageUser(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: { mem_code: string; type: string; old_url: string },
  ) {
    return await this.authService.UploadImage(
      file,
      data.type,
      data.mem_code,
      data.old_url,
    );
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get a feature flag status' })
  @ApiParam({ name: 'flag', description: 'Feature flag name', example: 'new_checkout' })
  @ApiResponse({ status: 200, description: 'Feature flag status' })
  @Get('/ecom/feature-flag/:flag')
  async checkFlag(@Param('flag') flag: string) {
    return this.featureFlagsService.getFlag(flag);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all feature flags' })
  @ApiResponse({ status: 200, description: 'All feature flags' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/feature-flags')
  async getAllFlags() {
    return this.featureFlagsService.getAllFlags();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a feature flag status' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        flag: { type: 'string', example: 'new_checkout', description: 'Required' },
        status: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['flag', 'status'],
    },
  })
  @ApiResponse({ status: 201, description: 'Feature flag updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/feature-flag/update-flag')
  async updateFlag(@Body() data: { flag: string; status: boolean }) {
    return this.featureFlagsService.updateFlag(data);
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload product PO data' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pro_code: { type: 'string', example: 'P00123', description: 'Required; product code, not empty' },
          month: { type: 'number', example: 6, description: 'Required; month number 1-12' },
        },
        required: ['pro_code', 'month'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'PO uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/products/insert-po')
  async uploadPO(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { pro_code: string; month: number }[],
  ) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.uploadPO(data);
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload products for flash sale' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productCode: { type: 'string', example: 'P00123', description: 'Required; not empty' },
          quantity: { type: 'number', example: 50, description: 'Required' },
        },
        required: ['productCode', 'quantity'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Flash sale products uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/products/upload-product-flashsale')
  async uploadProductFlashSale(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { productCode: string; quantity: number }[],
  ) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.uploadProductFlashSale(data);
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload product L16-only status' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Required',
          items: {
            type: 'object',
            properties: {
              pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
              status: {
                oneOf: [{ type: 'number' }, { type: 'string' }],
                example: 1,
                description: 'Required; 1 = L16-only, 0 = normal',
              },
            },
            required: ['pro_code', 'status'],
          },
        },
        filename: { type: 'string', example: 'l16-upload-2026-06.xlsx', description: 'Required; not empty' },
      },
      required: ['data', 'filename'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product L16 status uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/product-l16/upload')
  async uploadProductL16Only(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      data: { pro_code: string; status: number | string }[];
      filename: string;
    },
  ) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.updateProductL16OnlyFromUpload(body);
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export product L16 status' })
  @ApiResponse({ status: 200, description: 'Product L16 status export' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/product-l16/export')
  async exportProductL16Status(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.getProductL16Status();
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List flash sale product codes' })
  @ApiResponse({ status: 200, description: 'Flash sale product codes' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/products/flashsale-procode')
  async listProcodeFlashSale(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.listProcodeFlashSale();
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get favorite product list' })
  @ApiParam({ name: 'mem_code', description: 'Member code (unused, taken from JWT)', example: 'M00123' })
  @ApiQuery({ name: 'sort_by', required: false, description: 'Optional sort order key; omit for default order', example: 'name' })
  @ApiResponse({ status: 200, description: 'Favorite list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/favorite/:mem_code')
  async getListFavorite(
    @Req() req: Request & { user: JwtPayload },
    @Query('sort_by') sort_by?: string,
  ) {
    const memberCode = req.user.mem_code;
    return await this.favoriteService.getListFavorite(
      memberCode,
      sort_by,
      req.user.mem_route,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get flash sale product list' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', example: 20, description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Optional; overridden by JWT member code if present' },
      },
      required: ['limit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Flash sale list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/flashsale/get-list')
  async getDataFlashSale(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { limit: number; mem_code: string },
  ) {
    const mem_code = req.user.mem_code;
    const func = await this.productsService.getFlashSale(
      data.limit,
      mem_code,
      req.user.mem_route,
    );
    for (const funcItem of func as unknown as {
      pro_code: string;
      pro_imgmain: string;
    }[]) {
      await this.imagedebugService.UpsercetImg({
        pro_code: funcItem.pro_code,
        imageUrl: funcItem.pro_imgmain,
      });
    }
    return func;
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add product to favorites' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['mem_code', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Added to favorites' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/add')
  async addToFavorite(@Body() data: { mem_code: string; pro_code: string }) {
    return await this.favoriteService.addToFavorite(data);
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a favorite product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fav_id: { type: 'number', example: 101, description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required, but overridden by JWT member code' },
        sort_by: { type: 'number', example: 1, description: 'Optional' },
      },
      required: ['fav_id', 'mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Favorite deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/delete')
  async deleteFavorite(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { fav_id: number; mem_code: string; sort_by?: number },
  ) {
    return await this.favoriteService.deleteFavorite({
      ...data,
      mem_code: req.user.mem_code,
      mem_route: req.user.mem_route,
    });
  }

  @ApiTags('Auth & Session')
  @ApiOperation({ summary: 'User login' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'pharmacy01', description: 'Required; not empty' },
        password: { type: 'string', example: 'P@ssw0rd123', description: 'Required; not empty' },
      },
      required: ['username', 'password'],
    },
  })
  @ApiResponse({ status: 201, description: 'Login successful' })
  @Post('/ecom/login')
  async signin(
    @Body() data: { username: string; password: string },
    @Req() req: Request,
  ): Promise<SigninResponse> {
    const xClient = req.headers['x-client'] as string;
    return await this.authService.signin({
      ...data,
      source: xClient,
    });
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search products via Elasticsearch' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', example: 'paracetamol', description: 'Required; empty string returns unfiltered results' },
        offset: { type: 'number', example: 0, description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required, but overridden by JWT member code' },
        sort_by: { type: 'number', example: 1, description: 'Optional' },
        limit: { type: 'number', example: 20, description: 'Required' },
        creditor_codes: {
          type: 'array',
          items: { type: 'string' },
          example: ['C001', 'C002'],
          description: 'Optional filter by creditor codes',
        },
      },
      required: ['keyword', 'offset', 'mem_code', 'limit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/search-products')
  async searchProducts(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      keyword: string;
      offset: number;
      mem_code: string;
      sort_by?: number;
      limit: number;
      creditor_codes?: string[];
    },
  ) {
    const mem_code = req.user.mem_code;
    const result = await this.productsService.searchProductsElastic({
      ...data,
      mem_code,
      mem_route: req.user.mem_route,
    });
    for (const resultItem of result.products) {
      await this.imagedebugService.UpsercetImg({
        pro_code: resultItem.pro_code,
        imageUrl: resultItem.pro_imgmain,
      });
    }
    return result;
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search products by category' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', example: '', description: 'Required field; empty string allowed (returns whole category)' },
        offset: { type: 'number', example: 0, description: 'Required' },
        category: { type: 'number', example: 5, description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required, but overridden by JWT member code' },
        sort_by: { type: 'number', example: 1, description: 'Optional' },
        limit: { type: 'number', example: 20, description: 'Required' },
      },
      required: ['keyword', 'offset', 'category', 'mem_code', 'limit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Category search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/category-products')
  async searchCategoryProducts(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      keyword: string;
      offset: number;
      category: number;
      mem_code: string;
      sort_by?: number;
      limit: number;
    },
  ) {
    const mem_code = req.user.mem_code;
    return await this.productsService.searchCategoryProducts({
      ...data,
      mem_code,
      mem_route: req.user.mem_route,
    });
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommended products for user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', example: '', description: 'Required; empty string allowed' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['keyword', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Recommended products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-for-u')
  async productForYou(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { keyword: string; pro_code: string },
  ) {
    const mem_code = req.user.mem_code;
    return await this.productsService.productForYou({
      ...data,
      mem_code,
      mem_route: req.user.mem_route,
    });
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a shopping order' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        emp_code: { type: 'string', example: 'E001', description: 'Optional; empty string allowed' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required, but overridden by JWT member code' },
        total_price: { type: 'number', example: 1500.5, description: 'Required' },
        listFree: {
          type: 'array',
          nullable: true,
          description: 'Required; pass null if no point-redeemed free items',
          items: {
            type: 'object',
            properties: {
              pro_code: { type: 'string', example: 'P00123' },
              amount: { type: 'number', example: 1 },
              pro_unit1: { type: 'string', example: 'กล่อง' },
              pro_point: { type: 'number', example: 10 },
              unit_enum: { type: 'string', enum: ['1', '2', '3'], example: '1' },
            },
          },
        },
        priceOption: { type: 'string', example: 'A', description: 'Required; not empty' },
        paymentOptions: { type: 'string', example: 'cash', description: 'Required; not empty' },
        shippingOptions: { type: 'string', example: 'standard', description: 'Required; not empty' },
        addressed: { type: 'string', example: '123 ถ.สุขุมวิท กรุงเทพฯ', description: 'Required; not empty' },
      },
      required: [
        'mem_code',
        'total_price',
        'listFree',
        'priceOption',
        'paymentOptions',
        'shippingOptions',
        'addressed',
      ],
    },
  })
  @ApiResponse({ status: 201, description: 'Order submitted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/submit-order')
  async submitOrder(
    @Ip() ip: string,
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      emp_code?: string;
      mem_code: string;
      total_price: number;
      listFree:
        | [
            {
              pro_code: string;
              amount: number;
              pro_unit1: string;
              pro_point: number;
              unit_enum: '1' | '2' | '3';
            },
          ]
        | null;
      priceOption: string;
      paymentOptions: string;
      shippingOptions: string;
      addressed: string;
    },
  ) {
    const mem_code = req.user.mem_code;
    try {
      await this.shoppingOrderService.sendPurchaseEventToAnalytics(mem_code);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send purchase event to analytics for mem_code ${mem_code}: ${message}`,
      );
    }

    const result = await this.shoppingOrderService.submitOrder(
      { ...data, mem_code, mem_route: req.user.mem_route },
      ip,
    );
    return result;
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get cart item count' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Cart item count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/cart/count/:mem_code')
  async CountCart(@Param('mem_code') mem_code: string) {
    return await this.shoppingCartService.getCartItemCount(mem_code);
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product detail' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required, but overridden by JWT member code' },
      },
      required: ['pro_code', 'mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-detail')
  async GetProductDetail(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { pro_code: string; mem_code: string },
  ) {
    this.logger.log('data in controller:', data);
    const mem_code = req.user.mem_code;
    const result = await this.productsService.getProductDetail({
      ...data,
      mem_code,
      mem_route: req.user.mem_route,
    });
    await this.imagedebugService.UpsercetImg({
      pro_code: result.pro_code,
      imageUrl: result.pro_imgmain,
    });
    return result;
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List point-redeemable products' })
  @ApiParam({ name: 'sortBy', description: 'Sort order key, e.g. "name" or "point"', example: 'name' })
  @ApiResponse({ status: 200, description: 'Product coin list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-coin/:sortBy')
  async productCoin(
    @Req() req: Request & { user: JwtPayload },
    @Param('sortBy') sort_by: string,
  ) {
    const mem_code = req.user.mem_code;
    const result = await this.productsService.listFree(
      sort_by,
      mem_code,
      req.user.mem_route,
    );
    for (const resultItem of result) {
      await this.imagedebugService.UpsercetImg({
        pro_code: resultItem.pro_code,
        imageUrl: resultItem.pro_imgmain,
      });
    }
    return result;
  }

  // @UseGuards(JwtAuthGuard)
  // @Post('/ecom/products/upload-product-flashsale')
  // async uploadProductFlashSale(
  //   @Req() req: Request & { user: JwtPayload },
  //   @Body() data: { productCode: string; quantity: number }[],
  // ) {
  //   const permission = req.user.permission;
  //   if (permission === true) {
  //     return await this.productsService.uploadProductFlashSale(data);
  //   } else {
  //     throw new Error('You not have Permission to Accesss');
  //   }
  // }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add product to cart' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required, but overridden by JWT member code' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        pro_unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
        amount: { type: 'number', example: 2, description: 'Required' },
        flashsale_end: { type: 'string', example: '', description: 'Required; pass empty string if not a flash-sale item' },
        cartVersion: { type: 'string', example: '1', description: 'Optional' },
        clientVersion: { type: 'string', example: '1.0.0', description: 'Optional' },
        company_day_source: { type: 'string', example: '', description: 'Optional; empty string allowed' },
      },
      required: ['mem_code', 'pro_code', 'pro_unit', 'amount', 'flashsale_end'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product added to cart' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-add-cart')
  async addProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
      pro_unit: string;
      amount: number;
      // pro_freebie: number;
      flashsale_end: string;
      cartVersion?: string | number;
      clientVersion?: string;
      company_day_source?: string;
    },
  ) {
    const priceCondition = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      pro_unit: string;
      amount: number;
      priceCondition: string;
      mem_route?: string;
      // is_reward: boolean;
      flashsale_end: string;
      // hotdeal_free: boolean;
      clientVersion?: string | number;
      company_day_source?: string;
    } = {
      mem_code: data.mem_code,
      pro_code: data.pro_code,
      pro_unit: data.pro_unit,
      amount: data.amount,
      priceCondition,
      mem_route: req.user.mem_route,
      flashsale_end: data.flashsale_end,
      clientVersion: data.clientVersion ?? data.cartVersion,
      company_day_source: data.company_day_source,
    };
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.addProductCart(payload);
    const summaryCart = await this.shoppingCartService.summaryCart(
      data.mem_code,
    );
    return {
      cart,
      summaryCart: summaryCart.total,
      cartVersion,
      cartSyncedAt,
    };
  }

  @ApiTags('Tracking & Analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track company day promotion view' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promo_id: { type: 'number', example: 5, description: 'Required' },
        promo_name: { type: 'string', example: 'Company Day มิถุนายน', description: 'Required; not empty' },
        tier: { type: 'string', example: 'Gold', description: 'Required; not empty' },
        source: { type: 'string', example: 'banner', description: 'Required; not empty' },
      },
      required: ['promo_id', 'promo_name', 'tier', 'source'],
    },
  })
  @ApiResponse({ status: 201, description: 'View tracked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/company-day/view')
  trackCompanyDayView(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      promo_id: number;
      promo_name: string;
      tier: string;
      source: string;
    },
  ) {
    const mem_code = req.user.mem_code;
    void this.companyDayAnalyticService.emitEvent('view', mem_code, data);
    return { success: true };
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check/uncheck all cart items' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        type: { type: 'string', enum: ['check', 'uncheck'], example: 'check', description: 'Required; not empty' },
        clientVersion: { type: 'string', example: '1.0.0', description: 'Optional' },
      },
      required: ['mem_code', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Cart items updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-all-cart')
  async checkProductCartAll(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      mem_code: string;
      type: string;
      clientVersion?: string;
    },
  ) {
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      type: string;
      priceOption: string;
      clientVersion?: string;
    } = { ...data, priceOption };
    this.logger.log('Check all cart data:', data);
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.checkedProductCartAll(payload);
    const summaryCart = await this.shoppingCartService.summaryCart(
      data.mem_code,
    );
    return {
      cart,
      summaryCart: summaryCart.total,
      cartVersion,
      cartSyncedAt,
    };
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product from cart' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        clientVersion: { type: 'string', example: '1.0.0', description: 'Optional' },
      },
      required: ['mem_code', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product removed from cart' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-delete-cart')
  async deleteProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
      clientVersion?: string;
    },
  ) {
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      priceOption: string;
      clientVersion?: string;
    } = { ...data, priceOption };
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.handleDeleteCart(payload);
    const summaryCart = await this.shoppingCartService.summaryCart(
      data.mem_code,
    );
    return {
      cart,
      summaryCart: summaryCart.total,
      cartVersion,
      cartSyncedAt,
    };
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check/uncheck a single cart item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        type: { type: 'string', enum: ['check', 'uncheck'], example: 'check', description: 'Required; not empty' },
        clientVersion: { type: 'string', example: '1.0.0', description: 'Optional' },
      },
      required: ['mem_code', 'pro_code', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Cart item updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-cart')
  async checkProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
      type: string;
      clientVersion?: string;
    },
  ) {
    this.logger.log('Check cart data:', data);
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      type: string;
      priceOption: string;
      mem_route?: string;
      clientVersion?: string;
    } = { ...data, priceOption, mem_route: req.user.mem_route };
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.checkedProductCart(payload);
    const summaryCart = await this.shoppingCartService.summaryCart(
      data.mem_code,
    );
    return {
      cart,
      summaryCart: summaryCart.total,
      cartVersion,
      cartSyncedAt,
    };
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get cart snapshot with summary' })
  @ApiParam({ name: 'mem_code', description: 'Member code (unused, taken from JWT)', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Cart snapshot' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-cart/:mem_code')
  async getProductCart(@Req() req: Request & { user: JwtPayload }) {
    const memberCode = req.user.mem_code;
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.getCartSnapshot(
        memberCode,
        req.user.mem_route,
      );
    const summaryCart = await this.shoppingCartService.summaryCart(memberCode);
    const dataDeleteCart =
      await this.shoppingCartService.getDeleteCartItem(memberCode);
    for (const item of cart) {
      await this.imagedebugService.UpsercetImg({
        pro_code: item.pro_code,
        imageUrl: item.pro_imgmain,
      });
    }
    return {
      cart,
      summaryCart: summaryCart.total,
      cartVersion,
      cartSyncedAt,
      deleteCartItems: dataDeleteCart,
    };
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a cart item' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Cart item soft deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/delete-cart-item/:pro_code')
  async softDeleteCartItem(
    @Req() req: Request & { user: JwtPayload },
    @Param('pro_code') pro_code: string,
  ) {
    await this.shoppingCartService.softDeleteCartItem(
      req.user.mem_code,
      pro_code,
    );
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single product for cart' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Product detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-cart/get-one/:pro_code')
  async getProductCartOne(@Param('pro_code') pro_code: string) {
    return this.productsService.getProductOne(pro_code);
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get last 6 orders by member' })
  @ApiParam({ name: 'memCode', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Last 6 orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/last6/:memCode')
  async getLast6Orders(
    @Param('memCode') memCode: string,
  ): Promise<ShoppingOrderEntity[]> {
    const result =
      await this.shoppingOrderService.getLast6OrdersByMemberCode(memCode);
    for (const resultItem of result) {
      await this.imagedebugService.UpsercetImg({
        pro_code: resultItem.product.pro_code,
        imageUrl: resultItem.product.pro_imgmain,
      });
    }
    return result;
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all orders by member' })
  @ApiParam({ name: 'memCode', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'All member orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/all-order-member/:memCode')
  async AllOrderByMember(
    @Param('memCode') memCode: string,
  ): Promise<AllOrderByMemberRes> {
    const result = await this.shoppingHeadService.AllOrderByMember(memCode);
    for (const order of result) {
      for (const orderItem of order.Newdetails) {
        await this.imagedebugService.UpsercetImg({
          pro_code: orderItem.product.pro_code,
          imageUrl: orderItem.product.pro_imgmain,
        });
      }
    }
    return result;
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single order by running number' })
  @ApiParam({ name: 'soh_runing', description: 'Order running number', example: 'SO-67010001' })
  @ApiResponse({ status: 200, description: 'Order detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/some-order/:soh_runing')
  async SomeOrderByMember(
    @Param('soh_runing') soh_runing: string,
  ): Promise<ShoppingHeadEntity> {
    const result = await this.shoppingHeadService.SomeOrderByMember(soh_runing);
    for (const orderItem of result.details) {
      await this.imagedebugService.UpsercetImg({
        pro_code: orderItem.product.pro_code,
        imageUrl: orderItem.product.pro_imgmain,
      });
    }
    return result;
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a promotion with poster' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Required; promotion poster image' },
        promo_name: { type: 'string', example: 'โปรโมชั่นซัมเมอร์', description: 'Required; not empty' },
        creditor_code: { type: 'string', example: 'C001', description: 'Optional; empty string treated as no creditor' },
        start_date: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00Z', description: 'Required' },
        end_date: { type: 'string', format: 'date-time', example: '2026-07-31T23:59:59Z', description: 'Required' },
        status: { type: 'string', enum: ['true', 'false'], example: 'true', description: 'Required; string "true"/"false"' },
      },
      required: ['file', 'promo_name', 'start_date', 'end_date', 'status'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promotion created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/add')
  @UseInterceptors(FileInterceptor('file'))
  async addPromotion(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    data: {
      promo_name: string;
      creditor_code: string;
      start_date: Date;
      end_date: Date;
      status: string;
    },
  ) {
    return this.promotionService.addPromotion({
      ...data,
      status: data.status === 'true',
      creditor_code: data.creditor_code || null,
      file,
    });
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update promotion poster image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Required' },
        promo_id: { type: 'string', example: '12', description: 'Required; not empty' },
      },
      required: ['file', 'promo_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Poster updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update-poster')
  @UseInterceptors(FileInterceptor('file'))
  async updatePromoPoster(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: { promo_id: string },
  ) {
    return this.promotionService.updatePromoPoster({
      promo_id: Number(data.promo_id),
      file,
    });
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all promotions' })
  @ApiResponse({ status: 200, description: 'Promotion list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/list')
  async getPromotions() {
    return this.promotionService.getAllPromotions();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get promotion detail by id' })
  @ApiParam({ name: 'promo_id', description: 'Promotion id', example: '12' })
  @ApiResponse({ status: 200, description: 'Promotion detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/detail/:promo_id')
  async getPromotion(@Param('promo_id') promo_id: string) {
    return this.promotionService.getPromotionById(Number(promo_id));
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a tier to a promotion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Optional; tier poster image' },
        promo_id: { type: 'number', example: 12, description: 'Required' },
        tier_name: { type: 'string', example: 'Gold', description: 'Required; not empty' },
        min_amount: { type: 'number', example: 1000, description: 'Required' },
        description: { type: 'string', example: 'ซื้อครบ 1,000 บาท', description: 'Optional; empty string allowed' },
        detail: { type: 'string', example: 'รับส่วนลด 10%', description: 'Optional; empty string allowed' },
        is_unit_based: { type: 'string', enum: ['true', 'false'], example: 'false', description: 'Optional; string "true"/"false"' },
      },
      required: ['promo_id', 'tier_name', 'min_amount'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/add-tier')
  @UseInterceptors(FileInterceptor('file'))
  async addTier(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    data: {
      promo_id: number;
      tier_name: string;
      min_amount: number;
      description?: string;
      detail?: string;
      is_unit_based?: string;
    },
  ) {
    return this.promotionService.addTierToPromotion({
      promo_id: data.promo_id,
      tier_name: data.tier_name,
      min_amount: data.min_amount,
      description: data.description,
      detail: data.detail,
      file,
      is_unit_based: data.is_unit_based === 'true' ? true : false,
    });
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update promotion status' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promo_id: { type: 'number', example: 12, description: 'Required' },
        status: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['promo_id', 'status'],
    },
  })
  @ApiResponse({ status: 201, description: 'Status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update-status')
  async updatePromotionStatus(
    @Body() data: { promo_id: number; status: boolean },
  ) {
    return this.promotionService.updateStatus(data.promo_id, data.status);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { tier_id: { type: 'number', example: 5, description: 'Required' } },
      required: ['tier_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/delete-tier')
  async deleteTier(@Body() data: { tier_id: number }) {
    return this.promotionService.deleteTier(data.tier_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { promo_id: { type: 'number', example: 12, description: 'Required' } },
      required: ['promo_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promotion deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/delete')
  async deletePromotion(@Body() data: { promo_id: number }) {
    return this.promotionService.deletePromotion(data.promo_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List promotions available for duplicate' })
  @ApiResponse({ status: 200, description: 'Promotions for duplicate' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/list-for-duplicate')
  async getPromotionsForDuplicate() {
    return this.promotionService.getPromotionsForDuplicate();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate a promotion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promo_id: { type: 'number', example: 12, description: 'Required' },
        start_date: { type: 'string', format: 'date-time', example: '2026-08-01T00:00:00Z', description: 'Required' },
        end_date: { type: 'string', format: 'date-time', example: '2026-08-31T23:59:59Z', description: 'Required' },
      },
      required: ['promo_id', 'start_date', 'end_date'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promotion duplicated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/duplicate')
  async duplicatePromotion(
    @Body() data: { promo_id: number; start_date: Date; end_date: Date },
  ) {
    return this.promotionService.duplicatePromotion(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a promotion condition' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tier_id: { type: 'number', example: 5, description: 'Required' },
        product_gcode: { type: 'string', example: 'G001', description: 'Required; not empty' },
      },
      required: ['tier_id', 'product_gcode'],
    },
  })
  @ApiResponse({ status: 201, description: 'Condition created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/condition/add')
  async addPromotionCondition(
    @Body()
    data: {
      tier_id: number;
      product_gcode: string;
    },
  ) {
    return this.promotionService.createCondition(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion condition' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { cond_id: { type: 'number', example: 7, description: 'Required' } },
      required: ['cond_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Condition deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/condition/delete')
  async deletePromotionCondition(@Body() data: { cond_id: number }) {
    return this.promotionService.deleteCondition(data.cond_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List conditions by tier' })
  @ApiParam({ name: 'tier_id', description: 'Tier id', example: '5' })
  @ApiResponse({ status: 200, description: 'Conditions list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/condition/list/:tier_id')
  async listPromotionConditions(@Param('tier_id') tier_id: string) {
    return this.promotionService.getConditionsByTier(Number(tier_id));
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a promotion reward' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tier_id: { type: 'number', example: 5, description: 'Required' },
        product_gcode: { type: 'string', example: 'G001', description: 'Required; not empty' },
        qty: { type: 'number', example: 1, description: 'Required' },
        unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
      },
      required: ['tier_id', 'product_gcode', 'qty', 'unit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reward created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reward/add')
  async addPromotionReward(
    @Body()
    data: {
      tier_id: number;
      product_gcode: string;
      qty: number;
      unit: string;
    },
  ) {
    return this.promotionService.createReward(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List rewards by tier' })
  @ApiParam({ name: 'tier_id', description: 'Tier id', example: '5' })
  @ApiResponse({ status: 200, description: 'Rewards list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/reward/list/:tier_id')
  async listPromotionRewards(
    @Param('tier_id') tier_id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.promotionService.getRewardsByTier(
      Number(tier_id),
      req.user.mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products by creditor' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { creditor_code: { type: 'string', example: 'C001', description: 'Required; not empty' } },
      required: ['creditor_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Products by creditor' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/product/creditor')
  async getProductByCreditor(@Body() data: { creditor_code: string }) {
    return this.productsService.getProductByCreditor(data.creditor_code);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products for promotion key search' })
  @ApiResponse({ status: 200, description: 'Key search products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch')
  async getProductForKeySearch() {
    return this.productsService.getProductForKeySearch();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get flash sale products for key search' })
  @ApiResponse({ status: 200, description: 'Flash sale key search products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch-flashsale')
  async getProductForKeySearchForFlashSale() {
    return this.productsService.getProductForKeySearchForFlashSale();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommend products for key search' })
  @ApiResponse({ status: 200, description: 'Recommend key search products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch-recommend')
  async getProductForKeySearchForRecommend() {
    return this.productsService.getProductForKeySearchForRecommend();
  }

  @ApiTags('Promotion & Tier')
  @ApiOperation({ summary: 'Get replace products for key search' })
  @ApiResponse({ status: 200, description: 'Replace key search products' })
  // @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch-replace')
  async getProductForKeySearchForReplace() {
    return this.productsService.getProductForKeySearchForReplace();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a tier by id' })
  @ApiParam({ name: 'tier_id', description: 'Tier id', example: '5' })
  @ApiResponse({ status: 200, description: 'Tier detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/tiers/:tier_id')
  async getTierByID(@Param('tier_id') tier_id: number) {
    return this.promotionService.getTierOneById(tier_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion reward' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { reward_id: { type: 'number', example: 9, description: 'Required' } },
      required: ['reward_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reward deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reward/delete')
  async deletePromotionReward(@Body() data: { reward_id: number }) {
    return this.promotionService.deleteReward(data.reward_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promotion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promo_id: { type: 'number', example: 12, description: 'Required' },
        promo_name: { type: 'string', example: 'โปรโมชั่นซัมเมอร์', description: 'Optional; empty string allowed' },
        start_date: { type: 'string', format: 'date-time', example: '2026-08-01T00:00:00Z', description: 'Optional' },
        end_date: { type: 'string', format: 'date-time', example: '2026-08-31T23:59:59Z', description: 'Optional' },
        status: { type: 'boolean', example: true, description: 'Optional' },
      },
      required: ['promo_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promotion updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update/promotion')
  async updatePromotion(
    @Body()
    data: {
      promo_id: number;
      promo_name?: string;
      start_date?: Date;
      end_date?: Date;
      status?: boolean;
    },
  ) {
    return this.promotionService.updatePromotion(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a promotion reward' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reward_id: { type: 'number', example: 9, description: 'Required' },
        qty: { type: 'number', example: 2, description: 'Required' },
        unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
      },
      required: ['reward_id', 'qty', 'unit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reward edited' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update/edit-reward')
  async editReward(
    @Body()
    data: {
      reward_id: number;
      qty: number;
      unit: string;
    },
  ) {
    return this.promotionService.editReward(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tiers for customer' })
  @ApiResponse({ status: 200, description: 'Tiers for customer' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/get-tier-for-customer')
  async getTierAll(@Req() req: Request & { user: JwtPayload }) {
    return this.promotionService.getAllTiers(
      req.user.mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tier products' })
  @ApiResponse({ status: 200, description: 'All tier products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/get-tier-products-all')
  async getTierProducts() {
    return this.promotionService.getAllTiersProduct();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tier products for customer' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tier_id: { type: 'number', example: 5, description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        sort_by: { type: 'number', example: 1, description: 'Optional' },
      },
      required: ['tier_id', 'mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/get-tier-product-for-customer')
  async getProductTier(
    @Body() data: { tier_id: number; mem_code: string; sort_by?: number },
  ) {
    return this.promotionService.tierProducts(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiOperation({ summary: 'Add a creditor' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        creditor_code: { type: 'string', example: 'C001', description: 'Required; not empty' },
        creditor_name: { type: 'string', example: 'บริษัท ตัวอย่าง จำกัด', description: 'Required; not empty' },
      },
      required: ['creditor_code', 'creditor_name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Creditor added' })
  @Post('/ecom/promotion/creditor/add-creditor')
  async addCreditor(
    @Body() data: { creditor_code: string; creditor_name: string },
  ) {
    return this.productsService.addCreditor(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiOperation({ summary: 'Edit a tier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tier_id: { type: 'number', example: 5, description: 'Required' },
        tier_name: { type: 'string', example: 'Gold', description: 'Optional; empty string allowed' },
        min_amount: { type: 'number', example: 1000, description: 'Optional' },
        description: { type: 'string', example: 'ซื้อครบ 1,000 บาท', description: 'Optional; empty string allowed' },
        detail: { type: 'string', example: 'รับส่วนลด 10%', description: 'Optional; empty string allowed' },
      },
      required: ['tier_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier edited' })
  @Post('/ecom/promotion/edit-tier')
  async editTier(
    @Body()
    data: {
      tier_id: number;
      tier_name?: string;
      min_amount?: number;
      description?: string;
      detail?: string;
    },
  ) {
    return await this.promotionService.updateTier(data);
  }
  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import wangday data from Excel' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Required; rows from Excel with Thai column keys (วันที่, เลขที่ใบกำกับ, รหัสลูกค้า, ยอดเงินสุทธิ)',
          items: { type: 'object' },
        },
        isLastChunk: { type: 'boolean', example: true, description: 'Required' },
        isFirstChunk: { type: 'boolean', example: false, description: 'Required' },
        fileName: { type: 'string', example: 'wangday-2026-06.xlsx', description: 'Required; not empty' },
      },
      required: ['data', 'isLastChunk', 'isFirstChunk', 'fileName'],
    },
  })
  @ApiResponse({ status: 201, description: 'Wangday data imported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/wangday/import')
  async importWangday(
    @Body()
    body: {
      data: {
        date: string;
        sh_running: string;
        wang_code: string;
        sumprice: string;
      }[];
      isLastChunk: boolean;
      isFirstChunk: boolean;
      fileName: string;
    },
  ) {
    try {
      // แปลง key ภาษาไทยเป็น key ที่ entity ใช้
      const rows = (body.data || []).map((item) => {
        // this.logger.log('Mapping item:', item);
        const row = item as {
          วันที่?: number | string;
          เลขที่ใบกำกับ?: string;
          รหัสลูกค้า?: string;
          ยอดเงินสุทธิ?: number | string;
        };
        let dateValue: string | undefined = '';
        if (typeof row['วันที่'] === 'string') {
          dateValue = row['วันที่'];
        } else if (typeof row['วันที่'] === 'number') {
          dateValue = String(row['วันที่']);
        }
        return {
          date: dateValue,
          sh_running:
            typeof row['เลขที่ใบกำกับ'] === 'string'
              ? row['เลขที่ใบกำกับ']
              : '',
          wang_code:
            typeof row['รหัสลูกค้า'] === 'string' ? row['รหัสลูกค้า'] : '',
          sumprice:
            row['ยอดเงินสุทธิ'] !== undefined
              ? String(row['ยอดเงินสุทธิ'])
              : '',
        };
      });
      const imported = await this.wangdayService.importFromExcel(
        rows,
        body.isLastChunk,
        body.isFirstChunk,
        body.fileName,
      );
      return 'Successful' + imported.length;
    } catch (error) {
      this.logger.error('Error importing wangday data:', error);
      throw error;
    }
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get monthly wangday sum by code' })
  @ApiParam({ name: 'wang_code', description: 'Wang code', example: 'W001' })
  @ApiResponse({ status: 200, description: 'Monthly wangday sum' })
  @Get('/ecom/wangday/monthly/:wang_code')
  async getWangdayMonthly(@Param('wang_code') wang_code: string) {
    const result = await this.wangdayService.getMonthlySumByWangCode(wang_code);
    return result;
  }
  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get all wangday sum price by code' })
  @ApiParam({ name: 'wang_code', description: 'Wang code', example: 'W001' })
  @ApiResponse({ status: 200, description: 'Wangday sum price' })
  @Get('/ecom/wangsumprice/:wang_code')
  async getWangSumPrice(@Param('wang_code') wang_code: string) {
    return this.wangdayService.getAllWangSumPrice(wang_code);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiOperation({ summary: 'Search main products for hotdeal' })
  @ApiParam({ name: 'keyword', description: 'Search keyword', example: 'paracetamol' })
  @ApiResponse({ status: 201, description: 'Matched products' })
  @Post('/ecom/admin/hotdeal/search-product-main/:keyword')
  async searchProductMain(@Param('keyword') keyword: string) {
    const result = await this.hotdealService.searchProduct(keyword);
    for (const resultItem of result) {
      await this.imagedebugService.UpsercetImg({
        pro_code: resultItem?.pro_code,
        imageUrl: resultItem?.pro_imgmain,
      });
    }
    return result;
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a hotdeal' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Required; hotdeal input payload (pro_code, dates, discount, freebies, etc.)' },
        id: { type: 'number', example: 5, description: 'Optional; omit to create, provide to update' },
        order: { type: 'number', example: 1, description: 'Optional' },
        special_deal: { type: 'boolean', example: false, description: 'Optional' },
      },
      required: ['data'],
    },
  })
  @ApiResponse({ status: 201, description: 'Hotdeal saved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/hotdeal/save-hotdeal')
  async saveHotdeal(
    @Body()
    body: {
      data: HotdealInput;
      id?: number;
      order?: number;
      special_deal?: boolean;
    },
  ) {
    this.logger.log('Saving Hotdeal:', body);
    return this.hotdealService.saveHotdeal(
      body.data,
      body.id,
      body.order,
      body.special_deal,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiOperation({ summary: 'Get all hotdeals with product names' })
  @ApiResponse({ status: 200, description: 'List of hotdeals' })
  @Get('/ecom/admin/hotdeal/all-hotdeals')
  async getAllHotdeals() {
    return this.hotdealService.getAllHotdealsWithProductNames();
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a hotdeal' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 5, description: 'Required' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['id', 'pro_code'],
    },
  })
  @ApiResponse({ status: 200, description: 'Hotdeal deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/admin/hotdeal/delete')
  async deleteHotdeal(@Body() data: { id: number; pro_code: string }) {
    return this.hotdealService.deleteHotdeal(data.id, data.pro_code);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get hotdeals (simple list) for current member' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'offset', required: false, type: String, example: '0' })
  @ApiQuery({ name: 'special_deal', required: false, type: String, description: '"true" or "false"', example: 'false' })
  @ApiResponse({ status: 200, description: 'List of hotdeals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/hotdeal/simple-list')
  async getAllHotdealsSimple(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('special_deal') specialDeal?: string,
  ) {
    const memberCode = req.user.mem_code;
    const specialDealFilter =
      specialDeal === undefined ? undefined : specialDeal === 'true';

    return this.hotdealService.getAllHotdealsWithProductDetail(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      memberCode,
      req.user.mem_route,
      specialDealFilter,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product-pro deals (simple list) for current member' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'offset', required: false, type: String, example: '0' })
  @ApiResponse({ status: 200, description: 'List of product-pro deals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-pro/simple-list')
  async getProductProSimpleList(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.hotdealService.getProductProDeals(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      req.user.mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get "buy more get 1" deals (simple list) for current member' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'offset', required: false, type: String, example: '0' })
  @ApiResponse({ status: 200, description: 'List of buy-more-get-1 deals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/buy-more-get-1/simple-list')
  async getBuyMoreGetOneSimpleList(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.hotdealService.getBuyMoreGetOneDeals(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      req.user.mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiOperation({ summary: 'Check which cart items match active hotdeals' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hotDeal: {
          type: 'array',
          description: 'Required',
          items: {
            type: 'object',
            properties: {
              pro_code: { type: 'string', example: 'P00123' },
              shopping_cart: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pro1_unit: { type: 'string', example: 'กล่อง' },
                    pro1_amount: { type: 'string', example: '2' },
                  },
                },
              },
            },
            required: ['pro_code', 'shopping_cart'],
          },
        },
      },
      required: ['hotDeal'],
    },
  })
  @ApiResponse({ status: 201, description: 'Matched hotdeals' })
  @Post('/ecom/hotdeal/check-hotdeal-match')
  async checkHotdealMatch(
    @Body()
    body: {
      hotDeal: {
        pro_code: string;
        shopping_cart: { pro1_unit: string; pro1_amount: string }[];
      }[];
    },
  ) {
    try {
      const allResults = await Promise.all(
        (body.hotDeal || []).map(async (deal) => {
          const results = await this.hotdealService.checkHotdealMatch(
            deal.pro_code,
            deal.shopping_cart,
          );
          // filter เฉพาะตัวที่เจอ pro_code
          return results;
        }),
      );
      // flatten array
      return allResults.flat().filter(Boolean);
    } catch (error) {
      this.logger.error('Error in checkHotdealMatch:', error);
      throw new Error('Error checking hotdeal match');
    }
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply a promo code and check reward in cart' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { code_text: { type: 'string', example: 'PROMO2026', description: 'Required; not empty' } },
      required: ['code_text'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reward checked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/code/use')
  async useCodeForCheckReward(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { code_text: string },
  ) {
    const mem_code = req.user.mem_code;
    const price_option = req.user.price_option ?? 'C';
    return this.promotionService.checkedRewardInCartByCode(
      body.code_text,
      mem_code,
      price_option,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a promo code for a member (requires permission)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' } },
      required: ['mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promo code generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/code/generate')
  async generateCodePromotion(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { mem_code: string },
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You not have Permission to Accesss');
    }
    return this.promotionService.generateCodePromotion(data.mem_code);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiOperation({ summary: 'Get hotdeal/freebie detail by product code' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Hotdeal detail' })
  @Get('/ecom/hotdeal/get-hotdeal-from-code/:pro_code')
  async getHotdealFromCode(@Param('pro_code') pro_code: string) {
    return await this.hotdealService.getHotdealFromCode(pro_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Bulk update products from back office import file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        group: {
          type: 'array',
          description: 'Required; rows of product fields to update (pro_code, pro_name, prices, ratios, units, supplier, stock fields)',
          items: { type: 'object' },
        },
        filename: { type: 'string', example: 'back-office-2026-06.xlsx', description: 'Required; not empty' },
      },
      required: ['group', 'filename'],
    },
  })
  @ApiResponse({ status: 201, description: 'Products updated' })
  @Post('/ecom/admin/update-product-from-back-office')
  async updateProductFromBackOffice(
    @Body()
    body: {
      group: {
        pro_code: string;
        pro_name: string;
        priceA: number;
        priceB: number;
        priceC: number;
        ratio1: number;
        ratio2: number;
        ratio3: number;
        unit1: string;
        unit2: string;
        unit3: string;
        supplier: string;
        pro_lowest_stock: number;
        order_quantity: number;
      }[];
      filename: string;
    },
  ) {
    try {
      return this.productsService.updateProductFromBackOffice({
        group: body.group,
        filename: body.filename,
      });
    } catch (error) {
      this.logger.error('Error updating product from back office:', error);
      throw new Error('Error updating product from back office');
    }
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Bulk upsert customer accounts' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
          mem_nameSite: { type: 'string', example: 'ร้านยาตัวอย่าง', description: 'Required; not empty' },
          mem_username: { type: 'string', example: 'pharmacy01', description: 'Required; not empty' },
          mem_password: { type: 'string', example: 'P@ssw0rd123', description: 'Required; not empty' },
          mem_price: { type: 'string', example: 'A', description: 'Required; not empty' },
          emp_saleoffice: { type: 'string', example: 'E001', description: 'Required; not empty' },
          latest_purchase: { type: 'string', example: '2026-06-01', description: 'Required; not empty' },
          emp_id_ref: { type: 'string', example: 'E001', description: 'Optional; empty string allowed' },
        },
        required: [
          'mem_code',
          'mem_nameSite',
          'mem_username',
          'mem_password',
          'mem_price',
          'emp_saleoffice',
          'latest_purchase',
        ],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Customers upserted' })
  @Post('/ecom/update-customer-data')
  async updateCustomerData(
    @Body()
    data: {
      mem_code: string;
      mem_nameSite: string;
      mem_username: string;
      mem_password: string;
      mem_price: string;
      emp_saleoffice: string;
      latest_purchase: string;
      emp_id_ref?: string;
    }[],
  ) {
    return this.authService.upsertUser(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get last shopping head running number' })
  @ApiResponse({ status: 200, description: 'Last sh_running value' })
  @Get('/ecom/last-sh-running')
  async getLastShRunning() {
    return this.shoppingHeadService.getLastSHRunnning();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Bulk update stock from back office import file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        group: {
          type: 'array',
          description: 'Required',
          items: {
            type: 'object',
            properties: {
              pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
              stock: { type: 'number', example: 100, description: 'Required' },
            },
            required: ['pro_code', 'stock'],
          },
        },
        filename: { type: 'string', example: 'stock-2026-06.xlsx', description: 'Required; not empty' },
      },
      required: ['group', 'filename'],
    },
  })
  @ApiResponse({ status: 201, description: 'Stock updated' })
  @Post('/ecom/admin/update-stock-from-back-office')
  async updateStockFromBackOffice(
    @Body()
    body: {
      group: { pro_code: string; stock: number }[];
      filename: string;
    },
  ) {
    try {
      return await this.productsService.updateStock(body);
    } catch (error) {
      this.logger.error('Error updating stock from back office:', error);
      throw new Error('Error updating stock from back office');
    }
  }
  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reindex all products to Elasticsearch' })
  @ApiResponse({ status: 201, description: 'Sync started/completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/sync-products-elastic')
  async syncProductsToElastic() {
    return this.productsService.syncAllProductsToElastic();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get file log entries by feature' })
  @ApiParam({ name: 'feature', description: 'Feature name', example: 'wangday-import' })
  @ApiResponse({ status: 200, description: 'File log entries' })
  @Get('/ecom/fileLog/:feature')
  async getFileLog(@Param('feature') feature: string) {
    const fileLogs = await this.backendService.getFeatured({
      featured: feature,
    });
    return fileLogs;
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all debtor records for a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'List of debtor records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/debtor/:mem_code')
  async getDebtor(@Param('mem_code') mem_code: string) {
    return await this.debtorService.getAllDebtors(mem_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get favorite product count for a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Favorite count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/favorite/count/:mem_code')
  async getCountFavorite(@Param('mem_code') mem_code: string) {
    return await this.favoriteService.getCountFavorite(mem_code);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all searchable product keywords for current member' })
  @ApiResponse({ status: 200, description: 'List of product keywords' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product/keysearch-all')
  async getKeySearch(@Req() req: Request & { user: JwtPayload }) {
    const mem_code = req.user.mem_code;
    return await this.productsService.keySearchProducts(
      mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add product lot/expiry records' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lot: { type: 'string', example: 'LOT2026A', description: 'Required; not empty' },
          mfg: { type: 'string', example: '2026-01-01', description: 'Required; not empty' },
          exp: { type: 'string', example: '2028-01-01', description: 'Required; not empty' },
          pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        },
        required: ['lot', 'mfg', 'exp', 'pro_code'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Lots added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/lot/add-lots')
  async addLots(
    @Body()
    data: {
      lot: string;
      mfg: string;
      exp: string;
      pro_code: string;
    }[],
  ) {
    return this.lotService.addLots(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a daily flash sale promotion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promotion_name: { type: 'string', example: 'Flash Sale วันศุกร์', description: 'Required; not empty' },
        date: { type: 'string', example: '2026-07-03', description: 'Required; not empty' },
        time_start: { type: 'string', example: '10:00', description: 'Required; not empty' },
        time_end: { type: 'string', example: '14:00', description: 'Required; not empty' },
        is_active: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['promotion_name', 'date', 'time_start', 'time_end', 'is_active'],
    },
  })
  @ApiResponse({ status: 201, description: 'Flash sale created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/add-flashsale')
  async addDailyFlashsale(
    @Body()
    data: {
      promotion_name: string;
      date: string;
      time_start: string;
      time_end: string;
      is_active: boolean;
    },
  ) {
    return await this.flashsaleService.addFlashSale(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to a daily flash sale' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promotion_id: { type: 'number', example: 3, description: 'Required' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        limit: { type: 'number', example: 50, description: 'Required' },
      },
      required: ['promotion_id', 'pro_code', 'limit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product added to flash sale' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/add-product')
  async addProductToDailyFlashsale(
    @Body()
    data: {
      promotion_id: number;
      pro_code: string;
      limit: number;
    },
  ) {
    return await this.flashsaleService.addProductToFlashSale(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all daily flash sale promotions' })
  @ApiResponse({ status: 200, description: 'List of flash sales' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/daily-flashsale/list')
  async getAllDailyFlashsales() {
    return await this.flashsaleService.getAllFlashSales();
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products in a daily flash sale' })
  @ApiParam({ name: 'promotion_id', description: 'Flash sale promotion id', example: '3' })
  @ApiResponse({ status: 200, description: 'List of products in flash sale' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/daily-flashsale/products/:promotion_id')
  async getProductsInDailyFlashsale(
    @Param('promotion_id') promotion_id: number,
  ) {
    return await this.flashsaleService.getProductsInFlashSale(promotion_id);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product from a daily flash sale' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { id: { type: 'number', example: 10, description: 'Required' } },
      required: ['id'],
    },
  })
  @ApiResponse({ status: 200, description: 'Product removed from flash sale' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/daily-flashsale/delete-product')
  async deleteProductDailyFlashsale(@Body('id') id: number) {
    return await this.flashsaleService.deleteProduct(id);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a product in a daily flash sale' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 10, description: 'Required' },
        limit: { type: 'number', example: 50, description: 'Required' },
      },
      required: ['id', 'limit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product updated in flash sale' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/edit-product')
  async editProductInDailyFlashSale(
    @Body() data: { id: number; limit: number },
  ) {
    return await this.flashsaleService.editProductInFlashSale(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active flash sale for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', example: 20, description: 'Optional; max items to return' },
        mem_code: { type: 'string', example: 'M00123', description: 'Optional; overridden by JWT mem_code if present' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Flash sale data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/get-flashsale')
  async getFlashsaleByDate(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { limit: number; mem_code: string },
  ) {
    const mem_code = req.user.mem_code;
    return await this.flashsaleService.getFlashSale(
      data.limit,
      mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change active status of a daily flash sale' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 10, description: 'Required' },
        is_active: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['id', 'is_active'],
    },
  })
  @ApiResponse({ status: 201, description: 'Status changed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/change-status')
  async changeStatusDailyFlashsale(
    @Body() data: { id: number; is_active: boolean },
  ) {
    return await this.flashsaleService.changeStatus({
      promotion_id: data.id,
      is_active: data.is_active,
    });
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a daily flash sale' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { id: { type: 'number', example: 3, description: 'Required' } },
      required: ['id'],
    },
  })
  @ApiResponse({ status: 200, description: 'Flash sale deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/daily-flashsale/delete-flashsale')
  async deleteDailyFlashsale(@Body('id') id: number) {
    return await this.flashsaleService.deleteFlashSale(id);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert a file log entry' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        feature: { type: 'string', example: 'wangday-import', description: 'Required; not empty' },
        filename: { type: 'string', example: 'import-2026-06-23.csv', description: 'Required; not empty' },
      },
      required: ['feature', 'filename'],
    },
  })
  @ApiResponse({ status: 201, description: 'File log upserted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/upload-log-file')
  async uploadLogFile(@Body() data: { feature: string; filename: string }) {
    return await this.backendService.upsertFileLog({
      feature: data.feature,
      filename: data.filename,
    });
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get the log file for a feature' })
  @ApiParam({ name: 'feature', description: 'Feature name', example: 'wangday-import' })
  @ApiResponse({ status: 200, description: 'Log file content' })
  @Get('/ecom/get-upload-log-file/:feature')
  async getUploadLogFile(@Param('feature') feature: string) {
    return await this.backendService.getLogfile(feature);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a daily flash sale promotion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promotion_id: { type: 'number', example: 3, description: 'Required' },
        promotion_name: { type: 'string', example: 'Flash Sale วันหยุด', description: 'Required; not empty' },
        date: { type: 'string', example: '2026-06-23', description: 'Required; format YYYY-MM-DD' },
        time_start: { type: 'string', example: '09:00', description: 'Required; format HH:mm' },
        time_end: { type: 'string', example: '21:00', description: 'Required; format HH:mm' },
        is_active: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['promotion_id', 'promotion_name', 'date', 'time_start', 'time_end', 'is_active'],
    },
  })
  @ApiResponse({ status: 201, description: 'Flash sale updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/edit-flashsale')
  async editDailyFlashsale(
    @Body()
    data: {
      promotion_id: number;
      promotion_name: string;
      date: string;
      time_start: string;
      time_end: string;
      is_active: boolean;
    },
  ) {
    return await this.flashsaleService.EditFlashSale(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an invisible-product topic for a creditor' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        invisible_name: { type: 'string', example: 'ซ่อนสินค้าโปรโมชั่น', description: 'Required; not empty' },
        date_end: { type: 'string', example: '2026-12-31', description: 'Required; format YYYY-MM-DD' },
        creditor_code: { type: 'string', example: 'C00123', description: 'Required; not empty' },
      },
      required: ['invisible_name', 'date_end', 'creditor_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Topic added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/add-invisible-topic')
  async addInvisibleTopic(
    @Body()
    data: {
      invisible_name: string;
      date_end: string;
      creditor_code: string;
    },
  ) {
    return await this.invisibleService.addInvisibleTopic(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all invisible-product topics' })
  @ApiResponse({ status: 200, description: 'List of invisible-product topics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/invisible-product/get-invisible-topic-all')
  async getInvisibleTopic() {
    return await this.invisibleService.handleGetInvisibleTopics();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get invisible products by creditor code' })
  @ApiParam({ name: 'creditor_code', description: 'Creditor code', example: 'C00123' })
  @ApiResponse({ status: 200, description: 'List of products' })
  @Get('/ecom/invisible/product/creditor/:creditor_code')
  async getInvisibleProductByCreditor(
    @Param('creditor_code') creditor_code: string,
  ) {
    return this.productsService.getProductByCreditor(creditor_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get invisible products by invisible topic id' })
  @ApiParam({ name: 'invisible_id', description: 'Invisible topic id', example: 1 })
  @ApiResponse({ status: 200, description: 'List of products' })
  @Get('/ecom/invisible/product/creditor/list/:invisible_id')
  async getInvisibleProductByInvisibleID(
    @Param('invisible_id') invisible_id: number,
  ) {
    return this.invisibleService.handleGetInvisibleProducts(invisible_id);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to an invisible-product topic' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        invisible_id: { type: 'number', example: 1, description: 'Required' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['invisible_id', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product added to topic' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/add-product')
  async addInvisibleProduct(
    @Body()
    data: {
      invisible_id: number;
      pro_code: string;
    },
  ) {
    return await this.invisibleService.updateProductInvisible(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a product from invisible-product topics' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/delete-product')
  async deleteInvisibleProduct(@Body('pro_code') pro_code: string) {
    return await this.invisibleService.removeProductInvisible(pro_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an invisible-product topic' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { invisible_id: { type: 'string', example: '1', description: 'Required; not empty' } },
      required: ['invisible_id'],
    },
  })
  @ApiResponse({ status: 200, description: 'Topic deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/invisible-product/delete-topic')
  async deleteInvisibleTopic(@Body('invisible_id') invisible_id: string) {
    return await this.invisibleService.deleteInvisibleTopic(
      Number(invisible_id),
    );
  }

  @ApiTags('Address')
  @ApiOperation({ summary: 'Get an address by id' })
  @ApiParam({ name: 'addressId', description: 'Address id', example: 5 })
  @ApiResponse({ status: 201, description: 'Address detail' })
  // @UseGuards(JwtAuthGuard)
  @Post('/ecom/address/edit-address/:addressId')
  async editAddress(@Param('addressId') addressId: number) {
    return this.editAddressService.getAddressById(addressId);
  }

  @ApiTags('Address')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new address for a member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'บ้าน', description: 'Optional; empty string allowed' },
        fullName: { type: 'string', example: 'สมชาย ใจดี', description: 'Required; not empty' },
        mem_address: { type: 'string', example: '99/1', description: 'Optional; empty string allowed' },
        mem_village: { type: 'string', example: 'หมู่ 5', description: 'Optional; empty string allowed' },
        mem_alley: { type: 'string', example: 'ซอย 1', description: 'Optional; empty string allowed' },
        mem_road: { type: 'string', example: 'ถนนสุขุมวิท', description: 'Optional; empty string allowed' },
        mem_province: { type: 'string', example: 'กรุงเทพมหานคร', description: 'Required; not empty' },
        mem_amphur: { type: 'string', example: 'บางนา', description: 'Required; not empty' },
        mem_tumbon: { type: 'string', example: 'บางนา', description: 'Required; not empty' },
        mem_post: { type: 'string', example: '10260', description: 'Required; not empty' },
        phoneNumber: { type: 'string', example: '0812345678', description: 'Required; not empty' },
        Note: { type: 'string', example: 'ฝากไว้กับยาม', description: 'Optional; empty string allowed' },
        defaults: { type: 'boolean', example: false, description: 'Optional; defaults to false' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
      },
      required: [
        'fullName',
        'mem_province',
        'mem_amphur',
        'mem_tumbon',
        'mem_post',
        'phoneNumber',
        'mem_code',
      ],
    },
  })
  @ApiResponse({ status: 201, description: 'Address created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/address/create-address')
  async createAddress(
    @Body()
    addressData: {
      name?: string;
      fullName: string;
      mem_address?: string;
      mem_village?: string;
      mem_alley?: string;
      mem_road?: string;
      mem_province: string;
      mem_amphur: string;
      mem_tumbon: string;
      mem_post: string;
      phoneNumber: string;
      Note?: string;
      defaults?: boolean;
      mem_code: string;
    },
  ) {
    return this.editAddressService.createAddress(addressData);
  }

  @ApiTags('Address')
  @ApiOperation({ summary: 'Update an existing address' })
  @ApiParam({ name: 'id', description: 'Address id', example: 5 })
  @ApiBody({ type: EditAddress })
  @ApiResponse({ status: 200, description: 'Address updated' })
  // @UseGuards(JwtAuthGuard)
  @Put('/ecom/address/update-address/:id')
  async updateAddress(@Param('id') id: number, @Body() address: EditAddress) {
    return this.editAddressService.updateAddress(id, address);
  }

  @ApiTags('Address')
  @ApiOperation({ summary: 'Get all addresses for a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'List of addresses' })
  @Get('/ecom/address/:mem_code')
  async getAddressByUser(@Param('mem_code') mem_code: string) {
    return await this.editAddressService.getAddressesByUser(mem_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Save modal/popup content' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1, description: 'Required' },
        title: { type: 'string', example: 'ประกาศปิดระบบ', description: 'Required; not empty' },
        content: { type: 'string', example: '<p>เนื้อหา</p>', description: 'Optional; empty string allowed' },
        show: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['id', 'title', 'show'],
    },
  })
  @ApiResponse({ status: 201, description: 'Modal content saved' })
  @Post('/ecom/admin/modal-content/save')
  async saveModalContent(
    @Body()
    body: {
      id: number;
      title: string;
      content?: string;
      show: boolean;
    },
  ) {
    return this.modalContentService.saveModalContent(body);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get modal/popup content' })
  @ApiResponse({ status: 200, description: 'Modal content' })
  @Get('/ecom/admin/modal-content/get')
  async getModalContent() {
    return this.modalContentService.getModalContent();
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all "fix free" (point-redeemable) products' })
  @ApiResponse({ status: 200, description: 'List of free products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-free/all')
  async getAllProductFree() {
    try {
      return await this.fixFreeService.getAllProductFree();
    } catch {
      throw new Error('Error getting all free products');
    }
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to the "fix free" point-redeemable list' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        pro_point: { type: 'number', example: 100, description: 'Required' },
      },
      required: ['pro_code', 'pro_point'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-free/add')
  async addProductFree(@Body() data: { pro_code: string; pro_point: number }) {
    return await this.fixFreeService.addProductFree(data);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a product from the "fix free" list' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 200, description: 'Product removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/product-free/delete')
  async deleteProductFree(@Body() data: { pro_code: string }) {
    return await this.fixFreeService.removeProductFree(data.pro_code);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit the point cost of a "fix free" product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        pro_point: { type: 'number', example: 150, description: 'Required' },
      },
      required: ['pro_code', 'pro_point'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product point updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-free/edit')
  async editProductFree(@Body() data: { pro_code: string; pro_point: number }) {
    return await this.fixFreeService.editPoint(data.pro_code, data.pro_point);
  }

  // @Get('/ip')
  // getIP(@Ip() ip: string) {
  //   return { ip };
  // }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Refresh an access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...', description: 'Required; not empty; refresh token' } },
      required: ['token'],
    },
  })
  @ApiResponse({ status: 201, description: 'New access token issued' })
  @Post('/ecom/refresh_token')
  async refreshToken(@Body() body: { token: string }, @Req() req: Request) {
    return this.authService.refreshToken(
      body.token,
      req.headers['x-client'] as string,
    );
  }

  // Session Management APIs
  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a login session for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        session_token: { type: 'string', example: 'a1b2c3d4e5', description: 'Required; not empty' },
        ip_address: { type: 'string', example: '203.0.113.10', description: 'Optional; empty string allowed' },
        user_agent: { type: 'string', example: 'Mozilla/5.0', description: 'Optional; empty string allowed' },
        device_type: { type: 'string', example: 'mobile', description: 'Optional; empty string allowed' },
      },
      required: ['session_token'],
    },
  })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/create')
  async createSession(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      session_token: string;
      ip_address?: string;
      user_agent?: string;
      device_type?: string;
    },
  ) {
    const mem_code = req.user.mem_code;
    return await this.sessionsService.createSession(
      mem_code,
      data.session_token,
      data.ip_address,
      data.user_agent,
      data.device_type,
    );
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an active session by token' })
  @ApiParam({ name: 'session_token', description: 'Session token', example: 'a1b2c3d4e5' })
  @ApiResponse({ status: 200, description: 'Active session' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/active/:session_token')
  async getActiveSession(@Param('session_token') session_token: string) {
    return await this.sessionsService.findActiveSession(session_token);
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions for a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/user-sessions/:mem_code')
  async getUserActiveSessions(@Param('mem_code') mem_code: string) {
    return await this.sessionsService.findUserActiveSessions(mem_code);
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update last activity timestamp of a session' })
  @ApiParam({ name: 'session_token', description: 'Session token', example: 'a1b2c3d4e5' })
  @ApiResponse({ status: 200, description: 'Session activity updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/session/update-activity/:session_token')
  async updateSessionActivity(@Param('session_token') session_token: string) {
    await this.sessionsService.updateLastActivity(session_token);
    return { message: 'Session activity updated successfully' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout a single session' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { session_token: { type: 'string', example: 'a1b2c3d4e5', description: 'Required; not empty' } },
      required: ['session_token'],
    },
  })
  @ApiResponse({ status: 201, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout')
  async logoutSession(@Body() data: { session_token: string }) {
    await this.sessionsService.logoutSession(data.session_token);
    return { message: 'Logout successful' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions of a member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' } },
      required: ['mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'All sessions logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout-all')
  async logoutAllSessions(@Body() data: { mem_code: string }) {
    await this.sessionsService.logoutAllUserSessions(data.mem_code);
    return { message: 'All sessions logged out successfully' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout recently active sessions of a member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' } },
      required: ['mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Recently active sessions logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout-recent')
  async logoutRecentSessions(@Body() data: { mem_code: string }) {
    await this.sessionsService.logoutRecentUserSessions(data.mem_code);
    return { message: 'Recently active sessions logged out successfully' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate whether a session token is still active' })
  @ApiParam({ name: 'session_token', description: 'Session token', example: 'a1b2c3d4e5' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/validate/:session_token')
  async validateSession(@Param('session_token') session_token: string) {
    const isValid = await this.sessionsService.isSessionValid(session_token);
    return { is_valid: isValid };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Count active sessions of a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Active session count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/count/:mem_code')
  async countActiveSessions(@Param('mem_code') mem_code: string) {
    const count = await this.sessionsService.countUserActiveSessions(mem_code);
    return { active_sessions_count: count };
  }

  @ApiTags('Password')
  @ApiOperation({ summary: 'Check whether a member has an email on file for password reset' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Email check result' })
  @Get('/ecom/password/check-email/:mem_code')
  async checkEmail(@Param('mem_code') mem_code: string): Promise<{
    RefKey?: string;
    email?: boolean;
    success: boolean;
    message: string;
  }> {
    const result = await this.changePasswordService.CheckMember(mem_code);
    return result;
  }

  @ApiTags('Password')
  @ApiOperation({ summary: 'Request an OTP for password reset' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' } },
      required: ['mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'OTP request result' })
  @Post('/ecom/password/request-otp')
  async requestOtp(@Body('mem_code') mem_code: string): Promise<{
    valid: boolean;
    message: string;
    remainingTime?: number;
  }> {
    const result = await this.changePasswordService.CheckTimeRequest(mem_code);
    return result;
  }

  @ApiTags('Password')
  @ApiOperation({ summary: 'Validate an OTP for password reset' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_username: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        otp: { type: 'string', example: '123456', description: 'Required; not empty' },
        timeNow: { type: 'string', example: '2026-06-23T10:00:00.000Z', description: 'Required; ISO datetime' },
      },
      required: ['mem_username', 'otp', 'timeNow'],
    },
  })
  @ApiResponse({ status: 201, description: 'OTP validation result' })
  @Post('/ecom/password/validate-otp')
  async validateOtp(
    @Body()
    data: {
      mem_username: string;
      otp: string;
      timeNow: string;
    },
  ): Promise<{ valid: boolean; message: string; block?: boolean }> {
    const result = await this.changePasswordService.validateOtp(data);
    return result;
  }

  @ApiTags('Password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        new_password: { type: 'string', example: 'NewP@ssw0rd', description: 'Required; not empty' },
        old_password: { type: 'string', example: 'OldP@ssw0rd', description: 'Required; not empty' },
        logout_all_devices: { type: 'boolean', example: false, description: 'Optional; defaults to false' },
      },
      required: ['new_password', 'old_password'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password change result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/password/change-password')
  async changePassword(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      new_password: string;
      old_password: string;
      logout_all_devices?: boolean;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const mem_username = req.user.username;
      const result =
        await this.changePasswordService.CheckOldPasswordAndUpdatePassword({
          mem_username: mem_username,
          new_password: body.new_password,
          old_password: body.old_password,
        });
      if (result.success && body.logout_all_devices) {
        await this.sessionsService.logoutAllUserSessions(req.user.mem_code);
      }
      return result;
    } catch {
      return {
        success: false,
        message: 'An error occurred while changing the password.',
      };
    }
  }

  @ApiTags('Password')
  @ApiOperation({ summary: 'Reset password using a validated OTP' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_username: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        new_password: { type: 'string', example: 'NewP@ssw0rd', description: 'Required; not empty' },
        otp: { type: 'string', example: '123456', description: 'Required; not empty' },
      },
      required: ['mem_username', 'new_password', 'otp'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset result' })
  @Put('/ecom/password/reset-password')
  async resetPassword(
    @Body()
    body: {
      mem_username: string;
      new_password: string;
      otp: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    return this.changePasswordService.forgotPasswordUpdate(body);
  }

  @ApiTags('Products')
  @ApiOperation({ summary: 'Bulk add new-arrival product batches' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
          LOT: { type: 'string', example: 'L2026001', description: 'Required; not empty' },
          MFG: { type: 'string', example: '2026-01-01', description: 'Required; format YYYY-MM-DD' },
          EXP: { type: 'string', example: '2028-01-01', description: 'Required; format YYYY-MM-DD' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-06-23T10:00:00.000Z', description: 'Required; ISO datetime' },
          amount: { type: 'number', example: 100, description: 'Required' },
          unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
        },
        required: ['pro_code', 'LOT', 'MFG', 'EXP', 'createdAt', 'amount', 'unit'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'New arrivals added' })
  @Post('/ecom/new-arrivals')
  async NewArrivals(
    @Body()
    data: {
      pro_code: string;
      LOT: string;
      MFG: string;
      EXP: string;
      createdAt: Date;
      amount: number;
      unit: string;
    }[],
  ) {
    try {
      await this.newArrivalsService.addNewArrival(data);
      return { message: 'New arrivals added successfully' };
    } catch (error) {
      this.logger.error('Error adding new arrivals:', error);
      throw new Error('Error adding new arrivals');
    }
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get up to 30 new-arrival products for current member' })
  @ApiParam({ name: 'mem_code', description: 'Member code (unused, taken from JWT)', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'List of new-arrival products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/new-arrivals/list/:mem_code')
  async getNewArrivalsLimit30(@Req() req: Request & { user: JwtPayload }) {
    const memberCode = req.user.mem_code;
    return this.newArrivalsService.getNewArrivalsLimit30(
      memberCode,
      req.user.mem_route,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiOperation({ summary: 'Find a hotdeal by product code' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Hotdeal detail' })
  @Get('/ecom/hotdeal/find/:pro_code')
  find(@Param('pro_code') pro_code: string): Promise<any> {
    return this.hotdealService.find(pro_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wangday data grouped by product (requires permission)' })
  @ApiResponse({ status: 200, description: 'Wangday data by product' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/wangday')
  async getProductWangday(@Req() req: Request & { user: JwtPayload }): Promise<{
    [wang_code: string]: {
      wang_code: string;
      monthly: { [month: number]: number };
      total: number;
    };
  }> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.wangdayService.getProductWangday();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all company-day promotions (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of promotions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/company-days')
  async getCompanyDays(@Req() req: Request & { user: JwtPayload }): Promise<{
    promotions: PromotionEntityWithTransformedData[];
  }> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.promotionService.getPromotions();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all banners (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of banners' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/banner')
  async getBanner(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<BannerEntity[]> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.bannerService.findAllBanners();
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all hotdeals (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of hotdeals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/hotdeals')
  async getHotdeals(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<HotdealEntity[]> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.hotdealService.findAllHotdeals();
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all flash sales (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of flash sales' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/flashsales')
  async getFlashsales(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.flashsaleService.findAllFlashSales();
  }
  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all "fix free" products (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of free products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/product-free')
  async getProductFree(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<{ pro_code: string; pro_name: string; pro_point: number }[]> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.productsService.findProductFree();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all promotional products (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of promotional products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/product-promotion')
  async getProductPromotion(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.productsService.findProductPromotion();
  }

  @ApiTags('Debtor / Reduction')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk import reduction invoice data' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2026-06-23', description: 'Required; format YYYY-MM-DD' },
          invoice: { type: 'string', example: 'INV00123', description: 'Required; not empty' },
          mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
          date_due: { type: 'string', example: '2026-07-23', description: 'Required; format YYYY-MM-DD' },
          total: { type: 'string', example: '1000.00', description: 'Required; not empty' },
          payment: { type: 'string', example: '500.00', description: 'Required; not empty' },
          balance: { type: 'string', example: '500.00', description: 'Required; not empty' },
          bill_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-06-23', description: 'Required; format YYYY-MM-DD' },
                invoice: { type: 'string', example: 'INV00123', description: 'Required; not empty' },
                price: { type: 'string', example: '500.00', description: 'Required; not empty' },
                comments: { type: 'string', example: '', description: 'Optional; empty string allowed' },
              },
              required: ['date', 'invoice', 'price'],
            },
          },
        },
        required: ['date', 'invoice', 'mem_code', 'date_due', 'total', 'payment', 'balance', 'bill_list'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Invoices imported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/reduct-invoice/add-invoice')
  async importData(
    @Body()
    data: ImportDataRequestInvoice[],
  ): Promise<{ message: string }> {
    try {
      const importedInvoices = await this.debtorService.importDataInvoice(data);
      return {
        message: `Successfully imported ${importedInvoices?.length} invoices`,
      };
    } catch (error) {
      this.logger.error('Error importing reduction invoice data22:', error);
      return { message: 'Error importing reduction invoice data' };
    }
  }

  @ApiTags('Debtor / Reduction')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk import reduction RT (return) data' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          invoice: { type: 'string', example: 'INV00123', description: 'Required; not empty' },
          date: { type: 'string', example: '2026-06-23', description: 'Required; format YYYY-MM-DD' },
          mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
          pro_amount: { type: 'string', example: '10', description: 'Required; not empty' },
          dis_price: { type: 'string', example: '50.00', description: 'Required; not empty' },
          comments: { type: 'string', example: '', description: 'Optional; empty string allowed' },
          pro_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
                pro_name: { type: 'string', example: 'ยาพาราเซตามอล', description: 'Required; not empty' },
                pro_amount: { type: 'string', example: '10', description: 'Required; not empty' },
                pro_unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
                pro_price_per_unit: { type: 'string', example: '5.00', description: 'Required; not empty' },
                pro_discount: { type: 'string', example: '0.00', description: 'Required; not empty' },
              },
              required: ['pro_code', 'pro_name', 'pro_amount', 'pro_unit', 'pro_price_per_unit', 'pro_discount'],
            },
          },
        },
        required: ['invoice', 'date', 'mem_code', 'pro_amount', 'dis_price', 'pro_list'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'RT entries imported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/reduct-invoice/add-rt')
  async importDataRT(
    @Body()
    data: ImportDataRequestRT[],
  ): Promise<{ message: string }> {
    try {
      const importedRTs = await this.debtorService.importDataRT(data);
      return {
        message: `Successfully imported ${importedRTs?.length} RT entries`,
      };
    } catch (error) {
      this.logger.error('Error importing reduction RT data:', error);
      return { message: 'Error importing reduction RT data' };
    }
  }

  @ApiTags('Debtor / Reduction')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find a reduction invoice by invoice id for current member' })
  @ApiParam({ name: 'invoice', description: 'Invoice number', example: 'INV00123' })
  @ApiResponse({ status: 200, description: 'Debtor/invoice record' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/reduct-invoice/invoice/id/:invoice')
  async findReductionInvoices(
    @Req() req: Request & { user: JwtPayload },
    @Param('invoice') invoice: string,
  ): Promise<DebtorEntity | string> {
    try {
      const mem_code = req.user.mem_code;
      const result = await this.debtorService.findDebtor(mem_code, invoice);
      return result;
    } catch (error) {
      this.logger.error('Error finding reduction invoices:', error);
      return 'Error finding reduction invoices';
    }
  }

  @ApiTags('Debtor / Reduction')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find a reduction RT (return) record by id for current member' })
  @ApiParam({ name: 'rt', description: 'RT (return) number', example: 'RT00123' })
  @ApiResponse({ status: 200, description: 'Reduction RT record' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/reduct-invoice/rt/id/:rt')
  async findReductionRTs(
    @Req() req: Request & { user: JwtPayload },
    @Param('rt') rt: string,
  ): Promise<ReductionRT | string> {
    try {
      const mem_code = req.user.mem_code;
      const result = await this.debtorService.findReductionRT(mem_code, rt);
      return result;
    } catch (error) {
      this.logger.error('Error finding reduction RTs:', error);
      return 'Error finding reduction RTs';
    }
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update search keywords for a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        keysearch: { type: 'string', example: 'พารา,แก้ปวด', description: 'Optional; empty string allowed' },
        viewers: { type: 'number', example: 0, description: 'Optional' },
      },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Keyword updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/keysearch/update-product-keysearch')
  async updateKeysearch(
    @Body() data: { pro_code: string; keysearch: string; viewers: number },
  ) {
    await this.productKeySearch.updateKeyword(data);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get keysearch info for one product' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Keysearch info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/keysearch/get-one/:pro_code')
  async keysearchProductGetOne(@Param('pro_code') pro_code: string) {
    return await this.productKeySearch.getProductOne(pro_code);
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check/refresh latest purchase date for current member' })
  @ApiResponse({ status: 200, description: 'Check result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/usercheck_latest_purchase')
  async checkLatestPurchase(@Req() req: Request & { user: JwtPayload }) {
    const mem_code = req.user.mem_code;
    const permission = req.user.permission;
    if (permission === false) {
      return this.usersService.checklatestPurchase(mem_code);
    }
    return { message: 'Check initiated' };
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all employees' })
  @ApiResponse({ status: 200, description: 'List of employees' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/user/employee/list')
  async getEmployeeList() {
    return this.employeesService.getAllEmployees();
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update an employee record' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        emp_code: { type: 'string', example: 'E00123', description: 'Required; not empty' },
        data: {
          type: 'object',
          properties: {
            emp_code: { type: 'string', example: 'E00123', description: 'Required; not empty' },
            emp_nickname: { type: 'string', example: 'นัท', description: 'Optional; empty string allowed' },
            emp_firstname: { type: 'string', example: 'สมชาย', description: 'Optional; empty string allowed' },
            emp_lastname: { type: 'string', example: 'ใจดี', description: 'Optional; empty string allowed' },
            emp_mobile: { type: 'string', example: '0812345678', description: 'Optional; empty string allowed' },
            emp_email: { type: 'string', example: 'somchai@example.com', description: 'Optional; empty string allowed' },
            emp_ID_line: { type: 'string', example: 'somchai_line', description: 'Optional; empty string allowed' },
          },
          required: ['emp_code'],
        },
      },
      required: ['emp_code', 'data'],
    },
  })
  @ApiResponse({ status: 200, description: 'Employee upserted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/user/employee/upsert-employee')
  async upsertEmployee(
    @Body()
    requestData: {
      emp_code: string;
      data: {
        emp_code: string;
        emp_nickname?: string;
        emp_firstname?: string;
        emp_lastname?: string;
        emp_mobile?: string;
        emp_email?: string;
        emp_ID_line?: string;
      };
    },
  ): Promise<{ message: string; data: EmployeeEntity } | { message: string }> {
    try {
      this.logger.log('Update employee request:', requestData);
      const upsertEmployee = await this.employeesService.UpsertEmployee(
        requestData.emp_code,
        requestData.data,
      );
      return upsertEmployee;
    } catch (error) {
      this.logger.error('Error updating employee:', error);
      return {
        message: 'Error updating employee',
      };
    }
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update daily sale amount for products' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
          amount: { type: 'number', example: 25, description: 'Required' },
        },
        required: ['pro_code', 'amount'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Sale amounts updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product/pro-sale-amount-update')
  async updateProductProSaleAmount(
    @Body() data: { pro_code: string; amount: number }[],
  ) {
    return await this.productsService.updateSaleDayly(data);
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update or clear VIP tag for a member (requires permission)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        message: { type: 'string', example: 'อนุมัติ VIP แล้ว', description: 'Required; not empty' },
        tagVIP: { type: 'string', example: 'VIP', description: 'Optional; empty string/omit clears the tag' },
      },
      required: ['mem_code', 'message'],
    },
  })
  @ApiResponse({ status: 200, description: 'VIP tag updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/user/employee/user-vip')
  async updateAndDeleteUserVIP(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { mem_code: string; message: string; tagVIP?: string },
  ): Promise<{
    mem_code: string;
    message: string;
    emp_id_ref?: string | null;
    mem_nameSite?: string;
  }> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource.');
    }
    return await this.usersService.updateAndDeleteUserVIP(
      data.mem_code,
      data.message,
      data.tagVIP,
    );
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all VIP-tagged members' })
  @ApiResponse({ status: 200, description: 'List of VIP members' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/user/employee/user-vip-list')
  async getUserVIPList(): Promise<
    {
      mem_code: string;
      mem_nameSite: string;
      emp_id_ref: string | null;
      tagVIP: string | null;
    }[]
  > {
    const vipUsers = await this.usersService.getAllUsersVIP();
    return vipUsers.map((user) => ({
      mem_code: user.mem_code,
      mem_nameSite: user.mem_nameSite,
      emp_id_ref: user.emp_id_ref || null,
      tagVIP: user.tagVIP || null,
    }));
  }

  @ApiTags('Shopping Cart')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get total item count in cart for current member' })
  @ApiResponse({ status: 200, description: 'Cart item total' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/cart/summary')
  async summaryCart(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<number> {
    const mem_code = req.user.mem_code;
    const data = await this.shoppingCartService.summaryCart(mem_code);
    return data.total;
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all recommend tags' })
  @ApiResponse({ status: 200, description: 'List of recommend tags' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/recommend/tags')
  async getRecommendTags() {
    return await this.recommendService.getAllTags();
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Insert a recommend tag' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { tag: { type: 'string', example: 'สินค้าขายดี', description: 'Required; not empty' } },
      required: ['tag'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tag inserted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/insertTag')
  async insertRecommendTag(@Body() data: { tag: string }) {
    return await this.recommendService.insertTag(data.tag);
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products under a recommend tag' })
  @ApiParam({ name: 'tag_id', description: 'Recommend tag id', example: 1 })
  @ApiResponse({ status: 200, description: 'List of products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/recommend/products/:tag_id')
  async getRecommendProductsByTag(@Param('tag_id') tag_id: number) {
    return await this.recommendService.getProductsByTag(tag_id);
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attach a recommend tag to a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tag_id: { type: 'number', example: 1, description: 'Required' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['tag_id', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tag attached to product' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/updateTagToProduct')
  async updateTagToProduct(@Body() data: { tag_id: number; pro_code: string }) {
    return await this.recommendService.UpdateTagToProduct(
      data.pro_code,
      data.tag_id,
    );
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update display rank for a recommended product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        rank: { type: 'number', example: 1, description: 'Required' },
      },
      required: ['pro_code', 'rank'],
    },
  })
  @ApiResponse({ status: 201, description: 'Rank updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/updateRank')
  async updateRecommendRank(@Body() data: { pro_code: string; rank: number }) {
    this.logger.log(data);
    return await this.recommendService.UpdateRank(data.pro_code, data.rank);
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove all recommend tags from a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tags removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/removeTagFromProduct')
  async removeTagFromProduct(@Body() data: { pro_code: string }) {
    return await this.recommendService.DeleteTagFromProduct(data.pro_code);
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete display rank for a recommended product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Rank deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/deleteRank')
  async deleteRecommendRank(@Body() data: { pro_code: string }) {
    return await this.recommendService.DeleteRank(data.pro_code);
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a recommend tag' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { tag_id: { type: 'number', example: 1, description: 'Required' } },
      required: ['tag_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tag deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/deleteTag')
  async deleteRecommendTag(@Body() data: { tag_id: number }) {
    return await this.recommendService.deleteTag(data.tag_id);
  }

  @ApiTags('Recommend')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommended products by recommend ids for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'array', items: { type: 'string', example: 'P00123' }, description: 'Optional; not used by the implementation' },
        recommend_id: { type: 'array', items: { type: 'number', example: 1 }, description: 'Required; not empty' },
        mem_code: { type: 'string', example: 'M00123', description: 'Optional; overridden by JWT mem_code if present' },
      },
      required: ['recommend_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'List of recommended products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/recommend-products')
  async getRecommendProducts(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      pro_code: string[];
      recommend_id: number[];
      mem_code: string;
    },
  ) {
    const mem_code = req.user.mem_code;
    return await this.recommendService.GetProductRecommendByCode(
      data.recommend_id,
      mem_code,
      req.user.mem_route,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set promotion status for all products under a tier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tier_id: { type: 'number', example: 1, description: 'Required' },
        status: { type: 'boolean', example: true, description: 'Required' },
      },
      required: ['tier_id', 'status'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promotion status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/set-all-product')
  async setAllProductPromotion(
    @Body() data: { tier_id: number; status: boolean },
  ) {
    return await this.promotionService.setAllProducts(
      data.tier_id,
      data.status,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check the promotion tier applicable to a product for a member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
      },
      required: ['pro_code', 'mem_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier/promotion info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/check-product-promotion')
  async checkProductPromotion(
    @Body() data: { pro_code: string; mem_code: string },
  ) {
    return await this.promotionService.getTierWithProCode(
      data.pro_code,
      data.mem_code,
    );
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all image-debug records (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of image-debug records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/image-bug/all-imagedebug')
  async getAllImagedebug(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource.');
    }
    return await this.imagedebugService.getAllImagedebug();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get promotion tier list for all products' })
  @ApiResponse({ status: 200, description: 'Tier list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/tier-list-all-product')
  async getPromotionTierList() {
    return await this.promotionService.getTierAllProduct();
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reward products for a promotion tier' })
  @ApiParam({ name: 'tier_id', description: 'Tier id', example: 1 })
  @ApiResponse({ status: 200, description: 'List of reward products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/tier-list-all-product-reward/:tier_id')
  async getPromotionTierListReward(
    @Param('tier_id') tier_id: number,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return await this.promotionService.getRewardByTierId(
      tier_id,
      req.user?.mem_code,
      req.user?.mem_route,
    );
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a banner/contract-log image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Required; image file' },
        name: { type: 'string', example: 'สมชาย ใจดี', description: 'Optional; empty string allowed' },
        type: { type: 'string', enum: ['wang', 'attestor', 'creditor', 'banner'], example: 'banner', description: 'Optional' },
        bannerName: { type: 'string', example: 'แบนเนอร์โปรโมชั่น', description: 'Optional; empty string allowed' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/create-log-banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileBanner(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    data: {
      urlPath: Express.Multer.File;
      name?: string;
      type?: 'wang' | 'attestor' | 'creditor' | 'banner';
      bannerName?: string;
    },
  ): Promise<{
    Image: number;
    personId?: number;
    type?: string;
    bannerName?: string;
    urlBanner?: string;
  }> {
    this.logger.log('data:', data.urlPath);
    const result = await this.contractLogService.uploadFile({
      urlPath: file,
      bannerName: data.bannerName,
      type: data.type,
      name: data.name,
    });
    return result;
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get contract-log banner(s) by id or all' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bannerId: {
          oneOf: [{ type: 'number' }, { type: 'string', enum: ['all'] }],
          example: 'all',
          description: 'Optional; banner id, or "all" to get every banner',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Banner(s) found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/banner')
  async getContractLogBanner(
    @Body('bannerId') bannerId: number | 'all' | undefined,
  ): Promise<ContractLogBanner | ContractLogBanner[] | null> {
    const result = await this.contractLogService.getContractLogBanner(bannerId);
    return result;
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dropdown data for contract-log forms (e.g. attestor/creditor lists)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        group: { type: 'string', example: 'attestor', description: 'Required; not empty' },
        type: { type: 'string', example: 'attestor', description: 'Required; not empty' },
      },
      required: ['group', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Dropdown data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/dropdown')
  async selectDataDropdown(
    @Body() data: { group: string; type: string },
  ): Promise<{ type: string; data: ContractLogPerson[] }> {
    this.logger.log(data);
    const result = await this.contractLogService.selectDataDropdown(
      data.group,
      data.type,
    );
    return { type: data.type, data: result.data };
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a contract-log banner record' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        selectedWang: { type: 'number', example: 1, description: 'Optional' },
        selectedAttestor: { type: 'number', example: 1, description: 'Optional' },
        selectedAttestor2: { type: 'number', example: 2, description: 'Optional' },
        selectedCreditor: { type: 'number', example: 1, description: 'Optional' },
        bannerId: { type: 'number', example: 1, description: 'Optional' },
        bannerName: { type: 'string', example: 'แบนเนอร์โปรโมชั่น', description: 'Optional; empty string allowed' },
        signingDate: { type: 'string', format: 'date-time', example: '2026-06-23T00:00:00.000Z', description: 'Optional; ISO datetime' },
        creditorCode: { type: 'string', example: 'C00123', description: 'Optional; empty string allowed' },
        startDate: { type: 'string', format: 'date-time', example: '2026-06-23T00:00:00.000Z', description: 'Optional; ISO datetime' },
        endDate: { type: 'string', format: 'date-time', example: '2026-12-31T00:00:00.000Z', description: 'Optional; ISO datetime' },
        paymentDue: { type: 'string', format: 'date-time', example: '2026-07-23T00:00:00.000Z', description: 'Optional; ISO datetime' },
        address: { type: 'string', example: '99/1 ถนนสุขุมวิท', description: 'Optional; empty string allowed' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Banner record created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/create-banner')
  async createContractLogBanner(
    @Body()
    data: {
      selectedWang?: number;
      selectedAttestor?: number;
      selectedAttestor2?: number;
      selectedCreditor?: number;
      bannerId?: number;
      bannerName?: string;
      signingDate?: Date;
      creditorCode?: string;
      startDate?: Date;
      endDate?: Date;
      paymentDue?: Date;
      address?: string;
    },
  ): Promise<ContractLogBanner> {
    this.logger.log(data);

    const result = await this.contractLogService.createContractLog(data);
    return result;
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search creditors by keyword for contract-log forms' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { keyword: { type: 'string', example: 'บริษัท วังเภสัช', description: 'Optional; empty string allowed' } },
    },
  })
  @ApiResponse({ status: 201, description: 'List of matching creditors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/search-creditor')
  async getDataCreditor(
    @Body('keyword') keyword?: string,
  ): Promise<CreditorEntity[] | []> {
    return await this.productsService.getDataCreditor(keyword);
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a contract-log creditor/banner image and info' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractId: { type: 'number', example: 1, description: 'Required' },
        name: { type: 'string', example: 'สมชาย ใจดี', description: 'Optional; empty string allowed' },
        type: { type: 'string', enum: ['creditor', 'banner'], example: 'creditor', description: 'Optional' },
        bannerName: { type: 'string', example: 'แบนเนอร์โปรโมชั่น', description: 'Optional; empty string allowed' },
        file: { type: 'string', format: 'binary', description: 'Optional; image file' },
      },
      required: ['contractId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Contract log updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/update-creditor-person')
  @UseInterceptors(FileInterceptor('file'))
  async updateContractLogBanner(
    @Body()
    data: {
      contractId: number;
      name?: string;
      type?: 'creditor' | 'banner';
      bannerName?: string;
    },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ bannerName?: string; img_banner?: number }> {
    this.logger.log('contractId:', data.contractId);
    this.logger.log('urlPath:', file);
    this.logger.log('name:', data.name);
    return await this.contractLogService.updateContractLogBanner({
      bannerId: data.contractId,
      urlPath: file,
      name: data.name,
      type: data.type,
      bannerName: data.bannerName,
    });
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a signed contract file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractId: { type: 'number', example: 1, description: 'Required' },
        name: { type: 'string', example: 'สมชาย ใจดี', description: 'Optional; empty string allowed' },
        file: { type: 'string', format: 'binary', description: 'Required; signed contract file' },
      },
      required: ['contractId', 'file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Signed contract uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/upload-signed-contract')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignedContract(
    @Body() data: { contractId: number; name?: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ urlContract: string }> {
    this.logger.log('contractId:', data.contractId);
    this.logger.log('urlPath:', file);
    return await this.contractLogService.uploadSignedContract({
      bannerId: data.contractId,
      urlPath: file,
    });
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get contract-log company-day record(s) by id or all' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        companyDayId: {
          oneOf: [{ type: 'number' }, { type: 'string', enum: ['all'] }],
          example: 'all',
          description: 'Optional; company-day record id, or "all" to get every record',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Company-day record(s)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/contract-details')
  async getContractCompanyDays(
    @Body() body: { companyDayId?: number | 'all' },
  ): Promise<ContractLogCompanyDay[] | ContractLogCompanyDay | null> {
    this.logger.log(body);
    return await this.contractLogService.getContractCompanyDays(
      body.companyDayId,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update reward redemption limit for a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        limit: { type: 'number', example: 50, description: 'Required' },
      },
      required: ['pro_code', 'limit'],
    },
  })
  @ApiResponse({ status: 201, description: 'Limit updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/limit-update')
  async updatePromotionLimit(
    @Body() data: { pro_code: string; limit: number },
  ) {
    return await this.promotionService.rewardUpdateLimit(
      data.pro_code,
      data.limit,
    );
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset reward redemption count for a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Limit count reset' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reset-limit-count')
  async resetLimitReward(@Body() data: { pro_code: string }) {
    return await this.promotionService.resetCountLimit(data.pro_code);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a replacement product for a discontinued product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
        replace_pro_code: { type: 'string', example: 'P00456', description: 'Required; not empty' },
        note: { type: 'string', example: 'สินค้าหมดสายผลิต', description: 'Optional; empty string allowed' },
        date_end: { type: 'string', format: 'date-time', example: '2026-12-31T00:00:00.000Z', description: 'Optional; ISO datetime' },
      },
      required: ['pro_code', 'replace_pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Replacement product set' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/replace/replace-product')
  async ReplaceProduct(
    @Body()
    data: {
      pro_code: string;
      replace_pro_code: string;
      note?: string;
      date_end?: Date;
    },
  ) {
    this.logger.log('data:', data);
    return await this.recommendService.AddReplaceProduct(
      data.pro_code,
      data.replace_pro_code,
      data?.note,
      data?.date_end,
    );
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a contract-log company-day record' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        selectedWang: { type: 'number', example: 1, description: 'Optional' },
        selectedAttestor: { type: 'number', example: 1, description: 'Optional' },
        selectedAttestor2: { type: 'number', example: 2, description: 'Optional' },
        selectedCreditor: { type: 'number', example: 1, description: 'Optional' },
        bannerId: { type: 'number', example: 1, description: 'Optional' },
        bannerName: { type: 'string', example: 'แบนเนอร์โปรโมชั่น', description: 'Optional; empty string allowed' },
        signingDate: { type: 'string', format: 'date-time', example: '2026-06-23T00:00:00.000Z', description: 'Optional; ISO datetime' },
        creditorCode: { type: 'string', example: 'C00123', description: 'Optional; empty string allowed' },
        startDate: { type: 'string', format: 'date-time', example: '2026-06-23T00:00:00.000Z', description: 'Optional; ISO datetime' },
        endDate: { type: 'string', format: 'date-time', example: '2026-12-31T00:00:00.000Z', description: 'Optional; ISO datetime' },
        address: { type: 'string', example: '99/1 ถนนสุขุมวิท', description: 'Optional; empty string allowed' },
        reportDueDate: { type: 'string', format: 'date-time', example: '2026-12-31T00:00:00.000Z', description: 'Optional; ISO datetime' },
        finalPaymentAmount: { type: 'number', example: 5000, description: 'Optional' },
        totalSupportValue: { type: 'number', example: 10000, description: 'Optional' },
        supportDeliveryDate: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00.000Z', description: 'Optional; ISO datetime' },
        numberOfInstallments: { type: 'number', example: 3, description: 'Optional' },
        installmentIntervalDays: { type: 'number', example: 30, description: 'Optional' },
        firstInstallmentAmount: { type: 'number', example: 3000, description: 'Optional' },
        firstPaymentCondition: { type: 'string', example: 'ชำระทันทีหลังเซ็นสัญญา', description: 'Optional; empty string allowed' },
        finalInstallmentAmount: { type: 'number', example: 2000, description: 'Optional' },
        productsToOrder: { type: 'string', example: 'P00123, P00456', description: 'Optional; empty string allowed' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Company-day record created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/create-company-day')
  async createContractCompanyDay(
    @Body()
    data: {
      selectedWang?: number;
      selectedAttestor?: number;
      selectedAttestor2?: number;
      selectedCreditor?: number;
      bannerId?: number;
      bannerName?: string;
      signingDate?: Date;
      creditorCode?: string;
      startDate?: Date;
      endDate?: Date;
      address?: string;
      reportDueDate?: Date;
      finalPaymentAmount?: number;
      totalSupportValue?: number;
      supportDeliveryDate?: Date;
      numberOfInstallments?: number;
      installmentIntervalDays?: number;
      firstInstallmentAmount?: number;
      firstPaymentCondition?: string;
      finalInstallmentAmount?: number;
      productsToOrder?: string;
    },
  ): Promise<ContractLogCompanyDay> {
    this.logger.log(data);
    return await this.contractLogService.createContractLogCompanyDay(data);
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a contract-log company-day record (creditor image)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractId: { type: 'number', example: 1, description: 'Required' },
        name: { type: 'string', example: 'สมชาย ใจดี', description: 'Optional; empty string allowed' },
        type: { type: 'string', enum: ['creditor'], example: 'creditor', description: 'Optional' },
        file: { type: 'string', format: 'binary', description: 'Optional; image file' },
      },
      required: ['contractId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Company-day record updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/update-company-day')
  @UseInterceptors(FileInterceptor('file'))
  async updateContractCompanyDay(
    @Body()
    data: {
      contractId: number;
      urlPath?: Express.Multer.File;
      name?: string;
      type?: 'creditor';
    },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{
    creditorEmpId?: number;
    name?: string;
    image?: string;
  }> {
    this.logger.log(data);
    return await this.contractLogService.updateContractLogCompanyDay({
      companyId: data.contractId,
      urlPath: file,
      name: data.name,
      type: 'creditor',
    });
  }

  @ApiTags('Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a signed company-day contract file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractId: { type: 'number', example: 1, description: 'Required' },
        file: { type: 'string', format: 'binary', description: 'Required; signed contract file' },
      },
      required: ['contractId', 'file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Signed contract uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/upload-signed-company-day')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignedCompanyDay(
    @Body() data: { contractId: number },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ urlContract: string }> {
    this.logger.log('contractId:', data.contractId);
    this.logger.log('urlPath:', file);
    return await this.contractLogService.uploadSignedContractCompanyDays({
      companyId: data.contractId,
      urlPath: file,
    });
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the replacement product info for a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Replacement product info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/replace/get-product')
  async GetProductAndReplace(@Body() data: { pro_code: string }) {
    return await this.recommendService.GetProductAndReplace(data.pro_code);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear the replacement product for a product' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Replacement product cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/replace/replace-product-null')
  async UpdateProductAndReplaceNull(@Body() data: { pro_code: string }) {
    return await this.recommendService.RemoveReplaceProduct(data.pro_code);
  }

  @ApiTags('Policy Document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find policy document categories (optionally by name)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { name: { type: 'string', example: 'นโยบายความเป็นส่วนตัว', description: 'Optional; empty string allowed' } },
    },
  })
  @ApiResponse({ status: 201, description: 'List of policy categories' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/policy/option-catagory')
  async findOptionCatagoryPolicy(@Body('name') name?: string) {
    this.logger.log('Policy category name:', name);
    return await this.policyDocService.findOptionCatagoryPolicy(name);
  }

  @ApiTags('Policy Document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save a new policy document version' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', example: '<p>เนื้อหานโยบาย</p>', description: 'Required; not empty' },
        category: { type: 'number', example: 1, description: 'Required' },
        type: { type: 'number', example: 1, description: 'Required' },
      },
      required: ['content', 'category', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Policy document saved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/policy/upload-policy')
  async savePolicyDoc(
    @Body() data: { content: string; category: number; type: number },
  ) {
    this.logger.log('Received policy document data:', data);

    if (!data) {
      throw new Error('Missing form data. Please send category and type.');
    }

    const { content, category, type } = data;
    return await this.policyDocService.savePolicyDoc(content, category, type);
  }

  @ApiTags('Policy Document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check and get the correct (latest unsigned) policy for current member' })
  @ApiResponse({ status: 200, description: 'Applicable policy document' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/policy/check-policy')
  async ensureUserHasPolicyMember(@Req() req: Request & { user: JwtPayload }) {
    const mem_code = req.user.mem_code;
    return await this.policyDocService.checkAndGetCorrectPolicy(mem_code);
  }

  @ApiTags('Policy Document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agree to a policy document for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { policyID: { type: 'number', example: 1, description: 'Required' } },
      required: ['policyID'],
    },
  })
  @ApiResponse({ status: 201, description: 'Agreement recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/policy/agree')
  async agreeToPolicyDoc(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { policyID: number },
  ): Promise<PolicyDocMember | void | { message: string }> {
    const mem_code = req.user.mem_code;
    this.logger.log('Member code agreeing to policy:', mem_code);
    this.logger.log('Policy document ID:', body);
    return await this.policyDocService.agreePolicyDoc(mem_code, body.policyID);
  }

  @ApiTags('Policy Document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all policy documents' })
  @ApiResponse({ status: 200, description: 'List of policy documents' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/policy/all-policies')
  async getAllPolicies(): Promise<
    {
      policyID: number;
      category: {
        policyCatagoryId: number;
        nameCatagory: string;
      };
      content: string;
      latestVersion: string;
    }[]
  > {
    return await this.policyDocService.getAllPolicies();
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all campaigns' })
  @ApiResponse({ status: 200, description: 'List of campaigns' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/campaigns')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a campaign' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'แคมเปญสิ้นปี 2026', description: 'Required; not empty' },
        description: { type: 'string', example: 'แคมเปญลดราคาสิ้นปี', description: 'Optional; empty string allowed' },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign id', example: '1' })
  @ApiResponse({ status: 200, description: 'Campaign deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/campaigns/:id')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tracking data for a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiResponse({ status: 200, description: 'Campaign data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/campaigns/:campaignId/data')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a data row in a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        set_number: { type: 'number', example: 1, description: 'Required' },
        condition: { type: 'string', example: 'ซื้อครบ 1000 บาท', description: 'Optional; empty string allowed' },
        target: { type: 'string', example: 'P00123', description: 'Optional; empty string allowed' },
        con_percent: { type: 'string', example: '10', description: 'Optional; empty string allowed' },
      },
      required: ['set_number'],
    },
  })
  @ApiResponse({ status: 201, description: 'Row created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a campaign data row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        target: { type: 'string', example: 'P00123', description: 'Optional; empty string allowed' },
        con_percent: { type: 'string', example: '10', description: 'Optional; empty string allowed' },
        condition: { type: 'string', example: 'ซื้อครบ 1000 บาท', description: 'Optional; empty string allowed' },
        set_number: { type: 'number', example: 1, description: 'Optional' },
        price_per_set: { type: 'string', example: '500.00', description: 'Optional; empty string allowed' },
        number_of_sets: { type: 'number', example: 2, description: 'Optional' },
        unit_price: { type: 'number', example: 250, description: 'Optional' },
        quantity: { type: 'number', example: 2, description: 'Optional' },
        discounted_price: { type: 'number', example: 450, description: 'Optional' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Row updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/campaigns/:campaignId/data/:rowId')
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
      unit_price?: number;
      quantity?: number;
      discounted_price?: number;
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a campaign data row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiResponse({ status: 200, description: 'Row deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/campaigns/:campaignId/data/:rowId')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a reward column for a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'ของแถม', description: 'Required; not empty' },
        unit: { type: 'string', example: 'ชิ้น', description: 'Optional; empty string allowed' },
        value_per_unit: { type: 'string', example: '10.00', description: 'Optional; empty string allowed' },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reward column created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/columns')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a reward column from a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'columnId', description: 'Reward column id', example: '1' })
  @ApiResponse({ status: 200, description: 'Reward column deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/campaigns/:campaignId/columns/:columnId')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all products available to add to campaigns' })
  @ApiResponse({ status: 200, description: 'List of products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/campaigns/products')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to a campaign row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product added to row' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data/:rowId/products')
  async addProductToRow(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Body() body: { pro_code: string },
  ) {
    try {
      this.logger.log('Adding product to row:', {
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a product from a campaign row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' } },
      required: ['pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product removed from row' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data/:rowId/products-delete')
  async removeProductFromRow(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Body() body: { pro_code: string },
  ) {
    try {
      this.logger.log('Removing product from row:', {
        campaignId,
        rowId,
        pro_code: body.pro_code,
      });
      await this.campaignsService.removeProductFromRow(
        campaignId,
        rowId,
        body.pro_code,
      );
      return {
        success: true,
        data: { message: 'Product removed from row successfully' },
      };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'REMOVE_PRODUCT_FROM_ROW_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a promo reward value to a campaign row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reward_column_id: { type: 'string', example: '1', description: 'Required; not empty' },
        quantity: { type: 'string', example: '2', description: 'Optional; empty string allowed' },
        unit: { type: 'string', example: 'ชิ้น', description: 'Optional; empty string allowed' },
        price: { type: 'string', example: '10.00', description: 'Optional; empty string allowed' },
        value: { type: 'string', example: '20.00', description: 'Optional; empty string allowed' },
      },
      required: ['reward_column_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Promo reward added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data/:rowId/rewards')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promo reward value in a campaign row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiParam({ name: 'rewardId', description: 'Reward id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quantity: { type: 'string', example: '2', description: 'Optional; empty string allowed' },
        unit: { type: 'string', example: 'ชิ้น', description: 'Optional; empty string allowed' },
        price: { type: 'string', example: '10.00', description: 'Optional; empty string allowed' },
        value: { type: 'string', example: '20.00', description: 'Optional; empty string allowed' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Promo reward updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/campaigns/:campaignId/data/:rowId/rewards/:rewardId')
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
      this.logger.log('Updating promo reward:', {
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promo reward from a campaign row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiParam({ name: 'rewardId', description: 'Reward id', example: '1' })
  @ApiResponse({ status: 200, description: 'Promo reward deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/campaigns/:campaignId/data/:rowId/rewards/:rewardId')
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

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a reward column image/product link' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reward_id: { type: 'string', example: '1', description: 'Required; not empty' },
        url: { type: 'string', example: 'https://example.com/image.png', description: 'Required; not empty' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['reward_id', 'url', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reward column updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/update-collumn-reward')
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
        data: { message: 'Reward column updated successfully' },
      };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'DELETE_PROMO_REWARD_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload an image for a campaign reward' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Required; image file' },
        reward_id: { type: 'string', example: '1', description: 'Required; not empty' },
      },
      required: ['file', 'reward_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/upload-reward-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRewardImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { reward_id: string },
  ) {
    try {
      const url = await this.campaignsService.uploadRewardImage(
        file,
        body.reward_id,
      );
      return { success: true, data: { url } };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'UPLOAD_REWARD_IMAGE_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a generic campaign image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Required; image file' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCampaignImage(@UploadedFile() file: Express.Multer.File) {
    try {
      const url = await this.campaignsService.uploadImage(file);
      return { success: true, data: { url } };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'UPLOAD_IMAGE_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase products listed in a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiResponse({ status: 200, description: 'List of purchase products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/campaigns/:campaignId/purchase-products')
  async getPurchaseProducts(@Param('campaignId') campaignId: string) {
    try {
      const items = await this.campaignsService.getPurchaseProducts(campaignId);
      return { success: true, data: items };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'GET_PURCHASE_PRODUCTS_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a purchase product entry for a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { name: { type: 'string', example: 'แชมพูสมุนไพร', description: 'Required; not empty' } },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Purchase product created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/purchase-products')
  async createPurchaseProduct(
    @Param('campaignId') campaignId: string,
    @Body() body: { name: string },
  ) {
    try {
      const item = await this.campaignsService.createPurchaseProduct(
        campaignId,
        body.name,
      );
      return { success: true, data: item };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'CREATE_PURCHASE_PRODUCT_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a purchase product entry' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'productId', description: 'Purchase product id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'แชมพูสมุนไพร', description: 'Optional; empty string allowed' },
        img_url: { type: 'string', example: 'https://example.com/image.png', description: 'Optional; empty string allowed' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Purchase product updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('/campaigns/:campaignId/purchase-products/:productId')
  async updatePurchaseProduct(
    @Param('campaignId') campaignId: string,
    @Param('productId') productId: string,
    @Body() body: { name?: string; img_url?: string },
  ) {
    try {
      await this.campaignsService.updatePurchaseProduct(
        campaignId,
        productId,
        body,
      );
      return { success: true };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'UPDATE_PURCHASE_PRODUCT_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a purchase product entry' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'productId', description: 'Purchase product id', example: '1' })
  @ApiResponse({ status: 200, description: 'Purchase product deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/campaigns/:campaignId/purchase-products/:productId')
  async deletePurchaseProduct(
    @Param('campaignId') campaignId: string,
    @Param('productId') productId: string,
  ) {
    try {
      await this.campaignsService.deletePurchaseProduct(campaignId, productId);
      return { success: true };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'DELETE_PURCHASE_PRODUCT_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload an image for a purchase product' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'productId', description: 'Purchase product id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Required; image file' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/purchase-products/:productId/upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPurchaseProductImage(
    @Param('campaignId') campaignId: string,
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      const url = await this.campaignsService.uploadPurchaseProductImage(
        campaignId,
        productId,
        file,
      );
      return { success: true, data: { url } };
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'UPLOAD_PURCHASE_PRODUCT_IMAGE_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiOperation({ summary: 'Generate a campaign poster image via AI' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', example: 'โปสเตอร์โปรโมชั่นสินค้าฤดูร้อน', description: 'Required; not empty' },
        aspectRatio: { type: 'string', example: '1:1', description: 'Required; not empty' },
        imageItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', example: 'https://example.com/image.png', description: 'Required; not empty' },
              name: { type: 'string', example: 'แชมพูสมุนไพร', description: 'Required; not empty' },
              quantity: { type: 'number', example: 1, description: 'Required' },
              unit: { type: 'string', example: 'ชิ้น', description: 'Optional; empty string allowed' },
            },
            required: ['url', 'name', 'quantity'],
          },
        },
        session_cookies: { type: 'string', example: '', description: 'Optional; empty string allowed' },
      },
      required: ['prompt', 'aspectRatio'],
    },
  })
  @ApiResponse({ status: 201, description: 'Poster generation request id' })
  // @UseGuards(JwtAuthGuard)
  @Post('/campaigns/generate-poster')
  async generatePoster(
    @Body()
    body: {
      prompt: string;
      aspectRatio: string;
      imageItems: {
        url: string;
        name: string;
        quantity: number;
        unit: string;
      }[];
      session_cookies: string;
    },
  ) {
    return await this.campaignsService.generatePoster(
      body.prompt,
      body.aspectRatio,
      body.imageItems ?? [],
      body.session_cookies,
    );
  }

  @ApiTags('Campaigns')
  @ApiOperation({ summary: 'Poll for AI poster generation result by request id' })
  @ApiParam({ name: 'requestId', description: 'Poster generation request id', example: 'req_00123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { session_cookies: { type: 'string', example: '', description: 'Optional; empty string allowed' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Generation result' })
  @Post('/campaigns/get-response-id/:requestId')
  async getResponseId(
    @Param('requestId') requestId: string,
    @Body() body: { session_cookies?: string },
  ) {
    return await this.campaignsService.getAllResults(
      requestId,
      body.session_cookies,
    );
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reward columns for a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiResponse({ status: 200, description: 'List of reward columns' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/campaigns/:campaignId/columns')
  async getRewardColumns(@Param('campaignId') campaignId: string) {
    const columns = await this.campaignsService.getRewardColumns(campaignId);
    return { success: true, data: columns };
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update value-per-unit for a reward column' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'columnId', description: 'Reward column id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { value_per_unit: { type: 'number', example: 10, description: 'Required' } },
      required: ['value_per_unit'],
    },
  })
  @ApiResponse({ status: 200, description: 'Value per unit updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('/campaigns/:campaignId/columns/:columnId')
  async updateRewardColumnValuePerUnit(
    @Param('campaignId') campaignId: string,
    @Param('columnId') columnId: string,
    @Body() body: { value_per_unit: number },
  ) {
    await this.campaignsService.updateRewardColumnValuePerUnit(
      campaignId,
      columnId,
      body.value_per_unit,
    );
    return { success: true };
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save a generated poster image to a campaign row history' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { img_url: { type: 'string', example: 'https://example.com/poster.png', description: 'Required; not empty' } },
      required: ['img_url'],
    },
  })
  @ApiResponse({ status: 201, description: 'Poster history saved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data/:rowId/poster-history')
  async savePosterHistory(
    @Param('rowId') rowId: string,
    @Body() body: { img_url: string },
  ) {
    try {
      const result = await this.campaignsService.savePosterHistory(
        rowId,
        body.img_url,
      );
      return { success: true, data: result };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'SAVE_POSTER_HISTORY_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a banner from a poster history image and link it' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiParam({ name: 'historyId', description: 'Poster history id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        img_url: { type: 'string', example: 'https://example.com/poster.png', description: 'Required; not empty' },
        banner_name: { type: 'string', example: 'โปสเตอร์โปรโมชั่นฤดูร้อน', description: 'Optional; empty string allowed' },
        banner_location: {
          type: 'string',
          enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
          example: 'store_carousel',
          description: 'Required; not empty',
        },
        date_start: { type: 'string', format: 'date-time', example: '2026-06-23T00:00:00.000Z', description: 'Required; ISO datetime' },
        date_end: { type: 'string', format: 'date-time', example: '2026-07-23T00:00:00.000Z', description: 'Required; ISO datetime' },
      },
      required: ['img_url', 'banner_location', 'date_start', 'date_end'],
    },
  })
  @ApiResponse({ status: 201, description: 'Banner created and linked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post(
    '/campaigns/:campaignId/data/:rowId/poster-history/:historyId/banner-links',
  )
  async addBannerLink(
    @Param('historyId') historyId: string,
    @Body()
    body: {
      img_url: string;
      banner_name?: string;
      banner_location: 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar';
      date_start: Date;
      date_end: Date;
    },
  ) {
    const banner = await this.bannerService.createBannerFromUrl(body.img_url, {
      date_start: body.date_start,
      date_end: body.date_end,
      banner_name: body.banner_name,
      banner_location: body.banner_location,
    });
    try {
      const link = await this.campaignsService.addBannerLink(
        historyId,
        banner.banner_id,
        body.banner_location,
      );
      return { success: true, data: link };
    } catch {
      // rollback: ลบ banner ที่สร้างไปแล้วถ้า link สร้างไม่สำเร็จ
      await this.bannerService.deleteBannerById(banner.banner_id);
      throw new HttpException(
        { success: false, error: { code: 'ADD_BANNER_LINK_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a banner link from poster history (keeps the banner image file)' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiParam({ name: 'historyId', description: 'Poster history id', example: '1' })
  @ApiParam({ name: 'linkId', description: 'Banner link id', example: '1' })
  @ApiResponse({ status: 200, description: 'Banner link removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete(
    '/campaigns/:campaignId/data/:rowId/poster-history/:historyId/banner-links/:linkId',
  )
  async removeBannerLink(@Param('linkId') linkId: string) {
    try {
      const bannerId = await this.campaignsService.removeBannerLink(linkId);
      // ลบแค่ record ใน DB — ไม่ลบไฟล์ใน DO Spaces เพราะ URL เดียวกับ poster history
      await this.bannerService.deleteBannerRecordOnly(bannerId);
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: { code: 'REMOVE_BANNER_LINK_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get poster history for a campaign row' })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiResponse({ status: 200, description: 'List of poster history items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/campaigns/:campaignId/data/:rowId/poster-history')
  async getPosterHistory(@Param('rowId') rowId: string) {
    try {
      const items = await this.campaignsService.getPosterHistory(rowId);
      return { success: true, data: items };
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'GET_POSTER_HISTORY_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Campaigns')
  @ApiOperation({ summary: 'Proxy-download an ideogram.ai generated image (avoids CORS)' })
  @ApiQuery({ name: 'url', description: 'Must start with https://ideogram.ai/', example: 'https://ideogram.ai/api/images/example.png' })
  @ApiResponse({ status: 200, description: 'Image binary stream' })
  @Get('/campaigns/proxy-image')
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    if (!url || !url.startsWith('https://ideogram.ai/')) {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
    });
    const ext = url.includes('.png') ? 'png' : 'jpg';
    res.setHeader(
      'Content-Type',
      (response.headers['content-type'] as string) ?? 'image/jpeg',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="poster.${ext}"`,
    );
    res.send(Buffer.from(response.data));
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search banner-eligible products (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/products-banner')
  async searchProductsBanner(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.productsService.searchProductsBanner();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all creditors (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of creditors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/get-creditor')
  async getCreditors(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.productsService.getCreditors();
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get delivery tracking location for an order' })
  @ApiParam({ name: 'sh_running', description: 'Shopping head running number', example: 'SO00123' })
  @ApiResponse({ status: 200, description: 'Order tracking location' })
  @Get('/ecom/track-order/:sh_running')
  async trackOrder(@Param('sh_running') sh_running: string) {
    try {
      return this.trackOrderService.getOrderLocation(sh_running);
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'TRACK_ORDER_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ========== Product Return APIs ==========

  // Customer: Get eligible orders for return
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get orders eligible for return for a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'List of eligible orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/returns/eligible-orders/:mem_code')
  async getEligibleOrders(@Param('mem_code') mem_code: string) {
    try {
      return await this.productReturnService.getEligibleOrders(mem_code);
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Get order items for return selection
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order items available for return selection' })
  @ApiParam({ name: 'soh_running', description: 'Shopping order head running number', example: 'SO00123' })
  @ApiResponse({ status: 200, description: 'List of order items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/returns/order-items/:soh_running')
  async getOrderItemsForReturn(
    @Param('soh_running') soh_running: string,
    @Req() req: { user: JwtPayload },
  ) {
    try {
      return await this.productReturnService.getOrderItems(
        soh_running,
        req.user.mem_code,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Create return request
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product return request (customer-initiated)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        soh_id: { type: 'number', example: 12345, description: 'Required' },
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        reason: {
          type: 'string',
          enum: ['damaged', 'expired', 'wrong_item', 'disaster', 'other'],
          example: 'damaged',
          description: 'Required; not empty',
        },
        reason_detail: { type: 'string', example: 'สินค้าชำรุดตอนเปิดกล่อง', description: 'Optional; empty string allowed' },
        resolution_type: {
          type: 'string',
          enum: ['refund', 'replacement'],
          example: 'refund',
          description: 'Required; not empty',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
              qty: { type: 'number', example: 2, description: 'Required' },
              unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
              price_per_unit: { type: 'number', example: 150, description: 'Required' },
              item_reason: { type: 'string', example: 'สินค้าชำรุด', description: 'Optional; empty string allowed' },
              expiry_date: { type: 'string', example: '2026-12-31', description: 'Optional; format YYYY-MM-DD' },
            },
            required: ['pro_code', 'qty', 'unit', 'price_per_unit'],
          },
        },
        notes: { type: 'string', example: '', description: 'Optional; empty string allowed' },
      },
      required: ['soh_id', 'mem_code', 'reason', 'resolution_type', 'items'],
    },
  })
  @ApiResponse({ status: 201, description: 'Return request created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/returns/create')
  async createReturn(
    @Body()
    data: {
      soh_id: number;
      mem_code: string;
      reason: ReturnReason;
      reason_detail?: string;
      resolution_type: ResolutionType;
      items: {
        pro_code: string;
        qty: number;
        unit: string;
        price_per_unit: number;
        item_reason?: string;
        expiry_date?: string;
      }[];
      notes?: string;
    },
  ) {
    try {
      return await this.productReturnService.createReturn({
        ...data,
        initiator_type: InitiatorType.CUSTOMER,
      });
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Upload evidence images
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload evidence images for a return request (up to 5 files)' })
  @ApiParam({ name: 'return_id', description: 'Return request id', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Optional; up to 5 image files' },
        description: { type: 'string', example: '', description: 'Optional; empty string allowed' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Images uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/returns/:return_id/images')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 5 }]))
  async uploadReturnImages(
    @Param('return_id') return_id: string,
    @UploadedFile() files: Express.Multer.File[],
    @Body('description') description?: string,
  ) {
    try {
      return await this.productReturnService.uploadImages(
        parseInt(return_id),
        files || [],
        description,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Submit return request
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a draft return request for review' })
  @ApiParam({ name: 'return_id', description: 'Return request id', example: '1' })
  @ApiResponse({ status: 201, description: 'Return request submitted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/returns/:return_id/submit')
  async submitReturn(
    @Param('return_id') return_id: string,
    @Req() req: { user: JwtPayload },
  ) {
    try {
      return await this.productReturnService.submitReturn(
        parseInt(return_id),
        req.user.mem_code,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Get my returns
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get return requests for a member' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiQuery({ name: 'status', required: false, type: String, example: 'pending' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'offset', required: false, type: String, example: '0' })
  @ApiResponse({ status: 200, description: 'List of return requests' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/returns/my-returns/:mem_code')
  async getMyReturns(
    @Param('mem_code') mem_code: string,
    @Query('status') status?: ReturnStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      return await this.productReturnService.getMyReturns(mem_code, {
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Get return detail
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detail of a return request' })
  @ApiParam({ name: 'return_id', description: 'Return request id', example: '1' })
  @ApiResponse({ status: 200, description: 'Return request detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/returns/:return_id')
  async getReturnDetail(@Param('return_id') return_id: string) {
    try {
      return await this.productReturnService.getReturnDetail(
        parseInt(return_id),
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Customer: Delete draft return
  @ApiTags('Product Returns')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a draft (unsubmitted) return request' })
  @ApiParam({ name: 'return_id', description: 'Return request id', example: '1' })
  @ApiResponse({ status: 200, description: 'Draft return deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/returns/:return_id')
  async deleteDraftReturn(
    @Param('return_id') return_id: string,
    @Req() req: { user: JwtPayload },
  ) {
    try {
      return await this.productReturnService.deleteDraftReturn(
        parseInt(return_id),
        req.user.mem_code,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ========== Behavior Tracking APIs ==========
  // Track single event
  // @Post('/ecom/tracking/event')
  // async trackEvent(
  //   @Body() data: TrackEventDto,
  //   @Ip() ip: string,
  //   @Req() req: Request & { user: JwtPayload },
  // ) {
  //   try {
  //     data.ip_address = ip;
  //     data.user_agent = req.headers['user-agent'];
  //     return await this.behaviorTrackingService.trackEvent(data);
  //   } catch (error: unknown) {
  //     throw new HttpException(
  //       {
  //         success: false,
  //         message:
  //           error instanceof Error
  //             ? error.message
  //             : 'An unknown error occurred',
  //       },
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }

  // // Track batch events
  // @Post('/ecom/tracking/batch')
  // async trackBatch(
  //   @Body() data: BatchTrackDto,
  //   @Ip() ip: string,
  //   @Req() req: Request & { user: JwtPayload },
  // ) {
  //   try {
  //     // Add IP and user agent to all events
  //     const userAgent = req.headers['user-agent'];
  //     data.events = data.events.map((e) => ({
  //       ...e,
  //       ip_address: ip,
  //       user_agent: userAgent,
  //     }));
  //     return await this.behaviorTrackingService.trackBatch(data);
  //   } catch (error: unknown) {
  //     throw new HttpException(
  //       {
  //         success: false,
  //         message:
  //           error instanceof Error
  //             ? error.message
  //             : 'An unknown error occurred',
  //       },
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }

  // Get user behavior (for personalization)
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tracked behavior events for a member (for personalization)' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiResponse({ status: 200, description: 'User behavior data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/tracking/user/:mem_code')
  async getUserBehavior(
    @Param('mem_code') mem_code: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    try {
      return await this.behaviorTrackingService.getUserBehavior(
        mem_code,
        from_date,
        to_date,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get product analytics
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product view/interaction analytics (requires permission)' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiResponse({ status: 200, description: 'Product analytics data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/product/:pro_code')
  async getProductAnalytics(
    @Req() req: Request & { user: JwtPayload },
    @Param('pro_code') pro_code: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getProductAnalytics(
        pro_code,
        from_date,
        to_date,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get search analytics
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get search behavior analytics (requires permission)' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiResponse({ status: 200, description: 'Search analytics data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/searches')
  async getSearchAnalytics(
    @Req() req: Request & { user: JwtPayload },
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getSearchAnalytics(
        from_date,
        to_date,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get dashboard stats
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get behavior tracking dashboard stats (requires permission)' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/dashboard')
  async getTrackingDashboard(
    @Req() req: Request & { user: JwtPayload },
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getDashboardStats(
        from_date,
        to_date,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get daily trend
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get daily behavior trend (requires permission)' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiResponse({ status: 200, description: 'Daily trend data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/daily-trend')
  async getDailyTrend(
    @Req() req: Request & { user: JwtPayload },
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getDailyTrend(
        from_date,
        to_date,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get top products
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get top viewed/purchased products (requires permission)' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '10' })
  @ApiResponse({ status: 200, description: 'List of top products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/top-products')
  async getTopProducts(
    @Req() req: Request & { user: JwtPayload },
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('limit') limit?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getTopProducts(
        from_date,
        to_date,
        limit ? parseInt(limit) : 10,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get recent activity feed
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent customer activity feed (requires permission)' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '50' })
  @ApiResponse({ status: 200, description: 'Recent activity feed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/recent-activity')
  async getRecentActivity(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getRecentActivity(
        limit ? parseInt(limit) : 50,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get user journeys
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user navigation journeys (requires permission)' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiResponse({ status: 200, description: 'List of user journeys' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/user-journeys')
  async getUserJourneys(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getUserJourneys(
        limit ? parseInt(limit) : 20,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get zero result searches
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get search queries that returned zero results (requires permission)' })
  @ApiQuery({ name: 'from_date', required: false, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: false, type: String, example: '2026-06-23' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '30' })
  @ApiResponse({ status: 200, description: 'List of zero-result searches' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/zero-result-searches')
  async getZeroResultSearches(
    @Req() req: Request & { user: JwtPayload },
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('limit') limit?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getZeroResultSearches(
        from_date,
        to_date,
        limit ? parseInt(limit) : 30,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get stock alerts based on demand
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get demand-based stock alerts (requires permission)' })
  @ApiQuery({ name: 'days', required: false, type: String, example: '7' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiResponse({ status: 200, description: 'List of stock alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/stock-alerts')
  async getStockAlerts(
    @Req() req: Request & { user: JwtPayload },
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getStockAlerts(
        days ? parseInt(days) : 7,
        limit ? parseInt(limit) : 20,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get cart conversion analytics
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get cart-to-purchase conversion analytics (requires permission)' })
  @ApiQuery({ name: 'days', required: false, type: String, example: '30' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiResponse({ status: 200, description: 'Cart conversion analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/cart-analytics')
  async getCartConversionAnalytics(
    @Req() req: Request & { user: JwtPayload },
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getCartConversionAnalytics(
        days ? parseInt(days) : 30,
        limit ? parseInt(limit) : 20,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get customer segments
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer segmentation analysis (requires permission)' })
  @ApiQuery({ name: 'days', required: false, type: String, example: '90' })
  @ApiResponse({ status: 200, description: 'Customer segments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/customer-segments')
  async getCustomerSegments(
    @Req() req: Request & { user: JwtPayload },
    @Query('days') days?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getCustomerSegments(
        days ? parseInt(days) : 90,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get retention analysis
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer retention analysis (requires permission)' })
  @ApiQuery({ name: 'weeks', required: false, type: String, example: '8' })
  @ApiResponse({ status: 200, description: 'Retention analysis' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/retention')
  async getRetentionAnalysis(
    @Req() req: Request & { user: JwtPayload },
    @Query('weeks') weeks?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getRetentionAnalysis(
        weeks ? parseInt(weeks) : 8,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get repeat purchase patterns
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get repeat purchase patterns (requires permission)' })
  @ApiQuery({ name: 'days', required: false, type: String, example: '180' })
  @ApiResponse({ status: 200, description: 'Repeat purchase patterns' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/repeat-purchases')
  async getRepeatPurchasePatterns(
    @Req() req: Request & { user: JwtPayload },
    @Query('days') days?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getRepeatPurchasePatterns(
        days ? parseInt(days) : 180,
      );
    } catch (error: unknown) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get purchase interval box plot data
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase interval box-plot data (requires permission)' })
  @ApiQuery({ name: 'days', required: false, type: String, example: '180' })
  @ApiQuery({ name: 'group_by', required: false, type: String, example: 'overall', description: 'one of: overall, product, segment, month' })
  @ApiResponse({ status: 200, description: 'Box-plot data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/purchase-intervals-boxplot')
  async getPurchaseIntervalBoxPlot(
    @Req() req: Request & { user: JwtPayload },
    @Query('days') days?: string,
    @Query('group_by') groupBy?: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    try {
      return await this.behaviorTrackingService.getPurchaseIntervalBoxPlot(
        days ? parseInt(days) : 180,
        (groupBy as 'overall' | 'product' | 'segment' | 'month') || 'overall',
      );
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Admin: Get user journey sankey
  @ApiTags('Behavior Tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user journey sankey diagram data (requires permission)' })
  @ApiQuery({ name: 'from_date', required: true, type: String, example: '2026-06-01' })
  @ApiQuery({ name: 'to_date', required: true, type: String, example: '2026-06-23' })
  @ApiResponse({ status: 200, description: 'Sankey diagram data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/tracking/user-journey-sankey')
  async getUserJourneySankey(
    @Req() req: Request & { user: JwtPayload },
    @Query('from_date') from_date: string,
    @Query('to_date') to_date: string,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.behaviorTrackingService.getUserJourneySankey(
      from_date,
      to_date,
    );
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change a member\'s role/permission (Admin only)' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newRole: { type: 'string', enum: ['User', 'Admin', 'Sales'], example: 'Sales', description: 'Required; not empty' },
        permission: { type: 'boolean', example: true, description: 'Optional; defaults to false' },
      },
      required: ['newRole'],
    },
  })
  @ApiResponse({ status: 200, description: 'Role changed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/change-role/:mem_code')
  async changeUserRole(
    @Req() req: Request & { user: JwtPayload },
    @Param('mem_code') mem_code: string,
    @Body('newRole') newRole: 'User' | 'Admin' | 'Sales',
    @Body('permission') permission?: boolean,
  ) {
    // Granting roles (incl. Admin) is a privilege-escalation-capable action —
    // require the actor to actually BE an Admin, not merely have back-office
    // `permission` (a Sales account can carry that flag too).
    if (req.user.role !== 'Admin') {
      throw new Error('You do not have permission to access this resource');
    }
    this.logger.log('Changing user role for mem_code:', mem_code);
    return await this.usersService.changeUserRole(
      mem_code,
      newRole,
      permission,
      {
        mem_code: req.user.mem_code,
        username: req.user.username,
      },
    );
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all staff users (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of staff users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/user/staff-list')
  async getStaffUsers(@Req() req: Request & { user: JwtPayload }) {
    // ECWC-309: viewing/managing staff role assignments is Admin-only — `permission`
    // alone is not enough (Sales accounts can also carry permission=true).
    if (req.user.role !== 'Admin') {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.usersService.getStaffUsers();
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Look up a member for role management (Admin only)' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'Member info for role management' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/user/lookup/:mem_code')
  async lookupUserForRoleManage(
    @Req() req: Request & { user: JwtPayload },
    @Param('mem_code') mem_code: string,
  ) {
    if (req.user.role !== 'Admin') {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.usersService.findUserForRoleManageByMemCode(mem_code);
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search members for role management (Admin only)' })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'สมชาย' })
  @ApiResponse({ status: 200, description: 'List of matching members' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/user/search')
  async searchUsersForRoleManage(
    @Req() req: Request & { user: JwtPayload },
    @Query('q') query?: string,
  ) {
    if (req.user.role !== 'Admin') {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.usersService.searchUsersForRoleManage(query ?? '');
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update enabled feature flags for a member (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mem_code: { type: 'string', example: 'M00123', description: 'Required; not empty' },
        features: {
          type: 'array',
          items: { type: 'string', example: 'happy_hour' },
          description: 'Required; list of feature flag keys',
        },
      },
      required: ['mem_code', 'features'],
    },
  })
  @ApiResponse({ status: 200, description: 'Features updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/admin/user/update-features')
  async updateUserFeatures(
    @Req() req: Request & { user: JwtPayload },
    @Body('mem_code') mem_code: string,
    @Body('features') features: string[],
  ) {
    if (req.user.role !== 'Admin') {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.usersService.updateUserFeatures(
      mem_code,
      features ?? [],
      {
        mem_code: req.user.mem_code,
        username: req.user.username,
      },
    );
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated admin role-change action logs (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated admin action logs' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/user/role-logs')
  async getAdminActionLogs(
    @Req() req: Request & { user: JwtPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (req.user.role !== 'Admin') {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.usersService.getAdminActionLogs(page, limit);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get RT (return) order notifications from the last 3 days' })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiResponse({ status: 200, description: 'List of RT notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/get-notification-rt/:mem_code')
  async getRTNotifications(@Param('mem_code') mem_code: string) {
    return await this.notifyRtService.getRTOrdersInTheLast3Days(mem_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Update RT (return) notification read status' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        soh_running: { type: 'string', example: 'SO00123', description: 'Required; not empty' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['soh_running', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'RT notification status updated' })
  @Post('/ecom/update-notification-rt')
  async updateRTNotification(
    @Body() data: { soh_running: string; pro_code: string },
  ) {
    this.logger.log('Updating RT notification with data:', data);
    return await this.notifyRtService.updateRTStatus(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a push notification token for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string', example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', description: 'Required; not empty' } },
      required: ['token'],
    },
  })
  @ApiResponse({ status: 201, description: 'Token registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/qc/add-token-for-notification')
  async addTokenForNotification(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { token: string },
  ) {
    const mem_code = req.user.mem_code;
    return await this.notifyRtService.addTokenForNotification({
      mem_code,
      token: body.token,
    });
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a push notification token for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string', example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', description: 'Required; not empty' } },
      required: ['token'],
    },
  })
  @ApiResponse({ status: 201, description: 'Token removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/qc/remove-token-for-notification')
  async removeTokenForNotification(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { token: string },
  ) {
    const mem_code = req.user.mem_code;
    return await this.notifyRtService.removeTokenForNotification({
      mem_code,
      token: body.token,
    });
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a banner image for a hotdeal' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1, description: 'Required' },
        file: { type: 'string', format: 'binary', description: 'Required; image file' },
      },
      required: ['id', 'file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Banner uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/hotdeal/upload-banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadHotdealBanner(
    @Body() body: { id: number },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.hotdealService.uploadBannerHotdeal(file, body.id);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all hotdeals with their banners' })
  @ApiResponse({ status: 200, description: 'List of hotdeals with banners' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/admin/hotdeal/get-banner')
  async getHotdealBanner() {
    return await this.hotdealService.getAllHotdealsWithBanners();
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a hotdeal banner' })
  @ApiParam({ name: 'id', description: 'Hotdeal banner id', example: '1' })
  @ApiResponse({ status: 200, description: 'Banner deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/admin/hotdeal/delete-banner/:id')
  async deleteHotdealBanner(@Param('id') id: number) {
    return await this.hotdealService.deleteBannerHotdeal(id);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated list of products with a replacement set' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated replacement products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/replace-product')
  async getReplacementProduct(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.recommendService.getAllReplaceProducts(page, limit);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload/update the poster image for a promotion tier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tier_id: { type: 'string', example: '1', description: 'Required; not empty' },
        file: { type: 'string', format: 'binary', description: 'Required; image file' },
      },
      required: ['tier_id', 'file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier poster updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('ecom/promotion/update-tier-poster')
  @UseInterceptors(FileInterceptor('file'))
  async updateTierPoster(
    @Body('tier_id') tier_id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.promotionService.updateTierPoster(Number(tier_id), file);
  }

  @ApiTags('Promotion & Tier')
  @ApiOperation({ summary: 'Check/recalculate tier-turn-back reward price for an order item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sh_running: { type: 'string', example: 'SO00123', description: 'Required; not empty' },
        pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
      },
      required: ['sh_running', 'pro_code'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tier price result' })
  @Post('/ecom/get-tier-price')
  async getTierPrice(@Body() body: { sh_running: string; pro_code: string }) {
    return await this.shoppingOrderService.checkOrderTurnBackReward(
      body.sh_running,
      body.pro_code,
    );
  }

  @ApiTags('Happy Hour')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check and adjust happy-hour reward for an order (requires permission)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { sh_running: { type: 'string', example: 'SO00123', description: 'Required; not empty' } },
      required: ['sh_running'],
    },
  })
  @ApiResponse({ status: 201, description: 'Happy-hour reward adjusted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/check-happy-hour-reward')
  async checkHappyHourReward(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { sh_running: string },
  ) {
    if (req.user.permission !== true) {
      throw new ForbiddenException('You not have Permission to Access');
    }
    return await this.shoppingOrderService.checkAndAdjustHappyHourReward(
      body.sh_running,
    );
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get hotdeal detail by product code for current member' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Hotdeal detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/hotdeal/:pro_code')
  async getHotdealByProCode(
    @Param('pro_code') pro_code: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const mem_code = req.user.mem_code;
    return await this.hotdealService.getHotdealFromproCode(pro_code, mem_code);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add hotdeal freebie products to cart for current member' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        freebies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pro_code: { type: 'string', example: 'P00123', description: 'Required; not empty' },
              unit: { type: 'string', example: 'กล่อง', description: 'Required; not empty' },
              amount: { type: 'number', example: 1, description: 'Required' },
              pro_code1: { type: 'string', example: 'P00100', description: 'Required; not empty; the qualifying product code' },
            },
            required: ['pro_code', 'unit', 'amount', 'pro_code1'],
          },
        },
      },
      required: ['freebies'],
    },
  })
  @ApiResponse({ status: 201, description: 'Freebies added to cart' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/hotdeal/add-other-product')
  async createHotdeal(
    @Body()
    body: {
      freebies: {
        pro_code: string;
        unit: string;
        amount: number;
        pro_code1: string;
      }[];
    },
    @Req() req: Request & { user: JwtPayload },
  ) {
    const mem_code = req.user.mem_code;
    this.logger.log('Creating hotdeal with data:', {
      mem_code,
      freebies: body.freebies,
    });
    const results = await this.shoppingCartService.addHotdealToCart(
      mem_code,
      body.freebies,
    );
    return results;
  }

  @ApiTags('Products')
  @ApiOperation({ summary: 'Get product image by product code' })
  @ApiParam({ name: 'pro_code', description: 'Product code', example: 'P00123' })
  @ApiResponse({ status: 200, description: 'Product image data' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Get('/ecom/get-product-image/:pro_code')
  async getProductImage(@Param('pro_code') pro_code: string) {
    this.logger.log('Fetching product image for pro_code:', pro_code);
    try {
      const product =
        await this.productsService.getProductImageByCode(pro_code);
      if (!product) {
        throw new HttpException(
          {
            success: false,
            error: { code: 'PRODUCT_NOT_FOUND' },
          },
          HttpStatus.NOT_FOUND,
        );
      }
      return product;
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'GET_PRODUCT_IMAGE_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger the company-day promotion cart re-check' })
  @ApiResponse({ status: 200, description: 'Check triggered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/trigger/check-promotion-company-day')
  async triggerCheckPromotionCompanyDay() {
    await this.shoppingCartService.callCheckCartPromotion();
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Autocomplete product search against the external product source' })
  @ApiQuery({ name: 'search', description: 'Search keyword', example: 'แชมพู' })
  @ApiResponse({ status: 200, description: 'List of matching products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-search-autocomplete')
  async productSearchAutoComplete(@Query('search') search: string) {
    try {
      return await this.productsService.searchExternalProducts(search);
    } catch {
      throw new HttpException(
        { success: false, error: { code: 'PRODUCT_SEARCH_FAILED' } },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search Lotus gift card products (requires permission)' })
  @ApiResponse({ status: 200, description: 'List of Lotus card products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/products/lotus-cards')
  async searchLotusCards(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.searchLotusCards();
    } else {
      throw new ForbiddenException('You not have Permission to Accesss');
    }
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search products by name for admin (requires permission)' })
  @ApiQuery({ name: 'keyword', required: false, type: String, example: 'แชมพู' })
  @ApiResponse({ status: 200, description: 'List of matching products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtAuthGuard)
  @Get('ecom/admin/products/search')
  async productSearchProductName(
    @Query('keyword') keyword: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.productSearchProductName(keyword ?? '');
    } else {
      throw new ForbiddenException('You not have Permission to Accesss');
    }
  }
}
