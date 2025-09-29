import { Module } from '@nestjs/common';
import { ModalContentService } from './modalmain.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modalmain } from './modalmain.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Modalmain])],
  providers: [ModalContentService],
  exports: [ModalContentService],
})
export class ModalmainModule {}
