import { Module } from '@nestjs/common';
import { ChangePasswordService } from './change-password.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangePassword } from './change-password.entity';
import { UsersModule } from 'src/users/users.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TypeOrmModule.forFeature([ChangePassword]), UsersModule, HttpModule],
  providers: [ChangePasswordService],
  exports: [ChangePasswordService],
})
export class ChangePasswordModule {}
