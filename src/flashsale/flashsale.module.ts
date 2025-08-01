import { Module } from '@nestjs/common';
import { FlashsaleService } from './flashsale.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSaleEntity } from './flashsale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FlashSaleEntity])],
  providers: [FlashsaleService],
  exports: [FlashsaleService],
})
export class FlashsaleModule {}
