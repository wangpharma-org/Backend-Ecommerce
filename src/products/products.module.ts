import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, ProductPharmaEntity])],
  providers: [ProductsService],
})
export class ProductsModule {}
