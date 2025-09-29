import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShoppingHeadEntity } from './shopping-head.entity';
import { Repository } from 'typeorm';
import { AllOrderByMemberRes } from './types/AllOrderByMemberRes.type';
import { ProductsService } from '../products/products.service';

export interface ShoppingHead {
  soh_runing: string;
  soh_sumprice: number;
  soh_datetime: string; // หรือ Date ถ้าเป็น object
  soh_coin_recieve: number;
  address: string;
  details: ShoppingOrder[];
}

export interface ShoppingOrder {
  pro_code: string;
  pro_imgmain: string | null;
}

@Injectable()
export class ShoppingHeadService {
  constructor(
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadRepo: Repository<ShoppingHeadEntity>,
    private readonly productService: ProductsService,
  ) {}

  async AllOrderByMember(mem_code: string): Promise<AllOrderByMemberRes> {
    try {
      console.log('memcode in AllOrderByMember', mem_code);
      const result = await this.shoppingHeadRepo
        .createQueryBuilder('head')
        .leftJoin('head.details', 'order')
        .leftJoin('order.product', 'product')
        .where('head.mem_code = :mem_code', { mem_code })
        .select([
          'head.soh_running',
          'head.soh_sumprice',
          'head.soh_datetime',
          'head.soh_coin_recieve',
          // 'head.soh_payment_type',
          // 'head.soh_shipping_type',
          // 'order', // ดึงทั้งหมดของ order
          'product.pro_code',
          'product.pro_imgmain',
          'order.spo_id',
          'order.spo_qty',
          'order.spo_unit',
        ])
        .orderBy('head.soh_datetime', 'DESC')
        .getMany();

      const a = await Promise.all(
        result.map(async (item) => {
          // ✅ กลุ่ม pro_code ที่เหมือนกัน
          const groupedDetails: Record<
            string,
            { pro_code: string; product: any; items: any[] }
          > = {};

          // จัดกลุ่มรายละเอียดสินค้า
          for (const detail of item.details) {
            const proCode = detail.product.pro_code;

            if (!groupedDetails[proCode]) {
              groupedDetails[proCode] = {
                pro_code: proCode,
                product: detail.product,
                items: [],
              };
            }

            groupedDetails[proCode].items.push({
              spo_id: detail.spo_id,
              spo_qty: detail.spo_qty,
              spo_unit: detail.spo_unit,
            });
          }

          // คำนวณหน่วยที่เล็กที่สุดสำหรับทุก pro_code ใน details
          const totalSmallestUnit = await Promise.all(
            Object.values(groupedDetails).map(async (group) => {
              // กรอง orderItems ตาม pro_code
              const orderItems = group.items.map((item) => ({
                unit: item.spo_unit,
                quantity: parseFloat(item.spo_qty), // แปลงจำนวนเป็นตัวเลข
                pro_code: group.pro_code, // เพิ่ม pro_code ใน orderItems
              }));

              // คำนวณหน่วยที่เล็กที่สุดสำหรับ pro_code นี้
              return this.productService.calculateSmallestUnit(orderItems);
            }),
          );

          const ProductMaptotalSmallestUnit = totalSmallestUnit.map(
            (total, index) => ({
              pro_code: Object.values(groupedDetails)[index].pro_code,
              totalSmallestUnit: total,
            }),
          );

          const response = {
            ...item,
            totalSmallestUnit: ProductMaptotalSmallestUnit, // เพิ่มผลลัพธ์จากการคำนวณหน่วยที่เล็กที่สุด
            Newdetails: Object.values(groupedDetails),
            details: item.details.length, // ถ้าต้องการเก็บรายละเอียดเดิมไว้
          };

          return response;
        }),
      );

      return a;
    } catch (error) {
      console.error('Error get Order fail:', error);
      throw new Error(`Error get Order fail`);
    }
  }

  async SomeOrderByMember(soh_running: string): Promise<ShoppingHeadEntity> {
    try {
      const result = await this.shoppingHeadRepo
        .createQueryBuilder('head')
        .leftJoin('head.details', 'order')
        .leftJoin('order.product', 'product')
        .leftJoin('head.member', 'member')
        .where('head.soh_running = :soh_running', { soh_running })
        .select([
          'head.soh_running',
          'head.soh_sumprice',
          'head.soh_datetime',
          'head.soh_coin_recieve',
          'head.soh_payment_type',
          'order', // ดึงทั้งหมดของ order
          // 'order.spo_id',
          'product.pro_code',
          'product.pro_name',
          'product.pro_imgmain',
        ])
        .orderBy('head.soh_datetime', 'DESC')
        .getOne();

      if (!result) {
        throw new Error(`Order with soh_running ${soh_running} not found.`);
      }

      return result;
    } catch (error) {
      console.error('Error get Order fail:', error);
      throw new Error(`Error get Order fail`);
    }
  }

  async getLastSHRunnning(): Promise<string | null> {
    try {
      const lastOrder = await this.shoppingHeadRepo.findOne({
        where: {},
        order: { soh_running: 'DESC' },
      });
      return lastOrder ? lastOrder.soh_running : null;
    } catch (error) {
      console.error('Error fetching last soh_running:', error);
      throw new Error('Error fetching last soh_running');
    }
  }
}
