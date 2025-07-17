import { Module } from '@nestjs/common';
import { ShoppingCartService } from './shopping-cart.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingCartEntity } from './shopping-cart.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingCartEntity])],
  providers: [ShoppingCartService],
})
export class ShoppingCartModule {}
