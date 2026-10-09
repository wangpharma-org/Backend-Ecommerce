import { Module } from '@nestjs/common';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import { CartConsentsController } from './cart-consents.controller';

@Module({
  controllers: [CartConsentsController],
  providers: [CartConsentGatewayService],
  exports: [CartConsentGatewayService],
})
export class CartConsentsModule {}
