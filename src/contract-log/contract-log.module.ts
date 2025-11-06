import { Module } from '@nestjs/common';
import { ContractLogService } from './contract-log.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractLogBanner } from './contract-log-banner.entity';
import { ContractLogPerson } from './contract-log-person.entity';
import { ContractLogUpload } from './contract-log-upload.entity';
import { ContractLog } from './contract-log.entity';
import { ProductsModule } from 'src/products/products.module';
// import { ContractLogController } from './contract-log.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractLogBanner,
      ContractLogPerson,
      ContractLogUpload,
      ContractLog,
    ]),
    ProductsModule,
  ],
  providers: [ContractLogService],
  exports: [ContractLogService],
})
export class ContractLogModule {}
