import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { jwtConstants } from './constants';
import { JwtService } from '@nestjs/jwt';
import { REVIEW_SCOPE, isAllowedForReviewScope } from './token-scope';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly jwtService: JwtService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const isEnabled = await this.featureFlagsService.getFlag('all');

    if (isEnabled) {
      const allowed = (await super.canActivate(context)) as boolean;
      this.assertWithinScope(context);
      return allowed;
    } else {
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new ForbiddenException('Missing Authorization token');
      }

      try {
        const payload: { permission: string } =
          await this.jwtService.verifyAsync(token, {
            secret: jwtConstants.secret,
          });

        if (payload.permission) {
          const allowed = (await super.canActivate(context)) as boolean;
          this.assertWithinScope(context);
          return allowed;
        } else {
          throw new ForbiddenException('Insufficient permissions');
        }
      } catch {
        throw new ForbiddenException('Invalid or expired token');
      }
    }
  }

  /// token จากลิงก์รีวิว (ขอบเขต review) ใช้ได้เฉพาะเส้นทางของการรีวิว
  private assertWithinScope(context: ExecutionContext): void {
    const request = context.switchToHttp().getRequest<{
      user?: { scope?: unknown };
      originalUrl?: string;
      url?: string;
    }>();
    if (request.user?.scope !== REVIEW_SCOPE) return;
    if (!isAllowedForReviewScope(request.originalUrl ?? request.url)) {
      throw new ForbiddenException(
        'ลิงก์นี้ใช้ได้เฉพาะการรีวิว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน',
      );
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader =
      typeof request.headers['authorization'] === 'string'
        ? request.headers['authorization']
        : undefined;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
