import { Injectable } from '@nestjs/common';
import { InvisibleEntity } from './invisible-product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Injectable()
export class InvisibleProductService {
  constructor(
    @InjectRepository(InvisibleEntity)
    private readonly invisibleRepo: Repository<InvisibleEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async addInvisibleTopic(data: {
    invisible_name: string;
    date_start: string;
    date_end: string;
    creditor_code: string;
  }) {
    try {
      const invisible = this.invisibleRepo.create({
        invisible_name: data.invisible_name,
        date_start: data.date_start,
        date_end: data.date_end,
        creditor: { creditor_code: data.creditor_code },
      });
      return await this.invisibleRepo.save(invisible);
    } catch (error) {
      console.log(`${Date()} Error Something in addInvisibleTopic`);
      console.log(error);
      throw new Error('Error Something in addInvisibleTopic');
    }
  }

  updateProductInvisible(data: { pro_code: string; invisible_id: number }[]) {
    try {
      return this.productRepo.manager.transaction(async (manager) => {
        const entities = data.map((item) =>
          manager.create(ProductEntity, {
            pro_code: item.pro_code,
            invisibleProduct: { invisible_id: item.invisible_id },
          }),
        );
        return await manager.save(ProductEntity, entities);
      });
    } catch (error) {
      console.log(`${Date()} Error Something in updateProductInvisible`);
      console.log(error);
      throw new Error('Error Something in updateProductInvisible');
    }
  }
}
