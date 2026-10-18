import { Module } from '@nestjs/common';
import { InternalCustomerCartController } from './internal-customer-cart.controller';
import { InternalCustomerCartService } from './internal-customer-cart.service';

@Module({
  controllers: [InternalCustomerCartController],
  providers: [InternalCustomerCartService],
})
export class InternalCustomerCartModule {}
