import { Module } from '@nestjs/common';
import { HotdealService } from './hotdeal.service';
import { HotdealEntity } from './hotdeal.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from 'src/products/products.module';
import { ShoppingCartModule } from 'src/shopping-cart/shopping-cart.module';

@Module({
  imports: [TypeOrmModule.forFeature([HotdealEntity]), ProductsModule, ShoppingCartModule],
  exports: [HotdealService],
  providers: [HotdealService]
})
export class HotdealModule { }
