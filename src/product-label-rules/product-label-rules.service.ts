import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreateProductLabelRuleDto } from './dto/create-product-label-rule.dto';
import { UpdateProductLabelRuleDto } from './dto/update-product-label-rule.dto';
import { ProductLabelRuleEntity } from './product-label-rule.entity';

type LabelableProduct = {
  pro_name?: string | null;
  productLabels?: string[];
};

@Injectable()
export class ProductLabelRulesService {
  constructor(
    @InjectRepository(ProductLabelRuleEntity)
    private readonly productLabelRuleRepository: Repository<ProductLabelRuleEntity>,
  ) {}

  findAll() {
    return this.productLabelRuleRepository.find({
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async create(data: CreateProductLabelRuleDto) {
    await this.ensureKeywordAvailable(data.keyword);
    return this.productLabelRuleRepository.save(
      this.productLabelRuleRepository.create({
        label: data.label,
        keyword: data.keyword,
        isActive: data.isActive ?? true,
      }),
    );
  }

  async update(id: number, data: UpdateProductLabelRuleDto) {
    if (data.keyword) {
      await this.ensureKeywordAvailable(data.keyword, id);
    }

    await this.productLabelRuleRepository.update(id, data);
    return this.productLabelRuleRepository.findOneByOrFail({ id });
  }

  async remove(id: number) {
    await this.productLabelRuleRepository.delete(id);
  }

  async attachToProducts<T extends LabelableProduct>(products: T[]): Promise<T[]> {
    if (products.length === 0) {
      return products;
    }

    const rules = await this.productLabelRuleRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      select: { label: true, keyword: true },
    });

    products.forEach((product) => {
      const productName = product.pro_name?.toLocaleLowerCase() ?? '';
      product.productLabels = rules
        .filter((rule) => productName.includes(rule.keyword.toLocaleLowerCase()))
        .map((rule) => rule.label);
    });

    return products;
  }

  private async ensureKeywordAvailable(keyword: string, excludedId?: number) {
    const existing = await this.productLabelRuleRepository.findOne({
      where: {
        keyword,
        ...(excludedId ? { id: Not(excludedId) } : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Keyword นี้ถูกใช้งานแล้ว');
    }
  }
}
