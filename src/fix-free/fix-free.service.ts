import { In, Repository } from 'typeorm';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductEntity } from 'src/products/products.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  buildRedeemCandidateWhere,
  REDEEM_PRODUCT_SUPPLIER,
} from 'src/products/redeem-product.criteria';
import {
  RedeemAdminOverview,
  RedeemProductSetService,
} from './redeem-product-set.service';

export interface RedeemProductUpdate {
  pro_point: number;
  pro_redeem_display_quantity?: number;
}

@Injectable()
export class FixFreeService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productEntity: Repository<ProductEntity>,
    private readonly redeemProductSetService: RedeemProductSetService,
  ) {}

  private validatePoint(pro_point: number): void {
    if (!Number.isInteger(pro_point) || pro_point < 0) {
      throw new BadRequestException('point ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
    }
  }

  private validateDisplayQuantity(
    displayQuantity: number,
    stock: number,
  ): void {
    if (!Number.isInteger(displayQuantity) || displayQuantity < 0) {
      throw new BadRequestException(
        'จำนวนที่โชว์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป',
      );
    }
    if (displayQuantity > stock) {
      throw new BadRequestException(
        `จำนวนที่โชว์ต้องไม่เกิน stock จริง (${stock})`,
      );
    }
  }

  async addProductFree(
    data: { pro_code: string; pin_to_set?: boolean } & RedeemProductUpdate,
  ): Promise<void> {
    try {
      const product = await this.productEntity.findOne({
        where: {
          pro_code: data.pro_code,
        },
      });
      if (!product) {
        throw new NotFoundException('ไม่พบสินค้า');
      }
      this.validatePoint(data.pro_point);
      const displayQuantity =
        data.pro_redeem_display_quantity ?? Math.max(0, product.pro_stock);
      this.validateDisplayQuantity(displayQuantity, product.pro_stock);

      const maxRank = data.pin_to_set
        ? Math.max(
            0,
            ...(
              await this.productEntity.find({
                where: buildRedeemCandidateWhere(),
                select: { pro_redeem_rank: true },
              })
            ).map((candidate) => candidate.pro_redeem_rank ?? 0),
          )
        : null;

      await this.productEntity.update(
        {
          pro_code: data.pro_code,
        },
        {
          pro_free: true,
          pro_point: data.pro_point,
          pro_redeem_display_quantity: displayQuantity,
          ...(maxRank === null ? {} : { pro_redeem_rank: maxRank + 1 }),
        },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new Error('Something Error add Product Free');
    }
  }

  async removeProductFree(pro_code: string): Promise<void> {
    try {
      const product = await this.productEntity.findOne({
        where: { pro_code },
        select: { pro_code: true, pro_supplier: true },
      });
      if (!product) throw new NotFoundException('ไม่พบสินค้า');
      if (product.pro_supplier === REDEEM_PRODUCT_SUPPLIER) {
        throw new BadRequestException(
          'สินค้าที่มาจาก supplier 00 ไม่สามารถลบออกจากรายการได้',
        );
      }
      await this.redeemProductSetService.removeBackupForRedeemProduct(pro_code);
      await this.productEntity.update(
        {
          pro_code: pro_code,
        },
        {
          // เคลียร์ค่าตั้งค่าเดิม ไม่ให้กลับมาแสดงด้วยข้อมูลค้างภายหลัง
          pro_free: false,
          pro_point: 0,
          pro_redeem_display_quantity: null,
          pro_redeem_rank: null,
        },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new Error('Something Error remove Product Free');
    }
  }

  async reorderProducts(proCodes: string[]): Promise<void> {
    if (
      !Array.isArray(proCodes) ||
      proCodes.some(
        (proCode) => typeof proCode !== 'string' || !proCode.trim(),
      ) ||
      new Set(proCodes).size !== proCodes.length
    ) {
      throw new BadRequestException('ลำดับสินค้ามีข้อมูลไม่ถูกต้องหรือซ้ำกัน');
    }

    const candidates = await this.productEntity.find({
      where: buildRedeemCandidateWhere(),
      select: { pro_code: true },
    });
    const candidateCodes = new Set(
      candidates.map((product) => product.pro_code),
    );
    if (
      proCodes.length !== candidateCodes.size ||
      proCodes.some((proCode) => !candidateCodes.has(proCode))
    ) {
      throw new BadRequestException(
        'กรุณาส่งลำดับสินค้าแลกแต้มทั้งหมดให้ครบและเป็นข้อมูลล่าสุด',
      );
    }

    await this.productEntity.manager.transaction(async (manager) => {
      for (let index = 0; index < proCodes.length; index += 1) {
        await manager.update(
          ProductEntity,
          { pro_code: proCodes[index] },
          { pro_redeem_rank: index + 1 },
        );
      }
    });
  }

  async clearRanks(): Promise<void> {
    const candidates = await this.productEntity.find({
      where: buildRedeemCandidateWhere(),
      select: { pro_code: true },
    });
    if (candidates.length === 0) return;
    await this.productEntity.update(
      { pro_code: In(candidates.map((candidate) => candidate.pro_code)) },
      { pro_redeem_rank: null },
    );
  }

  async editProduct(
    pro_code: string,
    data: RedeemProductUpdate,
  ): Promise<void> {
    try {
      const product = await this.productEntity.findOne({
        where: { pro_code },
        select: { pro_code: true, pro_stock: true },
      });
      if (!product) throw new NotFoundException('ไม่พบสินค้า');

      this.validatePoint(data.pro_point);
      if (data.pro_redeem_display_quantity !== undefined) {
        this.validateDisplayQuantity(
          data.pro_redeem_display_quantity,
          product.pro_stock,
        );
      }

      await this.productEntity.update(
        {
          pro_code: pro_code,
        },
        {
          pro_point: data.pro_point,
          ...(data.pro_redeem_display_quantity === undefined
            ? {}
            : {
                pro_redeem_display_quantity: data.pro_redeem_display_quantity,
              }),
        },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new Error('Something Error edit Point Product Free');
    }
  }

  async getAllProductFree(): Promise<RedeemAdminOverview> {
    return this.redeemProductSetService.getAdminOverview();
  }

  async updateDisplayLimit(displayLimit: number): Promise<void> {
    await this.redeemProductSetService.updateDisplayLimit(displayLimit);
  }

  async setBackup(
    redeemProductCode: string,
    backupProductCode: string | null,
  ): Promise<void> {
    await this.redeemProductSetService.setBackup(
      redeemProductCode,
      backupProductCode,
    );
  }
}
