import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('ecom/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('line-login')
  async lineLogin(@Body() body: { lineAccessToken: string }) {
    return this.authService.signinWithLine(body.lineAccessToken);
  }
}
