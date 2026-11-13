import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ProductEntity } from '../products/products.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { StockCallbackController } from './stock-callback.controller';
import { StockCallbackRequestEntity } from './stock-callback.entity';
import { StockCallbackService } from './stock-callback.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockCallbackRequestEntity,
      ProductEntity,
      ShoppingCartEntity,
    ]),
    FeatureFlagsModule,
  ],
  controllers: [StockCallbackController],
  providers: [StockCallbackService],
})
export class StockCallbackModule {}
