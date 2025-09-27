import { Module } from '@nestjs/common';
import { InvisibleProductService } from './invisible-product.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvisibleEntity } from './invisible-product.entity';
import { ProductEntity } from 'src/products/products.entity';
import { CreditorEntity } from 'src/products/creditor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvisibleEntity, ProductEntity, CreditorEntity]),
  ],
  providers: [InvisibleProductService],
  exports: [InvisibleProductService],
})
export class InvisibleProductModule {}
