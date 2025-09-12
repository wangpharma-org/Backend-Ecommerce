import { Module } from '@nestjs/common';
import { WangdayService } from './wangday.service';
import { WangDay } from './wangday.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { WangdaySumPrice } from './wangdaySumPrice.entity';
import {  ProductEntity } from '../products/products.entity';

@Module({
    imports: [TypeOrmModule.forFeature([WangDay, WangdaySumPrice, ProductEntity])],
    exports: [WangdayService],
    providers: [WangdayService]
})
export class WangdayModule { }
