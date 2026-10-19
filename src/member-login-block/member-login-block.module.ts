import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { SessionsModule } from '../sessions/sessions.module';
import { RefreshTokenEntity } from '../auth/refresh-token.entity';
import { UserEntity } from '../users/users.entity';
import { MemberLoginBlockEntity } from './member-login-block.entity';
import { MemberLoginBlockLogEntity } from './member-login-block-log.entity';
import { MemberLoginBlockService } from './member-login-block.service';
import { MemberLoginBlockController } from './member-login-block.controller';

// AuthModule import module นี้ (JwtStrategy + ทางออก token) — ห้าม import AuthModule กลับ
@Module({
  imports: [
    FeatureFlagsModule,
    SessionsModule,
    TypeOrmModule.forFeature([
      MemberLoginBlockEntity,
      MemberLoginBlockLogEntity,
      UserEntity,
      RefreshTokenEntity,
    ]),
  ],
  providers: [MemberLoginBlockService],
  controllers: [MemberLoginBlockController],
  exports: [MemberLoginBlockService],
})
export class MemberLoginBlockModule {}
