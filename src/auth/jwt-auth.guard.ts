import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { jwtConstants } from './constants';
import { JwtService } from '@nestjs/jwt';

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
      return (await super.canActivate(context)) as boolean;
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
          return (await super.canActivate(context)) as boolean;
        } else {
          throw new ForbiddenException('Insufficient permissions');
        }
      } catch {
        throw new ForbiddenException('Invalid or expired token');
      }
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
