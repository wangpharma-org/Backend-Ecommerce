import { Module } from '@nestjs/common';
import { LineSupportService } from './line-support.service';

@Module({
  providers: [LineSupportService],
  exports: [LineSupportService],
})
export class LineSupportModule {}
