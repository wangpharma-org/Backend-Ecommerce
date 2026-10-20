import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

// route ที่ service ภายในเรียกกันเอง — ไม่ตั้ง INTERNAL_API_TOKEN = ปิด route ทั้งหมด
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header: unknown = request.headers['x-internal-token'];
    const provided = typeof header === 'string' ? header : '';
    const expected = process.env.INTERNAL_API_TOKEN ?? '';

    if (!expected || !this.isSameToken(provided, expected)) {
      throw new ForbiddenException('Invalid internal token');
    }
    return true;
  }

  private isSameToken(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }
}
