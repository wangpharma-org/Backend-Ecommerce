import { IsBoolean } from 'class-validator';

export class SetStoreVisibilityDto {
  @IsBoolean()
  show_store_name: boolean;
}
