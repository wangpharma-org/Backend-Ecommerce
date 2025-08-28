import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
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
  ) {}

  @Get('/ecom/presign')
  async getPresignedURL(
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
  ) {
    return this.bannerService.getPresignedUrl(fileName, fileType);
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

  @Get('/ecom/flashsale/:limit')
  async getDataFlashSale(@Param('limit') limit: number) {
    return await this.productsService.getFlashSale(limit);
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
  async searchProducts(@Body() data: { keyword: string; offset: number }) {
    console.log('data in controller:', data);
    return await this.productsService.searchProducts(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/category-products')
  async searchCategoryProducts(
    @Body() data: { keyword: string; offset: number; category: number },
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
  @Get('/ecom/last6/:memCode')
  async getLast6Orders(
    @Param('memCode') memCode: string,
  ): Promise<ShoppingOrderEntity[]> {
    return this.shoppingOrderService.getLast6OrdersByMemberCode(memCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/summary-cart/:memCode')
  async getDataFromCart(@Param('memCode') memCode: string): Promise<any> {
    return await this.shoppingCartService.getDataFromCart(memCode);
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
}
