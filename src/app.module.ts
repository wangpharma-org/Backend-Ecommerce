import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from './employees/employees.module';
import { MembersService } from './members/members.service';
import { MembersModule } from './members/members.module';
import { ProductsModule } from './products/products.module';
import { ShoppingCartModule } from './shopping-cart/shopping-cart.module';
import { ShoppingOrderService } from './shopping-order/shopping-order.service';
import { ShoppingOrderModule } from './shopping-order/shopping-order.module';
import { ShoppingHeadModule } from './shopping-head/shopping-head.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
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
        synchronize: true,
      }),
    }),
    EmployeesModule,
    MembersModule,
    ProductsModule,
    ShoppingCartModule,
    ShoppingOrderModule,
    ShoppingHeadModule,
  ],
  controllers: [AppController],
  providers: [AppService, MembersService, ShoppingOrderService],
})
export class AppModule {}
