import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  STORE_VISIBILITY_CHANNELS,
  StoreVisibilityChannel,
} from '../customer-store-visibility-log.entity';

// ECWC-600: channel เก็บลง log ว่าลูกค้ากดจากเว็บหรือแอป ไม่ส่งมา = เว็บ
export class SetStoreVisibilityDto {
  @IsBoolean()
  show_store_name: boolean;

  @IsOptional()
  @IsIn(STORE_VISIBILITY_CHANNELS)
  channel?: StoreVisibilityChannel;
}

export class MarkAskedStoreVisibilityDto {
  @IsOptional()
  @IsIn(STORE_VISIBILITY_CHANNELS)
  channel?: StoreVisibilityChannel;
}
