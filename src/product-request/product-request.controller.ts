import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ProductRequestService,
  UpdateProductRequestStatusDto,
} from './product-request.service';
import { ProductRequestStatus } from './product-request.entity';
import { JwtPayload } from '../app.controller';

@Controller('ecom')
export class ProductRequestController {
  constructor(private readonly service: ProductRequestService) {}

  // ==================== USER ====================

  @UseGuards(JwtAuthGuard)
  @Post('product-request')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('อนุญาตเฉพาะไฟล์ภาพเท่านั้น'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  createRequest(
    @Req() req: Request & { user: JwtPayload },
    @Body('keyword') keyword: string,
    @Body('pro_name') pro_name: string,
    @Body('note') note?: string,
    @Body('source_page') source_page?: string,
    @Body('shown_products') shown_products?: string,
    @Body('current_page') current_page?: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    if (!keyword || !pro_name) {
      throw new BadRequestException('keyword และ pro_name จำเป็นต้องระบุ');
    }
    return this.service.createRequest(
      {
        mem_code: req.user.mem_code,
        keyword,
        pro_name,
        note,
        source_page,
        shown_products,
        current_page: current_page !== undefined ? Number(current_page) : undefined,
      },
      image,
    );
  }

  // ==================== ADMIN ====================

  @UseGuards(JwtAuthGuard)
  @Get('admin/product-request')
  getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: ProductRequestStatus,
  ) {
    return this.service.getAll(page, limit, status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/product-request/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductRequestStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
