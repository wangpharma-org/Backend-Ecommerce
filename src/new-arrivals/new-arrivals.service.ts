import { Inject, Injectable } from '@nestjs/common';
import { NewArrival } from './new-arrival.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/users.entity';
import { ClientKafka } from '@nestjs/microservices';
import * as dayjs from 'dayjs';

@Injectable()
export class NewArrivalsService {
  constructor(
    @InjectRepository(NewArrival)
    private readonly newArrivalsRepository: Repository<NewArrival>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Inject('OrderPickingService')
    private readonly kafkaClient: ClientKafka,
  ) {}

  private async isL16Member(
    mem_code?: string,
    mem_route?: string,
  ): Promise<boolean> {
    if (mem_route !== undefined && mem_route !== null) {
      return mem_route.toUpperCase() === 'L16';
    }
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  async addNewArrival(
    data: {
      pro_code: string;
      LOT: string;
      MFG: string;
      EXP: string;
      createdAt: Date;
      amount: number;
      unit: string;
    }[],
  ): Promise<{ message: string }> {
    const queryRunner =
      this.newArrivalsRepository.manager.connection.createQueryRunner();

    try {
      const arrData: NewArrival[] = [];
      const kafkaEvents: {
        pro_code: string;
        createdAt: string;
        amount: number;
        unit: string;
      }[] = [];
      await queryRunner.connect();
      await queryRunner.startTransaction();

      for (const item of data) {
        const { pro_code, LOT, MFG, EXP, createdAt, amount, unit } = item;

        // ใช้ dayjs เพื่อ normalize date (เอาเฉพาะวันที่ ไม่รวม time)
        const normalizedDate = dayjs(createdAt).startOf('day').toDate();

        // ใช้ pessimistic write lock เพื่อป้องกัน race condition
        const existingRecord = await queryRunner.manager
          .createQueryBuilder(NewArrival, 'newArrival')
          .where('newArrival.pro_code = :pro_code', { pro_code })
          .andWhere('newArrival.LOT = :LOT', { LOT })
          .andWhere('newArrival.MFG = :MFG', { MFG })
          .andWhere('newArrival.EXP = :EXP', { EXP })
          .andWhere('DATE(newArrival.createdAt) = DATE(:createdAt)', {
            createdAt: normalizedDate,
          })
          .setLock('pessimistic_write')
          .getOne();

        if (existingRecord) {
          continue;
        }

        kafkaEvents.push({
          pro_code,
          createdAt: dayjs(normalizedDate).format('YYYY-MM-DD'),
          amount,
          unit,
        });

        // สร้างและบันทึกข้อมูลใหม่
        const newArrivalEntity = queryRunner.manager.create(NewArrival, {
          product: { pro_code },
          LOT,
          MFG,
          EXP,
          createdAt: normalizedDate,
        });

        arrData.push(newArrivalEntity);
      }
      await queryRunner.manager.save(arrData);

      // ส่ง Kafka event เฉพาะเมื่อบันทึกข้อมูลใหม่สำเร็จ
      this.kafkaClient.emit('newArrival_insert', { kafkaEvents });

      await queryRunner.commitTransaction();
      return { message: 'New arrival added successfully' };
    } catch {
      await queryRunner.rollbackTransaction();
      throw new Error('Error adding new arrival');
    } finally {
      await queryRunner.release();
    }
  }

  async getNewArrivalsLimit30(
    memCode: string,
    mem_route?: string,
  ): Promise<any[]> {
    const isL16 = await this.isL16Member(memCode, mem_route);
    const results = await this.newArrivalsRepository
      .createQueryBuilder('newArrival')
      .leftJoinAndSelect('newArrival.product', 'product')
      .leftJoinAndSelect(
        'product.inCarts',
        'cart',
        'cart.mem_code = :memCode AND cart.is_reward = false',
      )
      .leftJoinAndSelect('product.units', 'productUnits')
      .setParameter('memCode', memCode)
      .where(
        'product.pro_priceA != 1 AND product.pro_priceB != 1 AND product.pro_priceC != 1',
      )
      .andWhere(
        isL16
          ? '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)'
          : '1=1',
      )
      .groupBy('product.pro_code')
      .addGroupBy('newArrival.id')
      .addGroupBy('newArrival.createdAt')
      .addGroupBy('cart.spc_id')
      .addGroupBy('cart.spc_amount')
      .addGroupBy('cart.spc_unit_enum')
      .addGroupBy('cart.mem_code')
      .addGroupBy('productUnits.id')
      .addGroupBy('productUnits.level')
      .addGroupBy('productUnits.unit_name')
      .addGroupBy('productUnits.ratio')
      .orderBy('newArrival.createdAt', 'DESC')
      .addOrderBy('newArrival.id', 'DESC')
      .take(30)
      .select([
        'newArrival.id',
        'newArrival.createdAt',
        'product.pro_code',
        'product.pro_name',
        'product.pro_priceA',
        'product.pro_priceB',
        'product.pro_priceC',
        'product.pro_imgmain',
        'product.pro_stock',
        'product.pro_lowest_stock',
        'product.order_quantity',
        'cart.spc_id',
        'cart.spc_amount',
        'cart.spc_unit_enum',
        'cart.mem_code',
        'productUnits.id',
        'productUnits.level',
        'productUnits.unit_name',
        'productUnits.ratio',
      ])
      .getMany();

    // Return เฉพาะข้อมูล product พร้อมแปลง units → pro_unit1/2/3 และ spc_unit_enum → spc_unit
    return results.map((item) => {
      const product = item.product;
      if (!product) return product;

      const units = (product.units ?? []) as unknown as {
        level: number;
        unit_name: string;
        ratio: number;
      }[];

      const unit1 = units.find((u) => u.level === 1);
      const unit2 = units.find((u) => u.level === 2);
      const unit3 = units.find((u) => u.level === 3);

      const resolvedCarts = (product.inCarts ?? []).map((cart) => {
        const found = units.find((u) => u.level === Number(cart.spc_unit_enum));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { spc_unit_enum, ...cartWithoutEnum } = cart as typeof cart & {
          spc_unit_enum: string;
        };
        return { ...cartWithoutEnum, spc_unit: found?.unit_name ?? '' };
      });

      const productWithoutUnits = {
        ...(product as unknown as Record<string, unknown>),
      };
      delete productWithoutUnits['units'];

      return {
        ...productWithoutUnits,
        pro_unit1: unit1?.unit_name ?? '',
        pro_unit2: unit2?.unit_name ?? '',
        pro_unit3: unit3?.unit_name ?? '',
        pro_ratio1: unit1?.ratio ?? 1,
        pro_ratio2: unit2?.ratio ?? 1,
        pro_ratio3: unit3?.ratio ?? 1,
        inCarts: resolvedCarts,
      };
    });
  }
}
