import { Module } from '@nestjs/common';
import { NewArrivalsService } from './new-arrivals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewArrival } from './new-arrival.entity';
import { ProductsModule } from 'src/products/products.module';
import { UserEntity } from 'src/users/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewArrival, UserEntity]), ProductsModule],
  providers: [NewArrivalsService],
  exports: [NewArrivalsService],
})
export class NewArrivalsModule {}
