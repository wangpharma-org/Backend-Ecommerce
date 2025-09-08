import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ProductListner } from './product.listener';
import { CreditorEntity } from './creditor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductPharmaEntity,
      CreditorEntity,
    ]),
  ],
  providers: [ProductsService],
  controllers: [ProductListner],
  exports: [ProductsService],
})
export class ProductsModule {}
