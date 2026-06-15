import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditorEntity } from './creditor.entity';

export interface CreditorSyncPayload {
  creditor_code: string;
  creditor_name: string;
  creditor_address?: string | null;
}

@Injectable()
export class CreditorService {
  private readonly logger = new Logger(CreditorService.name);

  constructor(
    @InjectRepository(CreditorEntity)
    private readonly creditorRepository: Repository<CreditorEntity>,
  ) {}

  /**
   * Upsert เจ้าหนี้ที่ sync มาจากระบบ product กลาง (ผ่าน Kafka)
   * - match ด้วย creditor_code, สร้างใหม่ถ้ายังไม่มี
   * - อัปเดตเฉพาะฟิลด์ที่ส่งมา (ไม่ทับด้วยค่าว่าง)
   */
  async upsertFromCentral(payload: CreditorSyncPayload): Promise<void> {
    const { creditor_code, creditor_name, creditor_address } = payload;
    if (!creditor_code) {
      this.logger.warn('Received creditor sync without creditor_code, skipped');
      return;
    }

    const existing = await this.creditorRepository.findOne({
      where: { creditor_code },
    });

    if (existing) {
      existing.creditor_name = creditor_name ?? existing.creditor_name;
      existing.creditor_address = creditor_address ?? existing.creditor_address;
      await this.creditorRepository.save(existing);
      this.logger.log(`Creditor updated from central: ${creditor_code}`);
      return;
    }

    const creditor = this.creditorRepository.create({
      creditor_code,
      creditor_name,
      creditor_address: creditor_address ?? undefined,
    });
    await this.creditorRepository.save(creditor);
    this.logger.log(`Creditor created from central: ${creditor_code}`);
  }
}
