import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService, SigninResponse } from './auth/auth.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
  ) {}

  @Post('/ecom/login')
  async signin(
    @Body() data: { username: string; password: string },
  ): Promise<SigninResponse> {
    console.log('data in controller:', data);
    return await this.authService.signin(data);
  }
}
