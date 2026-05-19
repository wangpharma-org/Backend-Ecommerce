import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { HappyHourConfigEntity } from './happy-hour-config.entity';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { SimulateDto } from './dto/simulate.dto';
import { ProductEntity } from 'src/products/products.entity';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_SLOTS: Omit<
  HappyHourSlotEntity,
  'id' | 'created_at' | 'updated_at'
>[] = [
  {
    start_time: '22:00',
    // MySQL TIME ยอมรับ 24:00:00 เป็น special case — ใช้เพื่อครอบคลุม slot จนถึงก่อนเที่ยงคืน
    end_time: '24:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1334,
    discount_per_step: 10,
    is_active: true,
    reward_pro_code: '92020405',
    reward_unit: null,
    reward_amount: 1,
  },
  {
    start_time: '00:00',
    end_time: '02:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1000,
    discount_per_step: 10,
    is_active: true,
    reward_pro_code: '92020405',
    reward_unit: null,
    reward_amount: 1,
  },
  {
    start_time: '02:00',
    end_time: '06:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 667,
    discount_per_step: 10,
    is_active: true,
    reward_pro_code: '92020405',
    reward_unit: null,
    reward_amount: 1,
  },
  {
    start_time: '06:00',
    end_time: '08:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1334,
    discount_per_step: 10,
    is_active: true,
    reward_pro_code: '92020405',
    reward_unit: null,
    reward_amount: 1,
  },
];

@Injectable()
export class HappyHourService implements OnModuleInit {
  constructor(
    @InjectRepository(HappyHourConfigEntity)
    private readonly configRepo: Repository<HappyHourConfigEntity>,
    @InjectRepository(HappyHourSlotEntity)
    private readonly slotRepo: Repository<HappyHourSlotEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.slotRepo.count();
    if (count === 0) {
      await this.slotRepo.save(
        DEFAULT_SLOTS.map((s) => this.slotRepo.create(s)),
      );
    }
  }

  async getConfig(): Promise<HappyHourConfigEntity> {
    let config = await this.configRepo.findOneBy({ id: 1 });
    if (!config) {
      config = this.configRepo.create({ id: 1, is_enabled: false });
      await this.configRepo.save(config);
    }
    return config;
  }

  async toggle(username: string): Promise<HappyHourConfigEntity> {
    const config = await this.getConfig();
    config.is_enabled = !config.is_enabled;
    config.updated_at = new Date();
    config.updated_by = username;
    return this.configRepo.save(config);
  }

  async getSlots(): Promise<HappyHourSlotEntity[]> {
    return this.slotRepo.find({ order: { start_time: 'ASC' } });
  }

  async createSlot(dto: CreateSlotDto): Promise<HappyHourSlotEntity> {
    this.validateTimeRange(dto.start_time, dto.end_time);
    await this.validateNoOverlap(dto.start_time, dto.end_time);

    const slot = this.slotRepo.create({
      ...dto,
      is_active: dto.is_active ?? true,
    });
    return this.slotRepo.save(slot);
  }

  async updateSlot(
    id: number,
    dto: UpdateSlotDto,
  ): Promise<HappyHourSlotEntity> {
    const slot = await this.slotRepo.findOneBy({ id });
    if (!slot) {
      throw new NotFoundException(`ไม่พบ slot id ${id}`);
    }

    const newStart = dto.start_time ?? slot.start_time.substring(0, 5);
    const newEnd = dto.end_time ?? slot.end_time.substring(0, 5);

    this.validateTimeRange(newStart, newEnd);
    await this.validateNoOverlap(newStart, newEnd, id);

    Object.assign(slot, dto);
    return this.slotRepo.save(slot);
  }

  async deleteSlot(id: number): Promise<void> {
    const slot = await this.slotRepo.findOneBy({ id });
    if (!slot) {
      throw new NotFoundException(`ไม่พบ slot id ${id}`);
    }
    await this.slotRepo.delete(id);
  }

  async calcHappyHourReward(orderAmount: number): Promise<{
    slot: HappyHourSlotEntity;
    numCards: number;
    excessDiscount: number;
    totalCardValue: number;
    totalReward: number;
  } | null> {
    const config = await this.getConfig();
    if (!config.is_enabled) return null;

    const now = dayjs().tz('Asia/Bangkok');
    const orderTimeSql = now.format('HH:mm:00');

    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.is_active = true')
      .andWhere('slot.start_time <= :t', { t: orderTimeSql })
      .andWhere('slot.end_time > :t', { t: orderTimeSql })
      .getOne();

    if (!slot) return null;

    // Greedy: maximize cards first, then maximize discount steps from remainder
    const minOrder = Number(slot.min_order_amount);
    const numCards = Math.floor(orderAmount / minOrder);
    if (numCards === 0) return null;

    const excess = orderAmount - numCards * minOrder;
    const excessSteps = Math.floor(excess / Number(slot.excess_threshold));
    const excessDiscount = excessSteps * Number(slot.discount_per_step);

    const totalCardValue = numCards * Number(slot.card_value);
    return {
      slot,
      numCards,
      excessDiscount,
      totalCardValue,
      totalReward: totalCardValue + excessDiscount,
    };
  }

  async simulate(dto: SimulateDto) {
    const { order_amount, order_time } = dto;

    // แปลง "HH:mm" → "HH:mm:ss" สำหรับ MySQL TIME comparison
    const orderTimeSql = `${order_time}:00`;

    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.is_active = true')
      .andWhere('slot.start_time <= :t', { t: orderTimeSql })
      .andWhere('slot.end_time > :t', { t: orderTimeSql })
      .getOne();

    if (!slot) {
      return { is_happy_hour: false };
    }

    const num_cards = Math.floor(order_amount / Number(slot.min_order_amount));
    if (num_cards === 0) {
      return { is_happy_hour: false };
    }

    const excess = order_amount - num_cards * Number(slot.min_order_amount);
    const excess_steps = Math.floor(excess / Number(slot.excess_threshold));
    const excess_discount = excess_steps * Number(slot.discount_per_step);
    const total_reward = num_cards * Number(slot.card_value) + excess_discount;

    let reward_product: {
      pro_code: string;
      unit: string | null;
      amount: number;
      pro_name: string | null;
      pro_imgmain: string | null;
    } | null = null;
    if (num_cards > 0 && slot.reward_pro_code) {
      const product = await this.productRepo.findOne({
        where: { pro_code: slot.reward_pro_code },
        select: ['pro_code', 'pro_name', 'pro_imgmain'],
      });
      reward_product = {
        pro_code: slot.reward_pro_code,
        unit: slot.reward_unit,
        amount: num_cards * slot.reward_amount,
        pro_name: product?.pro_name ?? null,
        pro_imgmain: product?.pro_imgmain ?? null,
      };
    }

    return {
      is_happy_hour: true,
      matched_slot: slot,
      num_cards,
      excess_discount,
      total_reward,
      reward_product,
    };
  }

  private validateTimeRange(start: string, end: string): void {
    if (start >= end) {
      throw new BadRequestException('start_time ต้องน้อยกว่า end_time');
    }
  }

  private async validateNoOverlap(
    start: string,
    end: string,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.start_time < :end', { end: `${end}:00` })
      .andWhere('slot.end_time > :start', { start: `${start}:00` });

    if (excludeId !== undefined) {
      qb.andWhere('slot.id != :excludeId', { excludeId });
    }

    const count = await qb.getCount();
    if (count > 0) {
      throw new BadRequestException('ช่วงเวลานี้ทับซ้อนกับ slot ที่มีอยู่แล้ว');
    }
  }
}
