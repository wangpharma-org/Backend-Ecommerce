import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { HappyHourConfigEntity } from './happy-hour-config.entity';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';
import { HappyHourSlotRewardEntity } from './happy-hour-slot-reward.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { SimulateDto } from './dto/simulate.dto';
import { ProductEntity } from 'src/products/products.entity';

// import * as ให้ type เป็น { default: PluginFunc } แต่ runtime CJS value คือ PluginFunc โดยตรง
// ต้อง import แบบนี้เพื่อให้ type augmentation ของ .tz() / .utc() ทำงาน
dayjs.extend(utc);
dayjs.extend(timezone);

interface DefaultSlotSeed {
  start_time: string;
  end_time: string;
  min_order_amount: number;
  card_value: number;
  excess_threshold: number;
  discount_per_step: number;
  is_active: boolean;
  reward_amount: number;
  reward_pro_codes: string[];
}

const DEFAULT_SLOTS: DefaultSlotSeed[] = [
  {
    start_time: '22:00',
    // MySQL TIME ยอมรับ 24:00:00 เป็น special case — ใช้เพื่อครอบคลุม slot จนถึงก่อนเที่ยงคืน
    end_time: '24:00',
    min_order_amount: 9999,
    card_value: 100,
    excess_threshold: 1334,
    discount_per_step: 10,
    is_active: true,
    reward_pro_codes: ['92020405'],
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
    reward_pro_codes: ['92020405'],
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
    reward_pro_codes: ['92020405'],
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
    reward_pro_codes: ['92020405'],
    reward_amount: 1,
  },
];

@Injectable()
export class HappyHourService implements OnModuleInit {
  private readonly logger = new Logger(HappyHourService.name);
  constructor(
    @InjectRepository(HappyHourConfigEntity)
    private readonly configRepo: Repository<HappyHourConfigEntity>,
    @InjectRepository(HappyHourSlotEntity)
    private readonly slotRepo: Repository<HappyHourSlotEntity>,
    @InjectRepository(HappyHourSlotRewardEntity)
    private readonly rewardRepo: Repository<HappyHourSlotRewardEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const count = await this.slotRepo.count();
      if (count === 0) {
        for (const { reward_pro_codes, ...slotData } of DEFAULT_SLOTS) {
          const slot = await this.slotRepo.save(this.slotRepo.create(slotData));
          if (reward_pro_codes.length) {
            await this.rewardRepo.save(
              reward_pro_codes.map((code) =>
                this.rewardRepo.create({
                  pro_code: code,
                  slot: { id: slot.id },
                }),
              ),
            );
          }
        }
      }
    } catch {
      // table ยังไม่มีใน DB — ข้ามไปก่อน feature จะทำงานหลัง migrate
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

  async updateConfig(
    dto: {
      is_enabled?: boolean;
      start_date?: string | null;
      end_date?: string | null;
    },
    username: string,
  ): Promise<HappyHourConfigEntity> {
    const config = await this.getConfig();
    if (dto.is_enabled !== undefined) config.is_enabled = dto.is_enabled;
    if (Object.prototype.hasOwnProperty.call(dto, 'start_date')) {
      config.start_date = dto.start_date ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'end_date')) {
      config.end_date = dto.end_date ?? null;
    }
    config.updated_at = new Date();
    config.updated_by = username;
    return this.configRepo.save(config);
  }

  async getSlots() {
    const slots = await this.slotRepo.find({ order: { start_time: 'ASC' } });
    return Promise.all(slots.map((s) => this.enrichSlotWithProducts(s)));
  }

