import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { jwtConstants } from './constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/users.entity';
import { HttpModule } from '@nestjs/axios';
import { RefreshTokenEntity } from './refresh-token.entity';
import { EmployeesModule } from 'src/employees/employees.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity]),
    UsersModule,
    HttpModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
    }),
    EmployeesModule,
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
