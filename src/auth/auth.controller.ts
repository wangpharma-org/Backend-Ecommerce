import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('ecom/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('line-login')
  async lineLogin(@Body() body: { lineAccessToken: string }) {
    return this.authService.signinWithLine(body.lineAccessToken);
  }

  @Post('line-login-by-id')
  async lineLoginById(@Body() body: { lineUserId: string }) {
    return this.authService.signinWithLineUserId(body.lineUserId);
  }

  /// ยืนยันตัวตนผ่าน LINE: ผูกบัญชี LINE จากลิงก์ยืนยันตัวตนเข้ากับร้านที่ login อยู่
  /// รหัสร้านอ่านจาก token ของผู้เรียก ไม่รับจาก body — เดิมหน้า LIFF ยิง notification-service ตรง ๆ
  /// พร้อม memCode ที่ browser ส่งเอง ใครก็ผูกบัญชี LINE เข้ากับร้านใดก็ได้
  @Post('line-bind')
  @HttpCode(200)
  async lineBind(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { lineToken?: unknown },
  ) {
    return this.authService.bindLineAccount(authorization, body?.lineToken);
  }
}
