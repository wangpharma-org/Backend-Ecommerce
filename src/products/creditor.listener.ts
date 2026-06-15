import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreditorService, CreditorSyncPayload } from './creditor.service';

@Controller()
export class CreditorListener {
  private readonly logger = new Logger(CreditorListener.name);

  constructor(private readonly creditorService: CreditorService) {}

  @MessagePattern('creditor_created_ecom')
  async handleCreated(@Payload() message: CreditorSyncPayload): Promise<void> {
    try {
      await this.creditorService.upsertFromCentral(message);
    } catch (error) {
      this.logger.error('Failed to handle creditor_created_ecom', error as Error);
    }
  }

  @MessagePattern('creditor_update_ecom')
  async handleUpdated(@Payload() message: CreditorSyncPayload): Promise<void> {
    try {
      await this.creditorService.upsertFromCentral(message);
    } catch (error) {
      this.logger.error('Failed to handle creditor_update_ecom', error as Error);
    }
  }
}
