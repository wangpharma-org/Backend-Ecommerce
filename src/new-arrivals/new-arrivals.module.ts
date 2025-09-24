import { Module } from '@nestjs/common';
import { NewArrivalsService } from './new-arrivals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewArrival } from './new-arrival.entity';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([NewArrival]), ProductsModule],
  providers: [NewArrivalsService],
  exports: [NewArrivalsService],
})
export class NewArrivalsModule {}
