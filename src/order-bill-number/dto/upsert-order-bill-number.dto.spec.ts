import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpsertOrderBillNumberDto } from './upsert-order-bill-number.dto';

// ใช้ option เดียวกับ OrderBillNumberController
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const validate = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: UpsertOrderBillNumberDto,
  }) as Promise<UpsertOrderBillNumberDto>;

describe('UpsertOrderBillNumberDto (ECWC-559)', () => {
  it('trims both fields', async () => {
    await expect(
      validate({ sh_running: ' SO-001 ', bill_number: ' IV-001 ' }),
    ).resolves.toEqual({ sh_running: 'SO-001', bill_number: 'IV-001' });
  });

  it.each([
    [{ sh_running: 'SO-001' }],
    [{ bill_number: 'IV-001' }],
    [{ sh_running: '   ', bill_number: 'IV-001' }],
    [{ sh_running: 'SO-001', bill_number: 123 }],
    [{ sh_running: 'SO-001', bill_number: 'x'.repeat(61) }],
    [{ sh_running: 'SO-001', bill_number: 'IV-001', extra: 1 }],
  ])('rejects invalid payload %j', async (body) => {
    await expect(validate(body)).rejects.toThrow(BadRequestException);
  });
});
