import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSlotDto } from './dto/create-slot.dto';
import { SimulateDto } from './dto/simulate.dto';

/**
 * DTO validation tests
 * - คุม contract ของ input ที่ controller รับ
 * - มี test ที่ตั้งใจ fail เพื่อโชว์ BUG-001 (regex รับเวลาเกินช่วง)
 *   ดู BUG_REPORT.md
 */
describe('Happy Hour DTOs', () => {
  const baseValidSlot = {
    start_time: '10:00',
    end_time: '12:00',
    min_order_amount: 1000,
    card_value: 100,
    excess_threshold: 500,
    discount_per_step: 10,
  };

  describe('CreateSlotDto — happy path', () => {
    it('accepts a fully populated valid payload', async () => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        is_active: true,
        reward_pro_code: 'P001',
        reward_unit: 'BOX',
        reward_amount: 2,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts minimal payload (optional fields omitted)', async () => {
      const dto = plainToInstance(CreateSlotDto, baseValidSlot);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('CreateSlotDto — time format', () => {
    it.each([
      ['9:00', '12:00', 'start single-digit hour'],
      ['10:0', '12:00', 'start single-digit minute'],
      ['10:00', '12', 'end no minute'],
      ['', '12:00', 'empty start'],
      ['10-00', '12:00', 'wrong separator'],
    ])('rejects format start=%s end=%s (%s)', async (start, end) => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        start_time: start,
        end_time: end,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    /**
     * BUG-001 — regex /^\d{2}:\d{2}$/ ไม่ตรวจ range
     * Test นี้ตั้งใจให้ FAIL บน codebase ปัจจุบัน
     * Expected behavior: invalid 24-hour clock values ต้องถูก reject
     */
    it.each([
      ['25:00', '26:00'],
      ['99:99', '99:99'],
      ['10:60', '11:00'],
      ['10:00', '24:99'],
      ['ab:cd', '12:00'], // นี่ regex ปัจจุบันก็ reject แล้ว — ใส่เพื่อยืนยัน
    ])(
      'BUG-001: rejects invalid HH:mm range start=%s end=%s',
      async (start, end) => {
        const dto = plainToInstance(CreateSlotDto, {
          ...baseValidSlot,
          start_time: start,
          end_time: end,
        });
        const errors = await validate(dto);
        // เคสที่ regex ปัจจุบัน reject (ab:cd, 99:99 ในส่วน letters): pass
        // เคสที่ regex ปัจจุบัน accept ทั้งที่ range ผิด (25:00, 10:60): test นี้จะ fail → bug confirmed
        expect(errors.length).toBeGreaterThan(0);
      },
    );
  });

  describe('CreateSlotDto — numeric constraints', () => {
    it.each([
      ['min_order_amount', 0],
      ['min_order_amount', -1],
      ['card_value', 0],
      ['excess_threshold', 0],
      ['discount_per_step', 0],
      ['reward_amount', 0],
    ])('rejects %s = %i', async (field, value) => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        [field]: value,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === field)).toBe(true);
    });

    it.each([
      ['min_order_amount'],
      ['card_value'],
      ['excess_threshold'],
      ['discount_per_step'],
    ])('rejects non-numeric %s', async (field) => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        [field]: 'abc',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === field)).toBe(true);
    });

    /**
     * BUG-009 — accepts min_order_amount=1 (potential exploit)
     * Test ยืนยันว่า DTO ปัจจุบันยอมรับค่านี้ (FYI ใน report)
     */
    it('BUG-009: accepts min_order_amount=1 (no business minimum)', async () => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        min_order_amount: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('CreateSlotDto — optional fields', () => {
    it('accepts is_active=false', async () => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        is_active: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects is_active as non-boolean', async () => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        is_active: 'yes',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'is_active')).toBe(true);
    });

    it('rejects reward_pro_code as non-string', async () => {
      const dto = plainToInstance(CreateSlotDto, {
        ...baseValidSlot,
        reward_pro_code: 12345,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reward_pro_code')).toBe(true);
    });
  });

  describe('SimulateDto', () => {
    it('accepts valid payload', async () => {
      const dto = plainToInstance(SimulateDto, {
        order_amount: 10000,
        order_time: '22:30',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts order_amount = 0', async () => {
      const dto = plainToInstance(SimulateDto, {
        order_amount: 0,
        order_time: '22:30',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects negative order_amount', async () => {
      const dto = plainToInstance(SimulateDto, {
        order_amount: -1,
        order_time: '22:30',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'order_amount')).toBe(true);
    });

    it('rejects non-numeric order_amount', async () => {
      const dto = plainToInstance(SimulateDto, {
        order_amount: 'abc',
        order_time: '22:30',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'order_amount')).toBe(true);
    });

    it.each(['', '9:00', '22-30', '22:3', 'abcd'])(
      'rejects bad order_time format %s',
      async (time) => {
        const dto = plainToInstance(SimulateDto, {
          order_amount: 1000,
          order_time: time,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'order_time')).toBe(true);
      },
    );

    /**
     * BUG-001 (mirror) — order_time ก็มี regex เดียวกัน
     */
    it.each(['25:00', '99:99', '23:60'])(
      'BUG-001: rejects out-of-range order_time %s',
      async (time) => {
        const dto = plainToInstance(SimulateDto, {
          order_amount: 1000,
          order_time: time,
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      },
    );
  });
});
