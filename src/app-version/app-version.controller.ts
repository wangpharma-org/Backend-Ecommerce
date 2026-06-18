import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppVersionService } from './app-version.service';
import { CheckAppVersionDto } from './dto/check-app-version.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { LegacyCheckAppVersionDto } from './dto/legacy-check-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';

interface JwtPayload {
  permission?: boolean;
}

@ApiTags('App Version')
@Controller('app-version')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @ApiOperation({
    summary:
      'ตรวจสอบว่าเวอร์ชันแอปปัจจุบันได้รับอนุญาตให้ใช้งานหรือไม่ (public)',
  })
  @ApiBody({ type: CheckAppVersionDto })
  @ApiResponse({
    status: 200,
    description: 'ผลการตรวจสอบเวอร์ชันแอป (allowed/forceUpdate/storeUrl/message)',
  })
  @Post('check')
  async checkVersion(@Body() data: CheckAppVersionDto) {
    return this.appVersionService.checkVersion(data);
  }

  @ApiOperation({
    summary:
      'ตรวจสอบเวอร์ชันแอปแบบ legacy client (public, รูปแบบ response เก่า)',
  })
  @ApiBody({ type: LegacyCheckAppVersionDto })
  @ApiResponse({
    status: 200,
    description:
      'ผลการตรวจสอบเวอร์ชันแอปในรูปแบบ legacy (isLastest/latestVersion/forceUpdate/storeUrl/note)',
  })
  @Post('version/get')
  async checkVersionLegacy(@Body() data: LegacyCheckAppVersionDto) {
    const result = await this.appVersionService.checkVersion({
      os: data.os,
      version: data.version,
      buildNumber: 'legacy-client',
    });

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

  @ApiOperation({ summary: 'ดึงรายการ app version blacklist ทั้งหมด (admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'รายการ app version blacklist ทั้งหมด' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: { user?: JwtPayload }) {
    this.ensureAdmin(req.user);
    return this.appVersionService.findAll();
  }

  @ApiOperation({ summary: 'สร้าง app version blacklist ใหม่ (admin)' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateAppVersionDto })
  @ApiResponse({ status: 201, description: 'สร้าง app version blacklist สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() data: CreateAppVersionDto,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    return this.appVersionService.create(data);
  }

  @ApiOperation({ summary: 'แก้ไข app version blacklist ตาม id (admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'id ของ app version blacklist' })
  @ApiBody({ type: UpdateAppVersionDto })
  @ApiResponse({ status: 200, description: 'แก้ไข app version blacklist สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateAppVersionDto,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    return this.appVersionService.update(id, data);
  }

  @ApiOperation({ summary: 'ลบ app version blacklist ตาม id (admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'id ของ app version blacklist' })
  @ApiResponse({ status: 200, description: 'ลบ app version blacklist สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    return this.appVersionService.remove(id);
  }

  private ensureAdmin(user?: JwtPayload) {
    if (user?.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
