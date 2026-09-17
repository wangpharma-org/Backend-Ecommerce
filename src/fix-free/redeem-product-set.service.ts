import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  buildRedeemCandidateWhere,
  getRedeemDisplayQuantity,
  isRedeemProductType,
} from 'src/products/redeem-product.criteria';
import { ProductEntity } from 'src/products/products.entity';
import { RedeemProductBackupEntity } from './redeem-product-backup.entity';
import { RedeemSettingsEntity } from './redeem-settings.entity';

export interface RedeemSetItem {
  redeemProduct: ProductEntity;
  displayProduct: ProductEntity;
  displayQuantity: number;
  isComingSoon: boolean;
}

export interface RedeemProductBackupSummary {
  pro_code: string;
  pro_name: string | null;
  pro_imgmain: string | null;
  pro_stock: number;
  pro_redeem_display_quantity: number | null;
}

export interface RedeemAdminProduct extends ProductEntity {
  backup_product: RedeemProductBackupSummary | null;
  display_product: RedeemProductBackupSummary | null;
  is_visible: boolean;
  is_in_set: boolean;
  display_order: number | null;
  excluded_reason: 'hidden' | 'no_point' | 'out_of_stock' | 'over_limit' | null;
}

export interface RedeemAdminOverview {
  display_limit: number;
  products: RedeemAdminProduct[];
}

const DEFAULT_REDEEM_DISPLAY_LIMIT = 50;

