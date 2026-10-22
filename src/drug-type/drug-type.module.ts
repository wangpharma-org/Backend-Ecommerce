import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ProductEntity } from '../products/products.entity';
import { DrugTypeController } from './drug-type.controller';
import { DrugTypeEntity } from './drug-type.entity';
import { DrugTypeListener } from './drug-type.listener';
import { DrugTypeRewardEntity } from './drug-type-reward.entity';
import { DrugTypeService } from './drug-type.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DrugTypeEntity,
      DrugTypeRewardEntity,
      ProductEntity,
    ]),
    FeatureFlagsModule,
  ],
  controllers: [DrugTypeController, DrugTypeListener],
  providers: [DrugTypeService],
  exports: [DrugTypeService],
})
export class DrugTypeModule {}
