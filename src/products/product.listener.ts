import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductEntity } from './products.entity';
import { ProductsService } from './products.service';

@Controller()
export class ProductListner {
  constructor(private readonly productServerce: ProductsService) {}
  @MessagePattern('product_created_ecom')
  async addProduct(@Payload() message: ProductEntity) {
    try {
      console.log('Received message in product listener:', message);
      await this.productServerce.createProduct(message);
    } catch (error) {
      console.log('Kafka Received message in product listener', error);
    }
  }

  @MessagePattern('product_update_ecom')
  async updateProduct(@Payload() message: ProductEntity) {
    try {
      console.log('Received message in product listener:', message);
      await this.productServerce.updateProduct(message);
    } catch (error) {
      console.log('Kafka Received message in product listener', error);
    }
  }
}
