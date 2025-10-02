import { Injectable, NotFoundException } from '@nestjs/common';
import { InvisibleEntity } from './invisible-product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { CreditorEntity } from 'src/products/creditor.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class InvisibleProductService {
  constructor(
    @InjectRepository(InvisibleEntity)
    private readonly invisibleRepo: Repository<InvisibleEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CreditorEntity)
    private readonly creditorRepo: Repository<CreditorEntity>,
  ) {}

  async addInvisibleTopic(data: {
    invisible_name: string;
    date_start: string;
    date_end: string;
    creditor_code: string;
  }) {
    try {
      const creditor = await this.creditorRepo.findOne({
        where: { creditor_code: data.creditor_code },
      });

      if (!creditor) {
        throw new NotFoundException(
          `ไม่พบ creditor_code ${data.creditor_code}`,
        );
      }

      const invisible = this.invisibleRepo.create({
        invisible_name: data.invisible_name,
        date_start: data.date_start,
        date_end: data.date_end,
        creditor,
      });

      return await this.invisibleRepo.save(invisible);
    } catch (error) {
      console.log(`${Date()} Error Something in addInvisibleTopic`);
      console.log(error);
      throw new Error('Error Something in addInvisibleTopic');
    }
  }

  async updateProductInvisible(data: {
    pro_code: string;
    invisible_id: number;
  }) {
    try {
      return this.productRepo.update(
        { pro_code: data.pro_code },
        { invisibleProduct: { invisible_id: data.invisible_id } },
      );
    } catch (error) {
      console.log(`${Date()} Error Something in updateProductInvisible`);
      console.log(error);
      throw new Error('Error Something in updateProductInvisible');
    }
  }

  async removeProductInvisible(pro_code: string) {
    try {
      console.log(pro_code);
      return this.productRepo.update(
        { pro_code },
        { invisibleProduct: { invisible_id: undefined } },
      );
    } catch (error) {
      console.log(`${Date()} Error Something in removeProductInvisible`);
      console.log(error);
      throw new Error('Error Something in removeProductInvisible');
    }
  }

  handleGetInvisibleTopics() {
    try {
      return this.invisibleRepo.find({
        relations: ['creditor'],
        order: { invisible_id: 'DESC' },
      });
    } catch (error) {
      console.log(`${Date()} Error Something in handleGetInvisibleTopics`);
      console.log(error);
      throw new Error('Error Something in handleGetInvisibleTopics');
    }
  }

  async handleGetInvisibleProducts(invisible_id: number) {
    try {
      const invisible = await this.invisibleRepo.findOne({
        where: { invisible_id },
      });

      if (!invisible) {
        throw new NotFoundException(
          `ไม่พบ invisible_id ${invisible_id} ในระบบ`,
        );
      }

      return await this.productRepo.find({
        where: { invisibleProduct: { invisible_id } },
        select: {
          pro_code: true,
        },
      });
    } catch (error) {
      console.log(`${Date()} Error Something in handleGetInvisibleProducts`);
      console.log(error);
      throw new Error('Error Something in handleGetInvisibleProducts');
    }
  }
//   @Cron(CronExpression.EVERY_30_SECONDS)
  @Cron('0 0 * * *')
  async deleteInvisibleTopicWithExpired() {
    try {
      const expiredInvisibles = await this.invisibleRepo.find({
        where: { date_end: LessThan(new Date().toISOString()) },
      });

      for (const invisible of expiredInvisibles) {
        await this.productRepo.update(
          { invisibleProduct: { invisible_id: invisible.invisible_id } },
          { invisibleProduct: { invisible_id: undefined } },
        );
        await this.invisibleRepo.delete(invisible.invisible_id);
      }
    } catch (error) {
      console.log(
        `${Date()} Error Something in deleteInvisibleTopicWithExpired`,
      );
      console.log(error);
      throw new Error('Error Something in deleteInvisibleTopicWithExpired');
    }
  }

  async deleteInvisibleTopic(invisible_id: number) {
    try {
      const invisible = await this.invisibleRepo.findOne({
        where: { invisible_id },
      });

      if (!invisible) {
        throw new NotFoundException(
          `ไม่พบ invisible_id ${invisible_id} ในระบบ`,
        );
      }

      await this.productRepo.update(
        { invisibleProduct: { invisible_id } },
        { invisibleProduct: { invisible_id: undefined } },
      );

      return await this.invisibleRepo.delete(invisible_id);
    } catch (error) {
      console.log(`${Date()} Error Something in deleteInvisibleTopic`);
      console.log(error);
      throw new Error('Error Something in deleteInvisibleTopic');
    }
  }
}