@Injectable()
export class RedeemProductSetService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(RedeemSettingsEntity)
    private readonly settingsRepository: Repository<RedeemSettingsEntity>,
    @InjectRepository(RedeemProductBackupEntity)
    private readonly backupRepository: Repository<RedeemProductBackupEntity>,
  ) {}

  private getProductRepository(
    manager?: EntityManager,
  ): Repository<ProductEntity> {
    return manager?.getRepository(ProductEntity) ?? this.productRepository;
  }

  private getSettingsRepository(
    manager?: EntityManager,
  ): Repository<RedeemSettingsEntity> {
    return (
      manager?.getRepository(RedeemSettingsEntity) ?? this.settingsRepository
    );
  }

  private getBackupRepository(
    manager?: EntityManager,
  ): Repository<RedeemProductBackupEntity> {
    return (
      manager?.getRepository(RedeemProductBackupEntity) ?? this.backupRepository
    );
  }

  private sortCandidates(products: ProductEntity[]): ProductEntity[] {
    return [...products].sort((left, right) => {
      if (
        left.pro_redeem_rank !== null &&
        left.pro_redeem_rank !== undefined &&
        right.pro_redeem_rank !== null &&
        right.pro_redeem_rank !== undefined
      ) {
        return left.pro_redeem_rank - right.pro_redeem_rank;
      }
      if (left.pro_redeem_rank !== null && left.pro_redeem_rank !== undefined) {
        return -1;
      }
      if (
        right.pro_redeem_rank !== null &&
        right.pro_redeem_rank !== undefined
      ) {
        return 1;
      }

      const pointDifference =
        Number(left.pro_point ?? 0) - Number(right.pro_point ?? 0);
      if (pointDifference !== 0) return pointDifference;
      return left.pro_code.localeCompare(right.pro_code);
    });
  }

  private isAvailable(product: ProductEntity): boolean {
    return (
      product.pro_redeem_coming_soon !== true &&
      getRedeemDisplayQuantity(product) > 0
    );
  }

  async getDisplayLimit(manager?: EntityManager): Promise<number> {
    const setting = await this.getSettingsRepository(manager).findOne({
      where: { id: 1 },
    });
    return setting?.displayLimit ?? DEFAULT_REDEEM_DISPLAY_LIMIT;
  }

  async updateDisplayLimit(displayLimit: number): Promise<void> {
    if (!Number.isInteger(displayLimit) || displayLimit < 1) {
      throw new BadRequestException(
        'จำนวนรายการที่แสดงต้องเป็นจำนวนเต็มมากกว่า 0',
      );
    }

    await this.settingsRepository.save({ id: 1, displayLimit });
  }

  async getCustomerSet(manager?: EntityManager): Promise<RedeemSetItem[]> {
    const productRepository = this.getProductRepository(manager);
    const backupRepository = this.getBackupRepository(manager);
    const displayLimit = await this.getDisplayLimit(manager);
    const candidates = await productRepository.find({
      where: buildRedeemCandidateWhere(),
      relations: ['units'],
    });
    const backupRows = await backupRepository.find();
    const backupCodes = backupRows.map((backup) => backup.backupProductCode);
    const backupProducts = backupCodes.length
      ? await productRepository.find({
          where: { pro_code: In(backupCodes) },
          relations: ['units'],
        })
      : [];
    const backupByPrimaryCode = new Map(
      backupRows.map((backup) => [
        backup.redeemProductCode,
        backup.backupProductCode,
      ]),
    );
    const productByCode = new Map(
      [...candidates, ...backupProducts].map((product) => [
        product.pro_code,
        product,
      ]),
    );
    const usedDisplayCodes = new Set<string>();
    const selected: RedeemSetItem[] = [];
    const comingSoonProducts: RedeemSetItem[] = [];

    for (const redeemProduct of this.sortCandidates(candidates)) {
      if (Number(redeemProduct.pro_point ?? 0) <= 0) continue;

      // Coming Soon แยกออกจาก set หลัก จึงไม่กินจำนวนรายการที่ลูกค้าแลกได้
      if (redeemProduct.pro_redeem_coming_soon === true) {
        if (usedDisplayCodes.has(redeemProduct.pro_code)) continue;
        comingSoonProducts.push({
          redeemProduct,
          displayProduct: redeemProduct,
          displayQuantity: 0,
          isComingSoon: true,
        });
        usedDisplayCodes.add(redeemProduct.pro_code);
        continue;
      }

      if (selected.length >= displayLimit) continue;

      // ซ่อนเฉพาะ main product: ไม่ใช้สินค้าสำรองของรายการที่ถูกซ่อน
      if (redeemProduct.pro_redeem_hidden === true) continue;

      const backupCode = backupByPrimaryCode.get(redeemProduct.pro_code);
      const backupProduct = backupCode
        ? productByCode.get(backupCode)
        : undefined;
      const displayProduct = this.isAvailable(redeemProduct)
        ? redeemProduct
        : backupProduct && this.isAvailable(backupProduct)
          ? backupProduct
          : undefined;

      if (!displayProduct || usedDisplayCodes.has(displayProduct.pro_code))
        continue;

      selected.push({
        redeemProduct,
        displayProduct,
        displayQuantity: getRedeemDisplayQuantity(displayProduct),
        isComingSoon: false,
      });
      usedDisplayCodes.add(displayProduct.pro_code);
    }

    return [...selected, ...comingSoonProducts];
  }

  async getAdminOverview(): Promise<RedeemAdminOverview> {
    const candidates = await this.productRepository.find({
      where: buildRedeemCandidateWhere(),
    });
    const backupRows = await this.backupRepository.find();
    const backupCodes = backupRows.map((backup) => backup.backupProductCode);
    const backupProducts = backupCodes.length
      ? await this.productRepository.find({
          where: { pro_code: In(backupCodes) },
          select: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
            pro_stock: true,
            pro_redeem_display_quantity: true,
            pro_redeem_coming_soon: true,
          },
        })
      : [];
    const backupByPrimaryCode = new Map(
      backupRows.map((backup) => [
        backup.redeemProductCode,
        backup.backupProductCode,
      ]),
    );
    const backupProductByCode = new Map(
      backupProducts.map((product) => [product.pro_code, product]),
    );
    const selected = await this.getCustomerSet();
    let displayOrder = 0;
    const selectedByPrimaryCode = new Map(
      selected
        .filter((item) => item.isComingSoon !== true)
        .map((item) => [
          item.redeemProduct.pro_code,
          {
            displayOrder: (displayOrder += 1),
            displayProduct: item.displayProduct,
          },
        ]),
    );
    const displayLimit = await this.getDisplayLimit();

    return {
      display_limit: displayLimit,
      products: this.sortCandidates(candidates).map((product) => {
        const selectedItem = selectedByPrimaryCode.get(product.pro_code);
        const displayOrder = selectedItem?.displayOrder ?? null;
        const backupProduct = backupProductByCode.get(
          backupByPrimaryCode.get(product.pro_code) ?? '',
        );
        const hasAvailableBackup =
          backupProduct !== undefined && this.isAvailable(backupProduct);
        const excludedReason = displayOrder
          ? null
          : product.pro_redeem_hidden === true
            ? 'hidden'
            : Number(product.pro_point ?? 0) <= 0
              ? 'no_point'
              : !this.isAvailable(product) && !hasAvailableBackup
                ? 'out_of_stock'
                : 'over_limit';

        return {
          ...product,
          pro_point: Number(product.pro_point ?? 0),
          pro_redeem_display_quantity: getRedeemDisplayQuantity(product),
          backup_product: backupProduct
            ? {
                pro_code: backupProduct.pro_code,
                pro_name: backupProduct.pro_name,
                pro_imgmain: backupProduct.pro_imgmain,
                pro_stock: backupProduct.pro_stock,
                pro_redeem_display_quantity:
                  backupProduct.pro_redeem_display_quantity,
              }
            : null,
          display_product: selectedItem
            ? {
                pro_code: selectedItem.displayProduct.pro_code,
                pro_name: selectedItem.displayProduct.pro_name,
                pro_imgmain: selectedItem.displayProduct.pro_imgmain,
                pro_stock: selectedItem.displayProduct.pro_stock,
                pro_redeem_display_quantity:
                  selectedItem.displayProduct.pro_redeem_display_quantity,
              }
            : null,
          is_visible: displayOrder !== null,
          is_in_set: displayOrder !== null,
          display_order: displayOrder,
          excluded_reason: excludedReason,
        };
      }),
    };
  }

  async setBackup(
    redeemProductCode: string,
    backupProductCode: string | null,
  ): Promise<void> {
    const redeemProduct = await this.productRepository.findOne({
      where: { pro_code: redeemProductCode },
      select: { pro_code: true, pro_free: true, pro_supplier: true },
    });
    if (!redeemProduct) {
      throw new BadRequestException('ไม่พบสินค้าแลกแต้ม');
    }
    if (!isRedeemProductType(redeemProduct)) {
      throw new BadRequestException('สินค้าหลักไม่ได้อยู่ในรายการแลกแต้ม');
    }
    if (redeemProductCode === backupProductCode) {
      throw new BadRequestException('สินค้าสำรองต้องไม่ใช่สินค้าเดียวกัน');
    }
    if (!backupProductCode) {
      await this.backupRepository.delete({ redeemProductCode });
      return;
    }

    const backupProduct = await this.productRepository.findOne({
      where: { pro_code: backupProductCode },
      select: { pro_code: true },
    });
    if (!backupProduct) {
      throw new BadRequestException('ไม่พบสินค้าสำรอง');
    }

    const backupOwner = await this.backupRepository.findOne({
      where: { backupProductCode },
    });
    if (backupOwner && backupOwner.redeemProductCode !== redeemProductCode) {
      throw new BadRequestException(
        'สินค้าสำรองนี้ถูกกำหนดให้สินค้าหลักรายการอื่นแล้ว',
      );
    }

    await this.backupRepository.save({
      redeemProductCode,
      backupProductCode,
    });
  }

  async removeBackupForRedeemProduct(redeemProductCode: string): Promise<void> {
    await this.backupRepository.delete({ redeemProductCode });
  }

  async updateDisplayStatus(
    redeemProductCode: string,
    isHidden: boolean,
    isComingSoon: boolean,
  ): Promise<void> {
    if (typeof isHidden !== 'boolean' || typeof isComingSoon !== 'boolean') {
      throw new BadRequestException('สถานะการแสดงผลไม่ถูกต้อง');
    }

    const product = await this.productRepository.findOne({
      where: { pro_code: redeemProductCode },
      select: { pro_code: true, pro_free: true, pro_supplier: true },
    });
    if (!product || !isRedeemProductType(product)) {
      throw new BadRequestException('ไม่พบสินค้าหลักในรายการแลกแต้ม');
    }

    await this.productRepository.update(
      { pro_code: redeemProductCode },
      {
        pro_redeem_hidden: isHidden,
        pro_redeem_coming_soon: isComingSoon,
      },
    );
  }
}
