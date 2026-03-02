import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SiteConfigService } from './site-config.service';
import { SiteConfigEntity, ConfigType } from './site-config.entity';

@Controller('ecom')
export class SiteConfigController {
  constructor(private readonly siteConfigService: SiteConfigService) {}

  // Public: Get all public configs
  @Get('landing/site-config')
  async getAllPublicConfigs(): Promise<Record<string, any>> {
    return this.siteConfigService.getAllPublicConfigs();
  }

  // Public: Get config by key
  @Get('landing/site-config/:key')
  async getConfig(
    @Param('key') key: string,
  ): Promise<{ value: string | null }> {
    const value = await this.siteConfigService.getConfig(key);
    return { value };
  }

  // Public: Get configs by category
  @Get('landing/site-config/category/:category')
  async getConfigsByCategory(
    @Param('category') category: string,
  ): Promise<Record<string, string>> {
    return this.siteConfigService.getConfigsByCategory(category);
  }

  // Admin: Get all configs
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/site-config')
  async getAllConfigs(): Promise<SiteConfigEntity[]> {
    return this.siteConfigService.getAllConfigs();
  }

  // Admin: Get config entity by key
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/site-config/:key')
  async getConfigEntity(
    @Param('key') key: string,
  ): Promise<SiteConfigEntity | null> {
    return this.siteConfigService.getConfigEntity(key);
  }

  // Admin: Create config
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/site-config')
  async createConfig(
    @Body() data: Partial<SiteConfigEntity>,
  ): Promise<SiteConfigEntity> {
    return this.siteConfigService.createConfig(data);
  }

  // Admin: Update config
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/site-config/:key')
  async updateConfig(
    @Param('key') key: string,
    @Body() body: { value: string; type?: ConfigType; hidden: boolean },
  ): Promise<SiteConfigEntity> {
    return this.siteConfigService.updateConfig(
      key,
      body.value,
      body.hidden,
      body.type,
    );
  }

  // Admin: Delete config
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/site-config/:key')
  async deleteConfig(@Param('key') key: string): Promise<void> {
    return this.siteConfigService.deleteConfig(key);
  }
}
