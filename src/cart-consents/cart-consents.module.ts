import { Module } from '@nestjs/common';
// JwtAuthGuard injects FeatureFlagsService — without this module the guard is undefined (500).
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import {
  CartConsentsController,
  CartSessionsController,
} from './cart-consents.controller';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [CartConsentsController, CartSessionsController],
  providers: [CartConsentGatewayService],
  exports: [CartConsentGatewayService],
})
export class CartConsentsModule {}
