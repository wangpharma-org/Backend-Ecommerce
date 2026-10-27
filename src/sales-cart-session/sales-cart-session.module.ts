import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { SalesCartSessionController } from './sales-cart-session.controller';
import { SalesCartSessionService } from './sales-cart-session.service';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [SalesCartSessionController],
  providers: [SalesCartSessionService],
})
export class SalesCartSessionModule {}
