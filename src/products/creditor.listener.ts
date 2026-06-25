import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductsService } from './products.service';

interface CreditorEcomPayload {
  creditor_code: string;
  creditor_name?: string;
  creditor_address?: string | null;
}

@Controller()
export class CreditorListener {
  private readonly logger = new Logger(CreditorListener.name);

  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern('creditor_created_ecom')
  async handleCreated(@Payload() message: CreditorEcomPayload) {
    try {
      this.logger.log('Received message in creditor listener (created):', message);
      await this.productsService.upsertCreditor(message);
    } catch (error) {
      this.logger.error('Kafka creditor_created_ecom error', String(error));
    }
  }

  @MessagePattern('creditor_update_ecom')
  async handleUpdated(@Payload() message: CreditorEcomPayload) {
    try {
      this.logger.log('Received message in creditor listener (updated):', message);
      await this.productsService.upsertCreditor(message);
    } catch (error) {
      this.logger.error('Kafka creditor_update_ecom error', String(error));
    }
  }
}
