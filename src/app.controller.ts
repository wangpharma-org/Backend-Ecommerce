import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/favorite/:mem_code')
  async getListFavorite(@Param('mem_code') mem_code: string) {
    console.log('get data favorite');
    return await this.favoriteService.getListFavorite(mem_code);
  }

  // @Get('/ecom/flashsale')
  // async getDataFlashSale() {
  //   return await this.flashsaleService.getListFlashSale();
  // }

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

  @Post('/ecom/drug-sticker/checkuser')
  async checkUser(@Body() data: { username: string; password: string }): Promise<{ valid: boolean; message: string }> {
    try {
      console.log('data in controller to DrugSticker:', data.username);
      return await this.authService.checkUser(data);
    }
    catch (err) {
      console.log('Error in controller to DrugSticker:', err);
      return { valid: false, message: 'Error checking user' };
    }

  }
}
