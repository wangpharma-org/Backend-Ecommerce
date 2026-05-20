/* eslint-disable prettier/prettier */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { InjectRepository } from '@nestjs/typeorm';
import { HotdealEntity } from './hotdeal.entity';
import { In, Repository } from 'typeorm';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { UserEntity } from 'src/users/users.entity';
import * as AWS from 'aws-sdk';
import { BannerHotdealEntity } from './hotdeal-banner.entity';
import { ProductEntity } from 'src/products/products.entity';

export interface HotdealInput {
  pro1_code: string;
  pro1_amount: string;
  pro1_unit: string;
  pro2_code: string;
  pro2_amount: string;
  pro2_unit: string;
}

@Injectable()
export class HotdealService {
  private s3: AWS.S3;
  constructor(
    @InjectRepository(HotdealEntity)
    private readonly hotdealRepo: Repository<HotdealEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Inject(forwardRef(() => ProductsService))
    private readonly productService: ProductsService,
    @Inject(forwardRef(() => ShoppingCartService))
    private readonly shoppingCartService: ShoppingCartService,
    @InjectRepository(BannerHotdealEntity)
    private readonly bannerHotdealRepo: Repository<BannerHotdealEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

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

  // ตรวจสอบแล้วว่าใช้ได้
  async find(pro_code: string): Promise<HotdealEntity | null> {
    return await this.hotdealRepo.findOne({
      where: { product: { pro_code } },
      relations: ['product', 'product2'],
      select: {
        product: {
          pro_code: true,
        },
        product2: {
          pro_code: true,
        },
      },
    });
  }

  // ตรวจสอบแล้วว่าใช้ได้
  async searchProduct(keyword: string) {
    return this.productService.searchByCodeOrSupplier(keyword);
  }

  // นายเขียนเอง
  async checkAndAddProductToHotdeal(
    pro_code: string,
    unit_hotdeal: string,
    number_amount: number,
    pro_code2: string,
    pro_unit2: string,
  ) {
    try {
      const productHotdeal = await this.productService.getProductOne(pro_code);
      if (!productHotdeal) {
        throw new Error(`Product not found for pro_code: ${pro_code}`);
      }

      const unitRatioMap: Record<string, number> = {};
      if (productHotdeal.pro_unit1)
        unitRatioMap[productHotdeal.pro_unit1] = productHotdeal.pro_ratio1;
      if (productHotdeal.pro_unit2)
        unitRatioMap[productHotdeal.pro_unit2] = productHotdeal.pro_ratio2;
      if (productHotdeal.pro_unit3)
        unitRatioMap[productHotdeal.pro_unit3] = productHotdeal.pro_ratio3;

      const hotdeal = await this.hotdealRepo.findOne({
        where: { product: { pro_code } },
        relations: ['product', 'product2'],
      });

      const amountSmallestHotdeal = hotdeal
        ? Number(hotdeal.pro1_amount) * (unitRatioMap[hotdeal.pro1_unit] ?? 1)
        : number_amount * (unitRatioMap[unit_hotdeal] ?? 1);
      const targetProCode2 = hotdeal?.product2?.pro_code || pro_code2;
      const targetProUnit2 = hotdeal?.pro2_unit || pro_unit2;
      const targetProAmount2 = hotdeal ? Number(hotdeal.pro2_amount) : 1;

      const hotdealProductInCart =
        await this.shoppingCartService.find(pro_code);
      if (!hotdealProductInCart?.length) return;

      const totalsByMember: Record<string, number> = {};

      for (const item of hotdealProductInCart) {
        if (!item.hotdeal_free) { // ไม่นำของแถมมาคิดรวม
          const ratio = unitRatioMap[item.spc_unit] ?? 1;
          totalsByMember[item.mem_code] =
            (totalsByMember[item.mem_code] ?? 0) + item.spc_amount * ratio;
        }
      }

      for (const [mem_code, totalAmountInCartSmallest] of Object.entries(
        totalsByMember,
      )) {
        const sets = Math.floor(
          totalAmountInCartSmallest / amountSmallestHotdeal,
        );
        const amountFreebies = sets * targetProAmount2;
        if (amountFreebies > 0) {
          await this.shoppingCartService.addProductCartHotDeal({
            mem_code,
            pro_code: targetProCode2,
            pro_unit: targetProUnit2,
            amount: amountFreebies,
            hotdeal_free: true,
            hotdeal_promain: pro_code,
          });
        }
      }
    } catch (error) {
      throw new Error(
        'Something Error in checkAndAddProductToHotdeal: ' + error,
      );
    }
  }

  // ตรวจสอบและแก้ไขแล้ว
  async saveHotdeal(
    datainput: HotdealInput,
    id?: number,
    order?: number,
    special_deal?: boolean,
  ): Promise<string> {
    try {
      if (id) {
        const existingHotdeal = await this.hotdealRepo.findOne({
          where: { id: id },
        });
        if (existingHotdeal) {
          await this.hotdealRepo.update(
            { id: existingHotdeal.id },
            { order: order, special_deal: special_deal },
          );
        }
      } else {
        const existingHotdeal = await this.hotdealRepo.findOne({
          where: {
            product: { pro_code: datainput.pro1_code },
          },
        });
        console.log('Existing hotdeal:', existingHotdeal);

        if (existingHotdeal) {
          await this.shoppingCartService.removeAllCarthotdeal(
            datainput.pro1_code,
          );
          await this.hotdealRepo.save({
            id: existingHotdeal.id,
            pro1_amount: datainput.pro1_amount,
            pro1_unit: datainput.pro1_unit,
            pro2_amount: datainput.pro2_amount,
            pro2_unit: datainput.pro2_unit,
            product: { pro_code: datainput.pro1_code } as ProductEntity,
            product2: { pro_code: datainput.pro2_code } as ProductEntity,
          });
        } else {
          const hotdeal = this.hotdealRepo.create({
            pro1_amount: datainput.pro1_amount,
            pro1_unit: datainput.pro1_unit,
            pro2_amount: datainput.pro2_amount,
            pro2_unit: datainput.pro2_unit,
            product: { pro_code: datainput.pro1_code },
            product2: { pro_code: datainput.pro2_code },
          });

          await this.hotdealRepo.save(hotdeal);
        }
        await this.checkAndAddProductToHotdeal(
          datainput.pro1_code,
          datainput.pro1_unit,
          Number(datainput.pro1_amount),
          datainput.pro2_code,
          datainput.pro2_unit,
        );
      }
      return 'add hotdeal successfully';
    } catch (error) {
      console.error('Error saving hotdeal:', error);
      throw new Error('Something Error in saveHotdeal');
    }
  }

  // ตรวจสอบแล้วว่าใช้ได้
  async getAllHotdealsWithProductNames() {
    const hotdeals = await this.hotdealRepo.find({
      relations: ['product', 'product2'],
      order: { order: 'ASC' },
    });

    return hotdeals.map((hotdeal) => ({
      id: hotdeal.id,
      pro_code: hotdeal.product?.pro_code || null,
      pro2_code: hotdeal.product2?.pro_code || null,
      pro1_amount: hotdeal.pro1_amount,
      pro1_unit: hotdeal.pro1_unit,
      pro2_amount: hotdeal.pro2_amount,
      pro2_unit: hotdeal.pro2_unit,
      pro_name: hotdeal.product?.pro_name || null,
      pro2_name: hotdeal.product2?.pro_name || null,
      order: hotdeal.order,
      special_deal: hotdeal.special_deal,
      pro1_stock: hotdeal.product?.pro_stock || 0,
      pro2_stock: hotdeal.product2?.pro_stock || 0,
    }));
  }

  // Optimize แล้ว
  async deleteHotdeal(
    id: number,
    pro_code2: string,
  ): Promise<{ message: string }> {
    try {
      await this.shoppingCartService.removeAllCarthotdeal(pro_code2);
      await this.hotdealRepo.delete(id);
      return { message: 'Hotdeal deleted successfully' };
    } catch (error) {
      console.error('Error deleting hotdeal:', error);
      return { message: 'Error deleting hotdeal' };
    }
  }

  // ตรวจสอบแล้วว่าใช้ได้
  async getAllHotdealsWithProductDetail(
    limit?: number,
    offset?: number,
    mem_code?: string,
    mem_route?: string,
  ) {
    const isL16 = await this.isL16Member(mem_code, mem_route);
    const query = this.hotdealRepo
      .createQueryBuilder('hotdeal')
      .leftJoinAndSelect('hotdeal.product', 'product')
      .leftJoinAndSelect('hotdeal.product2', 'product2')
      .orderBy('hotdeal.order', 'ASC');

    if (mem_code) {
      query
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', mem_code)
        .leftJoinAndSelect(
          'product2.inCarts',
          'cart2',
          'cart2.mem_code = :mem_code',
          { mem_code },
        );
    }

    if (limit) {
      query.take(limit);
    }
    if (offset) {
      query.skip(offset);
    }

    if (!isL16) {
      query
        .andWhere(
          '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)',
        )
        .andWhere(
          '(product2.pro_l16_only = 0 OR product2.pro_l16_only IS NULL)',
        );
    }

    const hotdeals = await query.getMany();

    const result = hotdeals.map((hotdeal) => {
      type ProductType = {
        pro_code: string;
        pro_name: string;
        pro_priceA: number;
        pro_priceB: number;
        pro_priceC: number;
        pro_imgmain: string;
        pro_ratio1: number;
        pro_ratio2: number;
        pro_ratio3: number;
        pro_unit1: string;
        pro_unit2: string;
        pro_unit3: string;
        viwers: number;
        pro_stock: number;
        order_quantity: number;
        pro_lowest_stock: number;
        inCarts?: any[];
      };

      const pickProductFields = (product: ProductType | null | undefined) =>
        product
          ? {
            pro_code: product.pro_code,
            pro_name: product.pro_name,
            pro_priceA: product.pro_priceA,
            pro_priceB: product.pro_priceB,
            pro_priceC: product.pro_priceC,
            pro_imgmain: product.pro_imgmain,
            pro_ratio1: product.pro_ratio1,
            pro_ratio2: product.pro_ratio2,
            pro_ratio3: product.pro_ratio3,
            pro_unit1: product.pro_unit1,
            pro_unit2: product.pro_unit2,
            pro_unit3: product.pro_unit3,
            pro_stock: product.pro_stock,
            viwers: product.viwers,
            order_quantity: product.order_quantity,
            pro_lowest_stock: product.pro_lowest_stock,
          }
          : null;

      return {
        id: hotdeal.id,
        pro1_amount: hotdeal.pro1_amount,
        pro1_unit: hotdeal.pro1_unit,
        pro2_amount: hotdeal.pro2_amount,
        pro2_unit: hotdeal.pro2_unit,
        product: pickProductFields(hotdeal.product as ProductType),
        product2: pickProductFields(hotdeal.product2 as ProductType),
        shopping_cart: mem_code
          ? {
            product_cart: (hotdeal.product as ProductType)?.inCarts || [],
            product2_cart: (hotdeal.product2 as ProductType)?.inCarts || [],
          }
          : 'ไม่เจอข้อมูล',
        order: hotdeal.order,
        special_deal: hotdeal.special_deal,
      };
    });
    return result;
  }

  // ตรวจสอบแล้วคิดว่าใช้งานได้
  async checkHotdealMatch(
    pro_code: string,
    shopping_cart: { pro1_unit: string; pro1_amount: string }[],
    freebie_pro_code?: string,
  ): Promise<
    | {
      pro_code: string;
      match: boolean;
      countFreeBies: string;
      product2: { pro_code: string; pro_name: string; pro_imgmain?: string };
      hotdeal: {
        pro1_amount: string;
        pro1_unit: string;
        pro2_amount: string;
        pro2_unit: string;
      };
    }
    | undefined
  > {
    try {
      const found = await this.hotdealRepo.findOne({
        where: freebie_pro_code
          ? { product: { pro_code }, product2: { pro_code: freebie_pro_code } }
          : { product: { pro_code } },
        relations: ['product', 'product2'],
      });

      if (!found) return undefined;

      let fromFrontend = 0;
      for (const item of shopping_cart) {
        const converted = await this.convertToSmallestUnit(
          pro_code,
          item.pro1_amount,
          item.pro1_unit,
        );
        fromFrontend += converted ?? 0;
      }
      const fromDatabase = await this.convertToSmallestUnit(
        pro_code,
        found.pro1_amount,
        found.pro1_unit,
      );

      const threshold = fromDatabase ?? 0;
      const cal = threshold > 0 ? Math.floor(fromFrontend / threshold) : 0;
      const hotdealFreebies = found.pro2_amount
        ? Math.floor(cal * Number(found.pro2_amount))
        : 0;

      return {
        pro_code,
        match: threshold > 0 && cal >= 1,
        countFreeBies: hotdealFreebies.toString(),
        product2: {
          pro_code: found.product2?.pro_code || '',
          pro_name: found.product2?.pro_name || '',
          pro_imgmain: found.product2?.pro_imgmain || '',
        },
        hotdeal: {
          pro1_amount: found.pro1_amount,
          pro1_unit: found.pro1_unit,
          pro2_amount: found.pro2_amount,
          pro2_unit: found.pro2_unit,
        },
      };
    } catch (error) {
      console.error('Error checking hotdeal match:', error);
      throw error;
    }
  }

  // ตรวจสอบแล้วว่าใช้งานได้
  async convertToSmallestUnit(
    pro_code: string,
    spc_amount: string,
    spc_unit: string,
  ): Promise<number | null> {
    const product = await this.productService.getProductOne(pro_code);
    if (!product) {
      return null;
    }

    const units = [
      { unit: product.pro_unit1, ratio: product.pro_ratio1 },
      { unit: product.pro_unit2, ratio: product.pro_ratio2 },
      { unit: product.pro_unit3, ratio: product.pro_ratio3 },
    ];

    const found = units.find((u) => u.unit === spc_unit);
    if (!found || !found.ratio) {
      return null;
    }
    return Number(spc_amount) * Number(found.ratio);
  }

  // ตรวจสอบแล้วว่าใช้งานได้
  async getHotdealFromCode(pro_code: string): Promise<HotdealEntity | null> {
    return this.hotdealRepo.findOne({
      where: { product: { pro_code } },
    });
  }

  async findAllHotdeals(): Promise<HotdealEntity[]> {
    return await this.hotdealRepo.find({
      relations: ['product', 'product2'],
      select: {
        pro1_amount: true,
        pro1_unit: true,
        pro2_amount: true,
        pro2_unit: true,
        product: {
          pro_code: true,
        },
        product2: {
          pro_code: true,
        },
        order: true,
      },
    });
  }

  async uploadBannerHotdeal(file: Express.Multer.File | null, id_hotdeal: number) {
    let imageUrl: string | undefined = undefined;
    try {
      if (!file) {
        throw new Error('No file uploaded');
      }
      const hotdeal = await this.hotdealRepo.findOne({ where: { id: id_hotdeal } });
      if (!hotdeal) {
        throw new Error('Hotdeal not found');
      }
      const findBannerHotdeal = await this.bannerHotdealRepo.findOne({ where: { hotdeal: { id: id_hotdeal } } });
      if (findBannerHotdeal) {
        throw new Error('Banner for this hotdeal already exists');
      }
      const hasValidCredentials =
        process.env.DO_SPACES_KEY &&
        process.env.DO_SPACES_KEY !== 'placeholder' &&
        process.env.DO_SPACES_SECRET &&
        process.env.DO_SPACES_SECRET !== 'placeholder';
      if (hasValidCredentials) {

        const params = {
          Bucket: 'wang-storage',
          Key: `hotdeal-banners/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file?.originalname}`,
          Body: file?.buffer,
          ContentType: file?.mimetype,
          ACL: 'public-read',
        };
        const uploadResult = await this.s3.upload(params).promise();
        imageUrl = uploadResult.Location;
      } else {
        const randomSeed = Date.now();
        imageUrl = `https://picsum.photos/seed/${randomSeed}/1200/400`;
      }

      const bannerHotdeal = this.bannerHotdealRepo.create({
        banner_url: imageUrl,
        hotdeal: { id: hotdeal.id },
      });
      await this.bannerHotdealRepo.save(bannerHotdeal);
    } catch (error) {
      console.error('Error uploading banner for hotdeal:', error);
      throw new Error('Something Error in uploadBannerHotdeal');
    }
  }

  async getAllHotdealsWithBanners() {
    try {
      return await this.bannerHotdealRepo.find({
        relations: ['hotdeal', 'hotdeal.product', 'hotdeal.product2'],
        order: { banner_hotdeal_id: 'ASC' },
      });
    } catch (error) {
      console.error('Error fetching hotdeals with banners:', error);
      throw new Error('Something Error in getAllHotdealsWithBanners');
    }
  }

  async deleteBannerHotdeal(id: number) {
    try {
      const banner = await this.bannerHotdealRepo.findOne({
        where: { banner_hotdeal_id: id },
      });

      if (banner && banner.banner_url) {
        const bannerUrl = banner.banner_url;
        if (bannerUrl.includes('digitaloceanspaces.com') && bannerUrl.includes('hotdeal-banners/')) {
          const key = bannerUrl.substring(bannerUrl.indexOf('hotdeal-banners/'));
          const hasValidCredentials =
            process.env.DO_SPACES_KEY &&
            process.env.DO_SPACES_KEY !== 'placeholder' &&
            process.env.DO_SPACES_SECRET &&
            process.env.DO_SPACES_SECRET !== 'placeholder';

          if (hasValidCredentials) {
            try {
              const params = {
                Bucket: 'wang-storage',
                Key: decodeURIComponent(key),
              };
              await this.s3.deleteObject(params).promise();
            } catch (s3Error) {
              console.error('Error deleting image from S3:', s3Error);
            }
          }
        }
      }

      await this.bannerHotdealRepo.delete(id);
      return { message: 'Banner hotdeal deleted successfully' };
    } catch (error) {
      console.error('Error deleting banner hotdeal:', error);
      throw new Error('Something Error in deleteBannerHotdeal');
    }
  }

  async getHotdealFromproCode(
    pro_code: string,
    mem_code: string,
  ): Promise<{
    hotdeal: HotdealEntity;
    totalAmountInSmallestUnit: number;
    eligibleForFreebie: boolean;
    remainingPoints: number;
    freebies: {
      pro_code: string;
      unit: string;
      quantity: number;
      usedPoints: number;
      remainingPointsForThis: number;
    }[];
  } | null> {
    const hotdeal = await this.hotdealRepo.findOne({
      where: { product: { pro_code } },
      relations: ['product', 'product2'],
      select: {
        pro1_amount: true,
        pro1_unit: true,
        pro2_amount: true,
        pro2_unit: true,
        product: {
          pro_code: true,
          pro_name: true,
        },
        product2: {
          pro_code: true,
          pro_name: true,
        },
      },
    });

    if (!hotdeal) {
      return null;
    }

    const cartItems =
      await this.shoppingCartService.getOrderFromCartMember(
        mem_code,
        pro_code,
      );

    let totalAmountInSmallestUnit = 0;
    if (cartItems && cartItems.length > 0) {
      const product: ProductEntity | null = await this.productService.getProductOne(pro_code);
      if (product) {
        const units: { unit: string; ratio: number }[] = [
          { unit: product.pro_unit1 as string, ratio: product.pro_ratio1 as number },
          { unit: product.pro_unit2 as string, ratio: product.pro_ratio2 as number },
          { unit: product.pro_unit3 as string, ratio: product.pro_ratio3 as number },
        ];

        totalAmountInSmallestUnit = cartItems.reduce((total, item) => {
          if (item.hotdeal_free) return total; // ไม่นำของแถมมาคิดรวม
          const foundUnit = units.find((u) => u.unit === item.spc_unit);
          if (foundUnit && foundUnit.ratio) {
            return total + Number(item.spc_amount) * Number(foundUnit.ratio);
          }
          return total;
        }, 0);

        const conditionInSmallestUnit = units.find(
          (u) => u.unit === hotdeal.pro1_unit,
        )?.ratio;
        if (conditionInSmallestUnit) {
          hotdeal.pro1_amount = (
            Number(hotdeal.pro1_amount) * Number(conditionInSmallestUnit)
          ).toString();
          hotdeal.pro1_unit = product.pro_unit1 as string;
        }
      }
    }

    const freebies: {
      pro_code: string;
      unit: string;
      quantity: number;
      usedPoints: number;
      remainingPointsForThis: number;
    }[] = [];

    let remainingPoints = totalAmountInSmallestUnit;

    if (totalAmountInSmallestUnit > 0) {
      if (hotdeal.pro1_amount && hotdeal.pro1_unit && hotdeal.product2) {
        const conditionInSmallestUnit = await this.convertToSmallestUnit(
          pro_code,
          hotdeal.pro1_amount,
          hotdeal.pro1_unit,
        );

        if (conditionInSmallestUnit && conditionInSmallestUnit > 0) {
          const sets = Math.floor(
            totalAmountInSmallestUnit / conditionInSmallestUnit,
          );
          const usedPoints = sets * conditionInSmallestUnit;
          const remainingPointsForThis = totalAmountInSmallestUnit - usedPoints;

          freebies.push({
            pro_code: hotdeal.product2.pro_code,
            unit: hotdeal.pro2_unit,
            quantity: sets * Number(hotdeal.pro2_amount),
            usedPoints: usedPoints,
            remainingPointsForThis: remainingPointsForThis,
          });

          if (sets > 0) {
            remainingPoints = Math.min(remainingPoints, remainingPointsForThis);
          }
        }
      }
    }

    const eligibleForFreebie = freebies.some((f) => f.quantity > 0);

    return { 
      hotdeal, 
      totalAmountInSmallestUnit, 
      eligibleForFreebie, 
      remainingPoints,
      freebies 
    };
  }

  async getHotdealByProCode(pro_code: string[]): Promise<HotdealEntity[] | null> {
    return await this.hotdealRepo.find({
      where: { product: { pro_code: In(pro_code) } },
      relations: ['product', 'product2'],
      select: {
        pro1_amount: true,
        pro1_unit: true,
        pro2_amount: true,
        pro2_unit: true,
        product: {
          pro_code: true,
          pro_name: true,
        },
        product2: {
          pro_code: true,
          pro_name: true,
        },
      },
      order: { pro1_amount: 'ASC' },
    });
  }
}
