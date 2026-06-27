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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SiteConfigService } from './site-config.service';
import { SiteConfigEntity, ConfigType } from './site-config.entity';

@ApiTags('Landing - Site Config')
@Controller('ecom')
export class SiteConfigController {
  constructor(private readonly siteConfigService: SiteConfigService) {}

  // Public: Get all public configs
  @ApiOperation({ summary: 'ดึง config ทั้งหมดที่เป็น public (ไม่ถูกซ่อน) (Public)' })
  @ApiResponse({ status: 200, description: 'ออบเจกต์ของ config key-value ที่เป็น public' })
  @Get('landing/site-config')
  async getAllPublicConfigs(): Promise<Record<string, any>> {
    return this.siteConfigService.getAllPublicConfigs();
  }

  // Public: Get config by key
  @ApiOperation({ summary: 'ดึงค่า config ตามคีย์ (Public)' })
  @ApiParam({ name: 'key', description: 'คีย์ของ config', example: 'site_title' })
  @ApiResponse({ status: 200, description: 'ค่าของ config ตามคีย์ที่ระบุ' })
  @Get('landing/site-config/:key')
  async getConfig(
    @Param('key') key: string,
  ): Promise<{ value: string | null }> {
    const value = await this.siteConfigService.getConfig(key);
    return { value };
  }

  // Public: Get configs by category
  @ApiOperation({ summary: 'ดึง config ทั้งหมดตามหมวดหมู่ (Public)' })
  @ApiParam({ name: 'category', description: 'หมวดหมู่ของ config', example: 'general' })
  @ApiResponse({ status: 200, description: 'ออบเจกต์ของ config key-value ตามหมวดหมู่' })
  @Get('landing/site-config/category/:category')
  async getConfigsByCategory(
    @Param('category') category: string,
  ): Promise<Record<string, string>> {
    return this.siteConfigService.getConfigsByCategory(category);
  }

  // Admin: Get all configs
  @ApiOperation({ summary: 'ดึง config ทั้งหมด รวมที่ถูกซ่อน (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'รายการ config ทั้งหมด', type: [SiteConfigEntity] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/site-config')
  async getAllConfigs(): Promise<SiteConfigEntity[]> {
    return this.siteConfigService.getAllConfigs();
  }

  // Admin: Get config entity by key
  @ApiOperation({ summary: 'ดึงข้อมูล config entity ตามคีย์ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'key', description: 'คีย์ของ config', example: 'site_title' })
  @ApiResponse({ status: 200, description: 'ข้อมูล config entity', type: SiteConfigEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/site-config/:key')
  async getConfigEntity(
    @Param('key') key: string,
  ): Promise<SiteConfigEntity | null> {
    return this.siteConfigService.getConfigEntity(key);
  }

  // Admin: Create config
  @ApiOperation({ summary: 'สร้าง config ใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        config_key: { type: 'string', description: 'คีย์ของ config (unique)', example: 'site_title' },
        config_value: { type: 'string', description: 'ค่าของ config', example: 'WangPharma E-commerce' },
        config_type: { enum: Object.values(ConfigType), description: 'ประเภทของค่า config' },
        description: { type: 'string', description: 'คำอธิบาย config' },
        category: { type: 'string', description: 'หมวดหมู่ของ config' },
        hidden: { type: 'boolean', description: 'ซ่อนจาก public หรือไม่' },
      },
      required: ['config_key', 'config_value'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้าง config สำเร็จ', type: SiteConfigEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/site-config')
  async createConfig(
    @Body() data: Partial<SiteConfigEntity>,
  ): Promise<SiteConfigEntity> {
    return this.siteConfigService.createConfig(data);
  }

  // Admin: Update config
  @ApiOperation({ summary: 'แก้ไขค่า config ตามคีย์ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'key', description: 'คีย์ของ config', example: 'site_title' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        value: { type: 'string', description: 'ค่าใหม่ของ config', example: 'WangPharma E-commerce' },
        type: { enum: Object.values(ConfigType), description: 'ประเภทของค่า config' },
        hidden: { type: 'boolean', description: 'ซ่อนจาก public หรือไม่' },
      },
      required: ['value', 'hidden'],
    },
  })
  @ApiResponse({ status: 200, description: 'แก้ไข config สำเร็จ', type: SiteConfigEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'ลบ config ตามคีย์ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'key', description: 'คีย์ของ config', example: 'site_title' })
  @ApiResponse({ status: 200, description: 'ลบ config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/site-config/:key')
  async deleteConfig(@Param('key') key: string): Promise<void> {
    return this.siteConfigService.deleteConfig(key);
  }
}
