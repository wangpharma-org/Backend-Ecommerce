import { WangdayService } from './backend/wangday.service';
import { UserEntity } from 'src/users/users.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
import { WangDay } from './backend/wangday.entity';
import { WangdaySumPrice } from './backend/wangdaySumPrice.entity';
import { HotdealInput, HotdealService } from './hotdeal/hotdeal.service';

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
interface ImportAndSumResult {
  mem_code: string;
  date: string;
  sum: WangdaySumPrice | null;
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
    private readonly wangdayService: WangdayService,
    private readonly hotdealService: HotdealService,
  ) { }

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
    console.log(data);
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
    console.log(data);
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
    console.log('permission', permission);
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
    console.log('permission', permission);
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
    console.log('permission', permission);
    console.log(req.user);
    if (permission === true) {
      return await this.productsService.listProcodeFlashSale();
    } else {
      throw new Error('You not have Permission to Accesss');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/favorite/:mem_code')
  async getListFavorite(@Param('mem_code') mem_code: string) {
    console.log('get data favorite');
    return await this.favoriteService.getListFavorite(mem_code);
  }

  @Post('/ecom/flashsale/get-list')
  async getDataFlashSale(@Body() data: { limit: number; mem_code: string }) {
    return await this.productsService.getFlashSale(data.limit, data.mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/add')
  async addToFavorite(@Body() data: { mem_code: string; pro_code: string }) {
    console.log(data);
    return await this.favoriteService.addToFavorite(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/favorite/delete')
  async deleteFavorite(@Body() data: { fav_id: number; mem_code: string }) {
    return await this.favoriteService.deleteFavorite(data);
  }

  @Post('/ecom/login')
  async signin(
    @Body() data: { username: string; password: string },
  ): Promise<SigninResponse> {
    console.log('data in controller:', data);
    return await this.authService.signin(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/search-products')
  async searchProducts(
    @Body() data: { keyword: string; offset: number; mem_code: string },
  ) {
    console.log('data in controller:', data);
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
    },
  ) {
    console.log('data in controller:', data);
    return await this.productsService.searchCategoryProducts(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-for-u')
  async productForYou(@Body() data: { keyword: string; pro_code: string }) {
    console.log('data in controller:', data);
    return await this.productsService.productForYou(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/submit-order')
  async submitOrder(
    @Body()
    data: {
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
    },
  ) {
    console.log('data in controller:', data);
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
  @Get('/ecom/product-coin')
  async productCoin() {
    return await this.productsService.listFree();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-add-cart')
  async addProductCart(
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
      pro_unit: string;
      amount: number;
      pro_freebie: number;
    },
  ) {
    console.log(data);
    return await this.shoppingCartService.addProductCart(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-all-cart')
  async checkProductCartAll(
    @Body()
    data: {
      mem_code: string;
      type: string;
    },
  ) {
    console.log(data);
    return await this.shoppingCartService.checkedProductCartAll(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-delete-cart')
  async deleteProductCart(
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
    },
  ) {
    console.log(data);
    return await this.shoppingCartService.handleDeleteCart(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/product-check-cart')
  async checkProductCart(
    @Body()
    data: {
      mem_code: string;
      pro_code: string;
      type: string;
    },
  ) {
    console.log(data);
    return await this.shoppingCartService.checkedProductCart(data);
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
  @Post('/ecom/wangday/import')
  async importWangday(@Body() body: { data: any[], isLastChunk: boolean, isFirstChunk: boolean }) {
    try {
      // แปลง key ภาษาไทยเป็น key ที่ entity ใช้
      const rows = (body.data || []).map(item => ({
        date: item['วันที่'],
        sh_running: item['เลขที่ใบกำกับ'],
        wang_code: item['รหัสลูกค้า'],
        sumprice: item['ยอดเงินสุทธิ']?.toString(),
      }));
      const imported = await this.wangdayService.importFromExcel(rows, body.isLastChunk, body.isFirstChunk);
      return "Successful" + imported.length;
    }
    catch (error) {
      console.error('Error importing wangday data:', error);
      throw error;
    }
  }

  @Get('/ecom/wangday/monthly/:wang_code')
  async getWangdayMonthly(@Param('wang_code') wang_code: string) {
    return this.wangdayService.getMonthlySumByWangCode(wang_code);
  }
  @Get('/ecom/wangsumprice/:wang_code')
  async getWangSumPrice(@Param('wang_code') wang_code: string) {
    return this.wangdayService.getAllWangSumPrice(wang_code);
  }

  @Post('/ecom/admin/hotdeal/search-product-main/:keyword')
  async searchProductMain(@Param('keyword') keyword: string | '') {
    return this.hotdealService.searchProduct(keyword);
  }
  @Post('/ecom/admin/hotdeal/search-product-freebie/:keyword')
  async searchProductFreebie(@Param('keyword') keyword: string | '') {
    return this.hotdealService.searchProduct(keyword);
  }
  @Post('/ecom/admin/hotdeal/save-hotdeal')
  async saveHotdeal(@Body() body: { dataInput: HotdealInput }) {
    console.log(body);
    return this.hotdealService.saveHotdeal(body.dataInput);
  }

  @Get('/ecom/admin/hotdeal/all-hotdeals')
  async getAllHotdeals() {
    return this.hotdealService.getAllHotdealsWithProductNames();
  }

  @Delete('/ecom/admin/hotdeal/delete/:id')
  async deleteHotdeal(@Param('id') id: number) {
    return this.hotdealService.deleteHotdeal(id);
  }

  @Get('/ecom/hotdeal/simple-list')
  async getAllHotdealsSimple(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.hotdealService.getAllHotdealsWithProductDetail(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined
    );
  }

  @Post('/ecom/hotdeal/check-hotdeal-match')
  async checkHotdealMatch(
    @Body() body: { hotDeal: Array<{ mem_code: string, pro_code: string, shopping_cart: Array<{ pro1_unit: string, pro1_amount: string }> }> }
  ) {
    const allResults = await Promise.all(
      (body.hotDeal || []).map(async (deal) => {
        const results = await Promise.all(
          (deal.shopping_cart || []).map(item =>
            this.hotdealService.checkHotdealMatch(deal.mem_code, deal.pro_code, item)
          )
        );
        // filter เฉพาะตัวที่เจอ pro_code
        return results.filter(Boolean);
      })
    );
    // flatten array
    return allResults.flat();
  }

  @Post('/ecom/hotdeal/get-hotdeals-by-procodes')
  async getHotdealsByProCodes(@Body() body: { proCodes: string[] }) {
    return this.hotdealService.getHotdealsByProCodes(body.proCodes);
  }

  @Post('/ecom/hotdeal/save-freebies')
  async saveFreebies(@Body() body: { hotDeal: { mem_code: string, pro2_code: string, pro2_unit: string, pro2_amount: string }[] }) {
    console.log("body:", body);
    // if (!Array.isArray(body)) {
    //   throw new Error('Body must be an array of freebies');
    // }
    // Map body.hotDeal to the expected structure for saveCartProduct
    const cartProducts = body.hotDeal.map((item: { mem_code: string; pro2_code: string; pro2_unit: string; pro2_amount: string }) => ({
      mem_code: item.mem_code,
      pro2_code: item.pro2_code,
      pro2_unit: item.pro2_unit,
      pro2_amount: item.pro2_amount
    }));
    return this.hotdealService.saveCartProduct(cartProducts);
  }

  @Delete('/ecom/hotdeal/delete-all')
  async deleteAllHotdeals(@Body('mem_code') mem_code: string) {
    return this.shoppingCartService.clearFreebieCart(mem_code);
  }
}
