import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { UserEntity } from '../users/users.entity';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { CustomerReturnController } from './customer-return.controller';
import { CustomerReturnService } from './customer-return.service';
import { CustomerReturnClient } from './customer-return.client';
import { InternalKeyGuard } from './internal-key.guard';

// ECWC-691: แยกจาก src/product-return เดิม (flow อนุมัติ sales/manager ที่ไม่ได้ใช้)
// ข้อมูลจริงอยู่ที่ Order Picking — โมดูลนี้ไม่มี entity ของตัวเอง
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    HttpModule,
    FeatureFlagsModule,
  ],
  controllers: [CustomerReturnController],
  providers: [CustomerReturnService, CustomerReturnClient, InternalKeyGuard],
})
export class CustomerReturnModule {}
