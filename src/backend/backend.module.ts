import { Module } from '@nestjs/common';
import { WangdayService } from './wangday.service';
import { WangDay } from './wangday.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { WangdaySumPrice } from './wangdaySumPrice.entity';

@Module({
    imports: [TypeOrmModule.forFeature([WangDay, WangdaySumPrice])],
    exports: [WangdayService],
    providers: [WangdayService]
})
export class BackendModule { }
