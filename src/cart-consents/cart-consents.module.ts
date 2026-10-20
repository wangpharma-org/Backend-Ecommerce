import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// JwtAuthGuard injects FeatureFlagsService — without this module the guard is undefined (500).
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ShoppingCartModule } from '../shopping-cart/shopping-cart.module';
import { UserEntity } from '../users/users.entity';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import { SaleCartMutationService } from './sale-cart-mutation.service';
import {
  CartConsentsController,
  CartSessionsController,
} from './cart-consents.controller';

@Module({
  imports: [
    FeatureFlagsModule,
    ShoppingCartModule,
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [CartConsentsController, CartSessionsController],
  providers: [CartConsentGatewayService, SaleCartMutationService],
  exports: [CartConsentGatewayService, SaleCartMutationService],
})
export class CartConsentsModule {}
