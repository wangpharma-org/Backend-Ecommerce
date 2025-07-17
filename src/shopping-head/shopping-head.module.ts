import { Module } from '@nestjs/common';
import { ShoppingHeadService } from './shopping-head.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingHeadEntity])],
  providers: [ShoppingHeadService],
})
export class ShoppingHeadModule {}
