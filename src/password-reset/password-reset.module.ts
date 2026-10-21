import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/users.entity';
import { EmployeeEntity } from '../employees/employees.entity';
import { RefreshTokenEntity } from '../auth/refresh-token.entity';
import { SessionsModule } from '../sessions/sessions.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { PasswordResetRequestEntity } from './password-reset-request.entity';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetController } from './password-reset.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PasswordResetRequestEntity,
      UserEntity,
      EmployeeEntity,
      RefreshTokenEntity,
    ]),
    SessionsModule,
    FeatureFlagsModule,
  ],
  providers: [PasswordResetService],
  controllers: [PasswordResetController],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
