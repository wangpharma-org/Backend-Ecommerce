import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { ProductEntity } from '../products/products.entity';
import { DrugTypeEntity } from './drug-type.entity';
import {
  DrugTypeRewardEntity,
  DrugTypeRewardType,
} from './drug-type-reward.entity';

/** feature flag หน้าร้าน — migration seed ไว้เป็นปิด */
export const DRUG_TYPE_REWARD_FLAG = 'drug_type_reward';

/** ข้อความจาก topic drug_type_upsert_ecom (ProductService → Wang-Kafka-API-Service) */
export interface DrugTypeKafkaPayload {
  code: string;
  previous_code?: string | null;
  name: string;
  description?: string | null;
  is_active: boolean;
  deleted: boolean;
  rewards: Array<{
    reward_type: DrugTypeRewardType;
    product_code: string;
    buy_qty: number;
    buy_unit?: string | null;
    reward_qty: number;
    reward_unit?: string | null;
    bundle_price?: number | null;
    sort_order: number;
    note?: string | null;
  }>;
}

export interface DrugTypeRewardView {
  reward_type: DrugTypeRewardType;
  product_code: string;
  product_name: string | null;
  product_image: string | null;
  buy_qty: number;
  buy_unit: string | null;
  reward_qty: number;
  reward_unit: string | null;
  bundle_price: number | null;
  note: string | null;
}

export interface ProductDrugTypeView {
  code: string;
  name: string;
  rewards: DrugTypeRewardView[];
}

const MAX_LOOKUP_CODES = 200;

@Injectable()
export class DrugTypeService {
  private readonly logger = new Logger(DrugTypeService.name);

  constructor(
    @InjectRepository(DrugTypeEntity)
    private readonly drugTypeRepo: Repository<DrugTypeEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async assertEnabled(): Promise<void> {
    if (!(await this.featureFlags.getFlag(DRUG_TYPE_REWARD_FLAG))) {
      throw new ForbiddenException('ฟีเจอร์สินค้าแถม/ขายพ่วงยังไม่เปิดใช้งาน');
    }
  }

  /**
   * upsert ประเภท + แทนที่รายการแถม/พ่วงทั้งชุด (idempotent — ข้อความซ้ำได้ผลเดิม)
   * - previous_code: ย้ายประเภทเดิมมาใช้รหัสใหม่ + ย้าย product.drug_type_code ตาม
   * - deleted: ลบประเภท (rewards ลบตาม FK cascade) + ล้าง product.drug_type_code
   */
  async upsertFromKafka(payload: DrugTypeKafkaPayload): Promise<void> {
    const code = payload.code?.trim();
    if (!code) {
      this.logger.warn('drug_type_upsert_ecom without code — skipped');
      return;
    }
    const previousCode = payload.previous_code?.trim() || null;

    await this.dataSource.transaction(async (manager) => {
      if (previousCode && previousCode !== code) {
        const existsOld = await manager.findOne(DrugTypeEntity, {
          where: { code: previousCode },
        });
        const existsNew = await manager.findOne(DrugTypeEntity, {
          where: { code },
        });
        if (existsOld && !existsNew) {
          // ON UPDATE CASCADE ย้าย drug_type_reward ให้เอง
          await manager.update(
            DrugTypeEntity,
            { code: previousCode },
            { code },
          );
        } else if (existsOld) {
          await manager.delete(DrugTypeEntity, { code: previousCode });
        }
        await manager.update(
          ProductEntity,
          { drug_type_code: previousCode },
          { drug_type_code: code },
        );
      }

      if (payload.deleted) {
        await manager.update(
          ProductEntity,
          { drug_type_code: code },
          { drug_type_code: null },
        );
        await manager.delete(DrugTypeEntity, { code });
        return;
      }

      await manager.upsert(
        DrugTypeEntity,
        {
          code,
          name: payload.name,
          description: payload.description ?? null,
          is_active: payload.is_active,
        },
        ['code'],
      );
      await manager.delete(DrugTypeRewardEntity, { drug_type_code: code });
      const rewards = (payload.rewards ?? []).map((reward, index) =>
        manager.create(DrugTypeRewardEntity, {
          drug_type_code: code,
          reward_type: reward.reward_type,
          product_code: reward.product_code,
          buy_qty: reward.buy_qty,
          buy_unit: reward.buy_unit ?? null,
          reward_qty: reward.reward_qty,
          reward_unit: reward.reward_unit ?? null,
          bundle_price: reward.bundle_price ?? null,
          sort_order: reward.sort_order ?? index,
          note: reward.note ?? null,
        }),
      );
      if (rewards.length > 0) await manager.save(rewards);
    });
  }

  /** ประเภทยา + แถม/พ่วงของสินค้าหลายตัว (หน้าสินค้า / ตะกร้า) — ไม่มีประเภท/ปิดใช้งาน/ไม่มีรายการ = ไม่อยู่ในผลลัพธ์ */
  async findByProductCodes(
    proCodes: string[],
  ): Promise<Record<string, ProductDrugTypeView>> {
    const codes = [
      ...new Set(proCodes.map((c) => c?.trim()).filter(Boolean)),
    ].slice(0, MAX_LOOKUP_CODES);
    if (codes.length === 0) return {};

    const products = await this.productRepo.find({
      select: { pro_code: true, drug_type_code: true },
      where: { pro_code: In(codes) },
    });
    const typeCodes = [
      ...new Set(
        products.map((p) => p.drug_type_code).filter((c): c is string => !!c),
      ),
    ];
    if (typeCodes.length === 0) return {};

    const drugTypes = await this.drugTypeRepo
      .createQueryBuilder('dt')
      .innerJoinAndSelect('dt.rewards', 'reward')
      .where('dt.code IN (:...typeCodes)', { typeCodes })
      .andWhere('dt.is_active = 1')
      .orderBy('reward.sort_order', 'ASC')
      .getMany();

    const rewardProducts = await this.findRewardProducts(
      drugTypes.flatMap((dt) => (dt.rewards ?? []).map((r) => r.product_code)),
    );
    const views = new Map(
      drugTypes.map((dt) => [
        dt.code,
        {
          code: dt.code,
          name: dt.name,
          rewards: (dt.rewards ?? []).map((r) => {
            const rp = rewardProducts.get(r.product_code);
            return {
              reward_type: r.reward_type,
              product_code: r.product_code,
              product_name: rp ? rp.pro_nameTH?.trim() || rp.pro_name : null,
              product_image: rp?.pro_imgmain || null,
              buy_qty: r.buy_qty,
              buy_unit: r.buy_unit,
              reward_qty: r.reward_qty,
              reward_unit: r.reward_unit,
              bundle_price: r.bundle_price,
              note: r.note,
            };
          }),
        },
      ]),
    );

    const result: Record<string, ProductDrugTypeView> = {};
    for (const p of products) {
      const view = p.drug_type_code ? views.get(p.drug_type_code) : undefined;
      if (view) result[p.pro_code] = view;
    }
    return result;
  }

  private async findRewardProducts(
    codes: string[],
  ): Promise<Map<string, ProductEntity>> {
    const unique = [...new Set(codes)];
    if (unique.length === 0) return new Map();
    const rows = await this.productRepo.find({
      select: {
        pro_code: true,
        pro_name: true,
        pro_nameTH: true,
        pro_imgmain: true,
      },
      where: { pro_code: In(unique) },
    });
    return new Map(rows.map((row) => [row.pro_code, row]));
  }
}
