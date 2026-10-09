import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

// ECWC-691: callback จาก Order Picking (คืนสินค้าเสร็จ) — ต้องส่ง x-internal-key ตรงกับ RETURN_INTERNAL_API_KEY
@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.RETURN_INTERNAL_API_KEY;
    if (!expected) {
      this.logger.error('RETURN_INTERNAL_API_KEY is not configured');
      throw new UnauthorizedException();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-internal-key'];
    const given = Array.isArray(raw) ? raw[0] : raw;
    if (!given) throw new UnauthorizedException();

    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
