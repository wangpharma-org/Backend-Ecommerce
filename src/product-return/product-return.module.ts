import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductReturnEntity } from './product-return.entity';
import { ProductReturnItemEntity } from './product-return-item.entity';
import { ProductReturnImageEntity } from './product-return-image.entity';
import { ProductReturnApprovalEntity } from './product-return-approval.entity';
import { ProductReturnService } from './product-return.service';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductReturnEntity,
      ProductReturnItemEntity,
      ProductReturnImageEntity,
      ProductReturnApprovalEntity,
      ShoppingHeadEntity,
      ShoppingOrderEntity,
    ]),
  ],
  providers: [ProductReturnService],
  exports: [ProductReturnService],
})
export class ProductReturnModule {}
