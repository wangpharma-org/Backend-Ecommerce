import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionsEntity } from './sessions.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserSessionsEntity])],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