  private async enrichSlotWithProducts(slot: HappyHourSlotEntity | null) {
    if (!slot) return null;
    const rewardList = slot.rewards ?? [];

    // Batch query: ดึงสินค้าทั้งหมดใน 1 query แทนที่จะ query ทีละ reward (N+1)
    const productMap = new Map<
      string,
      { pro_name: string; pro_imgmain: string }
    >();
    if (rewardList.length) {
      const codes = rewardList.map((r) => r.pro_code);
      const products = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.pro_code', 'p.pro_name', 'p.pro_imgmain'])
        .where('p.pro_code IN (:...codes)', { codes })
        .getMany();
      products.forEach((p) => productMap.set(p.pro_code, p));
    }

    const rewards = rewardList.map((r) => ({
      id: r.id,
      pro_code: r.pro_code,
      unit: r.unit ?? null,
      pro_name: productMap.get(r.pro_code)?.pro_name ?? null,
      pro_imgmain: productMap.get(r.pro_code)?.pro_imgmain ?? null,
    }));

    return { ...slot, rewards };
  }

  async createSlot(dto: CreateSlotDto) {
    this.validateTimeRange(dto.start_time, dto.end_time);
    await this.validateNoOverlap(dto.start_time, dto.end_time);

    const rewardCodes = dto.reward_pro_codes ?? [];
    const hasCardValue = dto.card_value !== undefined && dto.card_value > 0;

    if (hasCardValue && rewardCodes.length > 0) {
      throw new BadRequestException(
        'ไม่สามารถตั้งค่า card_value และ reward_pro_codes พร้อมกันได้',
      );
    }

    const slot = await this.slotRepo.save(
      this.slotRepo.create({
        start_time: dto.start_time,
        end_time: dto.end_time,
        min_order_amount: dto.min_order_amount,
        card_value: rewardCodes.length > 0 ? 0 : (dto.card_value ?? 0),
        excess_threshold: dto.excess_threshold,
        discount_per_step: dto.discount_per_step,
        is_active: dto.is_active ?? true,
        reward_amount: hasCardValue ? 1 : (dto.reward_amount ?? 1),
      }),
    );

    if (rewardCodes.length) {
      await Promise.all(
        rewardCodes.map(async (code) => {
          const unit = await this.findSmallestUnit(code);
          return this.rewardRepo.save(
            this.rewardRepo.create({
              pro_code: code,
              unit,
              slot: { id: slot.id },
            }),
          );
        }),
      );
    }

    const saved = await this.slotRepo.findOne({ where: { id: slot.id } });
    return this.enrichSlotWithProducts(saved);
  }

  async updateSlot(id: number, dto: UpdateSlotDto) {
    const slot = await this.slotRepo.findOneBy({ id });
    if (!slot) {
      throw new NotFoundException(`ไม่พบ slot id ${id}`);
    }

    const newStart = dto.start_time ?? slot.start_time.substring(0, 5);
    const newEnd = dto.end_time ?? slot.end_time.substring(0, 5);
    this.validateTimeRange(newStart, newEnd);
    await this.validateNoOverlap(newStart, newEnd, id);

    const { reward_pro_codes: codes, ...slotData } = dto;

    if (dto.card_value !== undefined) {
      // card mode: ล้าง rewards ออก + reset reward_amount
      Object.assign(slot, slotData, { reward_amount: 1 });
      await this.slotRepo.save(slot);
      await this.rewardRepo.delete({ slot: { id } });
    } else if (codes !== undefined || dto.reward_amount !== undefined) {
      // reward mode: ล้าง card_value
      Object.assign(slot, slotData, { card_value: 0 });
      await this.slotRepo.save(slot);
      if (codes !== undefined) {
        await this.rewardRepo.delete({ slot: { id } });
        if (codes.length) {
          await Promise.all(
            codes.map(async (code) => {
              const unit = await this.findSmallestUnit(code);
              return this.rewardRepo.save(
                this.rewardRepo.create({ pro_code: code, unit, slot: { id } }),
              );
            }),
          );
        }
      }
    } else {
      Object.assign(slot, slotData);
      await this.slotRepo.save(slot);
    }

    const updated = await this.slotRepo.findOne({ where: { id } });
    return this.enrichSlotWithProducts(updated);
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
    try {
      const config = await this.getConfig();
      if (!config.is_enabled) return null;

      const now = dayjs().tz('Asia/Bangkok');
      const today = now.format('YYYY-MM-DD');

      // ตรวจสอบช่วงวันที่โปรโมชันระดับ config
      if (config.start_date && today < config.start_date) return null;
      if (config.end_date && today > config.end_date) return null;

      const orderTimeSql = now.format('HH:mm:00');

      const slot = await this.slotRepo
        .createQueryBuilder('slot')
        .leftJoinAndSelect('slot.rewards', 'reward')
        .where('slot.is_active = true')
        .andWhere('slot.start_time <= :t', { t: orderTimeSql })
        .andWhere('slot.end_time > :t', { t: orderTimeSql })
        .getOne();

      if (!slot) return null;

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
    } catch (error) {
      // log error แล้ว return null เพื่อไม่ให้กระทบ flow การสั่งซื้อ
      this.logger.error('Error calculating happy hour reward:', error);
      return null;
    }
  }

