import { Module } from '@nestjs/common';
import { ProductKeywordService } from './product-keyword.service';
import { ProductEntity } from 'src/products/products.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [ProductKeywordService],
  exports: [ProductKeywordService]
})
export class ProductKeywordModule {}
