import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductEntity } from './products.entity';
import { ProductsService } from './products.service';
import { UpdateProductImageDto } from './update-product-image.dto';
import { ProductPharmaEntity } from './product-pharma.entity';

export interface ProductEasyAcc {
  product_code: string;
  product_name?: string;
  product_nameEN?: string | null;
  product_nameSale?: string | null;
  product_genericname?: string | null;

  product_image_url?: string[] | null;
  product_barcode?: string | null;
  product_barcode2?: string | null;
  product_barcode3?: string | null;
  product_floor?: string | null;
  product_keysearch?: string | null;

  product_unit1?: string | null;
  product_unit2?: string | null;
  product_unit3?: string | null;

  product_price_a?: number | null;
  product_price_b?: number | null;
  product_price_c?: number | null;

  product_ratio_1?: number | null;
  product_ratio_2?: number | null;
  product_ratio_3?: number | null;

  product_stock?: number | null;
  product_lowest_stock?: number | null;
  creditor_code?: string | null;
}

@Controller()
export class ProductListner {
  private readonly logger = new Logger(ProductListner.name);
  constructor(private readonly productServerce: ProductsService) {}
  @MessagePattern('product_created_ecom')
  async addProduct(@Payload() message: ProductEntity) {
    try {
      this.logger.log('Received message in product listener:', message);
      await this.productServerce.createProduct(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in product listener',
        String(error),
      );
    }
  }

  @MessagePattern('product_created_detail_ecom')
  async addProductDetail(@Payload() message: ProductPharmaEntity) {
    try {
      this.logger.log('Received message in product detail listener:', message);
      await this.productServerce.createProductPharmaRepo(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in product detail listener',
        String(error),
      );
    }
  }

  @MessagePattern('product_update_detail_ecom')
  async updateProductDetail(@Payload() message: ProductPharmaEntity) {
    try {
      this.logger.log(
        'Received message in product detail update listener:',
        message,
      );
      await this.productServerce.createProductPharmaRepo(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in product detail update listener',
        String(error),
      );
    }
  }

  @MessagePattern('product_update_ecom')
  async updateProduct(@Payload() message: ProductEntity) {
    try {
      this.logger.log('Received message in product listener:', message);
      await this.productServerce.updateProduct(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in product listener',
        String(error),
      );
    }
  }

  @MessagePattern('update_product_image')
  async handleUpdate(@Payload() message: UpdateProductImageDto) {
    try {
      await this.productServerce.handleProductImageUpdate(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in update_product_image listener',
        String(error),
      );
    }
  }

  @MessagePattern('delete_product_image')
  async handleDeleteImage(@Payload() message: string[]) {
    try {
      await this.productServerce.deleteProductImage(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in delete_product_image listener',
        String(error),
      );
    }
  }

  @MessagePattern('product_update_from_easyacc')
  async handleUpdateFromEasyAcc(@Payload() message: ProductEasyAcc) {
    try {
      await this.productServerce.updateProductFromEasyAcc(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in product_update_from_easyacc listener',
        String(error),
      );
    }
  }
}
