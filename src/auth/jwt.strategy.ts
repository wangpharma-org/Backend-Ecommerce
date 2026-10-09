import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtConstants } from './constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  validate(payload: unknown) {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('mem_code' in payload) ||
      typeof payload.mem_code !== 'string' ||
      !payload.mem_code.trim() ||
      'emp_code' in payload ||
      'platform_id' in payload
    ) {
      throw new UnauthorizedException('Customer token required');
    }
    return payload;
  }
}