  async simulate(dto: SimulateDto) {
    const { order_amount, order_time } = dto;

    // แปลง "HH:mm" → "HH:mm:ss" สำหรับ MySQL TIME comparison
    const orderTimeSql = `${order_time}:00`;

    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.rewards', 'reward')
      .where('slot.is_active = true')
      .andWhere('slot.start_time <= :t', { t: orderTimeSql })
      .andWhere('slot.end_time > :t', { t: orderTimeSql })
      .getOne();

    if (!slot) {
      return { is_happy_hour: false, matched_slot: null };
    }

    const num_cards = Math.floor(order_amount / Number(slot.min_order_amount));
    if (num_cards === 0) {
      return { is_happy_hour: false, matched_slot: null };
    }

    const excess = order_amount - num_cards * Number(slot.min_order_amount);
    const excess_steps = Math.floor(excess / Number(slot.excess_threshold));
    const excess_discount = excess_steps * Number(slot.discount_per_step);
    const total_reward = num_cards * Number(slot.card_value) + excess_discount;

    const reward_products = await Promise.all(
      slot.rewards.map(async (r) => {
        const product = await this.productRepo.findOne({
          where: { pro_code: r.pro_code },
          select: ['pro_code', 'pro_name', 'pro_imgmain'],
        });
        return {
          pro_code: r.pro_code,
          unit: r.unit ?? null,
          amount: num_cards * slot.reward_amount,
          pro_name: product?.pro_name ?? null,
          pro_imgmain: product?.pro_imgmain ?? null,
        };
      }),
    );

    return {
      is_happy_hour: true,
      matched_slot: slot,
      num_cards,
      excess_discount,
      total_reward,
      reward_products,
    };
  }

  async getLotusCards(): Promise<{ pro_code: string; pro_name: string }[]> {
    return this.productRepo
      .createQueryBuilder('p')
      .select(['p.pro_code', 'p.pro_name'])
      .where('p.pro_name LIKE :keyword', { keyword: '%โลตัส%' })
      .orderBy('p.pro_code', 'ASC')
      .getMany();
  }

  private async findSmallestUnit(proCode: string): Promise<string | null> {
    const product = await this.productRepo.findOne({
      where: { pro_code: proCode },
      select: [
        'pro_unit1',
        'pro_unit2',
        'pro_unit3',
        'pro_ratio1',
        'pro_ratio2',
        'pro_ratio3',
      ],
    });
    if (!product) return null;

    const candidates = [
      { unit: product.pro_unit1, ratio: Number(product.pro_ratio1 ?? 0) },
      { unit: product.pro_unit2, ratio: Number(product.pro_ratio2 ?? 0) },
      { unit: product.pro_unit3, ratio: Number(product.pro_ratio3 ?? 0) },
    ].filter((u) => u.unit && u.ratio > 0);

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.ratio - b.ratio);
    return candidates[0].unit;
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
