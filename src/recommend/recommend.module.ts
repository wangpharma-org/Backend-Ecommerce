import { Module } from '@nestjs/common';
import { RecommendService } from './recommend.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendEntity } from './recommend.entity';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecommendEntity, ProductEntity, UserEntity]),
  ],
  providers: [RecommendService],
  exports: [RecommendService],
})
export class RecommendModule {}
