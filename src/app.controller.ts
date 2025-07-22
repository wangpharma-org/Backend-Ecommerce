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
import { ProductEntity } from './products/products.entity';

interface GroupedDetail {
  pro_code: string;
  product: any;
  items: {
    spo_id: number;
    spo_qty: string;
    spo_unit: string;
    spo_price_unit: string;
    spo_total_decimal: string;
  }[];
}

interface FormattedOrderDto extends Omit<ShoppingHeadEntity, 'details'> {
  details: GroupedDetail[];
}
interface ProductEntityUnit {
  pro_code: string;
  pro_name: string;
  Unit1: { unit: string; ratio: number };
  Unit2: { unit: string; ratio: number };
  Unit3: { unit: string; ratio: number };
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
  ) { }

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
      listFree: [{ pro_code: string; amount: number; unit: string }] | null;
      priceOption: string;
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

  @Get('/ecom/last6/:memCode')
  async getLast6Orders(@Param('memCode') memCode: string): Promise<ShoppingOrderEntity[]> {
    return this.shoppingOrderService.getLast6OrdersByMemberCode(memCode);
  }
  @Get('/ecom/summary-cart/:memCode')
  async getDataFromCart(@Param('memCode') memCode: string): Promise<any> {
    return this.shoppingCartService.getDataFromCart(memCode);
  }
  @Get('/ecom/all-order-member/:memCode')
  async AllOrderByMember(@Param('memCode') memCode: string): Promise<AllOrderByMemberRes> {
    return this.shoppingHeadService.AllOrderByMember(memCode);
  }
  @Get('/ecom/some-order/:soh_runing')
  async SomeOrderByMember(@Param('soh_runing') soh_runing: string): Promise<ShoppingHeadEntity> {
    return this.shoppingHeadService.SomeOrderByMember(soh_runing);
  }

  // @Get('/ecom/format-order/:pro_code')
  // async ShowUnitProduct(@Param('pro_code') pro_code: string): Promise<ProductEntityUnit> {
  //   return this.productsService.ShowUnitProduct(pro_code);
  // }

}
