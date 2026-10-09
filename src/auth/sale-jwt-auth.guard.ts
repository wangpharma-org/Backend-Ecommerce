import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedSaleUser {
  empCode: string;
  platformId: string;
}

@Injectable()
export class SaleJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      saleUser?: AuthenticatedSaleUser;
    }>();
    const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '');
    const secret = this.config.get<string>('ACCESS_TOKEN_SECRET');
    if (!match || !secret)
      throw new UnauthorizedException('Sale token required');
    try {
      const payload: unknown = await this.jwtService.verifyAsync(match[1], {
        secret,
        algorithms: ['HS256'],
      });
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('emp_code' in payload) ||
        typeof payload.emp_code !== 'string' ||
        !payload.emp_code.trim() ||
        !('platform_id' in payload) ||
        typeof payload.platform_id !== 'string' ||
        !payload.platform_id.trim() ||
        'mem_code' in payload
      ) {
        throw new UnauthorizedException('Sale token required');
      }
      request.saleUser = {
        empCode: payload.emp_code.trim(),
        platformId: payload.platform_id.trim(),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Sale token required');
    }
  }
}
