import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FavoriteService } from './favorite.service';

@Controller()
export class FavoriteListener {
  private readonly logger = new Logger(FavoriteListener.name);
  constructor(private readonly favoriteService: FavoriteService) {}
  @MessagePattern('favorite_ecom')
  async addProduct(@Payload() message: { mem_code: string; pro_code: string }) {
    try {
      await this.favoriteService.addToFavorite(message);
    } catch (error) {
      this.logger.error('Kafka Received message in favorite listener', error);
    }
  }
}
