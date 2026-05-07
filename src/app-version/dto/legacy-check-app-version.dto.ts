import { AppPlatform } from '../app-version.entity';

export class LegacyCheckAppVersionDto {
  os: AppPlatform;
  version: string;
}
