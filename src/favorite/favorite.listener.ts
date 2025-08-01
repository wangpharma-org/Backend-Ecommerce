import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FavoriteService } from './favorite.service';

@Controller()
export class FavoriteListener {
  constructor(private readonly favoriteService: FavoriteService) {}
  @MessagePattern('favorite_ecom')
  async addProduct(@Payload() message: { mem_code: string; pro_code: string }) {
    try {
      console.log('Received message in favorite listener:', message);
      await this.favoriteService.addToFavorite(message);
    } catch (error) {
      console.log('Kafka Received message in favorite listener', error);
    }
  }
}
