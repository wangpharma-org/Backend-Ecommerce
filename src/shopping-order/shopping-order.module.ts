import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from './shopping-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingOrderEntity])],
  providers: [],
  exports: [],
})
export class ShoppingOrderModule {}
