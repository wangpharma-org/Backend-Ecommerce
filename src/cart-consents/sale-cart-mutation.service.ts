import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ShoppingCartService,
  type SaleCartSnapshot,
} from '../shopping-cart/shopping-cart.service';
import { UserEntity } from '../users/users.entity';
import type { AuthenticatedSaleUser } from '../auth/sale-jwt-auth.guard';
import {
  isRecord,
  parseCartMutation,
  type CartMutation,
} from './cart-mutation.types';
import { CartConsentGatewayService } from './cart-consent-gateway.service';

@Injectable()
export class SaleCartMutationService {
  private readonly logger = new Logger(SaleCartMutationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly cart: ShoppingCartService,
    private readonly consentGateway: CartConsentGatewayService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async mutate(
    customerCode: string,
    sessionId: string,
    saleUser: AuthenticatedSaleUser,
    permit: string | undefined,
    authorization: string | undefined,
    raw: unknown,
  ): Promise<SaleCartSnapshot> {
    const mutation = parseCartMutation(raw);
    await this.assertPermit(
      customerCode,
      sessionId,
      saleUser,
      permit,
      mutation,
    );
    return this.withCartMutationLock(
      customerCode,
      async () => {
        await this.assertPermit(
          customerCode,
          sessionId,
          saleUser,
          permit,
          mutation,
        );
        const saleToken = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
        if (!saleToken) throw new ForbiddenException('Sale token required');
        await this.consentGateway.assertSalespersonCartMutation(
          saleToken,
          customerCode,
          sessionId,
        );
        const member = await this.users.findOne({
          where: { mem_code: customerCode },
          select: { mem_code: true, mem_price: true, mem_route: true },
        });
        if (!member) throw new NotFoundException('Customer not found');
        const current = await this.cart.getSaleCartSnapshot(customerCode);
        if (current.cartVersion !== mutation.expectedCartVersion) {
          throw new ConflictException('Cart changed; refresh and try again');
        }
        if (mutation.kind === 'ADD_PRODUCT') {
          if (
            current.cart.some(
              (item) =>
                item.pro_code === mutation.proCode &&
                item.shopping_cart.some(
                  (line) => line.editable && line.spc_unit === mutation.unit,
                ),
            )
          ) {
            throw new ConflictException(
              'Product already exists; change its quantity instead',
            );
          }
          await this.cart.addProductCart({
            mem_code: customerCode,
            pro_code: mutation.proCode,
            pro_unit: mutation.unit,
            amount: mutation.quantity,
            priceCondition: member.mem_price || 'C',
            mem_route: member.mem_route || undefined,
            clientVersion: mutation.expectedCartVersion,
            ordinaryOnly: true,
            newLineOnly: true,
          });
        } else if (mutation.kind === 'CHANGE_QUANTITY') {
          const product = current.cart.find(
            (item) => item.pro_code === mutation.proCode,
          );
          const matching =
            product?.shopping_cart.filter(
              (line) =>
                line.editable &&
                line.spc_id === mutation.lineId &&
                line.spc_unit === mutation.unit,
            ) ?? [];
          const sameUnit =
            product?.shopping_cart.filter(
              (line) => line.editable && line.spc_unit === mutation.unit,
            ) ?? [];
          if (matching.length !== 1 || sameUnit.length !== 1) {
            throw new ConflictException(
              'Cart line changed; refresh and try again',
            );
          }
          const existingQuantity = Number(matching[0].spc_amount);
          if (!Number.isFinite(existingQuantity) || existingQuantity <= 0) {
            throw new ConflictException('Cart line quantity is invalid');
          }
          const delta = mutation.quantity - existingQuantity;
          if (delta !== 0) {
            await this.cart.addProductCart({
              mem_code: customerCode,
              pro_code: mutation.proCode,
              pro_unit: mutation.unit,
              amount: delta,
              priceCondition: member.mem_price || 'C',
              mem_route: member.mem_route || undefined,
              clientVersion: mutation.expectedCartVersion,
              ordinaryOnly: true,
            });
          }
        } else {
          const product = current.cart.find(
            (item) => item.pro_code === mutation.proCode,
          );
          if (!product?.shopping_cart.some((line) => line.editable)) {
            throw new ConflictException(
              'Cart product changed; refresh and try again',
            );
          }
          await this.cart.handleDeleteCart({
            mem_code: customerCode,
            pro_code: mutation.proCode,
            priceOption: member.mem_price || 'C',
            clientVersion: mutation.expectedCartVersion,
            ordinaryOnly: true,
          });
        }
        return this.cart.getSaleCartSnapshot(customerCode);
      },
      1,
    );
  }

  async withCartMutationLock<T>(
    customerCode: string,
    operation: () => Promise<T>,
    waitSeconds = 30,
  ): Promise<T> {
    const code = customerCode.trim();
    if (!code || code.length > 30)
      throw new ForbiddenException('Invalid customer cart');
    const lockName = `ecom-cart:${code}`;
    const runner = this.dataSource.createQueryRunner();
    let acquired = false;
    try {
      await runner.connect();
      const result: unknown = await runner.query(
        'SELECT GET_LOCK(?, ?) AS acquired',
        [lockName, waitSeconds],
      );
      acquired =
        Array.isArray(result) &&
        isRecord(result[0]) &&
        (result[0].acquired === 1 || result[0].acquired === '1');
      if (!acquired)
        throw new ConflictException('Cart is busy; refresh and try again');
      return await operation();
    } finally {
      if (acquired) {
        try {
          await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
        } catch (error: unknown) {
          this.logger.warn(
            `Cart lock release failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }
      await runner.release();
    }
  }

  private async assertPermit(
    customerCode: string,
    sessionId: string,
    saleUser: AuthenticatedSaleUser,
    permit: string | undefined,
    mutation: CartMutation,
  ): Promise<void> {
    const secret = this.config.get<string>('ACCESS_TOKEN_SECRET')?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        'Sale cart authorization is not configured',
      );
    if (!permit) throw new ForbiddenException('Sale cart permit required');
    try {
      const claims: unknown = await this.jwt.verifyAsync(permit, {
        secret,
        algorithms: ['HS256'],
        audience: 'ecom-sale-cart',
        issuer: 'sale-service',
      });
      if (
        !isRecord(claims) ||
        claims.purpose !== 'sale-cart-mutation' ||
        claims.customerCode !== customerCode ||
        claims.sessionId !== sessionId ||
        claims.salespersonCode !== saleUser.empCode ||
        JSON.stringify(parseCartMutation(claims.mutation)) !==
          JSON.stringify(mutation)
      ) {
        throw new ForbiddenException('Sale cart permit mismatch');
      }
    } catch {
      throw new ForbiddenException('Sale cart permit invalid');
    }
  }
}
