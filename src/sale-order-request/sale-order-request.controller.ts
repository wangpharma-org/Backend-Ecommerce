import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SaleJwtAuthGuard,
  type AuthenticatedSaleUser,
} from '../auth/sale-jwt-auth.guard';
import { SaleOrderRequestService } from './sale-order-request.service';

function saleCredentials(
  req: Request & { saleUser?: AuthenticatedSaleUser },
  authorization: string | undefined,
): { user: AuthenticatedSaleUser; token: string } {
  const token = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (!req.saleUser || !token) {
    throw new UnauthorizedException('Sale token required');
  }
  return { user: req.saleUser, token };
}

function customerCode(user: unknown): string {
  if (
    typeof user !== 'object' ||
    user === null ||
    !('mem_code' in user) ||
    typeof user.mem_code !== 'string' ||
    !user.mem_code.trim() ||
    'emp_code' in user ||
    'platform_id' in user
  ) {
    throw new UnauthorizedException('Customer token required');
  }
  return user.mem_code.trim();
}

@Controller('ecom/internal/sale/customers/:customerCode')
@UseGuards(SaleJwtAuthGuard)
export class SaleOrderRequestInternalController {
  constructor(private readonly requests: SaleOrderRequestService) {}

  @Get('order-options')
  @Header('Cache-Control', 'no-store')
  options(
    @Param('customerCode') code: string,
    @Req() req: Request & { saleUser?: AuthenticatedSaleUser },
    @Headers('authorization') authorization: string | undefined,
  ) {
    const { token } = saleCredentials(req, authorization);
    return this.requests.options(code.trim(), token);
  }

  @Get('order-requests')
  @Header('Cache-Control', 'no-store')
  list(
    @Param('customerCode') code: string,
    @Req() req: Request & { saleUser?: AuthenticatedSaleUser },
    @Headers('authorization') authorization: string | undefined,
  ) {
    const { token } = saleCredentials(req, authorization);
    return this.requests.listForSale(code.trim(), token);
  }

  @Post('cart-sessions/:sessionId/order-requests')
  @Header('Cache-Control', 'no-store')
  create(
    @Param('customerCode') code: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: Request & { saleUser?: AuthenticatedSaleUser },
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-sale-order-permit') permit: string | undefined,
    @Body() input: unknown,
  ) {
    const { user, token } = saleCredentials(req, authorization);
    return this.requests.create(
      code.trim(),
      sessionId,
      user,
      token,
      permit,
      input,
    );
  }
}

@Controller('ecom/sale-order-requests')
@UseGuards(JwtAuthGuard)
export class SaleOrderRequestCustomerController {
  constructor(private readonly requests: SaleOrderRequestService) {}

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: unknown },
    @Headers('x-sale-order-token') token: string | undefined,
  ) {
    return this.requests.getForCustomer(
      id,
      customerCode(req.user),
      token ?? '',
    );
  }

  @Post(':id/confirm')
  @Header('Cache-Control', 'no-store')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: unknown },
    @Headers('x-sale-order-token') token: string | undefined,
    @Body() body: unknown,
  ) {
    const otp =
      typeof body === 'object' && body !== null && 'otp' in body
        ? body.otp
        : undefined;
    return this.requests.confirm(id, customerCode(req.user), token ?? '', otp);
  }

  @Post(':id/reject')
  @Header('Cache-Control', 'no-store')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: unknown },
    @Headers('x-sale-order-token') token: string | undefined,
  ) {
    return this.requests.reject(id, customerCode(req.user), token ?? '');
  }
}
