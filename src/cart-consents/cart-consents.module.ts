import { Module } from '@nestjs/common';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import {
  CartConsentsController,
  CartSessionsController,
} from './cart-consents.controller';

@Module({
  controllers: [CartConsentsController, CartSessionsController],
  providers: [CartConsentGatewayService],
  exports: [CartConsentGatewayService],
})
export class CartConsentsModule {}
