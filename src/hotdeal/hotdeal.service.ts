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
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';

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

      // ใช้ units relationship แทนการเข้าถึง properties โดยตรง
      const unitRatioMap: Record<string, number> = {};
      if (productHotdeal.units) {
        productHotdeal.units.forEach((unit) => {
          unitRatioMap[String(unit.level)] = unit.ratio || 1;
        });
      }

      let minSmallestAmount = Infinity;
      let bestHotdeal: HotdealEntity | null = null;

      // ดึง hotdeals ทั้งหมดของสินค้าหลักนี้เพื่อหาเงื่อนไขที่ใช้แต้มน้อยที่สุดในหน่วยเล็กสุด
      const hotdeals = await this.hotdealRepo.find({
        where: { product: { pro_code } },
        relations: ['product', 'product2'],
      });

      for (const hd of hotdeals) {
        const ratio = unitRatioMap[hd.pro1_unit] ?? 1;
        const amountInSmallest = Number(hd.pro1_amount) * ratio;

        if (amountInSmallest > 0 && amountInSmallest < minSmallestAmount && hd.product2) {
          minSmallestAmount = amountInSmallest;
          bestHotdeal = hd;
        }
      }

      // หากไม่พบข้อมูลในฐานข้อมูล (fallback)
      if (!bestHotdeal) {
        minSmallestAmount = number_amount * (unitRatioMap[unit_hotdeal] ?? 1);
      }

      const amountSmallestHotdeal = minSmallestAmount;

      if (amountSmallestHotdeal <= 0) return;

      const targetProCode2 = bestHotdeal?.product2?.pro_code || pro_code2;
      const targetProAmount2 = bestHotdeal ? Number(bestHotdeal.pro2_amount) : 1;

      // pro2_unit ใน DB เก็บเป็น enum string ("1"/"2"/"3") หลัง migration
      // ต้องแปลงเป็นชื่อหน่วยจริงก่อนส่งไป addProductCartHotDeal
      let targetProUnit2 = pro_unit2;
      const rawUnit2 = bestHotdeal?.pro2_unit ?? pro_unit2;
      const unitLevel2 = Number(rawUnit2);
      if ([1, 2, 3].includes(unitLevel2)) {
        const transformed2 = await this.productService.transformProductWithUnits({
          pro_code: targetProCode2,
        });
        if (unitLevel2 === 1) targetProUnit2 = transformed2.pro_unit1;
        else if (unitLevel2 === 2) targetProUnit2 = transformed2.pro_unit2;
        else if (unitLevel2 === 3) targetProUnit2 = transformed2.pro_unit3;
      } else {
        targetProUnit2 = rawUnit2;
      }

      const hotdealProductInCart =
        await this.shoppingCartService.find(pro_code);
      if (!hotdealProductInCart?.length) return;

      const totalsByMember: Record<string, number> = {};

      for (const item of hotdealProductInCart) {
        if (!item.hotdeal_free) { // ไม่นำของแถมมาคิดรวม
          const ratio = unitRatioMap[item.spc_unit_enum] ?? 1;
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
        const duplicate = await this.hotdealRepo.findOne({
          where: {
            product: { pro_code: datainput.pro1_code },
            product2: { pro_code: datainput.pro2_code },
          },
          relations: ['product', 'product2'],
        });

        if (duplicate) {
          await this.hotdealRepo.delete({ id: duplicate.id });
        }

        const hotdeal = this.hotdealRepo.create({
          pro1_amount: datainput.pro1_amount,
          pro1_unit: datainput.pro1_unit,
          pro2_amount: datainput.pro2_amount,
          pro2_unit: datainput.pro2_unit,
          product: { pro_code: datainput.pro1_code },
          product2: { pro_code: datainput.pro2_code },
        });

        await this.hotdealRepo.save(hotdeal);
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
      relations: ['product', 'product.units', 'product2', 'product2.units'],
      order: { order: 'ASC' },
    });

    const hotdealitems = await Promise.all(
      hotdeals.map(async (hotdeal) => {
        // ใช้ transformProductWithUnits เหมือนไฟล์อื่นๆ
        let pro1_unit = hotdeal.pro1_unit;
        let pro2_unit = hotdeal.pro2_unit;

        if (hotdeal.product) {
          const transformedProduct = await this.productService.transformProductWithUnits(hotdeal.product);
          const unitLevel = Number(hotdeal.pro1_unit);
          if (unitLevel === 1) pro1_unit = transformedProduct.pro_unit1;
          else if (unitLevel === 2) pro1_unit = transformedProduct.pro_unit2;
          else if (unitLevel === 3) pro1_unit = transformedProduct.pro_unit3;
        }

        if (hotdeal.product2) {
          const transformedProduct2 = await this.productService.transformProductWithUnits(hotdeal.product2);
          const unitLevel = Number(hotdeal.pro2_unit);
          if (unitLevel === 1) pro2_unit = transformedProduct2.pro_unit1;
          else if (unitLevel === 2) pro2_unit = transformedProduct2.pro_unit2;
          else if (unitLevel === 3) pro2_unit = transformedProduct2.pro_unit3;
        }

        return {
          id: hotdeal.id,
          pro_code: hotdeal.product?.pro_code || null,
          pro2_code: hotdeal.product2?.pro_code || null,
          pro1_amount: hotdeal.pro1_amount,
          pro1_unit,
          pro2_amount: hotdeal.pro2_amount,
          pro2_unit,
          pro_name: hotdeal.product?.pro_name || null,
          pro2_name: hotdeal.product2?.pro_name || null,
          order: hotdeal.order,
          special_deal: hotdeal.special_deal,
          pro1_stock: hotdeal.product?.pro_stock || 0,
          pro2_stock: hotdeal.product2?.pro_stock || 0,
        };
      })
    );

    return hotdealitems;
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
      .leftJoinAndSelect('product.units', 'units1')
      .leftJoinAndSelect('hotdeal.product2', 'product2')
      .leftJoinAndSelect('product2.units', 'units2')
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

    type UnitDef = { level: number; unit_name: string; ratio: number };

    const getUnits = (product: ProductEntity | null | undefined): UnitDef[] =>
      (product as unknown as { units?: UnitDef[] })?.units ?? [];

    const resolveUnitName = (enumVal: string, units: UnitDef[]): string => {
      const level = Number(enumVal);
      return units.find((u) => u.level === level)?.unit_name ?? enumVal;
    };

    const pickProductFields = (product: ProductEntity | null | undefined) => {
      if (!product) return null;
      const units = getUnits(product);
      const unit1 = units.find((u) => u.level === 1);
      const unit2 = units.find((u) => u.level === 2);
      const unit3 = units.find((u) => u.level === 3);
      return {
        pro_code: product.pro_code,
        pro_name: product.pro_name,
        pro_priceA: product.pro_priceA,
        pro_priceB: product.pro_priceB,
        pro_priceC: product.pro_priceC,
        pro_imgmain: product.pro_imgmain,
        pro_stock: product.pro_stock,
        viwers: product.viwers,
        order_quantity: product.order_quantity,
        pro_lowest_stock: product.pro_lowest_stock,
        pro_unit1: unit1?.unit_name ?? '',
        pro_unit2: unit2?.unit_name ?? '',
        pro_unit3: unit3?.unit_name ?? '',
        pro_ratio1: unit1?.ratio ?? 1,
        pro_ratio2: unit2?.ratio ?? 1,
        pro_ratio3: unit3?.ratio ?? 1,
      };
    };

    const resolveCartItems = (
      carts: ShoppingCartEntity[],
      units: UnitDef[],
    ) =>
      carts.map((cart) => {
        const found = units.find(
          (u) => u.level === Number(cart.spc_unit_enum),
        );
        const cartObj = { ...(cart as unknown as Record<string, unknown>) };
        delete cartObj['spc_unit_enum'];
        return { ...cartObj, spc_unit: found?.unit_name ?? '' };
      });

    const result = hotdeals.map((hotdeal) => {
      const units1 = getUnits(hotdeal.product);
      const units2 = getUnits(hotdeal.product2);

      return {
        id: hotdeal.id,
        pro1_amount: hotdeal.pro1_amount,
        pro1_unit: resolveUnitName(hotdeal.pro1_unit, units1),
        pro2_amount: hotdeal.pro2_amount,
        pro2_unit: resolveUnitName(hotdeal.pro2_unit, units2),
        product: pickProductFields(hotdeal.product),
        product2: pickProductFields(hotdeal.product2),
        shopping_cart: mem_code
          ? {
              product_cart: resolveCartItems(
                hotdeal.product?.inCarts ?? [],
                units1,
              ),
              product2_cart: resolveCartItems(
                hotdeal.product2?.inCarts ?? [],
                units2,
              ),
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
        where: { product: { pro_code } },
        relations: ['product', 'product.units', 'product2', 'product2.units'],
      });


      // ใช้ transformProductWithUnits สำหรับแปลงหน่วย
      let pro1_unit = found?.pro1_unit;
      let pro2_unit = found?.pro2_unit;

      if (found?.product) {
        const transformedProduct = await this.productService.transformProductWithUnits(found.product);
        const unitLevel = Number(found.pro1_unit);
        if (unitLevel === 1) pro1_unit = transformedProduct.pro_unit1;
        else if (unitLevel === 2) pro1_unit = transformedProduct.pro_unit2;
        else if (unitLevel === 3) pro1_unit = transformedProduct.pro_unit3;
      }

      if (found?.product2) {
        const transformedProduct2 = await this.productService.transformProductWithUnits(found.product2);
        const unitLevel = Number(found.pro2_unit);
        if (unitLevel === 1) pro2_unit = transformedProduct2.pro_unit1;
        else if (unitLevel === 2) pro2_unit = transformedProduct2.pro_unit2;
        else if (unitLevel === 3) pro2_unit = transformedProduct2.pro_unit3;
      }


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
        found?.pro1_amount ?? '',
        pro1_unit ?? '',
      );

      let match = false;
      if (found) {
        const amountInCart = fromFrontend ?? 0;
        const cal = Math.floor(amountInCart / (fromDatabase ?? 0));

        const hotdealFreebies = found?.pro2_amount
          ? Math.floor(cal * Number(found.pro2_amount))
          : 0;

        if ((fromDatabase ?? 0) > 0 && cal >= 1) {
          match = true;
        }

        return {
          pro_code,
          match,
          countFreeBies: hotdealFreebies.toString(),
          product2: {
            pro_code: found.product2?.pro_code || '',
            pro_name: found.product2?.pro_name || '',
            pro_imgmain: found.product2?.pro_imgmain || '',
          },
          hotdeal: {
            pro1_amount: found.pro1_amount,
            pro1_unit: pro1_unit ?? '',
            pro2_amount: found.pro2_amount,
            pro2_unit: pro2_unit ?? '',
          },
        };
      }

      return undefined;
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

    // product มี pro_unit1/2/3 และ pro_ratio1/2/3 เป็น string/number
    let ratio = 1;
    if (spc_unit === product.pro_unit1) ratio = product.pro_ratio1;
    else if (spc_unit === product.pro_unit2) ratio = product.pro_ratio2;
    else if (spc_unit === product.pro_unit3) ratio = product.pro_ratio3;
    else ratio = 1;

    return Number(spc_amount) * Number(ratio);
  }

  async getHotdealFromCode(pro_code: string) {
    const hotdeal = await this.hotdealRepo.findOne({
      where: { product: { pro_code } },
      relations: ['product', 'product2'],
    });
    if (!hotdeal) return null;

    let pro1_unit = hotdeal.pro1_unit;
    let pro2_unit = hotdeal.pro2_unit;

    // แปลง pro1_unit เป็น string ชื่อหน่วยจริง
    if (hotdeal.product?.pro_code) {
      const transformed = await this.productService.transformProductWithUnits(hotdeal.product);
      const unitLevel = Number(hotdeal.pro1_unit);
      if (unitLevel === 1) pro1_unit = transformed.pro_unit1;
      else if (unitLevel === 2) pro1_unit = transformed.pro_unit2;
      else if (unitLevel === 3) pro1_unit = transformed.pro_unit3;
    }
    // แปลง pro2_unit เป็น string ชื่อหน่วยจริง
    if (hotdeal.product2?.pro_code) {
      const transformed2 = await this.productService.transformProductWithUnits(hotdeal.product2);
      const unitLevel2 = Number(hotdeal.pro2_unit);
      if (unitLevel2 === 1) pro2_unit = transformed2.pro_unit1;
      else if (unitLevel2 === 2) pro2_unit = transformed2.pro_unit2;
      else if (unitLevel2 === 3) pro2_unit = transformed2.pro_unit3;
    }

    return {
      ...hotdeal,
      pro1_unit,
      pro2_unit,
    };
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
    hotdeal: HotdealEntity[];
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
    const hotdeal = await this.hotdealRepo.find({
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

    if (!hotdeal || hotdeal.length === 0) {
      return null;
    }

    // Get และ cache product transformation ครั้งเดียว
    const product = await this.productService.getProductOne(pro_code);
    if (!product) {
      return null;
    }

    const transformedProduct = await this.productService.transformProductWithUnits(product);

    // สร้าง units lookup สำหรับใช้ร่วมกัน
    const units = [
      { unit_name: transformedProduct.pro_unit1, ratio: transformedProduct.pro_ratio1, level: 1 },
      { unit_name: transformedProduct.pro_unit2, ratio: transformedProduct.pro_ratio2, level: 2 },
      { unit_name: transformedProduct.pro_unit3, ratio: transformedProduct.pro_ratio3, level: 3 }
    ].filter(u => u.unit_name);

    // Helper function สำหรับแปลงเป็น smallest unit
    const convertToSmallest = (amount: string, unit: string): number => {
      const foundUnit = units.find(u => u.unit_name === unit || String(u.level) === unit);
      return foundUnit ? Number(amount) * foundUnit.ratio : 0;
    };

    // แปลงหน่วยใน hotdeal entities
    const transformedHotdeal = await Promise.all(
      hotdeal.map(async (hd) => {
        let pro1_unit = hd.pro1_unit;
        let pro2_unit = hd.pro2_unit;

        // แปลงหน่วย product 1 (ใช้ product เดียวกัน)
        const unitLevel1 = Number(hd.pro1_unit);
        if (unitLevel1 === 1) pro1_unit = transformedProduct.pro_unit1;
        else if (unitLevel1 === 2) pro1_unit = transformedProduct.pro_unit2;
        else if (unitLevel1 === 3) pro1_unit = transformedProduct.pro_unit3;

        // แปลงหน่วย product 2
        if (hd.product2) {
          const transformedProduct2 = await this.productService.transformProductWithUnits(hd.product2);
          const unitLevel2 = Number(hd.pro2_unit);
          if (unitLevel2 === 1) pro2_unit = transformedProduct2.pro_unit1;
          else if (unitLevel2 === 2) pro2_unit = transformedProduct2.pro_unit2;
          else if (unitLevel2 === 3) pro2_unit = transformedProduct2.pro_unit3;
        }

        return {
          ...hd,
          pro1_unit,
          pro2_unit,
        };
      })
    );

    const cartItems = await this.shoppingCartService.getOrderFromCartMember(mem_code, pro_code);

    // คำนวณ totalAmountInSmallestUnit
    let totalAmountInSmallestUnit = 0;
    if (cartItems && cartItems.length > 0) {
      totalAmountInSmallestUnit = cartItems.reduce((total, item) => {
        const foundUnit = units.find((u) => u.unit_name === item.spc_unit);
        if (foundUnit && foundUnit.ratio) {
          return total + Number(item.spc_amount) * foundUnit.ratio;
        }
        return total;
      }, 0);
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
      // สร้างรายการ hotdeals พร้อมเงื่อนไขแต้ม (ใช้ helper function)
      const hotdealConditions = transformedHotdeal
        .filter(hd => hd.pro1_amount && hd.pro1_unit && hd.product2)
        .map(hd => {
          const condition = convertToSmallest(hd.pro1_amount, hd.pro1_unit);
          return condition > 0 ? { hotdeal: hd, condition } : null;
        })
        .filter(item => item !== null)
        .sort((a, b) => a.condition - b.condition);

      // คำนวณทีละ hotdeal ตามลำดับ (แต้มน้อยไปมาก)
      for (const item of hotdealConditions) {
        if (item && remainingPoints >= item.condition) {
          const hd = item.hotdeal;
          const conditionInSmallestUnit = item.condition;

          const sets = Math.floor(remainingPoints / conditionInSmallestUnit);
          const usedPoints = sets * conditionInSmallestUnit;

          if (sets > 0) {
            freebies.push({
              pro_code: hd.product2.pro_code,
              unit: hd.pro2_unit,
              quantity: sets * Number(hd.pro2_amount),
              usedPoints: usedPoints,
              remainingPointsForThis: remainingPoints - usedPoints,
            });

            // หักแต้มที่ใช้ไปแล้วออกจากแต้มที่เหลือ
            remainingPoints -= usedPoints;
          }
        }
      }
    }

    const eligibleForFreebie = freebies.some((f) => f.quantity > 0);

    return {
      hotdeal: transformedHotdeal,
      totalAmountInSmallestUnit,
      eligibleForFreebie,
      remainingPoints,
      freebies
    };
  }

  async getHotdealByProCode(pro_code: string[]) {
    const hotdeals = await this.hotdealRepo.find({
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

    // รวม unique pro_code ทั้งหมด (product1 + product2) แล้ว fetch ครั้งเดียว
    const uniqueCodes = [
      ...new Set([
        ...hotdeals.map((hd) => hd.product?.pro_code).filter(Boolean),
        ...hotdeals.map((hd) => hd.product2?.pro_code).filter(Boolean),
      ]),
    ] as string[];

    const transformedMap = new Map<string, { pro_unit1: string; pro_unit2: string; pro_unit3: string }>();
    await Promise.all(
      uniqueCodes.map(async (code) => {
        const t = await this.productService.transformProductWithUnits({ pro_code: code } as ProductEntity);
        transformedMap.set(code, t);
      }),
    );

    const resolveUnit = (transformed: { pro_unit1: string; pro_unit2: string; pro_unit3: string } | undefined, level: number, fallback: string) => {
      if (!transformed) return fallback;
      if (level === 1) return transformed.pro_unit1;
      if (level === 2) return transformed.pro_unit2;
      if (level === 3) return transformed.pro_unit3;
      return fallback;
    };

    return hotdeals.map((hotdeal) => ({
      ...hotdeal,
      pro1_unit: resolveUnit(transformedMap.get(hotdeal.product?.pro_code), Number(hotdeal.pro1_unit), hotdeal.pro1_unit),
      pro2_unit: resolveUnit(transformedMap.get(hotdeal.product2?.pro_code), Number(hotdeal.pro2_unit), hotdeal.pro2_unit),
    }));
  }
}