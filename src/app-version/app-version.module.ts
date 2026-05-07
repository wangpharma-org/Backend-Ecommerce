import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppVersionEntity } from './app-version.entity';

@Module({
  providers: [AppVersionService],
  controllers: [AppVersionController],
  imports: [
    TypeOrmModule.forFeature([AppVersionEntity]),
    AuthModule,
    FeatureFlagsModule,
  ],
  exports: [AppVersionService],
})
export class AppVersionModule {}
