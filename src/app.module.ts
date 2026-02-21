import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from './employees/employees.module';
import { ProductsModule } from './products/products.module';
import { ShoppingCartModule } from './shopping-cart/shopping-cart.module';
import { ShoppingOrderModule } from './shopping-order/shopping-order.module';
import { ShoppingHeadModule } from './shopping-head/shopping-head.module';
import { FailedApiModule } from './failed-api/failed-api.module';
import { FavoriteModule } from './favorite/favorite.module';
import { FlashsaleModule } from './flashsale/flashsale.module';
import { BannerModule } from './banner/banner.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PromotionModule } from './promotion/promotion.module';
import { WangdayModule } from './wangday/wangday.module';
import { HotdealModule } from './hotdeal/hotdeal.module';
import { LoggerModule } from './logger/logger.module';
import { BackendModule } from './backend/backend.module';
import { DebtorModule } from './debtor/debtor.module';
import { LotModule } from './lot/lot.module';
import { EditAddressModule } from './edit-address/edit-address.module';
import { ModalmainModule } from './modalmain/modalmain.module';
import { InvisibleProductModule } from './invisible-product/invisible-product.module';
import { NewArrivalsModule } from './new-arrivals/new-arrivals.module';
import { ChangePasswordModule } from './change-password/change-password.module';
import { FixFreeModule } from './fix-free/fix-free.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProductKeywordModule } from './product-keyword/product-keyword.module';
import { RecommendModule } from './recommend/recommend.module';
import { ContractLogModule } from './contract-log/contract-log.module';
import { ImagedebugModule } from './imagedebug/imagedebug.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PolicyDocModule } from './policy-doc/policy-doc.module';
import { AppVersionModule } from './app-version/app-version.module';
import { TrackOrderModule } from './track-order/track-order.module';
import { ProductReturnModule } from './product-return/product-return.module';
import { BehaviorTrackingModule } from './behavior-tracking/behavior-tracking.module';
import { NotifyRtModule } from './notify-rt/notify-rt.module';
import { envValidationSchema } from './env.validation';

@Module({
  imports: [
    AuthModule,
    ScheduleModule.forRoot(),
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('SYNCHRONIZE') ?? false,
        // migrationsRun: true,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),
    EmployeesModule,
    ProductsModule,
    ShoppingCartModule,
    ShoppingOrderModule,
    ShoppingHeadModule,
    FailedApiModule,
    FavoriteModule,
    FlashsaleModule,
    BannerModule,
    FeatureFlagsModule,
    PromotionModule,
    WangdayModule,
    HotdealModule,
    LoggerModule,
    BackendModule,
    DebtorModule,
    LotModule,
    EditAddressModule,
    ModalmainModule,
    InvisibleProductModule,
    NewArrivalsModule,
    ChangePasswordModule,
    FixFreeModule,
    SessionsModule,
    ProductKeywordModule,
    RecommendModule,
    ContractLogModule,
    ImagedebugModule,
    CampaignsModule,
    PolicyDocModule,
    AppVersionModule,
    TrackOrderModule,
    ProductReturnModule,
    BehaviorTrackingModule,
    NotifyRtModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
