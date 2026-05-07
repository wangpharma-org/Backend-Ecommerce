import { AppPlatform } from '../app-version.entity';

export class CheckAppVersionDto {
  os: AppPlatform;

  version: string;
  buildNumber: string;
}
