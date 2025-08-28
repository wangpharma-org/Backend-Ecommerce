import { Module } from '@nestjs/common';
import { ShoppingHeadService } from './shopping-head.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
// import { ProductsService } from '../products/products.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingHeadEntity]), ProductsModule],
  providers: [ShoppingHeadService],
  exports: [ShoppingHeadService],
})
export class ShoppingHeadModule {}
