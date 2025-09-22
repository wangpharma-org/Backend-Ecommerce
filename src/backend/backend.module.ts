import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogFileEntity } from './logFile.entity';
import { BackendService } from './backend.service';

@Module({
  imports: [TypeOrmModule.forFeature([LogFileEntity])],
  providers: [BackendService],
  exports: [BackendService],
})
export class BackendModule {}
