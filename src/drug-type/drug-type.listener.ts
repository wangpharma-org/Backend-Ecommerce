import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DrugTypeKafkaPayload, DrugTypeService } from './drug-type.service';

/** WGDD-427 รับประเภทยา + แถม/พ่วง จาก ProductService */
@Controller()
export class DrugTypeListener {
  private readonly logger = new Logger(DrugTypeListener.name);

  constructor(private readonly drugTypeService: DrugTypeService) {}

  @MessagePattern('drug_type_upsert_ecom')
  async handleUpsert(@Payload() message: DrugTypeKafkaPayload) {
    try {
      await this.drugTypeService.upsertFromKafka(message);
    } catch (error) {
      this.logger.error(
        'Kafka Received message in drug_type_upsert_ecom listener',
        String(error),
      );
    }
  }
}
