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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ProductRequestService,
  UpdateProductRequestStatusDto,
} from './product-request.service';
import { ProductRequestStatus } from './product-request.entity';
import { JwtPayload } from '../app.controller';

@ApiTags('Product Request')
@Controller('ecom')
export class ProductRequestController {
  constructor(private readonly service: ProductRequestService) {}

  // ==================== USER ====================

  @ApiOperation({
    summary: 'สร้างคำขอสินค้าใหม่ (แจ้งหาสินค้าที่ไม่พบในระบบ) พร้อมแนบรูปภาพ',
  })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['keyword', 'pro_name'],
      properties: {
        keyword: { type: 'string', description: 'คำค้นหาที่ผู้ใช้ใช้ค้นหาสินค้า' },
        pro_name: { type: 'string', description: 'ชื่อสินค้าที่ต้องการ' },
        note: { type: 'string', description: 'หมายเหตุเพิ่มเติม (ถ้ามี)' },
        source_page: {
          type: 'string',
          description: 'หน้าที่ผู้ใช้ส่งคำขอมา (ถ้ามี)',
        },
        shown_products: {
          type: 'string',
          description: 'รายการสินค้าที่แสดงอยู่ในหน้านั้น (ถ้ามี)',
        },
        current_page: {
          type: 'number',
          description: 'หมายเลขหน้าปัจจุบัน (ถ้ามี)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'ไฟล์รูปภาพสินค้า (ไม่เกิน 5MB, เฉพาะไฟล์ภาพ)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'สร้างคำขอสินค้าสำเร็จ' })
  @ApiResponse({ status: 400, description: 'keyword หรือ pro_name ไม่ถูกต้อง/ไม่ใช่ไฟล์ภาพ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
    @Body('current_page') current_page?: number,
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
        current_page:
          current_page !== undefined ? Number(current_page) : undefined,
      },
      image,
    );
  }

  // ==================== ADMIN ====================

  @ApiOperation({ summary: 'ดึงรายการคำขอสินค้าทั้งหมดแบบแบ่งหน้า (admin)' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, description: 'หมายเลขหน้า (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'จำนวนต่อหน้า (default: 20)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ProductRequestStatus,
    description: 'กรองตามสถานะคำขอสินค้า',
  })
  @ApiResponse({ status: 200, description: 'รายการคำขอสินค้าพร้อม pagination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/product-request')
  getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: ProductRequestStatus,
  ) {
    return this.service.getAll(page, limit, status);
  }

  @ApiOperation({ summary: 'อัปเดตสถานะคำขอสินค้าตาม id (admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'id ของคำขอสินค้า' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: Object.values(ProductRequestStatus),
          description: 'สถานะใหม่ของคำขอสินค้า',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'อัปเดตสถานะคำขอสินค้าสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('admin/product-request/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductRequestStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
