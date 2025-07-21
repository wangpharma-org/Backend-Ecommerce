import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService, SigninResponse } from './auth/auth.service';
import { ProductsService } from './products/products.service';
import { ShoppingOrderEntity } from './shopping-order/shopping-order.entity';
import { ShoppingOrderService } from './shopping-order/shopping-order.service';
import { ShoppingCartService } from './shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from './shopping-head/shopping-head.entity';
import { ShoppingHeadService } from './shopping-head/shopping-head.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly productsService: ProductsService,
    private readonly shoppingCartService: ShoppingCartService,
    private readonly shoppingOrderService: ShoppingOrderService,
    private readonly shoppingHeadService: ShoppingHeadService,
  ) {}

  @Post('/ecom/login')
  async signin(
    @Body() data: { username: string; password: string },
  ): Promise<SigninResponse> {
    console.log('data in controller:', data);
    return await this.authService.signin(data);
  }

  @Post('/ecom/search-products')
  async searchProducts(@Body() data: { keyword: string; offset: number }) {
    console.log('data in controller:', data);
    return await this.productsService.searchProducts(data);
  }

  @Get('/ecom/product-coin')
  async productCoin() {
    return await this.productsService.listFree();
  }

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

  @Get('/ecom/product-cart/:mem_code')
  async getProductCart(@Param('mem_code') mem_code: string) {
    return this.shoppingCartService.getProductCart(mem_code);
  }

  @Get('/ecom/last6/:memCode')
  async getLast6Orders(@Param('memCode') memCode: string): Promise<ShoppingOrderEntity[]> {
    return this.shoppingOrderService.getLast6OrdersByMemberCode(memCode);
  }
  @Get('/ecom/summary-cart/:memCode')
  async getDataFromCart(@Param('memCode') memCode: string): Promise<any> {
    return this.shoppingCartService.getDataFromCart(memCode);
  }
  @Get('/ecom/all-order-member/:memCode')
  async AllOrderByMember(@Param('memCode') memCode: string): Promise<ShoppingHeadEntity[]> {
    return this.shoppingHeadService.AllOrderByMember(memCode);
  }
  @Get('/ecom/some-order-member/:soh_runing')
  async SomeOrderByMember(@Param('soh_runing') soh_runing: string): Promise<ShoppingHeadEntity[]> {
    return this.shoppingHeadService.SomeOrderByMember(soh_runing);
  }

}
