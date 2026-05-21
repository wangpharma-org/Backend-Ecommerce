import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import * as request from 'supertest';
import { HappyHourController } from './happy-hour.controller';
import { HappyHourService } from './happy-hour.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

/**
 * HappyHourController tests
 * - Unit-style: mock HappyHourService + override JwtAuthGuard
 * - ครอบคลุม routing, DTO validation pipe ที่ controller ใช้, transform/whitelist
 *   ดู BUG_REPORT.md
 */
describe('HappyHourController', () => {
  let app: INestApplication;
  let service: jest.Mocked<HappyHourService>;

  const fakeUser = {
    username: 'admin1',
    name: 'Admin One',
    email: 'a@b.com',
    mem_code: 'M01',
  };

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<HappyHourService>> = {
      getConfig: jest.fn(),
      toggle: jest.fn(),
      getSlots: jest.fn(),
      createSlot: jest.fn(),
      updateSlot: jest.fn(),
      deleteSlot: jest.fn(),
      simulate: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HappyHourController],
      providers: [
        { provide: HappyHourService, useValue: serviceMock },
        {
          provide: APP_PIPE,
          useFactory: () =>
            new ValidationPipe({
              whitelist: true,
              forbidNonWhitelisted: true,
              transform: true,
            }),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = fakeUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    service = moduleRef.get(HappyHourService) as jest.Mocked<HappyHourService>;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /admin/happy-hour/config', () => {
    it('returns config from service', async () => {
      const config = { id: 1, is_enabled: true } as any;
      service.getConfig.mockResolvedValueOnce(config);

      await request(app.getHttpServer())
        .get('/admin/happy-hour/config')
        .expect(200)
        .expect(config);
    });
  });

  describe('PATCH /admin/happy-hour/toggle', () => {
    it('toggles using authenticated username', async () => {
      service.toggle.mockResolvedValueOnce({ id: 1, is_enabled: false } as any);

      await request(app.getHttpServer())
        .patch('/admin/happy-hour/toggle')
        .expect(200);

      expect(service.toggle).toHaveBeenCalledWith('admin1');
    });
  });

  describe('GET /admin/happy-hour/slots', () => {
    it('returns slot list', async () => {
      service.getSlots.mockResolvedValueOnce([{ id: 1 } as any]);
      await request(app.getHttpServer())
        .get('/admin/happy-hour/slots')
        .expect(200)
        .expect([{ id: 1 }]);
    });
  });

  describe('POST /admin/happy-hour/slots', () => {
    const validBody = {
      start_time: '10:00',
      end_time: '12:00',
      min_order_amount: 1000,
      card_value: 100,
      excess_threshold: 500,
      discount_per_step: 10,
    };

    it('creates slot with valid body', async () => {
      service.createSlot.mockResolvedValueOnce({ id: 1, ...validBody } as any);
      await request(app.getHttpServer())
        .post('/admin/happy-hour/slots')
        .send(validBody)
        .expect(201);
      expect(service.createSlot).toHaveBeenCalledWith(
        expect.objectContaining(validBody),
      );
    });

    it('rejects missing required fields', async () => {
      const { start_time, ...partial } = validBody;
      await request(app.getHttpServer())
        .post('/admin/happy-hour/slots')
        .send(partial)
        .expect(400);
    });

    it('rejects extra non-whitelisted fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/admin/happy-hour/slots')
        .send({ ...validBody, foo: 'bar' })
        .expect(400);
    });

    it('rejects bad time format', async () => {
      await request(app.getHttpServer())
        .post('/admin/happy-hour/slots')
        .send({ ...validBody, start_time: 'bad' })
        .expect(400);
    });

    it('propagates BadRequest from service overlap check', async () => {
      service.createSlot.mockRejectedValueOnce(
        new BadRequestException('overlap'),
      );
      await request(app.getHttpServer())
        .post('/admin/happy-hour/slots')
        .send(validBody)
        .expect(400);
    });

    /**
     * BUG-001 (controller level) — invalid HH:mm range ผ่าน
     * Test ตั้งใจให้ FAIL บน codebase ปัจจุบัน
     */
    it.each(['25:00', '99:99', '10:60'])(
      'BUG-001: rejects invalid range start_time=%s',
      async (bad) => {
        await request(app.getHttpServer())
          .post('/admin/happy-hour/slots')
          .send({ ...validBody, start_time: bad, end_time: '23:59' })
          .expect(400);
      },
    );
  });

  describe('PUT /admin/happy-hour/slots/:id', () => {
    const validBody = {
      start_time: '10:00',
      end_time: '12:00',
      min_order_amount: 1000,
      card_value: 100,
      excess_threshold: 500,
      discount_per_step: 10,
    };

    it('parses :id as number and forwards body', async () => {
      service.updateSlot.mockResolvedValueOnce({ id: 5 } as any);
      await request(app.getHttpServer())
        .put('/admin/happy-hour/slots/5')
        .send(validBody)
        .expect(200);
      expect(service.updateSlot).toHaveBeenCalledWith(
        5,
        expect.objectContaining(validBody),
      );
    });

    it('returns 400 for non-integer id', async () => {
      await request(app.getHttpServer())
        .put('/admin/happy-hour/slots/abc')
        .send(validBody)
        .expect(400);
    });

    /**
     * BUG-008: partial update rejected by validation
     * Controller declares dto as Partial<CreateSlotDto> (TS-only) — runtime decorators ยัง required
     * Test นี้ตั้งใจให้ FAIL บน codebase ปัจจุบัน (ส่ง only is_active → 400)
     */
    it('BUG-008: should accept partial body { is_active: false }', async () => {
      service.updateSlot.mockResolvedValueOnce({ id: 5, is_active: false } as any);
      await request(app.getHttpServer())
        .put('/admin/happy-hour/slots/5')
        .send({ is_active: false })
        .expect(200);
    });
  });

  describe('DELETE /admin/happy-hour/slots/:id', () => {
    it('returns 204 on success', async () => {
      service.deleteSlot.mockResolvedValueOnce(undefined);
      await request(app.getHttpServer())
        .delete('/admin/happy-hour/slots/5')
        .expect(204);
      expect(service.deleteSlot).toHaveBeenCalledWith(5);
    });

    it('returns 400 for non-integer id', async () => {
      await request(app.getHttpServer())
        .delete('/admin/happy-hour/slots/xyz')
        .expect(400);
    });
  });

  describe('POST /admin/happy-hour/simulate', () => {
    const validBody = { order_amount: 10000, order_time: '22:30' };

    it('returns simulate result', async () => {
      service.simulate.mockResolvedValueOnce({ is_happy_hour: false } as any);
      await request(app.getHttpServer())
        .post('/admin/happy-hour/simulate')
        .send(validBody)
        .expect(201)
        .expect({ is_happy_hour: false });
      expect(service.simulate).toHaveBeenCalledWith(
        expect.objectContaining(validBody),
      );
    });

    it('rejects negative order_amount', async () => {
      await request(app.getHttpServer())
        .post('/admin/happy-hour/simulate')
        .send({ order_amount: -1, order_time: '22:30' })
        .expect(400);
    });

    it('rejects bad order_time format', async () => {
      await request(app.getHttpServer())
        .post('/admin/happy-hour/simulate')
        .send({ order_amount: 1000, order_time: '22-30' })
        .expect(400);
    });

    it('strips extra fields via whitelist', async () => {
      service.simulate.mockResolvedValueOnce({ is_happy_hour: false } as any);
      await request(app.getHttpServer())
        .post('/admin/happy-hour/simulate')
        .send({ ...validBody, extraField: 'x' })
        .expect(400); // forbidNonWhitelisted = true
    });
  });
});
