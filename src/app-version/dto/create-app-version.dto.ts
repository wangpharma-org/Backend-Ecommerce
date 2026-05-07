import { AppPlatform } from '../app-version.entity';

export class CreateAppVersionDto {
  platform: AppPlatform;

  version: string;
  message?: string;
  storeUrl: string;
  isActive?: boolean;
}
