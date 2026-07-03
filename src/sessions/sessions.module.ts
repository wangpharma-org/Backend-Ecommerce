import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionsEntity } from './sessions.entity';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSessionsEntity]),
    FeatureFlagsModule,
  ],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
