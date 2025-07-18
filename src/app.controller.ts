import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService, SigninResponse } from './auth/auth.service';
import { ProductsService } from './products/products.service';
import { ShoppingCartService } from './shopping-cart/shopping-cart.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly productsService: ProductsService,
    private readonly shoppingCartService: ShoppingCartService,
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

  @Get('/ecom/product-cart/:mem_code')
  async getProductCart(@Param('mem_code') mem_code: string) {
    return this.shoppingCartService.getProductCart(mem_code);
  }
}
