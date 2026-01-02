import { Module } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteEntity } from './favorite.entity';
import { FavoriteListener } from './favorite.listener';
import { UserEntity } from 'src/users/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FavoriteEntity, UserEntity])],
  providers: [FavoriteService],
  controllers: [FavoriteListener],
  exports: [FavoriteService],
})
export class FavoriteModule {}
