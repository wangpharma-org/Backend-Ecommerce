import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartConsentsModule } from '../cart-consents/cart-consents.module';
import { EditAddress } from '../edit-address/edit-address.entity';
import { ShoppingCartModule } from '../shopping-cart/shopping-cart.module';
import { ShoppingOrderModule } from '../shopping-order/shopping-order.module';
import { UserEntity } from '../users/users.entity';
import {
  SaleOrderRequestCustomerController,
  SaleOrderRequestInternalController,
} from './sale-order-request.controller';
import { SaleOrderRequestEntity } from './sale-order-request.entity';
import { SaleOrderRequestService } from './sale-order-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleOrderRequestEntity, UserEntity, EditAddress]),
    CartConsentsModule,
    ShoppingCartModule,
    ShoppingOrderModule,
  ],
  controllers: [
    SaleOrderRequestInternalController,
    SaleOrderRequestCustomerController,
  ],
  providers: [SaleOrderRequestService],
  exports: [SaleOrderRequestService],
})
export class SaleOrderRequestModule {}
