import { Module } from '@nestjs/common';
import { FlashsaleService } from './flashsale.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSaleEntity } from './flashsale.entity';
import { FlashSaleProductsEntity } from './flashsale-product.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { UserEntity } from 'src/users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FlashSaleEntity,
      FlashSaleProductsEntity,
      ShoppingCartEntity,
      UserEntity,
    ]),
  ],
  providers: [FlashsaleService],
  exports: [FlashsaleService],
})
export class FlashsaleModule {}
