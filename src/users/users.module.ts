import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './users.entity';
import { UsersListner } from './users.listener';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersListner],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
