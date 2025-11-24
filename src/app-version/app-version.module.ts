import { Module } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppVersionEntity } from './app-version.entity';

@Module({
  providers: [AppVersionService],
  imports: [TypeOrmModule.forFeature([AppVersionEntity])],
  exports: [AppVersionService],
})
export class AppVersionModule {}
