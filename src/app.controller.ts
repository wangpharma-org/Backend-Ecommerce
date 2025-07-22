import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService, SigninResponse } from './auth/auth.service';
import { ProductsService } from './products/products.service';
import { ShoppingCartService } from './shopping-cart/shopping-cart.service';
import { ShoppingOrderService } from './shopping-order/shopping-order.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly productsService: ProductsService,
    private readonly shoppingCartService: ShoppingCartService,
    private readonly shoppingOrderService: ShoppingOrderService,
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

  @Get('/ecom/cart/count/:mem_code')
  async CountCart(@Param('mem_code') mem_code: string) {
    return await this.shoppingCartService.getCartItemCount(mem_code);
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
}
