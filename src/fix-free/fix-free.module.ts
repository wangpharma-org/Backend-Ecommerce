import { Module } from '@nestjs/common';
import { FixFreeService } from './fix-free.service';
import { ProductEntity } from 'src/products/products.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [FixFreeService],
  exports: [FixFreeService],
})
export class FixFreeModule {}
