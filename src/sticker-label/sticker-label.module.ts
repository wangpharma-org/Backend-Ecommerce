import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../products/products.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import { ShoppingCartModule } from '../shopping-cart/shopping-cart.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { StickerPrintLogEntity } from './sticker-print-log.entity';
import { StickerLabelService } from './sticker-label.service';
import { StickerLabelController } from './sticker-label.controller';
import { StickerPdfRendererService } from './sticker-pdf-renderer.service';
import { StickerExportService } from './sticker-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ShoppingCartEntity,
      ShoppingOrderEntity,
      StickerPrintLogEntity,
    ]),
    ShoppingCartModule,
    FeatureFlagsModule,
  ],
  providers: [
    StickerLabelService,
    StickerPdfRendererService,
    StickerExportService,
  ],
  controllers: [StickerLabelController],
})
export class StickerLabelModule {}
