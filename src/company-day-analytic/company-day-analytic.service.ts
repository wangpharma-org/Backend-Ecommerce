import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';

export interface CompanyDayAnalyticDto {
  promo_name: string;
  event: 'view' | 'addcart' | 'purchase';
  source: string;
  tier: string;
  mem_code: string;
}

@Injectable()
export class CompanyDayAnalyticService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CompanyDayAnalyticService.name);

  constructor(
    @Inject(COMPANY_DAY_ANALYTIC_KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
  }

  async sendAnalytic(data: CompanyDayAnalyticDto): Promise<void> {
    if (!data.mem_code?.trim()) return;
    if (
      !data.promo_name?.trim() ||
      !data.tier?.trim() ||
      !data.source?.trim()
    ) {
      return;
    }

    try {
      await firstValueFrom(this.kafkaClient.emit('company_day_analytic', data));
    } catch (error) {
      this.logger.warn(
        `Failed to emit company day analytic: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
