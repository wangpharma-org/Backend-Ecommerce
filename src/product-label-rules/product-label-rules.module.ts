import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ProductLabelRuleEntity } from './product-label-rule.entity';
import { ProductLabelRulesController } from './product-label-rules.controller';
import { ProductLabelRulesService } from './product-label-rules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductLabelRuleEntity]),
    AuthModule,
    FeatureFlagsModule,
  ],
  controllers: [ProductLabelRulesController],
  providers: [ProductLabelRulesService],
  exports: [ProductLabelRulesService],
})
export class ProductLabelRulesModule {}
