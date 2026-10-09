import {
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
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import { SaleCartMutationService } from './sale-cart-mutation.service';

function customerToken(user: unknown, authorization?: string): string {
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
  const match = /^Bearer (\S+)$/.exec(authorization ?? '');
  if (!match) throw new UnauthorizedException('Customer token required');
  return match[1];
}

@Controller('ecom/cart-consents')
@UseGuards(JwtAuthGuard)
export class CartConsentsController {
  constructor(private readonly gateway: CartConsentGatewayService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization?: string,
  ) {
    const token = customerToken(req.user, authorization);
    return this.gateway.list(token);
  }

  @Post(':id/accept')
  accept(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gateway.action(
      customerToken(req.user, authorization),
      id,
      'accept',
    );
  }

  @Post(':id/reject')
  reject(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gateway.action(
      customerToken(req.user, authorization),
      id,
      'reject',
    );
  }

  @Post(':id/revoke')
  revoke(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gateway.action(
      customerToken(req.user, authorization),
      id,
      'revoke',
    );
  }
}

@Controller('ecom/cart-sessions')
@UseGuards(JwtAuthGuard)
export class CartSessionsController {
  constructor(
    private readonly gateway: CartConsentGatewayService,
    private readonly cartMutations: SaleCartMutationService,
  ) {}

  @Post('write-barrier')
  async writeBarrier(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization?: string,
  ) {
    customerToken(req.user, authorization);
    const user = req.user;
    if (
      typeof user !== 'object' ||
      user === null ||
      !('mem_code' in user) ||
      typeof user.mem_code !== 'string'
    ) {
      throw new UnauthorizedException('Customer token required');
    }
    await this.cartMutations.withCartMutationLock(
      user.mem_code,
      () => Promise.resolve(undefined),
      30,
    );
    return { settled: true };
  }

  @Get('contact')
  @Header('Cache-Control', 'no-store')
  contact(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization?: string,
  ) {
    return this.gateway.getCartContact(customerToken(req.user, authorization));
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization?: string,
  ) {
    return this.gateway.listSessions(customerToken(req.user, authorization));
  }

  @Post(':id/accept')
  accept(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gateway.sessionAction(
      customerToken(req.user, authorization),
      id,
      'accept',
    );
  }

  @Post(':id/reject')
  reject(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gateway.sessionAction(
      customerToken(req.user, authorization),
      id,
      'reject',
    );
  }

  @Post(':id/stop')
  stop(
    @Req() req: Request & { user?: unknown },
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gateway.sessionAction(
      customerToken(req.user, authorization),
      id,
      'stop',
    );
  }
}
