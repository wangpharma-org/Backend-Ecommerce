import { Module } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteEntity } from './favorite.entity';
import { FavoriteListener } from './favorite.listener';
import { UserEntity } from 'src/users/users.entity';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FavoriteEntity, UserEntity]),
    ProductsModule,
  ],
  providers: [FavoriteService],
  controllers: [FavoriteListener],
  exports: [FavoriteService],
})
export class FavoriteModule {}
