import { Module } from '@nestjs/common';
import { ShoppingCartModule } from '../shopping-cart/shopping-cart.module';
import { InternalCustomerCartController } from './internal-customer-cart.controller';
import { InternalCustomerCartService } from './internal-customer-cart.service';

@Module({
  imports: [ShoppingCartModule],
  controllers: [InternalCustomerCartController],
  providers: [InternalCustomerCartService],
})
export class InternalCustomerCartModule {}
