import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

export interface SigninResponse {
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signin(data: {
    username: string;
    password: string;
  }): Promise<SigninResponse> {
    console.log('data in auth service:', data);
    const user = await this.userService.findOne(data.username);
    if (user && user.mem_password !== data.password) {
      throw new UnauthorizedException();
    }
    const payload = {
      username: user.mem_username,
      name: user.mem_nameSite ?? '',
      mem_code: user.mem_code ?? '',
      price_option: user.mem_price ?? '',
    };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '12h',
    });
    return { token: access_token };
  }
}
