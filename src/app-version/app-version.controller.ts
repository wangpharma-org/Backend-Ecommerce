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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppVersionService } from './app-version.service';
import { CheckAppVersionDto } from './dto/check-app-version.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { LegacyCheckAppVersionDto } from './dto/legacy-check-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';

interface JwtPayload {
  permission?: boolean;
}

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

  @Post('check')
  async checkVersion(@Body() data: CheckAppVersionDto) {
    return this.appVersionService.checkVersion(data);
  }

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
    return this.appVersionService.create(data);
  }

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
