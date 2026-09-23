import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderBillNumberController } from './order-bill-number.controller';
import { OrderBillNumberEntity } from './order-bill-number.entity';
import { OrderBillNumberService } from './order-bill-number.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderBillNumberEntity])],
  controllers: [OrderBillNumberController],
  providers: [OrderBillNumberService],
  exports: [OrderBillNumberService],
})
export class OrderBillNumberModule {}
