import { WangdayService } from './wangday/wangday.service';
import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ProductKeywordService } from './product-keyword/product-keyword.service';

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
  permission?: boolean;
}

@Controller()
export class AppController {
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
    private readonly productKeySearch: ProductKeywordService,
  ) {}

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
    @Param('mem_code') mem_code: string,
    @Query('sort_by') sort_by?: string,
  ) {
    //console.log('get data favorite');
    return await this.favoriteService.getListFavorite(mem_code, sort_by);
  }

  @Post('/ecom/flashsale/get-list')
  async getDataFlashSale(@Body() data: { limit: number; mem_code: string }) {
    return await this.productsService.getFlashSale(data.limit, data.mem_code);
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
    @Body() data: { fav_id: number; mem_code: string; sort_by?: number },
  ) {
    //console.log(data);
    return await this.favoriteService.deleteFavorite(data);
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
    return await this.productsService.searchProducts(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/category-products')
  async searchCategoryProducts(
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
    return await this.productsService.searchCategoryProducts(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-for-u')
  async productForYou(@Body() data: { keyword: string; pro_code: string }) {
    //console.log('data in controller:', data);
    return await this.productsService.productForYou(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/submit-order')
  async submitOrder(
    @Ip() ip: string,
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
    return await this.shoppingOrderService.submitOrder(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/cart/count/:mem_code')
  async CountCart(@Param('mem_code') mem_code: string) {
    return await this.shoppingCartService.getCartItemCount(mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-detail')
  async GetProductDetail(@Body() data: { pro_code: string; mem_code: string }) {
    return await this.productsService.getProductDetail(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-coin/:sortBy')
  async productCoin(@Param('sortBy') sort_by: string) {
    return await this.productsService.listFree(sort_by);
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
    },
  ) {
    const priceCondition = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      pro_unit: string;
      amount: number;
      priceCondition: string;
      // is_reward: boolean;
      flashsale_end: string;
      // hotdeal_free: boolean;
    } = {
      ...data,
      priceCondition,
    };
    console.log(payload);
    return await this.shoppingCartService.addProductCart(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-all-cart')
  async checkProductCartAll(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      mem_code: string;
      type: string;
    },
  ) {
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      type: string;
      priceOption: string;
    } = { ...data, priceOption };
    //console.log(data);
    return await this.shoppingCartService.checkedProductCartAll(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-delete-cart')
  async deleteProductCart(
    @Req() req: Request & { user: JwtPayload },
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
    },
  ) {
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      priceOption: string;
    } = { ...data, priceOption };
    //console.log('Delete', data);
    return await this.shoppingCartService.handleDeleteCart(payload);
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
    },
  ) {
    //console.log(data);
    const priceOption = req.user.price_option ?? 'C';
    const payload: {
      mem_code: string;
      pro_code: string;
      type: string;
      priceOption: string;
    } = { ...data, priceOption };
    return await this.shoppingCartService.checkedProductCart(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/product-cart/:mem_code')
  async getProductCart(@Param('mem_code') mem_code: string) {
    return this.shoppingCartService.getProductCart(mem_code);
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
    return this.shoppingOrderService.getLast6OrdersByMemberCode(memCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/all-order-member/:memCode')
  async AllOrderByMember(
    @Param('memCode') memCode: string,
  ): Promise<AllOrderByMemberRes> {
    return await this.shoppingHeadService.AllOrderByMember(memCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/some-order/:soh_runing')
  async SomeOrderByMember(
    @Param('soh_runing') soh_runing: string,
  ): Promise<ShoppingHeadEntity> {
    return await this.shoppingHeadService.SomeOrderByMember(soh_runing);
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
    },
  ) {
    return this.promotionService.addTierToPromotion({
      promo_id: data.promo_id,
      tier_name: data.tier_name,
      min_amount: data.min_amount,
      description: data.description,
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
  @Get('/ecom/promotion/product/creditor/:creditor_code')
  async getProductByCreditor(@Param('creditor_code') creditor_code: string) {
    return this.productsService.getProductByCreditor(creditor_code);
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
    console.log('Get Monthly Sum for wang_code:', wang_code);
    const result = await this.wangdayService.getMonthlySumByWangCode(wang_code);
    console.log('Result:', result);
    return result;
  }
  @Get('/ecom/wangsumprice/:wang_code')
  async getWangSumPrice(@Param('wang_code') wang_code: string) {
    return this.wangdayService.getAllWangSumPrice(wang_code);
  }

  @Post('/ecom/admin/hotdeal/search-product-main/:keyword')
  async searchProductMain(@Param('keyword') keyword: string) {
    return this.hotdealService.searchProduct(keyword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/admin/hotdeal/save-hotdeal')
  async saveHotdeal(@Body() body: { data: HotdealInput }) {
    console.log(body);
    return this.hotdealService.saveHotdeal(body.data);
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

  @Get('/ecom/hotdeal/simple-list')
  async getAllHotdealsSimple(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('mem_code') mem_code?: string,
  ) {
    return this.hotdealService.getAllHotdealsWithProductDetail(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      mem_code,
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
      console.log('allResults:', allResults);
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
  async getKeySearch() {
    return await this.productsService.keySearchProducts();
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
  async getFlashsaleByDate(@Body() data: { limit: number; mem_code: string }) {
    return await this.flashsaleService.getFlashSale(data.limit, data.mem_code);
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
  async getNewArrivalsLimit30(@Param('mem_code') mem_code: string) {
    return this.newArrivalsService.getNewArrivalsLimit30(mem_code);
  }

  @Get('/ecom/hotdeal/find/:pro_code')
  find(@Param('pro_code') pro_code: string): Promise<any> {
    return this.hotdealService.find(pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/wangday')
  async getProductWangday(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.wangdayService.getProductWangday();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/company-days')
  async getCompanyDays(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.promotionService.getPromotions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/banner')
  async getBanner(@Req() req: Request & { user: JwtPayload }) {
    const permission = req.user.permission;
    if (permission !== true) {
      throw new Error('You do not have permission to access this resource');
    }
    return await this.bannerService.findAllBanners();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/data/hotdeals')
  async getHotdeals(@Req() req: Request & { user: JwtPayload }) {
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
  ): Promise<{ pro_code: string; pro_name: string }[]> {
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
  async updateKeysearch(@Body() data: { pro_code: string; keysearch: string }) {
    await this.productKeySearch.updateKeyword(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/keysearch/get-one/:pro_code')
  async keysearchProductGetOne(@Param('pro_code') pro_code: string) {
    return await this.productKeySearch.getProductOne(pro_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product/pro-sale-amount-update')
  async updateProductProSaleAmount(
    @Body() data: { pro_code: string; amount: number }[],
  ) {
    return await this.productsService.updateSaleDayly(data);
  }
}
