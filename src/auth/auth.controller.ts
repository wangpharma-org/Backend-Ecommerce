import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('ecom/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'เข้าสู่ระบบด้วย LINE access token (public)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['lineAccessToken'],
      properties: {
        lineAccessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiJ9.line-access-token-example',
          description: 'Required; not empty; Access token ที่ได้จาก LINE Login',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'เข้าสู่ระบบสำเร็จ คืนค่า token และ refresh_token',
  })
  @ApiResponse({ status: 401, description: 'LINE access token ไม่ถูกต้อง' })
  @Post('line-login')
  async lineLogin(@Body() body: { lineAccessToken: string }) {
    return this.authService.signinWithLine(body.lineAccessToken);
  }

  @ApiOperation({
    summary: 'เข้าสู่ระบบด้วย LINE user id โดยตรง (public)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['lineUserId'],
      properties: {
        lineUserId: {
          type: 'string',
          example: 'U1234567890abcdef1234567890abcdef',
          description: 'Required; not empty; LINE user id ของผู้ใช้',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'เข้าสู่ระบบสำเร็จ คืนค่า token และ refresh_token',
  })
  @ApiResponse({ status: 401, description: 'LINE user id ไม่ถูกต้อง' })
  @Post('line-login-by-id')
  async lineLoginById(@Body() body: { lineUserId: string }) {
    return this.authService.signinWithLineUserId(body.lineUserId);
  }
}
