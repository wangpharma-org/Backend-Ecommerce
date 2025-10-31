import { Module } from '@nestjs/common';
import { ImagedebugService } from './imagedebug.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Imagedebug } from './imagedebug.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Imagedebug])],
  exports: [ImagedebugService],
  providers: [ImagedebugService],
})
export class ImagedebugModule {}
