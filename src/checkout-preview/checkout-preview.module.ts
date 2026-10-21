import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { ShoppingCartModule } from 'src/shopping-cart/shopping-cart.module';
import { HappyHourModule } from 'src/happy-hour/happy-hour.module';
import { FixFreeModule } from 'src/fix-free/fix-free.module';
import { CheckoutPreviewController } from './checkout-preview.controller';
import { CheckoutPreviewService } from './checkout-preview.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity]),
    ShoppingCartModule,
    HappyHourModule,
    FixFreeModule,
  ],
  controllers: [CheckoutPreviewController],
  providers: [CheckoutPreviewService],
})
export class CheckoutPreviewModule {}
