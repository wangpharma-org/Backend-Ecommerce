import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { jwtConstants } from './constants';
import { MemberLoginBlockService } from 'src/member-login-block/member-login-block.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly loginBlockService: MemberLoginBlockService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  // SSN0-273: ร้านที่ sale ระงับ — token ที่ออกไปก่อนหน้าใช้ไม่ได้ทันที (ไม่ต้องรอหมดอายุ 15 นาที)
  async validate(payload: {
    username: string;
    name: string;
    email: string;
    mem_code: string;
    price_option: string;
    mem_route: string;
  }) {
    await this.loginBlockService.assertNotBlocked(payload.mem_code);
    return payload;
  }
}
