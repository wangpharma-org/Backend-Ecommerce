import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import type { AuthenticatedSaleUser } from '../auth/sale-jwt-auth.guard';
import { CartConsentGatewayService } from '../cart-consents/cart-consent-gateway.service';
import { isRecord } from '../cart-consents/cart-mutation.types';
import { SaleCartMutationService } from '../cart-consents/sale-cart-mutation.service';
import { EditAddress } from '../edit-address/edit-address.entity';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { UserEntity } from '../users/users.entity';
import {
  SaleOrderRequestEntity,
  SaleOrderRequestStatus,
  type SaleOrderAddressSnapshot,
} from './sale-order-request.entity';
import {
  parseSaleOrderRequestInput,
  SALE_ORDER_PAYMENT_OPTIONS,
  SALE_ORDER_SHIPPING_OPTIONS,
  type SaleOrderRequestInput,
} from './sale-order-request.types';

const REQUEST_MS = 15 * 60 * 1000;

@Injectable()
export class SaleOrderRequestService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly gateway: CartConsentGatewayService,
    private readonly cartMutations: SaleCartMutationService,
    private readonly cart: ShoppingCartService,
    @InjectRepository(SaleOrderRequestEntity)
    private readonly requests: Repository<SaleOrderRequestEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(EditAddress)
    private readonly addresses: Repository<EditAddress>,
  ) {}

  async options(customerCode: string, saleToken: string) {
    await this.gateway.assertSalespersonCartRead(saleToken, customerCode);
    const addresses = await this.addresses.find({
      where: { user: { mem_code: customerCode } },
      relations: { user: true },
    });
    return {
      addresses: addresses.map((address) => this.addressSnapshot(address)),
      shippingOptions: [...SALE_ORDER_SHIPPING_OPTIONS],
      paymentOptions: [...SALE_ORDER_PAYMENT_OPTIONS],
    };
  }

  async listForSale(customerCode: string, saleToken: string) {
    await this.gateway.assertSalespersonCartRead(saleToken, customerCode);
    const requests = await this.requests.find({
      where: { customerCode },
      order: { createdAt: 'DESC' },
      take: 30,
    });
    return Promise.all(requests.map((request) => this.summary(request)));
  }

  async create(
    customerCode: string,
    sessionId: string,
    saleUser: AuthenticatedSaleUser,
    saleToken: string,
    permit: string | undefined,
    raw: unknown,
  ) {
    const input = parseSaleOrderRequestInput(raw);
    await this.assertPermit(customerCode, sessionId, saleUser, input, permit);
    return this.cartMutations.withCartMutationLock(
      customerCode,
      async () => {
        await this.assertPermit(
          customerCode,
          sessionId,
          saleUser,
          input,
          permit,
        );
        await this.gateway.assertSalespersonOrderRequest(
          saleToken,
          customerCode,
          sessionId,
        );
        const member = await this.users.findOne({
          where: { mem_code: customerCode },
          select: { mem_code: true, mem_price: true },
        });
        if (!member) throw new NotFoundException('Customer not found');
        const address = await this.addresses.findOne({
          where: { id: input.addressId, user: { mem_code: customerCode } },
          relations: { user: true },
        });
        if (!address) throw new BadRequestException('Address not found');
        const snapshot = await this.cart.getSaleCartSnapshot(customerCode);
        if (snapshot.cartVersion !== input.expectedCartVersion) {
          throw new ConflictException('Cart changed; refresh and try again');
        }
        if (
          !snapshot.cart.some((product) => product.shopping_cart.length > 0)
        ) {
          throw new BadRequestException('Cart is empty');
        }
        const total = Number((await this.cart.summaryCart(customerCode)).total);
        if (!Number.isFinite(total) || total <= 0) {
          throw new BadRequestException('Cart total is invalid');
        }
        const pending = await this.requests.find({
          where: {
            customerCode,
            status: SaleOrderRequestStatus.PENDING,
          },
        });
        for (const previous of pending) {
          if (previous.expiresAt <= new Date()) {
            previous.status = SaleOrderRequestStatus.EXPIRED;
            await this.requests.save(previous);
            continue;
          }
          if (
            previous.sessionId === sessionId &&
            previous.salespersonCode === saleUser.empCode &&
            previous.cartVersion === input.expectedCartVersion &&
            previous.addressSnapshot.id === input.addressId &&
            previous.shippingOption === input.shippingOption &&
            previous.paymentOption === input.paymentOption
          ) {
            return this.internalResponse(previous);
          }
          throw new ConflictException('A pending order already exists');
        }
        const request = await this.requests.save(
          this.requests.create({
            customerCode,
            salespersonCode: saleUser.empCode,
            sessionId,
            status: SaleOrderRequestStatus.PENDING,
            cartVersion: input.expectedCartVersion,
            cartSnapshot: snapshot,
            addressSnapshot: this.addressSnapshot(address),
            priceOption: member.mem_price || 'C',
            shippingOption: input.shippingOption,
            paymentOption: input.paymentOption,
            quotedTotal: total.toFixed(2),
            otpAttempts: 0,
            notifiedAt: null,
            expiresAt: new Date(Date.now() + REQUEST_MS),
            confirmedOrderNumbers: null,
          }),
        );
        return this.internalResponse(request);
      },
      1,
    );
  }

  async getForCustomer(id: string, customerCode: string, token: string) {
    const request = await this.findForCustomer(id, customerCode, token);
    return this.review(request);
  }

  async reject(id: string, customerCode: string, token: string) {
    const request = await this.findForCustomer(id, customerCode, token);
    if (request.status !== SaleOrderRequestStatus.PENDING) {
      throw new ConflictException('Order request is no longer pending');
    }
    const result = await this.requests.update(
      { id, status: SaleOrderRequestStatus.PENDING },
      { status: SaleOrderRequestStatus.REJECTED },
    );
    if (result.affected !== 1) {
      throw new ConflictException('Order request has changed');
    }
    request.status = SaleOrderRequestStatus.REJECTED;
    return this.review(request);
  }

  private async findForCustomer(
    id: string,
    customerCode: string,
    token: string,
  ): Promise<SaleOrderRequestEntity> {
    const request = await this.requests.findOne({
      where: { id, customerCode },
    });
    if (!request || !this.matches(token, this.reviewToken(request))) {
      throw new NotFoundException('Order request not found');
    }
    if (
      request.status === SaleOrderRequestStatus.PENDING &&
      request.expiresAt <= new Date()
    ) {
      await this.requests.update(
        { id, status: SaleOrderRequestStatus.PENDING },
        { status: SaleOrderRequestStatus.EXPIRED },
      );
      request.status = SaleOrderRequestStatus.EXPIRED;
    }
    return request;
  }

  private async summary(request: SaleOrderRequestEntity) {
    if (
      request.status === SaleOrderRequestStatus.PENDING &&
      request.expiresAt <= new Date()
    ) {
      await this.requests.update(
        { id: request.id, status: SaleOrderRequestStatus.PENDING },
        { status: SaleOrderRequestStatus.EXPIRED },
      );
      request.status = SaleOrderRequestStatus.EXPIRED;
    }
    return {
      id: request.id,
      status: request.status,
      expiresAt: request.expiresAt.toISOString(),
      quotedTotal: request.quotedTotal,
      confirmedOrderNumbers: request.confirmedOrderNumbers,
    };
  }

  private async internalResponse(request: SaleOrderRequestEntity) {
    return {
      ...(await this.summary(request)),
      reviewToken: this.reviewToken(request),
      otp: this.otp(request),
    };
  }

  private review(request: SaleOrderRequestEntity) {
    return {
      id: request.id,
      status: request.status,
      expiresAt: request.expiresAt.toISOString(),
      cartSnapshot: request.cartSnapshot,
      addressSnapshot: request.addressSnapshot,
      shippingOption: request.shippingOption,
      paymentOption: request.paymentOption,
      quotedTotal: request.quotedTotal,
      confirmedOrderNumbers: request.confirmedOrderNumbers,
    };
  }

  private addressSnapshot(address: EditAddress): SaleOrderAddressSnapshot {
    return {
      id: address.id,
      name: address.name,
      fullName: address.fullName,
      mem_address: address.mem_address,
      mem_village: address.mem_village,
      mem_alley: address.mem_alley,
      mem_road: address.mem_road,
      mem_tumbon: address.mem_tumbon,
      mem_amphur: address.mem_amphur,
      mem_province: address.mem_province,
      mem_post: address.mem_post,
      phoneNumber: address.phoneNumber,
      Note: address.Note ?? null,
    };
  }

  private reviewToken(request: SaleOrderRequestEntity): string {
    return this.digest(
      `sale-order-link:v1:${request.id}:${request.customerCode}`,
    ).toString('base64url');
  }

  private otp(request: SaleOrderRequestEntity): string {
    const digest = this.digest(
      `sale-order-otp:v1:${request.id}:${request.expiresAt.toISOString()}`,
    );
    return String(digest.readUInt32BE(0) % 1000000).padStart(6, '0');
  }

  private digest(value: string): Buffer {
    const secret = this.config.get<string>('ACCESS_TOKEN_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Order confirmation is not configured',
      );
    }
    return createHmac('sha256', secret).update(value).digest();
  }

  private matches(value: string, expected: string): boolean {
    const actual = Buffer.from(value);
    const target = Buffer.from(expected);
    return actual.length === target.length && timingSafeEqual(actual, target);
  }

  private async assertPermit(
    customerCode: string,
    sessionId: string,
    saleUser: AuthenticatedSaleUser,
    input: SaleOrderRequestInput,
    permit: string | undefined,
  ): Promise<void> {
    const secret = this.config.get<string>('ACCESS_TOKEN_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Order confirmation is not configured',
      );
    }
    if (!permit) throw new ForbiddenException('Order permit required');
    try {
      const claims: unknown = await this.jwt.verifyAsync(permit, {
        secret,
        algorithms: ['HS256'],
        audience: 'ecom-sale-order',
        issuer: 'sale-service',
      });
      if (
        !isRecord(claims) ||
        claims.purpose !== 'sale-order-request' ||
        claims.customerCode !== customerCode ||
        claims.sessionId !== sessionId ||
        claims.salespersonCode !== saleUser.empCode ||
        JSON.stringify(parseSaleOrderRequestInput(claims.input)) !==
          JSON.stringify(input)
      ) {
        throw new ForbiddenException('Order permit mismatch');
      }
    } catch {
      throw new ForbiddenException('Order permit invalid');
    }
  }
}
