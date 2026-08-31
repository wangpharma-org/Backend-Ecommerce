import { Module } from '@nestjs/common';
import { FixFreeService } from './fix-free.service';
import { ProductEntity } from 'src/products/products.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedeemProductBackupEntity } from './redeem-product-backup.entity';
import { RedeemSettingsEntity } from './redeem-settings.entity';
import { RedeemProductSetService } from './redeem-product-set.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      RedeemSettingsEntity,
      RedeemProductBackupEntity,
    ]),
  ],
  providers: [FixFreeService, RedeemProductSetService],
  exports: [FixFreeService, RedeemProductSetService],
})
export class FixFreeModule {}
