import { AppPlatform } from '../app-version.entity';

export class UpdateAppVersionDto {
  platform?: AppPlatform;
  version?: string;
  message?: string;
  storeUrl?: string;
  isActive?: boolean;
}
