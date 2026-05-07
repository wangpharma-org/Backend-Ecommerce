import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppVersionService } from './app-version.service';
import { CheckAppVersionDto } from './dto/check-app-version.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { LegacyCheckAppVersionDto } from './dto/legacy-check-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { AppPlatform } from './app-version.entity';

interface JwtPayload {
  permission?: boolean;
}

const APP_PLATFORMS = [AppPlatform.ANDROID, AppPlatform.IOS] as const;

@Controller('app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Post('check')
  async checkVersion(@Body() data: CheckAppVersionDto) {
    const payload = this.validateCheckPayload(data);
    return this.appVersionService.checkVersion(payload);
  }

  @Post('version/get')
  async checkVersionLegacy(@Body() data: LegacyCheckAppVersionDto) {
    const payload = this.validateLegacyCheckPayload(data);
    const result = await this.appVersionService.checkVersion(payload);

    if (result.allowed) {
      return {
        isLastest: true,
      };
    }

    return {
      isLastest: false,
      latestVersion: '',
      forceUpdate: result.forceUpdate,
      storeUrl: result.storeUrl,
      note: result.message,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: { user?: JwtPayload }) {
    this.ensureAdmin(req.user);
    return this.appVersionService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() data: CreateAppVersionDto,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    const payload = this.validateCreatePayload(data);
    return this.appVersionService.create(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateAppVersionDto,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    const payload = this.validateUpdatePayload(data);
    return this.appVersionService.update(this.parseId(id), payload);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user?: JwtPayload }) {
    this.ensureAdmin(req.user);
    return this.appVersionService.remove(this.parseId(id));
  }

  private ensureAdmin(user?: JwtPayload) {
    if (user?.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private validateCheckPayload(data: CheckAppVersionDto) {
    const os = this.normalizePlatform(data.os, 'os');
    const version = this.requireNonEmptyString(data.version, 'version');
    const buildNumber = this.requireNonEmptyString(
      data.buildNumber,
      'buildNumber',
    );

    return {
      os,
      version,
      buildNumber,
    };
  }

  private validateCreatePayload(data: CreateAppVersionDto) {
    const platform = this.normalizePlatform(data.platform, 'platform');
    const version = this.requireNonEmptyString(data.version, 'version');
    const storeUrl = this.requireHttpUrl(data.storeUrl, 'storeUrl');
    const message = this.normalizeOptionalString(data.message);

    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
      throw new BadRequestException('isActive must be a boolean');
    }

    return {
      platform,
      version,
      storeUrl,
      message,
      isActive: data.isActive,
    };
  }

  private validateUpdatePayload(data: UpdateAppVersionDto) {
    const payload: UpdateAppVersionDto = {};

    if (data.platform !== undefined) {
      payload.platform = this.normalizePlatform(data.platform, 'platform');
    }
    if (data.version !== undefined) {
      payload.version = this.requireNonEmptyString(data.version, 'version');
    }
    if (data.storeUrl !== undefined) {
      payload.storeUrl = this.requireHttpUrl(data.storeUrl, 'storeUrl');
    }
    if (data.message !== undefined) {
      payload.message = this.normalizeOptionalString(data.message);
    }
    if (data.isActive !== undefined) {
      if (typeof data.isActive !== 'boolean') {
        throw new BadRequestException('isActive must be a boolean');
      }
      payload.isActive = data.isActive;
    }

    return payload;
  }

  private validateLegacyCheckPayload(data: LegacyCheckAppVersionDto) {
    const os = this.normalizePlatform(data.os, 'os');
    const version = this.requireNonEmptyString(data.version, 'version');

    return {
      os,
      version,
      buildNumber: 'legacy-client',
    };
  }

  private normalizePlatform(value: string, fieldName: string): AppPlatform {
    const normalized = this.requireNonEmptyString(
      value,
      fieldName,
    ).toLowerCase();
    if (!APP_PLATFORMS.includes(normalized as AppPlatform)) {
      throw new BadRequestException(
        `${fieldName} must be one of: ${AppPlatform.ANDROID}, ${AppPlatform.IOS}`,
      );
    }
    return normalized as AppPlatform;
  }

  private requireNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeOptionalString(value: unknown) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('message must be a string');
    }

    const normalized = value.trim();
    return normalized || undefined;
  }

  private requireHttpUrl(value: unknown, fieldName: string): string {
    const normalized = this.requireNonEmptyString(value, fieldName);

    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid protocol');
      }
      return normalized;
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid URL`);
    }
  }

  private parseId(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('id must be a positive integer');
    }
    return parsed;
  }
}
