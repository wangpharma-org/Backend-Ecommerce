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
import { HotdealService } from './hotdeal/hotdeal.service';
import { PromotionService } from './promotion/promotion.service';
import type { PromotionEntityWithTransformedData } from './promotion/promotion.service';
import {
  UpdateUserDataDto,
  UpdateBannerDto,
  UploadBannerDto,
  CreateBannerFromUrlDto,
  UploadImageUserDto,
  UpdateFlagDto,
  UploadPoItemDto,
  UploadProductFlashSaleItemDto,
  UploadProductL16Dto,
  GetFlashSaleDto,
  AddToFavoriteDto,
  DeleteFavoriteDto,
  SigninDto,
  SearchProductsDto,
  SearchCategoryProductsDto,
  ProductForYouDto,
  SubmitOrderDto,
  GetProductDetailDto,
  AddProductCartDto,
  TrackCompanyDayViewDto,
  CheckProductCartAllDto,
  DeleteProductCartDto,
  CheckProductCartDto,
  AddPromotionDto,
  UpdatePromoPosterDto,
  AddTierDto,
  UpdatePromotionStatusDto,
  DeleteTierDto,
  DeletePromotionDto,
  DuplicatePromotionDto,
  AddPromotionConditionDto,
  DeletePromotionConditionDto,
  AddPromotionRewardDto,
  GetProductByCreditorDto,
  DeletePromotionRewardDto,
  UpdatePromotionDto,
  EditPromotionRewardDto,
  GetProductTierDto,
  AddCreditorDto,
  EditTierDto,
  ImportWangdayDto,
  SaveHotdealDto,
  DeleteHotdealDto,
  CheckHotdealMatchDto,
  UseCodeForCheckRewardDto,
  GenerateCodePromotionDto,
  UpdateProductFromBackOfficeDto,
  UpdateStockFromBackOfficeDto,
  UpdateCustomerDataDto,
  RefreshTokenDto,
  AddLotItemDto,
  AddFlashsaleDto,
  AddProductToFlashsaleDto,
  DeleteProductFlashsaleDto,
  EditProductInFlashsaleDto,
  GetFlashsaleByDateDto,
  ChangeStatusFlashsaleDto,
  DeleteFlashsaleDto,
  EditFlashsaleDto,
  UploadLogFileDto,
  AddInvisibleTopicDto,
  AddInvisibleProductDto,
  DeleteInvisibleProductDto,
  DeleteInvisibleTopicDto,
  CreateAddressBodyDto,
  SaveModalContentDto,
  AddProductFreeDto,
  DeleteProductFreeDto,
  EditProductFreeDto,
  CreateSessionDto,
  LogoutSessionDto,
  MemCodeDto,
  RequestOtpDto,
  ValidateOtpDto,
  ChangePasswordDto,
  ResetPasswordDto,
  NewArrivalItemDto,
  ImportDataInvoiceDto,
  ImportDataRtDto,
  UpdateKeysearchDto,
} from 'src/common/dto-index';
import { objectSchema, arraySchema } from 'src/common/swagger-helpers';
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
  @ApiParam({
    name: 'soh_running',
    description: 'Order running number',
    example: 'SO-67010001',
  })
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
    description:
      'Banner placement location. Omit to get banners for all locations.',
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
    description:
      'Partial banner fields to update — any subset of BannerEntity columns; omitted fields are left unchanged.',
    type: UpdateBannerDto,
  })
  @ApiResponse({ status: 200, description: 'Banner updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('/ecom/banner/:id')
  async updateBanner(@Param('id') id: string, @Body() data: UpdateBannerDto) {
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
  @ApiBody({ type: UpdateUserDataDto })
  @ApiResponse({ status: 201, description: 'User data updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/user-data/update')
  async updateUserData(@Body() data: UpdateUserDataDto) {
    return this.authService.updateUserData(data);
  }

  @ApiTags('Banner & Contract Log')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload banner image with metadata' })
  @ApiBody({ type: UploadBannerDto })
  @ApiResponse({ status: 201, description: 'Banner uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UploadBannerDto,
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
  @ApiBody({ type: CreateBannerFromUrlDto })
  @ApiResponse({ status: 201, description: 'Banner created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/banner/from-url')
  async createBannerFromUrl(@Body() body: CreateBannerFromUrlDto) {
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
  @ApiBody({ type: UploadImageUserDto })
  @ApiResponse({ status: 201, description: 'User image uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/user/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImageUser(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UploadImageUserDto,
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
  @ApiParam({
    name: 'flag',
    description: 'Feature flag name',
    example: 'new_checkout',
  })
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
  @ApiBody({ type: UpdateFlagDto })
  @ApiResponse({ status: 201, description: 'Feature flag updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/feature-flag/update-flag')
  async updateFlag(@Body() data: UpdateFlagDto) {
    return this.featureFlagsService.updateFlag(data);
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload product PO data' })
  @ApiBody({ type: [UploadPoItemDto] })
  @ApiResponse({ status: 201, description: 'PO uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/products/insert-po')
  async uploadPO(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: UploadPoItemDto[],
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
  @ApiBody({ type: [UploadProductFlashSaleItemDto] })
  @ApiResponse({ status: 201, description: 'Flash sale products uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/products/upload-product-flashsale')
  async uploadProductFlashSale(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: UploadProductFlashSaleItemDto[],
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
  @ApiBody({ type: UploadProductL16Dto })
  @ApiResponse({ status: 201, description: 'Product L16 status uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/product-l16/upload')
  async uploadProductL16Only(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: UploadProductL16Dto,
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
  @ApiParam({
    name: 'mem_code',
    description: 'Member code (unused, taken from JWT)',
    example: 'M00123',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    description: 'Optional sort order key; omit for default order',
    example: 'name',
  })
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
  @ApiBody({ type: GetFlashSaleDto })
  @ApiResponse({ status: 201, description: 'Flash sale list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/flashsale/get-list')
  async getDataFlashSale(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: GetFlashSaleDto,
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
  @ApiBody({ type: AddToFavoriteDto })
  @ApiResponse({ status: 201, description: 'Added to favorites' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/add')
  async addToFavorite(@Body() data: AddToFavoriteDto) {
    return await this.favoriteService.addToFavorite(data);
  }

  @ApiTags('Product Search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a favorite product' })
  @ApiBody({ type: DeleteFavoriteDto })
  @ApiResponse({ status: 201, description: 'Favorite deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/delete')
  async deleteFavorite(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: DeleteFavoriteDto,
  ) {
    return await this.favoriteService.deleteFavorite({
      ...data,
      mem_code: req.user.mem_code,
      mem_route: req.user.mem_route,
    });
  }

  @ApiTags('Auth & Session')
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: SigninDto })
  @ApiResponse({ status: 201, description: 'Login successful' })
  @Post('/ecom/login')
  async signin(
    @Body() data: SigninDto,
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
  @ApiBody({ type: SearchProductsDto })
  @ApiResponse({ status: 201, description: 'Search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/search-products')
  async searchProducts(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: SearchProductsDto,
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
  @ApiBody({ type: SearchCategoryProductsDto })
  @ApiResponse({ status: 201, description: 'Category search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/category-products')
  async searchCategoryProducts(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: SearchCategoryProductsDto,
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
  @ApiBody({ type: ProductForYouDto })
  @ApiResponse({ status: 201, description: 'Recommended products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-for-u')
  async productForYou(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: ProductForYouDto,
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
  @ApiBody({ type: SubmitOrderDto })
  @ApiResponse({ status: 201, description: 'Order submitted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/submit-order')
  async submitOrder(
    @Ip() ip: string,
    @Req() req: Request & { user: JwtPayload },
    @Body() data: SubmitOrderDto,
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
  @ApiBody({ type: GetProductDetailDto })
  @ApiResponse({ status: 201, description: 'Product detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-detail')
  async GetProductDetail(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: GetProductDetailDto,
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
  @ApiParam({
    name: 'sortBy',
    description: 'Sort order key, e.g. "name" or "point"',
    example: 'name',
  })
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
  @ApiBody({ type: AddProductCartDto })
  @ApiResponse({ status: 201, description: 'Product added to cart' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-add-cart')
  async addProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: AddProductCartDto,
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
  @ApiBody({ type: TrackCompanyDayViewDto })
  @ApiResponse({ status: 201, description: 'View tracked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/company-day/view')
  trackCompanyDayView(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: TrackCompanyDayViewDto,
  ) {
    const mem_code = req.user.mem_code;
    void this.companyDayAnalyticService.emitEvent('view', mem_code, data);
    return { success: true };
  }

  @ApiTags('Cart & Checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check/uncheck all cart items' })
  @ApiBody({ type: CheckProductCartAllDto })
  @ApiResponse({ status: 201, description: 'Cart items updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-all-cart')
  async checkProductCartAll(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: CheckProductCartAllDto,
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
  @ApiBody({ type: DeleteProductCartDto })
  @ApiResponse({ status: 201, description: 'Product removed from cart' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-delete-cart')
  async deleteProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: DeleteProductCartDto,
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
  @ApiBody({ type: CheckProductCartDto })
  @ApiResponse({ status: 201, description: 'Cart item updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-cart')
  async checkProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: CheckProductCartDto,
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
  @ApiParam({
    name: 'mem_code',
    description: 'Member code (unused, taken from JWT)',
    example: 'M00123',
  })
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
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
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
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
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
  @ApiParam({
    name: 'soh_runing',
    description: 'Order running number',
    example: 'SO-67010001',
  })
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
  @ApiBody({ type: AddPromotionDto })
  @ApiResponse({ status: 201, description: 'Promotion created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/add')
  @UseInterceptors(FileInterceptor('file'))
  async addPromotion(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: Omit<AddPromotionDto, 'file'>,
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
  @ApiBody({ type: UpdatePromoPosterDto })
  @ApiResponse({ status: 201, description: 'Poster updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update-poster')
  @UseInterceptors(FileInterceptor('file'))
  async updatePromoPoster(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: Omit<UpdatePromoPosterDto, 'file'>,
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
  @ApiBody({ type: AddTierDto })
  @ApiResponse({ status: 201, description: 'Tier added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/add-tier')
  @UseInterceptors(FileInterceptor('file'))
  async addTier(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: Omit<AddTierDto, 'file'>,
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
  @ApiBody({ type: UpdatePromotionStatusDto })
  @ApiResponse({ status: 201, description: 'Status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update-status')
  async updatePromotionStatus(@Body() data: UpdatePromotionStatusDto) {
    return this.promotionService.updateStatus(data.promo_id, data.status);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tier' })
  @ApiBody({ type: DeleteTierDto })
  @ApiResponse({ status: 201, description: 'Tier deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/delete-tier')
  async deleteTier(@Body() data: DeleteTierDto) {
    return this.promotionService.deleteTier(data.tier_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion' })
  @ApiBody({ type: DeletePromotionDto })
  @ApiResponse({ status: 201, description: 'Promotion deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/delete')
  async deletePromotion(@Body() data: DeletePromotionDto) {
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
  @ApiBody({ type: DuplicatePromotionDto })
  @ApiResponse({ status: 201, description: 'Promotion duplicated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/duplicate')
  async duplicatePromotion(@Body() data: DuplicatePromotionDto) {
    return this.promotionService.duplicatePromotion(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a promotion condition' })
  @ApiBody({ type: AddPromotionConditionDto })
  @ApiResponse({ status: 201, description: 'Condition created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/condition/add')
  async addPromotionCondition(@Body() data: AddPromotionConditionDto) {
    return this.promotionService.createCondition(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion condition' })
  @ApiBody({ type: DeletePromotionConditionDto })
  @ApiResponse({ status: 201, description: 'Condition deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/condition/delete')
  async deletePromotionCondition(@Body() data: DeletePromotionConditionDto) {
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
  @ApiBody({ type: AddPromotionRewardDto })
  @ApiResponse({ status: 201, description: 'Reward created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reward/add')
  async addPromotionReward(@Body() data: AddPromotionRewardDto) {
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
  @ApiBody({ type: GetProductByCreditorDto })
  @ApiResponse({ status: 201, description: 'Products by creditor' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/product/creditor')
  async getProductByCreditor(@Body() data: GetProductByCreditorDto) {
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
  @ApiBody({ type: DeletePromotionRewardDto })
  @ApiResponse({ status: 201, description: 'Reward deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reward/delete')
  async deletePromotionReward(@Body() data: DeletePromotionRewardDto) {
    return this.promotionService.deleteReward(data.reward_id);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promotion' })
  @ApiBody({ type: UpdatePromotionDto })
  @ApiResponse({ status: 201, description: 'Promotion updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update/promotion')
  async updatePromotion(@Body() data: UpdatePromotionDto) {
    return this.promotionService.updatePromotion(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a promotion reward' })
  @ApiBody({ type: EditPromotionRewardDto })
  @ApiResponse({ status: 201, description: 'Reward edited' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update/edit-reward')
  async editReward(@Body() data: EditPromotionRewardDto) {
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
  @ApiBody({ type: GetProductTierDto })
  @ApiResponse({ status: 201, description: 'Tier products' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/get-tier-product-for-customer')
  async getProductTier(@Body() data: GetProductTierDto) {
    return this.promotionService.tierProducts(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiOperation({ summary: 'Add a creditor' })
  @ApiBody({ type: AddCreditorDto })
  @ApiResponse({ status: 201, description: 'Creditor added' })
  @Post('/ecom/promotion/creditor/add-creditor')
  async addCreditor(@Body() data: AddCreditorDto) {
    return this.productsService.addCreditor(data);
  }

  @ApiTags('Promotion & Tier')
  @ApiOperation({ summary: 'Edit a tier' })
  @ApiBody({ type: EditTierDto })
  @ApiResponse({ status: 201, description: 'Tier edited' })
  @Post('/ecom/promotion/edit-tier')
  async editTier(@Body() data: EditTierDto) {
    return await this.promotionService.updateTier(data);
  }
  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import wangday data from Excel' })
  @ApiBody({ type: ImportWangdayDto })
  @ApiResponse({ status: 201, description: 'Wangday data imported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/wangday/import')
  async importWangday(@Body() body: ImportWangdayDto) {
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
  @ApiParam({
    name: 'keyword',
    description: 'Search keyword',
    example: 'paracetamol',
  })
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
  @ApiBody({ type: SaveHotdealDto })
  @ApiResponse({ status: 201, description: 'Hotdeal saved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/hotdeal/save-hotdeal')
  async saveHotdeal(@Body() body: SaveHotdealDto) {
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
  @ApiBody({ type: DeleteHotdealDto })
  @ApiResponse({ status: 200, description: 'Hotdeal deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/admin/hotdeal/delete')
  async deleteHotdeal(@Body() data: DeleteHotdealDto) {
    return this.hotdealService.deleteHotdeal(data.id, data.pro_code);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get hotdeals (simple list) for current member' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'offset', required: false, type: String, example: '0' })
  @ApiQuery({
    name: 'special_deal',
    required: false,
    type: String,
    description: '"true" or "false"',
    example: 'false',
  })
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
  @ApiOperation({
    summary: 'Get product-pro deals (simple list) for current member',
  })
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
  @ApiOperation({
    summary: 'Get "buy more get 1" deals (simple list) for current member',
  })
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
  @ApiBody({ type: CheckHotdealMatchDto })
  @ApiResponse({ status: 201, description: 'Matched hotdeals' })
  @Post('/ecom/hotdeal/check-hotdeal-match')
  async checkHotdealMatch(@Body() body: CheckHotdealMatchDto) {
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
  @ApiBody({ type: UseCodeForCheckRewardDto })
  @ApiResponse({ status: 201, description: 'Reward checked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/code/use')
  async useCodeForCheckReward(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: UseCodeForCheckRewardDto,
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
  @ApiOperation({
    summary: 'Generate a promo code for a member (requires permission)',
  })
  @ApiBody({ type: GenerateCodePromotionDto })
  @ApiResponse({ status: 201, description: 'Promo code generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/code/generate')
  async generateCodePromotion(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: GenerateCodePromotionDto,
  ) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You not have Permission to Accesss');
    }
    return this.promotionService.generateCodePromotion(data.mem_code);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiOperation({ summary: 'Get hotdeal/freebie detail by product code' })
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
  @ApiResponse({ status: 200, description: 'Hotdeal detail' })
  @Get('/ecom/hotdeal/get-hotdeal-from-code/:pro_code')
  async getHotdealFromCode(@Param('pro_code') pro_code: string) {
    return await this.hotdealService.getHotdealFromCode(pro_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({
    summary: 'Bulk update products from back office import file',
  })
  @ApiBody({ type: UpdateProductFromBackOfficeDto })
  @ApiResponse({ status: 201, description: 'Products updated' })
  @Post('/ecom/admin/update-product-from-back-office')
  async updateProductFromBackOffice(
    @Body()
    body: UpdateProductFromBackOfficeDto,
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
  @ApiBody({ type: [UpdateCustomerDataDto] })
  @ApiResponse({ status: 201, description: 'Customers upserted' })
  @Post('/ecom/update-customer-data')
  async updateCustomerData(
    @Body()
    data: UpdateCustomerDataDto[],
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
  @ApiBody({ type: UpdateStockFromBackOfficeDto })
  @ApiResponse({ status: 201, description: 'Stock updated' })
  @Post('/ecom/admin/update-stock-from-back-office')
  async updateStockFromBackOffice(
    @Body()
    body: UpdateStockFromBackOfficeDto,
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
  @ApiParam({
    name: 'feature',
    description: 'Feature name',
    example: 'wangday-import',
  })
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
  @ApiOperation({
    summary: 'Get all searchable product keywords for current member',
  })
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
  @ApiBody({ type: [AddLotItemDto] })
  @ApiResponse({ status: 201, description: 'Lots added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/lot/add-lots')
  async addLots(
    @Body()
    data: AddLotItemDto[],
  ) {
    return this.lotService.addLots(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a daily flash sale promotion' })
  @ApiBody({ type: AddFlashsaleDto })
  @ApiResponse({ status: 201, description: 'Flash sale created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/add-flashsale')
  async addDailyFlashsale(
    @Body()
    data: AddFlashsaleDto,
  ) {
    return await this.flashsaleService.addFlashSale(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to a daily flash sale' })
  @ApiBody({ type: AddProductToFlashsaleDto })
  @ApiResponse({ status: 201, description: 'Product added to flash sale' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/add-product')
  async addProductToDailyFlashsale(
    @Body()
    data: AddProductToFlashsaleDto,
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
  @ApiParam({
    name: 'promotion_id',
    description: 'Flash sale promotion id',
    example: '3',
  })
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
  @ApiBody({ type: DeleteProductFlashsaleDto })
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
  @ApiBody({ type: EditProductInFlashsaleDto })
  @ApiResponse({ status: 201, description: 'Product updated in flash sale' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/edit-product')
  async editProductInDailyFlashSale(@Body() data: EditProductInFlashsaleDto) {
    return await this.flashsaleService.editProductInFlashSale(data);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active flash sale for current member' })
  @ApiBody({ type: GetFlashsaleByDateDto })
  @ApiResponse({ status: 201, description: 'Flash sale data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/get-flashsale')
  async getFlashsaleByDate(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: GetFlashsaleByDateDto,
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
  @ApiBody({ type: ChangeStatusFlashsaleDto })
  @ApiResponse({ status: 201, description: 'Status changed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/change-status')
  async changeStatusDailyFlashsale(@Body() data: ChangeStatusFlashsaleDto) {
    return await this.flashsaleService.changeStatus({
      promotion_id: data.id,
      is_active: data.is_active,
    });
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a daily flash sale' })
  @ApiBody({ type: DeleteFlashsaleDto })
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
  @ApiBody({ type: UploadLogFileDto })
  @ApiResponse({ status: 201, description: 'File log upserted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/upload-log-file')
  async uploadLogFile(@Body() data: UploadLogFileDto) {
    return await this.backendService.upsertFileLog({
      feature: data.feature,
      filename: data.filename,
    });
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get the log file for a feature' })
  @ApiParam({
    name: 'feature',
    description: 'Feature name',
    example: 'wangday-import',
  })
  @ApiResponse({ status: 200, description: 'Log file content' })
  @Get('/ecom/get-upload-log-file/:feature')
  async getUploadLogFile(@Param('feature') feature: string) {
    return await this.backendService.getLogfile(feature);
  }

  @ApiTags('Hotdeal & Flash Sale')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a daily flash sale promotion' })
  @ApiBody({ type: EditFlashsaleDto })
  @ApiResponse({ status: 201, description: 'Flash sale updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/edit-flashsale')
  async editDailyFlashsale(
    @Body()
    data: EditFlashsaleDto,
  ) {
    return await this.flashsaleService.EditFlashSale(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an invisible-product topic for a creditor' })
  @ApiBody({ type: AddInvisibleTopicDto })
  @ApiResponse({ status: 201, description: 'Topic added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/add-invisible-topic')
  async addInvisibleTopic(
    @Body()
    data: AddInvisibleTopicDto,
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
  @ApiParam({
    name: 'creditor_code',
    description: 'Creditor code',
    example: 'C00123',
  })
  @ApiResponse({ status: 200, description: 'List of products' })
  @Get('/ecom/invisible/product/creditor/:creditor_code')
  async getInvisibleProductByCreditor(
    @Param('creditor_code') creditor_code: string,
  ) {
    return this.productsService.getProductByCreditor(creditor_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiOperation({ summary: 'Get invisible products by invisible topic id' })
  @ApiParam({
    name: 'invisible_id',
    description: 'Invisible topic id',
    example: 1,
  })
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
  @ApiBody({ type: AddInvisibleProductDto })
  @ApiResponse({ status: 201, description: 'Product added to topic' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/add-product')
  async addInvisibleProduct(
    @Body()
    data: AddInvisibleProductDto,
  ) {
    return await this.invisibleService.updateProductInvisible(data);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a product from invisible-product topics' })
  @ApiBody({ type: DeleteInvisibleProductDto })
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
  @ApiBody({ type: DeleteInvisibleTopicDto })
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
  @ApiBody({ type: CreateAddressBodyDto })
  @ApiResponse({ status: 201, description: 'Address created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/address/create-address')
  async createAddress(
    @Body()
    addressData: CreateAddressBodyDto,
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
  @ApiBody({ type: SaveModalContentDto })
  @ApiResponse({ status: 201, description: 'Modal content saved' })
  @Post('/ecom/admin/modal-content/save')
  async saveModalContent(
    @Body()
    body: SaveModalContentDto,
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
  @ApiOperation({
    summary: 'Add a product to the "fix free" point-redeemable list',
  })
  @ApiBody({ type: AddProductFreeDto })
  @ApiResponse({ status: 201, description: 'Product added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-free/add')
  async addProductFree(@Body() data: AddProductFreeDto) {
    return await this.fixFreeService.addProductFree(data);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a product from the "fix free" list' })
  @ApiBody({ type: DeleteProductFreeDto })
  @ApiResponse({ status: 200, description: 'Product removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/product-free/delete')
  async deleteProductFree(@Body() data: DeleteProductFreeDto) {
    return await this.fixFreeService.removeProductFree(data.pro_code);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit the point cost of a "fix free" product' })
  @ApiBody({ type: EditProductFreeDto })
  @ApiResponse({ status: 201, description: 'Product point updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-free/edit')
  async editProductFree(@Body() data: EditProductFreeDto) {
    return await this.fixFreeService.editPoint(data.pro_code, data.pro_point);
  }

  // @Get('/ip')
  // getIP(@Ip() ip: string) {
  //   return { ip };
  // }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Refresh an access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 201, description: 'New access token issued' })
  @Post('/ecom/refresh_token')
  async refreshToken(@Body() body: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(
      body.token,
      req.headers['x-client'] as string,
    );
  }

  // Session Management APIs
  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a login session for current member' })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/create')
  async createSession(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: CreateSessionDto,
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
  @ApiParam({
    name: 'session_token',
    description: 'Session token',
    example: 'a1b2c3d4e5',
  })
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
  @ApiParam({
    name: 'session_token',
    description: 'Session token',
    example: 'a1b2c3d4e5',
  })
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
  @ApiBody({ type: LogoutSessionDto })
  @ApiResponse({ status: 201, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout')
  async logoutSession(@Body() data: LogoutSessionDto) {
    await this.sessionsService.logoutSession(data.session_token);
    return { message: 'Logout successful' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions of a member' })
  @ApiBody({ type: MemCodeDto })
  @ApiResponse({ status: 201, description: 'All sessions logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout-all')
  async logoutAllSessions(@Body() data: MemCodeDto) {
    await this.sessionsService.logoutAllUserSessions(data.mem_code);
    return { message: 'All sessions logged out successfully' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout recently active sessions of a member' })
  @ApiBody({ type: MemCodeDto })
  @ApiResponse({
    status: 201,
    description: 'Recently active sessions logged out',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout-recent')
  async logoutRecentSessions(@Body() data: MemCodeDto) {
    await this.sessionsService.logoutRecentUserSessions(data.mem_code);
    return { message: 'Recently active sessions logged out successfully' };
  }

  @ApiTags('Session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate whether a session token is still active' })
  @ApiParam({
    name: 'session_token',
    description: 'Session token',
    example: 'a1b2c3d4e5',
  })
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
  @ApiOperation({
    summary: 'Check whether a member has an email on file for password reset',
  })
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
  @ApiBody({ type: RequestOtpDto })
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
  @ApiBody({ type: ValidateOtpDto })
  @ApiResponse({ status: 201, description: 'OTP validation result' })
  @Post('/ecom/password/validate-otp')
  async validateOtp(
    @Body()
    data: ValidateOtpDto,
  ): Promise<{ valid: boolean; message: string; block?: boolean }> {
    const result = await this.changePasswordService.validateOtp(data);
    return result;
  }

  @ApiTags('Password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for current member' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password change result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('/ecom/password/change-password')
  async changePassword(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: ChangePasswordDto,
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
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset result' })
  @Put('/ecom/password/reset-password')
  async resetPassword(
    @Body()
    body: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.changePasswordService.forgotPasswordUpdate(body);
  }

  @ApiTags('Products')
  @ApiOperation({ summary: 'Bulk add new-arrival product batches' })
  @ApiBody({ type: [NewArrivalItemDto] })
  @ApiResponse({ status: 201, description: 'New arrivals added' })
  @Post('/ecom/new-arrivals')
  async NewArrivals(
    @Body()
    data: NewArrivalItemDto[],
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
  @ApiOperation({
    summary: 'Get up to 30 new-arrival products for current member',
  })
  @ApiParam({
    name: 'mem_code',
    description: 'Member code (unused, taken from JWT)',
    example: 'M00123',
  })
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
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
  @ApiResponse({ status: 200, description: 'Hotdeal detail' })
  @Get('/ecom/hotdeal/find/:pro_code')
  find(@Param('pro_code') pro_code: string): Promise<any> {
    return this.hotdealService.find(pro_code);
  }

  @ApiTags('Misc / Admin Tools')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get wangday data grouped by product (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get all company-day promotions (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get all "fix free" products (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get all promotional products (requires permission)',
  })
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
  @ApiBody({ type: [ImportDataInvoiceDto] })
  @ApiResponse({ status: 201, description: 'Invoices imported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/reduct-invoice/add-invoice')
  async importData(
    @Body()
    data: ImportDataInvoiceDto[],
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
  @ApiBody({ type: [ImportDataRtDto] })
  @ApiResponse({ status: 201, description: 'RT entries imported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/reduct-invoice/add-rt')
  async importDataRT(
    @Body()
    data: ImportDataRtDto[],
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
  @ApiOperation({
    summary: 'Find a reduction invoice by invoice id for current member',
  })
  @ApiParam({
    name: 'invoice',
    description: 'Invoice number',
    example: 'INV00123',
  })
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
  @ApiOperation({
    summary: 'Find a reduction RT (return) record by id for current member',
  })
  @ApiParam({
    name: 'rt',
    description: 'RT (return) number',
    example: 'RT00123',
  })
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
  @ApiBody({ type: UpdateKeysearchDto })
  @ApiResponse({ status: 201, description: 'Keyword updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/keysearch/update-product-keysearch')
  async updateKeysearch(@Body() data: UpdateKeysearchDto) {
    await this.productKeySearch.updateKeyword(data);
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get keysearch info for one product' })
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
  @ApiResponse({ status: 200, description: 'Keysearch info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/keysearch/get-one/:pro_code')
  async keysearchProductGetOne(@Param('pro_code') pro_code: string) {
    return await this.productKeySearch.getProductOne(pro_code);
  }

  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check/refresh latest purchase date for current member',
  })
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
    schema: objectSchema({
      emp_code: {
        type: 'string',
        example: 'E00123',
        description: 'Required; not empty',
      },
      data: objectSchema({
        emp_code: {
          type: 'string',
          example: 'E00123',
          description: 'Required; not empty',
        },
        emp_nickname: {
          type: 'string',
          example: 'นัท',
          description: 'Optional; empty string allowed',
          optional: true,
        },
        emp_firstname: {
          type: 'string',
          example: 'สมชาย',
          description: 'Optional; empty string allowed',
          optional: true,
        },
        emp_lastname: {
          type: 'string',
          example: 'ใจดี',
          description: 'Optional; empty string allowed',
          optional: true,
        },
        emp_mobile: {
          type: 'string',
          example: '0812345678',
          description: 'Optional; empty string allowed',
          optional: true,
        },
        emp_email: {
          type: 'string',
          example: 'somchai@example.com',
          description: 'Optional; empty string allowed',
          optional: true,
        },
        emp_ID_line: {
          type: 'string',
          example: 'somchai_line',
          description: 'Optional; empty string allowed',
          optional: true,
        },
      }),
    }),
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
    schema: arraySchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
      amount: { type: 'number', example: 25, description: 'Required' },
    }),
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
  @ApiOperation({
    summary: 'Update or clear VIP tag for a member (requires permission)',
  })
  @ApiBody({
    schema: objectSchema({
      mem_code: {
        type: 'string',
        example: 'M00123',
        description: 'Required; not empty',
      },
      message: {
        type: 'string',
        example: 'อนุมัติ VIP แล้ว',
        description: 'Required; not empty',
      },
      tagVIP: {
        type: 'string',
        example: 'VIP',
        description: 'Optional; empty string/omit clears the tag',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      tag: {
        type: 'string',
        example: 'สินค้าขายดี',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      tag_id: { type: 'number', example: 1, description: 'Required' },
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
      rank: { type: 'number', example: 1, description: 'Required' },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      tag_id: { type: 'number', example: 1, description: 'Required' },
    }),
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
  @ApiOperation({
    summary: 'Get recommended products by recommend ids for current member',
  })
  @ApiBody({
    schema: objectSchema({
      pro_code: {
        type: 'array',
        items: { type: 'string', example: 'P00123' },
        description: 'Optional; not used by the implementation',
        optional: true,
      },
      recommend_id: {
        type: 'array',
        items: { type: 'number', example: 1 },
        description: 'Required; not empty',
      },
      mem_code: {
        type: 'string',
        example: 'M00123',
        description: 'Optional; overridden by JWT mem_code if present',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Set promotion status for all products under a tier',
  })
  @ApiBody({
    schema: objectSchema({
      tier_id: { type: 'number', example: 1, description: 'Required' },
      status: { type: 'boolean', example: true, description: 'Required' },
    }),
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
  @ApiOperation({
    summary: 'Check the promotion tier applicable to a product for a member',
  })
  @ApiBody({
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
      mem_code: {
        type: 'string',
        example: 'M00123',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Get all image-debug records (requires permission)',
  })
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
    schema: objectSchema({
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; image file',
      },
      name: {
        type: 'string',
        example: 'สมชาย ใจดี',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      type: {
        type: 'string',
        enum: ['wang', 'attestor', 'creditor', 'banner'],
        example: 'banner',
        description: 'Optional',
        optional: true,
      },
      bannerName: {
        type: 'string',
        example: 'แบนเนอร์โปรโมชั่น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      bannerId: {
        oneOf: [{ type: 'number' }, { type: 'string', enum: ['all'] }],
        example: 'all',
        description: 'Optional; banner id, or "all" to get every banner',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary:
      'Get dropdown data for contract-log forms (e.g. attestor/creditor lists)',
  })
  @ApiBody({
    schema: objectSchema({
      group: {
        type: 'string',
        example: 'attestor',
        description: 'Required; not empty',
      },
      type: {
        type: 'string',
        example: 'attestor',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      selectedWang: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      selectedAttestor: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      selectedAttestor2: {
        type: 'number',
        example: 2,
        description: 'Optional',
        optional: true,
      },
      selectedCreditor: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      bannerId: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      bannerName: {
        type: 'string',
        example: 'แบนเนอร์โปรโมชั่น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      signingDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-06-23T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      creditorCode: {
        type: 'string',
        example: 'C00123',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-06-23T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-12-31T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      paymentDue: {
        type: 'string',
        format: 'date-time',
        example: '2026-07-23T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      address: {
        type: 'string',
        example: '99/1 ถนนสุขุมวิท',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Search creditors by keyword for contract-log forms',
  })
  @ApiBody({
    schema: objectSchema({
      keyword: {
        type: 'string',
        example: 'บริษัท วังเภสัช',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Update a contract-log creditor/banner image and info',
  })
  @ApiBody({
    schema: objectSchema({
      contractId: { type: 'number', example: 1, description: 'Required' },
      name: {
        type: 'string',
        example: 'สมชาย ใจดี',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      type: {
        type: 'string',
        enum: ['creditor', 'banner'],
        example: 'creditor',
        description: 'Optional',
        optional: true,
      },
      bannerName: {
        type: 'string',
        example: 'แบนเนอร์โปรโมชั่น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Optional; image file',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      contractId: { type: 'number', example: 1, description: 'Required' },
      name: {
        type: 'string',
        example: 'สมชาย ใจดี',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; signed contract file',
      },
    }),
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
  @ApiOperation({
    summary: 'Get contract-log company-day record(s) by id or all',
  })
  @ApiBody({
    schema: objectSchema({
      companyDayId: {
        oneOf: [{ type: 'number' }, { type: 'string', enum: ['all'] }],
        example: 'all',
        description:
          'Optional; company-day record id, or "all" to get every record',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
      limit: { type: 'number', example: 50, description: 'Required' },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Set a replacement product for a discontinued product',
  })
  @ApiBody({
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
      replace_pro_code: {
        type: 'string',
        example: 'P00456',
        description: 'Required; not empty',
      },
      note: {
        type: 'string',
        example: 'สินค้าหมดสายผลิต',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      date_end: {
        type: 'string',
        format: 'date-time',
        example: '2026-12-31T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      selectedWang: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      selectedAttestor: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      selectedAttestor2: {
        type: 'number',
        example: 2,
        description: 'Optional',
        optional: true,
      },
      selectedCreditor: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      bannerId: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      bannerName: {
        type: 'string',
        example: 'แบนเนอร์โปรโมชั่น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      signingDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-06-23T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      creditorCode: {
        type: 'string',
        example: 'C00123',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-06-23T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-12-31T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      address: {
        type: 'string',
        example: '99/1 ถนนสุขุมวิท',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      reportDueDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-12-31T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      finalPaymentAmount: {
        type: 'number',
        example: 5000,
        description: 'Optional',
        optional: true,
      },
      totalSupportValue: {
        type: 'number',
        example: 10000,
        description: 'Optional',
        optional: true,
      },
      supportDeliveryDate: {
        type: 'string',
        format: 'date-time',
        example: '2026-07-01T00:00:00.000Z',
        description: 'Optional; ISO datetime',
        optional: true,
      },
      numberOfInstallments: {
        type: 'number',
        example: 3,
        description: 'Optional',
        optional: true,
      },
      installmentIntervalDays: {
        type: 'number',
        example: 30,
        description: 'Optional',
        optional: true,
      },
      firstInstallmentAmount: {
        type: 'number',
        example: 3000,
        description: 'Optional',
        optional: true,
      },
      firstPaymentCondition: {
        type: 'string',
        example: 'ชำระทันทีหลังเซ็นสัญญา',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      finalInstallmentAmount: {
        type: 'number',
        example: 2000,
        description: 'Optional',
        optional: true,
      },
      productsToOrder: {
        type: 'string',
        example: 'P00123, P00456',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Update a contract-log company-day record (creditor image)',
  })
  @ApiBody({
    schema: objectSchema({
      contractId: { type: 'number', example: 1, description: 'Required' },
      name: {
        type: 'string',
        example: 'สมชาย ใจดี',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      type: {
        type: 'string',
        enum: ['creditor'],
        example: 'creditor',
        description: 'Optional',
        optional: true,
      },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Optional; image file',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      contractId: { type: 'number', example: 1, description: 'Required' },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; signed contract file',
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Find policy document categories (optionally by name)',
  })
  @ApiBody({
    schema: objectSchema({
      name: {
        type: 'string',
        example: 'นโยบายความเป็นส่วนตัว',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      content: {
        type: 'string',
        example: '<p>เนื้อหานโยบาย</p>',
        description: 'Required; not empty',
      },
      category: { type: 'number', example: 1, description: 'Required' },
      type: { type: 'number', example: 1, description: 'Required' },
    }),
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
  @ApiOperation({
    summary:
      'Check and get the correct (latest unsigned) policy for current member',
  })
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
    schema: objectSchema({
      policyID: { type: 'number', example: 1, description: 'Required' },
    }),
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
    schema: objectSchema({
      name: {
        type: 'string',
        example: 'แคมเปญสิ้นปี 2026',
        description: 'Required; not empty',
      },
      description: {
        type: 'string',
        example: 'แคมเปญลดราคาสิ้นปี',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      set_number: { type: 'number', example: 1, description: 'Required' },
      condition: {
        type: 'string',
        example: 'ซื้อครบ 1000 บาท',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      target: {
        type: 'string',
        example: 'P00123',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      con_percent: {
        type: 'string',
        example: '10',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      target: {
        type: 'string',
        example: 'P00123',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      con_percent: {
        type: 'string',
        example: '10',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      condition: {
        type: 'string',
        example: 'ซื้อครบ 1000 บาท',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      set_number: {
        type: 'number',
        example: 1,
        description: 'Optional',
        optional: true,
      },
      price_per_set: {
        type: 'string',
        example: '500.00',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      number_of_sets: {
        type: 'number',
        example: 2,
        description: 'Optional',
        optional: true,
      },
      unit_price: {
        type: 'number',
        example: 250,
        description: 'Optional',
        optional: true,
      },
      quantity: {
        type: 'number',
        example: 2,
        description: 'Optional',
        optional: true,
      },
      discounted_price: {
        type: 'number',
        example: 450,
        description: 'Optional',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      name: {
        type: 'string',
        example: 'ของแถม',
        description: 'Required; not empty',
      },
      unit: {
        type: 'string',
        example: 'ชิ้น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      value_per_unit: {
        type: 'string',
        example: '10.00',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      reward_column_id: {
        type: 'string',
        example: '1',
        description: 'Required; not empty',
      },
      quantity: {
        type: 'string',
        example: '2',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      unit: {
        type: 'string',
        example: 'ชิ้น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      price: {
        type: 'string',
        example: '10.00',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      value: {
        type: 'string',
        example: '20.00',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      quantity: {
        type: 'string',
        example: '2',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      unit: {
        type: 'string',
        example: 'ชิ้น',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      price: {
        type: 'string',
        example: '10.00',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      value: {
        type: 'string',
        example: '20.00',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      reward_id: {
        type: 'string',
        example: '1',
        description: 'Required; not empty',
      },
      url: {
        type: 'string',
        example: 'https://example.com/image.png',
        description: 'Required; not empty',
      },
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; image file',
      },
      reward_id: {
        type: 'string',
        example: '1',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; image file',
      },
    }),
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
    schema: objectSchema({
      name: {
        type: 'string',
        example: 'แชมพูสมุนไพร',
        description: 'Required; not empty',
      },
    }),
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
  @ApiParam({
    name: 'productId',
    description: 'Purchase product id',
    example: '1',
  })
  @ApiBody({
    schema: objectSchema({
      name: {
        type: 'string',
        example: 'แชมพูสมุนไพร',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      img_url: {
        type: 'string',
        example: 'https://example.com/image.png',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiParam({
    name: 'productId',
    description: 'Purchase product id',
    example: '1',
  })
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
  @ApiParam({
    name: 'productId',
    description: 'Purchase product id',
    example: '1',
  })
  @ApiBody({
    schema: objectSchema({
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; image file',
      },
    }),
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
    schema: objectSchema({
      prompt: {
        type: 'string',
        example: 'โปสเตอร์โปรโมชั่นสินค้าฤดูร้อน',
        description: 'Required; not empty',
      },
      aspectRatio: {
        type: 'string',
        example: '1:1',
        description: 'Required; not empty',
      },
      imageItems: {
        ...arraySchema({
          url: {
            type: 'string',
            example: 'https://example.com/image.png',
            description: 'Required; not empty',
          },
          name: {
            type: 'string',
            example: 'แชมพูสมุนไพร',
            description: 'Required; not empty',
          },
          quantity: { type: 'number', example: 1, description: 'Required' },
          unit: {
            type: 'string',
            example: 'ชิ้น',
            description: 'Optional; empty string allowed',
            optional: true,
          },
        }),
        optional: true,
      },
      session_cookies: {
        type: 'string',
        example: '',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Poll for AI poster generation result by request id',
  })
  @ApiParam({
    name: 'requestId',
    description: 'Poster generation request id',
    example: 'req_00123',
  })
  @ApiBody({
    schema: objectSchema({
      session_cookies: {
        type: 'string',
        example: '',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
    schema: objectSchema({
      value_per_unit: { type: 'number', example: 10, description: 'Required' },
    }),
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
  @ApiOperation({
    summary: 'Save a generated poster image to a campaign row history',
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiBody({
    schema: objectSchema({
      img_url: {
        type: 'string',
        example: 'https://example.com/poster.png',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Create a banner from a poster history image and link it',
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiParam({
    name: 'historyId',
    description: 'Poster history id',
    example: '1',
  })
  @ApiBody({
    schema: objectSchema({
      img_url: {
        type: 'string',
        example: 'https://example.com/poster.png',
        description: 'Required; not empty',
      },
      banner_name: {
        type: 'string',
        example: 'โปสเตอร์โปรโมชั่นฤดูร้อน',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      banner_location: {
        type: 'string',
        enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
        example: 'store_carousel',
        description: 'Required; not empty',
      },
      date_start: {
        type: 'string',
        format: 'date-time',
        example: '2026-06-23T00:00:00.000Z',
        description: 'Required; ISO datetime',
      },
      date_end: {
        type: 'string',
        format: 'date-time',
        example: '2026-07-23T00:00:00.000Z',
        description: 'Required; ISO datetime',
      },
    }),
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
  @ApiOperation({
    summary:
      'Remove a banner link from poster history (keeps the banner image file)',
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign id', example: '1' })
  @ApiParam({ name: 'rowId', description: 'Row id', example: '1' })
  @ApiParam({
    name: 'historyId',
    description: 'Poster history id',
    example: '1',
  })
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
  @ApiOperation({
    summary: 'Proxy-download an ideogram.ai generated image (avoids CORS)',
  })
  @ApiQuery({
    name: 'url',
    description: 'Must start with https://ideogram.ai/',
    example: 'https://ideogram.ai/api/images/example.png',
  })
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
  @ApiOperation({
    summary: 'Search banner-eligible products (requires permission)',
  })
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
  @ApiParam({
    name: 'sh_running',
    description: 'Shopping head running number',
    example: 'SO00123',
  })
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
  @ApiParam({
    name: 'soh_running',
    description: 'Shopping order head running number',
    example: 'SO00123',
  })
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
  @ApiOperation({
    summary: 'Create a product return request (customer-initiated)',
  })
  @ApiBody({
    schema: objectSchema({
      soh_id: { type: 'number', example: 12345, description: 'Required' },
      mem_code: {
        type: 'string',
        example: 'M00123',
        description: 'Required; not empty',
      },
      reason: {
        type: 'string',
        enum: ['damaged', 'expired', 'wrong_item', 'disaster', 'other'],
        example: 'damaged',
        description: 'Required; not empty',
      },
      reason_detail: {
        type: 'string',
        example: 'สินค้าชำรุดตอนเปิดกล่อง',
        description: 'Optional; empty string allowed',
        optional: true,
      },
      resolution_type: {
        type: 'string',
        enum: ['refund', 'replacement'],
        example: 'refund',
        description: 'Required; not empty',
      },
      items: arraySchema({
        pro_code: {
          type: 'string',
          example: 'P00123',
          description: 'Required; not empty',
        },
        qty: { type: 'number', example: 2, description: 'Required' },
        unit: {
          type: 'string',
          example: 'กล่อง',
          description: 'Required; not empty',
        },
        price_per_unit: {
          type: 'number',
          example: 150,
          description: 'Required',
        },
        item_reason: {
          type: 'string',
          example: 'สินค้าชำรุด',
          description: 'Optional; empty string allowed',
          optional: true,
        },
        expiry_date: {
          type: 'string',
          example: '2026-12-31',
          description: 'Optional; format YYYY-MM-DD',
          optional: true,
        },
      }),
      notes: {
        type: 'string',
        example: '',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Upload evidence images for a return request (up to 5 files)',
  })
  @ApiParam({
    name: 'return_id',
    description: 'Return request id',
    example: '1',
  })
  @ApiBody({
    schema: objectSchema({
      files: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Optional; up to 5 image files',
        optional: true,
      },
      description: {
        type: 'string',
        example: '',
        description: 'Optional; empty string allowed',
        optional: true,
      },
    }),
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
  @ApiParam({
    name: 'return_id',
    description: 'Return request id',
    example: '1',
  })
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
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    example: 'pending',
  })
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
  @ApiParam({
    name: 'return_id',
    description: 'Return request id',
    example: '1',
  })
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
  @ApiParam({
    name: 'return_id',
    description: 'Return request id',
    example: '1',
  })
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
  @ApiOperation({
    summary: 'Get tracked behavior events for a member (for personalization)',
  })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({
    summary: 'Get product view/interaction analytics (requires permission)',
  })
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({
    summary: 'Get search behavior analytics (requires permission)',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({
    summary: 'Get behavior tracking dashboard stats (requires permission)',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({
    summary: 'Get top viewed/purchased products (requires permission)',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({
    summary: 'Get recent customer activity feed (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get user navigation journeys (requires permission)',
  })
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
  @ApiOperation({
    summary:
      'Get search queries that returned zero results (requires permission)',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({
    summary: 'Get demand-based stock alerts (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get cart-to-purchase conversion analytics (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get customer segmentation analysis (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get customer retention analysis (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get repeat purchase patterns (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Get purchase interval box-plot data (requires permission)',
  })
  @ApiQuery({ name: 'days', required: false, type: String, example: '180' })
  @ApiQuery({
    name: 'group_by',
    required: false,
    type: String,
    example: 'overall',
    description: 'one of: overall, product, segment, month',
  })
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
  @ApiOperation({
    summary: 'Get user journey sankey diagram data (requires permission)',
  })
  @ApiQuery({
    name: 'from_date',
    required: true,
    type: String,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: true,
    type: String,
    example: '2026-06-23',
  })
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
  @ApiOperation({ summary: "Change a member's role/permission (Admin only)" })
  @ApiParam({ name: 'mem_code', description: 'Member code', example: 'M00123' })
  @ApiBody({
    schema: objectSchema({
      newRole: {
        type: 'string',
        enum: ['User', 'Admin', 'Sales'],
        example: 'Sales',
        description: 'Required; not empty',
      },
      permission: {
        type: 'boolean',
        example: true,
        description: 'Optional; defaults to false',
        optional: true,
      },
    }),
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
  @ApiOperation({
    summary: 'Look up a member for role management (Admin only)',
  })
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
  @ApiOperation({
    summary: 'Update enabled feature flags for a member (Admin only)',
  })
  @ApiBody({
    schema: objectSchema({
      mem_code: {
        type: 'string',
        example: 'M00123',
        description: 'Required; not empty',
      },
      features: {
        type: 'array',
        items: { type: 'string', example: 'happy_hour' },
        description: 'Required; list of feature flag keys',
      },
    }),
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
  @ApiOperation({
    summary: 'Get paginated admin role-change action logs (Admin only)',
  })
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
  @ApiOperation({
    summary: 'Get RT (return) order notifications from the last 3 days',
  })
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
    schema: objectSchema({
      soh_running: {
        type: 'string',
        example: 'SO00123',
        description: 'Required; not empty',
      },
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Register a push notification token for current member',
  })
  @ApiBody({
    schema: objectSchema({
      token: {
        type: 'string',
        example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Remove a push notification token for current member',
  })
  @ApiBody({
    schema: objectSchema({
      token: {
        type: 'string',
        example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        description: 'Required; not empty',
      },
    }),
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
    schema: objectSchema({
      id: { type: 'number', example: 1, description: 'Required' },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; image file',
      },
    }),
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
  @ApiOperation({
    summary: 'Get paginated list of products with a replacement set',
  })
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
  @ApiOperation({
    summary: 'Upload/update the poster image for a promotion tier',
  })
  @ApiBody({
    schema: objectSchema({
      tier_id: {
        type: 'string',
        example: '1',
        description: 'Required; not empty',
      },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Required; image file',
      },
    }),
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
  @ApiOperation({
    summary: 'Check/recalculate tier-turn-back reward price for an order item',
  })
  @ApiBody({
    schema: objectSchema({
      sh_running: {
        type: 'string',
        example: 'SO00123',
        description: 'Required; not empty',
      },
      pro_code: {
        type: 'string',
        example: 'P00123',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary:
      'Check and adjust happy-hour reward for an order (requires permission)',
  })
  @ApiBody({
    schema: objectSchema({
      sh_running: {
        type: 'string',
        example: 'SO00123',
        description: 'Required; not empty',
      },
    }),
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
  @ApiOperation({
    summary: 'Get hotdeal detail by product code for current member',
  })
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
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
  @ApiOperation({
    summary: 'Add hotdeal freebie products to cart for current member',
  })
  @ApiBody({
    schema: objectSchema({
      freebies: arraySchema({
        pro_code: {
          type: 'string',
          example: 'P00123',
          description: 'Required; not empty',
        },
        unit: {
          type: 'string',
          example: 'กล่อง',
          description: 'Required; not empty',
        },
        amount: { type: 'number', example: 1, description: 'Required' },
        pro_code1: {
          type: 'string',
          example: 'P00100',
          description: 'Required; not empty; the qualifying product code',
        },
      }),
    }),
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
  @ApiParam({
    name: 'pro_code',
    description: 'Product code',
    example: 'P00123',
  })
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
  @ApiOperation({
    summary: 'Manually trigger the company-day promotion cart re-check',
  })
  @ApiResponse({ status: 200, description: 'Check triggered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('/ecom/trigger/check-promotion-company-day')
  async triggerCheckPromotionCompanyDay() {
    await this.shoppingCartService.callCheckCartPromotion();
  }

  @ApiTags('Products')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Autocomplete product search against the external product source',
  })
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
  @ApiOperation({
    summary: 'Search Lotus gift card products (requires permission)',
  })
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
  @ApiOperation({
    summary: 'Search products by name for admin (requires permission)',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    example: 'แชมพู',
  })
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
