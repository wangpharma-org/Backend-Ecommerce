import { WangdayService } from './wangday/wangday.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
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
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';
import { BannerService } from './banner/banner.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { HotdealInput, HotdealService } from './hotdeal/hotdeal.service';
import { PromotionService } from './promotion/promotion.service';
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
import { PromotionEntity } from './promotion/promotion.entity';
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
import { AppVersionService } from './app-version/app-version.service';

interface JwtPayload {
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
}

@Controller()
export class AppController {
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
    private readonly appVersion: AppVersionService,
  ) { }

  @Get('/ecom/get-data/:soh_running')
  async apiForOldSystem(@Param('soh_running') soh_running: string) {
    return this.shoppingOrderService.sendDataToOldSystem(soh_running);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/image-banner')
  async getImageUrl() {
    return this.bannerService.GetImageUrl();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/user-data/:mem_code')
  async getUserData(@Param('mem_code') mem_code: string) {
    return this.authService.fetchUserData(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/user-data/update')
  async updateUserData(@Body() data: UserEntity) {
    //console.log(data);
    return this.authService.updateUserData(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: { date_start: Date; date_end: Date },
  ) {
    const uploadUrl = await this.bannerService.UploadImage(
      file,
      data.date_start,
      data.date_end,
    );
    return uploadUrl?.Location;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/user/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImageUser(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: { mem_code: string; type: string; old_url: string },
  ) {
    //console.log(data);
    return await this.authService.UploadImage(
      file,
      data.type,
      data.mem_code,
      data.old_url,
    );
  }

  @Get('/ecom/feature-flag/:flag')
  async checkFlag(@Param('flag') flag: string) {
    return this.featureFlagsService.getFlag(flag);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/feature-flag/update-flag')
  async updateFlag(@Body() data: { flag: string; status: boolean }) {
    return this.featureFlagsService.updateFlag(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/products/insert-po')
  async uploadPO(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { pro_code: string; month: number }[],
  ) {
    const permission = req.user.permission;
    //console.log('permission', permission);
    if (permission === true) {
      return await this.productsService.uploadPO(data);
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/products/upload-product-flashsale')
  async uploadProductFlashSale(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { productCode: string; quantity: number }[],
  ) {
    const permission = req.user.permission;
    //console.log('permission', permission);
    if (permission === true) {
      return await this.productsService.uploadProductFlashSale(data);
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/product-l16/upload')
  async uploadProductL16Only(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: { data: { pro_code: string; status: number | string }[]; filename: string },
  ) {
    const permission = req.user.permission;
    if (permission === true) {
      return await this.productsService.updateProductL16OnlyFromUpload(body);
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/products/flashsale-procode')
  async listProcodeFlashSale(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    //console.log('permission', permission);
    //console.log(req.user);
    if (permission === true) {
      return await this.productsService.listProcodeFlashSale();
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/favorite/:mem_code')
  async getListFavorite(
    @Req() req: Request & { user: JwtPayload },
    @Param('mem_code') mem_code: string,
    @Query('sort_by') sort_by?: string,
  ) {
    //console.log('get data favorite');
    const memberCode = req.user.mem_code;
    return await this.favoriteService.getListFavorite(
      memberCode,
      sort_by,
      req.user.mem_route,
    );
  }

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
    for (const funcItem of func) {
      await this.imagedebugService.UpsercetImg({
        pro_code: funcItem.pro_code,
        imageUrl: funcItem.pro_imgmain,
      });
    }
    return func;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/add')
  async addToFavorite(@Body() data: { mem_code: string; pro_code: string }) {
    //console.log(data);
    return await this.favoriteService.addToFavorite(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/delete')
  async deleteFavorite(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { fav_id: number; mem_code: string; sort_by?: number },
  ) {
    //console.log(data);
    return await this.favoriteService.deleteFavorite({
      ...data,
      mem_code: req.user.mem_code,
      mem_route: req.user.mem_route,
    });
  }

  @Post('/ecom/login')
  async signin(
    @Body() data: { username: string; password: string },
  ): Promise<SigninResponse> {
    //console.log('data in controller:', data);
    return await this.authService.signin(data);
  }

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
    },
  ) {
    //console.log('data in controller:', data);
    const mem_code = req.user.mem_code;
    const result = await this.productsService.searchProducts({
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
    //console.log('data in controller:', data);
    const mem_code = req.user.mem_code;
    return await this.productsService.searchCategoryProducts({
      ...data,
      mem_code,
      mem_route: req.user.mem_route,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-for-u')
  async productForYou(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { keyword: string; pro_code: string },
  ) {
    //console.log('data in controller:', data);
    const mem_code = req.user.mem_code;
    return await this.productsService.productForYou({
      ...data,
      mem_code,
      mem_route: req.user.mem_route,
    });
  }

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
    return await this.shoppingOrderService.submitOrder(
      { ...data, mem_code, mem_route: req.user.mem_route },
      ip,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/cart/count/:mem_code')
  async CountCart(@Param('mem_code') mem_code: string) {
    return await this.shoppingCartService.getCartItemCount(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-detail')
  async GetProductDetail(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { pro_code: string; mem_code: string },
  ) {
    console.log('data in controller:', data);
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
  //   //console.log('permission', permission);
  //   if (permission === true) {
  //     return await this.productsService.uploadProductFlashSale(data);
  //   } else {
  //     throw new Error('You not have Permission to Accesss');
  //   }
  // }

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
      clientVersion?: string;
    },
  ) {
    console.log('Add to cart data:', data);
    const priceCondition = req.user.price_option ?? 'C';
    const mem_code = req.user.mem_code;
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
      clientVersion?: string;
    } = {
      ...data,
      mem_code,
      priceCondition,
      mem_route: req.user.mem_route,
    };
    console.log(payload);
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.addProductCart(payload);
    const summaryCart = await this.shoppingCartService.summaryCart(mem_code);
    return {
      cart,
      summaryCart: summaryCart.total,
      cartVersion,
      cartSyncedAt,
    };
  }

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
    console.log('Check all cart data:', data);
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
    //console.log('Delete', data);
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
    //console.log(data);
    console.log('Check cart data:', data);
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      type: string;
      priceOption: string;
      clientVersion?: string;
    } = { ...data, priceOption };
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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-cart/:mem_code')
  async getProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Param('mem_code') mem_code: string,
  ) {
    const memberCode = req.user.mem_code;
    const { cart, cartVersion, cartSyncedAt } =
      await this.shoppingCartService.getCartSnapshot(
        memberCode,
        req.user.mem_route,
      );
    const summaryCart = await this.shoppingCartService.summaryCart(memberCode);
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
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-cart/get-one/:pro_code')
  async getProductCartOne(@Param('pro_code') pro_code: string) {
    return this.productsService.getProductOne(pro_code);
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/add')
  async addPromotion(
    @Body()
    data: {
      promo_name: string;
      creditor_code: string;
      start_date: Date;
      end_date: Date;
      status: boolean;
    },
  ) {
    return this.promotionService.addPromotion(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/list')
  async getPromotions() {
    return this.promotionService.getAllPromotions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/detail/:promo_id')
  async getPromotion(@Param('promo_id') promo_id: string) {
    return this.promotionService.getPromotionById(Number(promo_id));
  }

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
    },
  ) {
    return this.promotionService.addTierToPromotion({
      promo_id: data.promo_id,
      tier_name: data.tier_name,
      min_amount: data.min_amount,
      description: data.description,
      detail: data.detail,
      file,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/update-status')
  async updatePromotionStatus(
    @Body() data: { promo_id: number; status: boolean },
  ) {
    return this.promotionService.updateStatus(data.promo_id, data.status);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/delete-tier')
  async deleteTier(@Body() data: { tier_id: number }) {
    return this.promotionService.deleteTier(data.tier_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/delete')
  async deletePromotion(@Body() data: { promo_id: number }) {
    return this.promotionService.deletePromotion(data.promo_id);
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/condition/delete')
  async deletePromotionCondition(@Body() data: { cond_id: number }) {
    return this.promotionService.deleteCondition(data.cond_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/condition/list/:tier_id')
  async listPromotionConditions(@Param('tier_id') tier_id: string) {
    return this.promotionService.getConditionsByTier(Number(tier_id));
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/reward/list/:tier_id')
  async listPromotionRewards(@Param('tier_id') tier_id: string) {
    return this.promotionService.getRewardsByTier(Number(tier_id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/product/creditor')
  async getProductByCreditor(@Body() data: { creditor_code: string }) {
    return this.productsService.getProductByCreditor(data.creditor_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch')
  async getProductForKeySearch() {
    return this.productsService.getProductForKeySearch();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch-flashsale')
  async getProductForKeySearchForFlashSale() {
    return this.productsService.getProductForKeySearchForFlashSale();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch-recommend')
  async getProductForKeySearchForRecommend() {
    return this.productsService.getProductForKeySearchForRecommend();
  }

  // @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/product/keysearch-replace')
  async getProductForKeySearchForReplace() {
    return this.productsService.getProductForKeySearchForReplace();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/tiers/:tier_id')
  async getTierByID(@Param('tier_id') tier_id: number) {
    return this.promotionService.getTierOneById(tier_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reward/delete')
  async deletePromotionReward(@Body() data: { reward_id: number }) {
    return this.promotionService.deleteReward(data.reward_id);
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/get-tier-for-customer')
  async getTierAll() {
    return this.promotionService.getAllTiers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/get-tier-products-all')
  async getTierProducts() {
    return this.promotionService.getAllTiersProduct();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/get-tier-product-for-customer')
  async getProductTier(
    @Body() data: { tier_id: number; mem_code: string; sort_by?: number },
  ) {
    return this.promotionService.tierProducts(data);
  }

  @Post('/ecom/promotion/creditor/add-creditor')
  async addCreditor(
    @Body() data: { creditor_code: string; creditor_name: string },
  ) {
    return this.productsService.addCreditor(data);
  }

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
        // console.log('Mapping item:', item);
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
      console.error('Error importing wangday data:', error);
      throw error;
    }
  }

  @Get('/ecom/wangday/monthly/:wang_code')
  async getWangdayMonthly(@Param('wang_code') wang_code: string) {
    const result = await this.wangdayService.getMonthlySumByWangCode(wang_code);
    return result;
  }
  @Get('/ecom/wangsumprice/:wang_code')
  async getWangSumPrice(@Param('wang_code') wang_code: string) {
    return this.wangdayService.getAllWangSumPrice(wang_code);
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/hotdeal/save-hotdeal')
  async saveHotdeal(
    @Body()
    body: {
      data: HotdealInput;
      pro_code?: string;
      id?: number;
      order?: number;
    },
  ) {
    console.log('Saving Hotdeal:', body);
    return this.hotdealService.saveHotdeal(body.data, body.id, body.order);
  }

  @Get('/ecom/admin/hotdeal/all-hotdeals')
  async getAllHotdeals() {
    return this.hotdealService.getAllHotdealsWithProductNames();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/admin/hotdeal/delete')
  async deleteHotdeal(@Body() data: { id: number; pro_code: string }) {
    return this.hotdealService.deleteHotdeal(data.id, data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/hotdeal/simple-list')
  async getAllHotdealsSimple(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('mem_code') mem_code?: string,
  ) {
    const memberCode = req.user.mem_code;
    return this.hotdealService.getAllHotdealsWithProductDetail(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      memberCode,
      req.user.mem_route,
    );
  }

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
      console.error('Error in checkHotdealMatch:', error);
      throw new Error('Error checking hotdeal match');
    }
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/code/generate')
  async generateCodePromotion(
    @Req() req: Request & { user: JwtPayload },
    @Body() data: { mem_code: string },
  ) {
    const permission = req.user.permission;
    //console.log('permission', permission);
    if (permission !== true) {
      throw new Error('You not have Permission to Accesss');
    }
    return this.promotionService.generateCodePromotion(data.mem_code);
  }

  @Get('/ecom/hotdeal/get-hotdeal-from-code/:pro_code')
  async getHotdealFromCode(@Param('pro_code') pro_code: string) {
    return await this.hotdealService.getHotdealFromCode(pro_code);
  }

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
      // //console.log('Received body:', {
      //   group: body.group,
      // });
      //console.log(body.filename);
      return this.productsService.updateProductFromBackOffice({
        group: body.group,
        filename: body.filename,
      });
    } catch (error) {
      console.error('Error updating product from back office:', error);
      throw new Error('Error updating product from back office');
    }
  }

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
    //console.log(data);
    return this.authService.upsertUser(data);
  }

  @Get('/ecom/last-sh-running')
  async getLastShRunning() {
    return this.shoppingHeadService.getLastSHRunnning();
  }

  @Post('/ecom/admin/update-stock-from-back-office')
  async updateStockFromBackOffice(
    @Body()
    body: {
      group: { pro_code: string; stock: number }[];
      filename: string;
    },
  ) {
    try {
      //console.log('Received body for stock update:', body);
      return await this.productsService.updateStock(body);
    } catch (error) {
      console.error('Error updating stock from back office:', error);
      throw new Error('Error updating stock from back office');
    }
  }
  @Get('/ecom/fileLog/:feature')
  async getFileLog(@Param('feature') feature: string) {
    const fileLogs = await this.backendService.getFeatured({
      featured: feature,
    });
    return fileLogs;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/debtor/:mem_code')
  async getDebtor(@Param('mem_code') mem_code: string) {
    return await this.debtorService.getAllDebtors(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/favorite/count/:mem_code')
  async getCountFavorite(@Param('mem_code') mem_code: string) {
    return await this.favoriteService.getCountFavorite(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product/keysearch-all')
  async getKeySearch(@Req() req: Request & { user: JwtPayload }) {
    const mem_code = req.user.mem_code;
    return await this.productsService.keySearchProducts(
      mem_code,
      req.user.mem_route,
    );
  }

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
    //console.log(data);
    return this.lotService.addLots(data);
  }

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
    //console.log(data);
    return await this.flashsaleService.addFlashSale(data);
  }

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
    //console.log(data);
    return await this.flashsaleService.addProductToFlashSale(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/daily-flashsale/list')
  async getAllDailyFlashsales() {
    return await this.flashsaleService.getAllFlashSales();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/daily-flashsale/products/:promotion_id')
  async getProductsInDailyFlashsale(
    @Param('promotion_id') promotion_id: number,
  ) {
    return await this.flashsaleService.getProductsInFlashSale(promotion_id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/daily-flashsale/delete-product')
  async deleteProductDailyFlashsale(@Body('id') id: number) {
    return await this.flashsaleService.deleteProduct(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/edit-product')
  async editProductInDailyFlashSale(
    @Body() data: { id: number; limit: number },
  ) {
    return await this.flashsaleService.editProductInFlashSale(data);
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/daily-flashsale/change-status')
  async changeStatusDailyFlashsale(
    @Body() data: { id: number; is_active: boolean },
  ) {
    //console.log(data);
    return await this.flashsaleService.changeStatus({
      promotion_id: data.id,
      is_active: data.is_active,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/daily-flashsale/delete-flashsale')
  async deleteDailyFlashsale(@Body('id') id: number) {
    return await this.flashsaleService.deleteFlashSale(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/upload-log-file')
  async uploadLogFile(@Body() data: { feature: string; filename: string }) {
    return await this.backendService.upsertFileLog({
      feature: data.feature,
      filename: data.filename,
    });
  }

  @Get('/ecom/get-upload-log-file/:feature')
  async getUploadLogFile(@Param('feature') feature: string) {
    return await this.backendService.getLogfile(feature);
  }

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
    //console.log(data);
    return await this.flashsaleService.EditFlashSale(data);
  }

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
    //console.log(data);
    return await this.invisibleService.addInvisibleTopic(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/invisible-product/get-invisible-topic-all')
  async getInvisibleTopic() {
    return await this.invisibleService.handleGetInvisibleTopics();
  }

  @Get('/ecom/invisible/product/creditor/:creditor_code')
  async getInvisibleProductByCreditor(
    @Param('creditor_code') creditor_code: string,
  ) {
    return this.productsService.getProductByCreditor(creditor_code);
  }

  @Get('/ecom/invisible/product/creditor/list/:invisible_id')
  async getInvisibleProductByInvisibleID(
    @Param('invisible_id') invisible_id: number,
  ) {
    return this.invisibleService.handleGetInvisibleProducts(invisible_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/add-product')
  async addInvisibleProduct(
    @Body()
    data: {
      invisible_id: number;
      pro_code: string;
    },
  ) {
    //console.log(data);
    return await this.invisibleService.updateProductInvisible(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/invisible-product/delete-product')
  async deleteInvisibleProduct(@Body('pro_code') pro_code: string) {
    return await this.invisibleService.removeProductInvisible(pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/invisible-product/delete-topic')
  async deleteInvisibleTopic(@Body('invisible_id') invisible_id: string) {
    return await this.invisibleService.deleteInvisibleTopic(
      Number(invisible_id),
    );
  }

  // @UseGuards(JwtAuthGuard)
  @Post('/ecom/address/edit-address/:addressId')
  async editAddress(@Param('addressId') addressId: number) {
    //console.log(addressId);
    return this.editAddressService.getAddressById(addressId);
  }

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
    //console.log(addressData);
    return this.editAddressService.createAddress(addressData);
  }

  // @UseGuards(JwtAuthGuard)
  @Put('/ecom/address/update-address/:id')
  async updateAddress(@Param('id') id: number, @Body() address: EditAddress) {
    //console.log(address);
    return this.editAddressService.updateAddress(id, address);
  }

  @Get('/ecom/address/:mem_code')
  async getAddressByUser(@Param('mem_code') mem_code: string) {
    return await this.editAddressService.getAddressesByUser(mem_code);
  }

  @Post('/ecom/admin/modal-content/save')
  async SaveModalContent(
    @Body()
    body: {
      id: number;
      title: string;
      content?: string;
      show: boolean;
    },
  ) {
    //console.log(body);
    return this.modalContentService.SaveModalContent(body);
  }

  @Get('/ecom/admin/modal-content/get')
  async GetModalContent() {
    return this.modalContentService.GetModalContent();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-free/all')
  async getAllProductFree() {
    try {
      return await this.fixFreeService.getAllProductFree();
    } catch {
      throw new Error('Error getting all free products');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-free/add')
  async addProductFree(@Body() data: { pro_code: string; pro_point: number }) {
    return await this.fixFreeService.addProductFree(data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/ecom/product-free/delete')
  async deleteProductFree(@Body() data: { pro_code: string }) {
    return await this.fixFreeService.removeProductFree(data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-free/edit')
  async editProductFree(@Body() data: { pro_code: string; pro_point: number }) {
    return await this.fixFreeService.editPoint(data.pro_code, data.pro_point);
  }

  // @Get('/ip')
  // getIP(@Ip() ip: string) {
  //   return { ip };
  // }

  @Post('/ecom/refresh_token')
  async refreshToken(@Body() body: { token: string }) {
    return this.authService.refreshToken(body.token);
  }

  // Session Management APIs
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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/active/:session_token')
  async getActiveSession(@Param('session_token') session_token: string) {
    return await this.sessionsService.findActiveSession(session_token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/user-sessions/:mem_code')
  async getUserActiveSessions(@Param('mem_code') mem_code: string) {
    return await this.sessionsService.findUserActiveSessions(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/ecom/session/update-activity/:session_token')
  async updateSessionActivity(@Param('session_token') session_token: string) {
    await this.sessionsService.updateLastActivity(session_token);
    return { message: 'Session activity updated successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout')
  async logoutSession(@Body() data: { session_token: string }) {
    await this.sessionsService.logoutSession(data.session_token);
    return { message: 'Logout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/session/logout-all')
  async logoutAllSessions(@Body() data: { mem_code: string }) {
    await this.sessionsService.logoutAllUserSessions(data.mem_code);
    return { message: 'All sessions logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/validate/:session_token')
  async validateSession(@Param('session_token') session_token: string) {
    const isValid = await this.sessionsService.isSessionValid(session_token);
    return { is_valid: isValid };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/session/count/:mem_code')
  async countActiveSessions(@Param('mem_code') mem_code: string) {
    const count = await this.sessionsService.countUserActiveSessions(mem_code);
    return { active_sessions_count: count };
  }

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

  @Post('/ecom/password/request-otp')
  async requestOtp(@Body('mem_code') mem_code: string): Promise<{
    valid: boolean;
    message: string;
    remainingTime?: number;
  }> {
    const result = await this.changePasswordService.CheckTimeRequest(mem_code);
    return result;
  }

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

  @UseGuards(JwtAuthGuard)
  @Put('/ecom/password/change-password')
  async changePassword(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    body: {
      new_password: string;
      old_password: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const mem_username = req.user.username;
      return this.changePasswordService.CheckOldPasswordAndUpdatePassword({
        mem_username: mem_username,
        new_password: body.new_password,
        old_password: body.old_password,
      });
    } catch {
      return {
        success: false,
        message: 'An error occurred while changing the password.',
      };
    }
  }

  @Put('/ecom/password/reset-password')
  async resetPassword(
    @Body()
    body: {
      mem_username: string;
      new_password: string;
      otp: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    //console.log(body);
    return this.changePasswordService.forgotPasswordUpdate(body);
  }

  @Post('/ecom/new-arrivals')
  async NewArrivals(
    @Body()
    data: {
      pro_code: string;
      LOT: string;
      MFG: string;
      EXP: string;
      createdAt: Date;
    }[],
  ) {
    type N = {
      product: { pro_code: string };
      LOT: string;
      MFG: string;
      EXP: string;
      createdAt: Date;
    };
    try {
      const results: N[] = [];
      console.log('Received body for new arrivals:', data);
      for (const item of data) {
        const result = await this.newArrivalsService.addNewArrival(
          item.pro_code,
          item.LOT,
          item.MFG,
          item.EXP,
          item.createdAt,
        );
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('Error adding new arrivals:', error);
      throw new Error('Error adding new arrivals');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/new-arrivals/list/:mem_code')
  async getNewArrivalsLimit30(
    @Req() req: Request & { user: JwtPayload },
    @Param('mem_code') mem_code: string,
  ) {
    const memberCode = req.user.mem_code;
    return this.newArrivalsService.getNewArrivalsLimit30(
      memberCode,
      req.user.mem_route,
    );
  }

  @Get('/ecom/hotdeal/find/:pro_code')
  find(@Param('pro_code') pro_code: string): Promise<any> {
    return this.hotdealService.find(pro_code);
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/company-days')
  async getCompanyDays(@Req() req: Request & { user: JwtPayload }): Promise<{
    promotions: PromotionEntity[];
  }> {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.promotionService.getPromotions();
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/flashsales')
  async getFlashsales(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.flashsaleService.findAllFlashSales();
  }
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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/product-promotion')
  async getProductPromotion(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.productsService.findProductPromotion();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/reduct-invoice/add-invoice')
  async importData(
    @Body()
    data: ImportDataRequestInvoice[],
  ): Promise<{ message: string }> {
    //console.log('Received data for reduction invoice import:', data);
    try {
      const importedInvoices = await this.debtorService.importDataInvoice(data);
      // //console.log('Imported invoice:', importedInvoices);
      return {
        message: `Successfully imported ${importedInvoices?.length} invoices`,
      };
    } catch (error) {
      console.error('Error importing reduction invoice data22:', error);
      return { message: 'Error importing reduction invoice data' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/reduct-invoice/add-rt')
  async importDataRT(
    @Body()
    data: ImportDataRequestRT[],
  ): Promise<{ message: string }> {
    //console.log('Received data for reduction RT import:', data);
    try {
      const importedRTs = await this.debtorService.importDataRT(data);
      // //console.log('Imported RT:', importedRTs);
      return {
        message: `Successfully imported ${importedRTs?.length} RT entries`,
      };
    } catch (error) {
      console.error('Error importing reduction RT data:', error);
      return { message: 'Error importing reduction RT data' };
    }
  }

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
      console.error('Error finding reduction invoices:', error);
      return 'Error finding reduction invoices';
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/reduct-invoice/rt/id/:rt')
  async findReductionRTs(
    @Req() req: Request & { user: JwtPayload },
    @Param('rt') rt: string,
  ): Promise<ReductionRT | string> {
    try {
      //console.log('Searching for RT:', rt);
      const mem_code = req.user.mem_code;
      //console.log('Member code from token:', mem_code);
      const result = await this.debtorService.findReductionRT(mem_code, rt);
      return result;
    } catch (error) {
      console.error('Error finding reduction RTs:', error);
      return 'Error finding reduction RTs';
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/keysearch/update-product-keysearch')
  async updateKeysearch(
    @Body() data: { pro_code: string; keysearch: string; viewers: number },
  ) {
    await this.productKeySearch.updateKeyword(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/keysearch/get-one/:pro_code')
  async keysearchProductGetOne(@Param('pro_code') pro_code: string) {
    return await this.productKeySearch.getProductOne(pro_code);
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/user/employee/list')
  async getEmployeeList() {
    return this.employeesService.getAllEmployees();
  }

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
      console.log('Update employee request:', requestData);
      const upsertEmployee = await this.employeesService.UpsertEmployee(
        requestData.emp_code,
        requestData.data,
      );
      return upsertEmployee;
    } catch (error) {
      console.error('Error updating employee:', error);
      return {
        message: 'Error updating employee',
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product/pro-sale-amount-update')
  async updateProductProSaleAmount(
    @Body() data: { pro_code: string; amount: number }[],
  ) {
    return await this.productsService.updateSaleDayly(data);
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/cart/summary')
  async summaryCart(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<number> {
    const mem_code = req.user.mem_code;
    const data = await this.shoppingCartService.summaryCart(mem_code);
    return data.total;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/recommend/tags')
  async getRecommendTags() {
    return await this.recommendService.getAllTags();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/insertTag')
  async insertRecommendTag(@Body() data: { tag: string }) {
    return await this.recommendService.insertTag(data.tag);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/recommend/products/:tag_id')
  async getRecommendProductsByTag(@Param('tag_id') tag_id: number) {
    return await this.recommendService.getProductsByTag(tag_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/updateTagToProduct')
  async updateTagToProduct(@Body() data: { tag_id: number; pro_code: string }) {
    return await this.recommendService.UpdateTagToProduct(
      data.pro_code,
      data.tag_id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/updateRank')
  async updateRecommendRank(@Body() data: { pro_code: string; rank: number }) {
    console.log(data);
    return await this.recommendService.UpdateRank(data.pro_code, data.rank);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/removeTagFromProduct')
  async removeTagFromProduct(@Body() data: { pro_code: string }) {
    return await this.recommendService.DeleteTagFromProduct(data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/deleteRank')
  async deleteRecommendRank(@Body() data: { pro_code: string }) {
    return await this.recommendService.DeleteRank(data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/recommend/deleteTag')
  async deleteRecommendTag(@Body() data: { tag_id: number }) {
    return await this.recommendService.deleteTag(data.tag_id);
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/image-bug/all-imagedebug')
  async getAllImagedebug(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource.');
    }
    return await this.imagedebugService.getAllImagedebug();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/tier-list-all-product')
  async getPromotionTierList() {
    return await this.promotionService.getTierAllProduct();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/promotion/tier-list-all-product-reward/:tier_id')
  async getPromotionTierListReward(@Param('tier_id') tier_id: number) {
    return await this.promotionService.getRewardByTierId(tier_id);
  }

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
    console.log('data:', data.urlPath);
    const result = await this.contractLogService.uploadFile({
      urlPath: file,
      bannerName: data.bannerName,
      type: data.type,
      name: data.name,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/banner')
  async getContractLogBanner(
    @Body('bannerId') bannerId: number | 'all' | undefined,
  ): Promise<ContractLogBanner | ContractLogBanner[] | null> {
    const result = await this.contractLogService.getContractLogBanner(bannerId);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/dropdown')
  async selectDataDropdown(
    @Body() data: { group: string; type: string },
  ): Promise<{ type: string; data: ContractLogPerson[] }> {
    console.log(data);
    const result = await this.contractLogService.selectDataDropdown(
      data.group,
      data.type,
    );
    return { type: data.type, data: result.data };
  }

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
    console.log(data);

    const result = await this.contractLogService.createContractLog(data);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/search-creditor')
  async getDataCreditor(
    @Body('keyword') keyword?: string,
  ): Promise<CreditorEntity[] | []> {
    return await this.productsService.getDataCreditor(keyword);
  }

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
    console.log('contractId:', data.contractId);
    console.log('urlPath:', file);
    console.log('name:', data.name);
    return await this.contractLogService.updateContractLogBanner({
      bannerId: data.contractId,
      urlPath: file,
      name: data.name,
      type: data.type,
      bannerName: data.bannerName,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/upload-signed-contract')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignedContract(
    @Body() data: { contractId: number; name?: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ urlContract: string }> {
    console.log('contractId:', data.contractId);
    console.log('urlPath:', file);
    return await this.contractLogService.uploadSignedContract({
      bannerId: data.contractId,
      urlPath: file,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/contract-details')
  async getContractCompanyDays(
    @Body() body: { companyDayId?: number | 'all' },
  ): Promise<ContractLogCompanyDay[] | ContractLogCompanyDay | null> {
    console.log(body);
    return await this.contractLogService.getContractCompanyDays(
      body.companyDayId,
    );
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/promotion/reset-limit-count')
  async resetLimitReward(@Body() data: { pro_code: string }) {
    return await this.promotionService.resetCountLimit(data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/replace/replace-product')
  async ReplaceProduct(
    @Body() data: { pro_code: string; replace_pro_code: string },
  ) {
    return await this.recommendService.AddReplaceProduct(
      data.pro_code,
      data.replace_pro_code,
    );
  }

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
    console.log(data);
    return await this.contractLogService.createContractLogCompanyDay(data);
  }

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
    console.log(data);
    return await this.contractLogService.updateContractLogCompanyDay({
      companyId: data.contractId,
      urlPath: file,
      name: data.name,
      type: 'creditor',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/contract-log/upload-signed-company-day')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignedCompanyDay(
    @Body() data: { contractId: number },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ urlContract: string }> {
    console.log('contractId:', data.contractId);
    console.log('urlPath:', file);
    return await this.contractLogService.uploadSignedContractCompanyDays({
      companyId: data.contractId,
      urlPath: file,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/replace/get-product')
  async GetProductAndReplace(@Body() data: { pro_code: string }) {
    return await this.recommendService.GetProductAndReplace(data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/replace/replace-product-null')
  async UpdateProductAndReplaceNull(@Body() data: { pro_code: string }) {
    return await this.recommendService.RemoveReplaceProduct(data.pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/policy/option-catagory')
  async findOptionCatagoryPolicy(@Body('name') name?: string) {
    console.log('Policy category name:', name);
    return await this.policyDocService.findOptionCatagoryPolicy(name);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/policy/upload-policy')
  async savePolicyDoc(
    @Body() data: { content: string; category: number; type: number },
  ) {
    console.log('Received policy document data:', data);

    if (!data) {
      throw new Error('Missing form data. Please send category and type.');
    }

    const { content, category, type } = data;
    return await this.policyDocService.savePolicyDoc(content, category, type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/policy/check-policy')
  async ensureUserHasPolicyMember(@Req() req: Request & { user: JwtPayload }) {
    const mem_code = req.user.mem_code;
    console.log('Checking policy for member code:', mem_code);
    return await this.policyDocService.checkAndGetCorrectPolicy(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/policy/agree')
  async agreeToPolicyDoc(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { policyID: number },
  ): Promise<PolicyDocMember | void | { message: string }> {
    const mem_code = req.user.mem_code;
    console.log('Member code agreeing to policy:', mem_code);
    console.log('Policy document ID:', body);
    return await this.policyDocService.agreePolicyDoc(mem_code, body.policyID);
  }
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

  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data/:rowId/products')
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

  @UseGuards(JwtAuthGuard)
  @Post('/campaigns/:campaignId/data/:rowId/products-delete')
  async removeProductFromRow(
    @Param('campaignId') campaignId: string,
    @Param('rowId') rowId: string,
    @Body() body: { pro_code: string },
  ) {
    try {
      console.log('Removing product from row:', {
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

  @Post('/app-version/version/get')
  async getVersion(@Body() data: { version: string; os: string }) {
    console.log('Get version request data:', data);
    try {
      return this.appVersion.getLatestVersion(data.version, data.os);
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'GET_VERSION_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // @UseGuards(JwtAuthGuard)
  @Post('/app-version/version/update')
  async postVersion(
    @Body()
    data: {
      latestVersionAndroid: string;
      latestVersionIOS: string;
      forceUpdateAndroid: boolean;
      forceUpdateIOS: boolean;
      androidStoreUrl?: string;
      iosStoreUrl?: string;
      note?: string;
    },
  ) {
    try {
      return this.appVersion.insertLastestVersion(data);
    } catch {
      throw new HttpException(
        {
          success: false,
          error: { code: 'POST_VERSION_FAILED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
