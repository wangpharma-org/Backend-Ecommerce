import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppVersionEntity } from './app-version.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { CheckAppVersionDto } from './dto/check-app-version.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';

export const DEFAULT_APP_VERSION_MESSAGE =
  'เวอร์ชันนี้ไม่รองรับ กรุณาอัปเดตแอป';

@Injectable()
export class AppVersionService {
  constructor(
    @InjectRepository(AppVersionEntity)
    private readonly appVersionRepository: Repository<AppVersionEntity>,
  ) {}

  async checkVersion(data: CheckAppVersionDto) {
    const matchedRule = await this.appVersionRepository.findOne({
      where: {
        platform: data.os,
        version: data.version.trim(),
        isActive: true,
      },
    });

    if (!matchedRule) {
      return {
        allowed: true,
        forceUpdate: false,
        message: null,
        storeUrl: null,
      };
    }

    return {
      allowed: false,
      forceUpdate: true,
      message: matchedRule.message || DEFAULT_APP_VERSION_MESSAGE,
      storeUrl: matchedRule.storeUrl,
    };
  }

  async findAll() {
    return this.appVersionRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async create(data: CreateAppVersionDto) {
    try {
      const entity = this.appVersionRepository.create({
        platform: data.platform,
        version: data.version.trim(),
        message: this.normalizeMessage(data.message),
        storeUrl: data.storeUrl.trim(),
        isActive: data.isActive ?? true,
      });

      return await this.appVersionRepository.save(entity);
    } catch (error) {
      this.handleDuplicate(error, data.version);
      throw error;
    }
  }

  async update(id: number, data: UpdateAppVersionDto) {
    const existing = await this.appVersionRepository.findOne({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('App version rule not found');
    }

    try {
      if (data.platform !== undefined) {
        existing.platform = data.platform;
      }
      if (data.version !== undefined) {
        existing.version = data.version.trim();
      }
      if (data.message !== undefined) {
        existing.message = this.normalizeMessage(data.message);
      }
      if (data.storeUrl !== undefined) {
        existing.storeUrl = data.storeUrl.trim();
      }
      if (data.isActive !== undefined) {
        existing.isActive = data.isActive;
      }

      return await this.appVersionRepository.save(existing);
    } catch (error) {
      this.handleDuplicate(error, data.version ?? existing.version);
      throw error;
    }
  }

  async remove(id: number) {
    const existing = await this.appVersionRepository.findOne({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('App version rule not found');
    }

    await this.appVersionRepository.remove(existing);
    return { message: 'App version rule deleted' };
  }

  private normalizeMessage(message?: string | null) {
    const normalized = message?.trim();
    return normalized || DEFAULT_APP_VERSION_MESSAGE;
  }

  private handleDuplicate(error: unknown, version: string): never | void {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException(
        `App version rule already exists for version ${version.trim()}`,
      );
    }
  }
}
