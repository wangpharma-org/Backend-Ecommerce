import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ReviewRequestService } from './review-request.service';

interface ReviewNotificationPayload {
  mem_code: string;
  sh_running: string[];
}

@Controller()
export class ReviewRequestListener {
  private readonly logger = new Logger(ReviewRequestListener.name);

  constructor(private readonly service: ReviewRequestService) {}

  @EventPattern('review.notification.created')
  async handle(@Payload() raw: unknown): Promise<void> {
    // รองรับทั้ง payload ที่ wrap ด้วย value และ plain object
    const data =
      (raw as { value?: ReviewNotificationPayload })?.value ??
      (raw as ReviewNotificationPayload);

    if (!data?.mem_code || !Array.isArray(data?.sh_running)) {
      this.logger.warn(`Invalid review.notification.created payload: ${JSON.stringify(raw)}`);
      return;
    }

    try {
      await this.service.create(data.mem_code, data.sh_running);
      this.logger.log(`Review request created: memCode=${data.mem_code}, orders=${data.sh_running.join(',')}`);
    } catch (err) {
      this.logger.error(
        `Failed to create review request: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
