import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppVersionEntity } from './app-version.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AppVersionService {
  constructor(
    @InjectRepository(AppVersionEntity)
    private readonly appVersionRepository: Repository<AppVersionEntity>,
  ) {}

  async getLatestVersion(version: string, os: string) {
    const data = await this.appVersionRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (version === data?.latestVersion) {
      return { isLastest: true };
    } else {
      if (os === 'android') {
        return {
          isLastest: false,
          latestVersion: data?.latestVersion,
          forceUpdate: data?.forceUpdate,
          storeUrl: data?.androidStoreUrl,
          note: data?.note,
        };
      } else {
        return {
          isLastest: false,
          latestVersion: data?.latestVersion,
          forceUpdate: data?.forceUpdate,
          storeUrl: data?.iosStoreUrl,
          note: data?.note,
        };
      }
    }
  }

  async insertLastestVersion(data: {
    latestVersion: string;
    forceUpdate: boolean;
    androidStoreUrl?: string;
    iosStoreUrl?: string;
    note?: string;
  }) {
    const newVersion = this.appVersionRepository.create(data);
    return this.appVersionRepository.save(newVersion);
  }
}
