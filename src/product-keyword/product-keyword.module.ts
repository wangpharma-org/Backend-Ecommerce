import { Module } from '@nestjs/common';
import { ProductKeywordService } from './product-keyword.service';
import { ProductEntity } from 'src/products/products.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from 'src/elasticsearch/elasticsearch.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity]), ElasticsearchModule],
  providers: [ProductKeywordService],
  exports: [ProductKeywordService],
})
export class ProductKeywordModule {}
