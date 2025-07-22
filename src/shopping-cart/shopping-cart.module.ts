import { Module } from '@nestjs/common';
import { ShoppingCartService } from './shopping-cart.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingCartEntity]), ProductsModule],
  providers: [ShoppingCartService],
  exports: [ShoppingCartService],
})
export class ShoppingCartModule {}
