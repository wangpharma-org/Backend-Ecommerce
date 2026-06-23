import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  RatingService,
  CreateRatingDto,
  BatchRatingItemDto,
  CreateQuestionnaireAnswerDto,
  CreateSelectConfigDto,
  UpdateSelectConfigDto,
  CreateQuestionnaireConfigDto,
  UpdateQuestionnaireConfigDto,
} from './rating.service';
import { ReviewSelectType } from './review-config-select.entity';

@ApiTags('Rating')
@ApiBearerAuth()
@Controller('ecom')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // ==================== USER ====================

  @ApiOperation({ summary: 'ดึงตัวเลือก select config (positive/negative) ที่เปิดใช้งานอยู่' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['positive', 'negative'],
    example: 'positive',
    description: 'Optional; กรองประเภทตัวเลือก: positive หรือ negative',
  })
  @ApiResponse({ status: 200, description: 'รายการตัวเลือก select config ที่เปิดใช้งาน' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('rating/config/select')
  getActiveSelectOptions(@Query('type') type?: ReviewSelectType) {
    return this.ratingService.getActiveSelectOptions(type);
  }

  @ApiOperation({ summary: 'ดึงคำถามแบบสอบถาม (questionnaire) ที่เปิดใช้งานอยู่' })
  @ApiResponse({ status: 200, description: 'รายการคำถามแบบสอบถามที่เปิดใช้งาน' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('rating/config/questionnaire')
  getActiveQuestions() {
    return this.ratingService.getActiveQuestions();
  }

  @ApiOperation({ summary: 'ตรวจสอบว่าออเดอร์ (sh_running) นี้มีการรีวิวแล้วหรือยัง' })
  @ApiParam({ name: 'sh_running', description: 'เลขที่ออเดอร์/บิล', example: 'SH00001234' })
  @ApiResponse({ status: 200, description: 'ข้อมูลรีวิวของออเดอร์นี้ (ถ้ามี)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('rating/check/:sh_running')
  getRatingBySh(@Param('sh_running') sh_running: string) {
    return this.ratingService.getRatingBySh(sh_running);
  }

  @ApiOperation({ summary: 'ส่งคำรีวิว/ให้คะแนนสำหรับออเดอร์หนึ่งรายการ' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sh_running: {
          type: 'string',
          example: 'SH00001234',
          description: 'Required; not empty; เลขที่ออเดอร์/บิล',
        },
        mem_code: {
          type: 'string',
          example: 'M00001',
          description: 'Optional; empty string allowed; รหัสสมาชิก',
        },
        rating_point: {
          type: 'number',
          example: 5,
          description: 'Required; คะแนนที่ให้',
        },
        comment: {
          type: 'string',
          example: 'สินค้าดี จัดส่งรวดเร็ว',
          description: 'Optional; empty string allowed; ความเห็นเพิ่มเติม',
        },
        positive_select: {
          type: 'array',
          items: { type: 'string' },
          example: ['จัดส่งเร็ว', 'สินค้าตรงปก'],
          description: 'Optional; ตัวเลือกด้านบวกที่เลือก',
        },
        negative_select: {
          type: 'array',
          items: { type: 'string' },
          example: [],
          description: 'Optional; ตัวเลือกด้านลบที่เลือก',
        },
      },
      required: ['sh_running', 'rating_point'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้างรีวิวสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('rating')
  submitRating(@Body() data: CreateRatingDto) {
    return this.ratingService.submitRating(data);
  }

  @ApiOperation({ summary: 'ส่งคำรีวิว/ให้คะแนนหลายออเดอร์พร้อมกัน (batch)' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sh_running: {
            type: 'string',
            example: 'SH00001234',
            description: 'Required; not empty; เลขที่ออเดอร์/บิล',
          },
          mem_code: {
            type: 'string',
            example: 'M00001',
            description: 'Optional; empty string allowed; รหัสสมาชิก',
          },
          rating_point: {
            type: 'number',
            example: 5,
            description: 'Required; คะแนนที่ให้',
          },
          comment: {
            type: 'string',
            example: 'สินค้าดี จัดส่งรวดเร็ว',
            description: 'Optional; empty string allowed; ความเห็นเพิ่มเติม',
          },
          positive_select: {
            type: 'array',
            items: { type: 'string' },
            example: ['จัดส่งเร็ว', 'สินค้าตรงปก'],
            description: 'Optional; ตัวเลือกด้านบวกที่เลือก',
          },
          negative_select: {
            type: 'array',
            items: { type: 'string' },
            example: [],
            description: 'Optional; ตัวเลือกด้านลบที่เลือก',
          },
        },
        required: ['sh_running', 'rating_point'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'สร้างรีวิวแบบ batch สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('rating/batch')
  submitBatchRating(@Body() items: BatchRatingItemDto[]) {
    return this.ratingService.submitBatchRating(items);
  }

  @ApiOperation({ summary: 'อัปโหลดรูปภาพประกอบรีวิว (สูงสุด 10 ไฟล์ ไฟล์ละไม่เกิน 5MB)' })
  @ApiParam({ name: 'id', description: 'รหัสรีวิว (rating id)', example: '1' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Optional; ไฟล์รูปภาพ (สูงสุด 10 ไฟล์)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'อัปโหลดรูปภาพสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('rating/:id/images')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
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
  uploadReviewImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.ratingService.uploadReviewImages(id, files);
  }

  @ApiOperation({ summary: 'ส่งคำตอบแบบสอบถาม (questionnaire) สำหรับรีวิวหนึ่งรายการ' })
  @ApiParam({ name: 'id', description: 'รหัสรีวิว (rating id)', example: '1' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question_id: {
            type: 'number',
            example: 1,
            description: 'Required; รหัสคำถาม',
          },
          rating_point: {
            type: 'number',
            example: 5,
            description: 'Required; คะแนนที่ให้สำหรับคำถามนี้',
          },
        },
        required: ['question_id', 'rating_point'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'ส่งคำตอบแบบสอบถามสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('rating/:id/questionnaire')
  submitQuestionnaire(
    @Param('id', ParseIntPipe) id: number,
    @Body() answers: CreateQuestionnaireAnswerDto[],
  ) {
    return this.ratingService.submitQuestionnaire(id, answers);
  }

  // ==================== ADMIN ====================

  @ApiOperation({ summary: 'ดึงสถิติสรุปของรีวิวทั้งหมด (ค่าเฉลี่ย, การกระจายคะแนน)' })
  @ApiResponse({ status: 200, description: 'สถิติสรุปของรีวิว' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/stats')
  getRatingStats() {
    return this.ratingService.getRatingStats();
  }

  @ApiOperation({ summary: 'ดึง select config ทั้งหมด (admin) ทั้งที่เปิดและปิดใช้งาน' })
  @ApiResponse({ status: 200, description: 'รายการ select config ทั้งหมด' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/config/select')
  getAllSelectConfigs() {
    return this.ratingService.getAllSelectConfigs();
  }

  @ApiOperation({ summary: 'ดึง questionnaire config ทั้งหมด (admin) ทั้งที่เปิดและปิดใช้งาน' })
  @ApiResponse({ status: 200, description: 'รายการ questionnaire config ทั้งหมด' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/config/questionnaire')
  getAllQuestionnaireConfigs() {
    return this.ratingService.getAllQuestionnaireConfigs();
  }

  @ApiOperation({ summary: 'ดึงรายการรีวิวทั้งหมดแบบ pagination พร้อมกรองตามช่วงคะแนน' })
  @ApiQuery({ name: 'page', required: false, example: '1', description: 'Optional; หน้าที่ต้องการ (default 1)' })
  @ApiQuery({ name: 'limit', required: false, example: '20', description: 'Optional; จำนวนรายการต่อหน้า (default 20)' })
  @ApiQuery({ name: 'minPoint', required: false, example: '1', description: 'Optional; คะแนนต่ำสุดที่ใช้กรอง' })
  @ApiQuery({ name: 'maxPoint', required: false, example: '5', description: 'Optional; คะแนนสูงสุดที่ใช้กรอง' })
  @ApiResponse({ status: 200, description: 'รายการรีวิวพร้อม pagination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/rating')
  getAllRatings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('minPoint') minPoint?: string,
    @Query('maxPoint') maxPoint?: string,
  ) {
    return this.ratingService.getAllRatings(
      page,
      limit,
      minPoint !== undefined ? parseFloat(minPoint) : undefined,
      maxPoint !== undefined ? parseFloat(maxPoint) : undefined,
    );
  }

  @ApiOperation({ summary: 'ดึงรายละเอียดรีวิวรายการเดียวตาม id (admin)' })
  @ApiParam({ name: 'id', description: 'รหัสรีวิว (rating id)', example: '1' })
  @ApiResponse({ status: 200, description: 'รายละเอียดรีวิว' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/:id')
  getRatingById(@Param('id', ParseIntPipe) id: number) {
    return this.ratingService.getRatingById(id);
  }

  @ApiOperation({ summary: 'สร้าง select config ใหม่ (positive/negative choice) (admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        choice: {
          type: 'string',
          example: 'จัดส่งเร็ว',
          description: 'Required; not empty; ข้อความตัวเลือก',
        },
        type: {
          type: 'string',
          enum: ['positive', 'negative'],
          example: 'positive',
          description: 'Required; ประเภทตัวเลือก',
        },
        status: {
          type: 'boolean',
          example: true,
          description: 'Optional; สถานะเปิดใช้งาน',
        },
      },
      required: ['choice', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้าง select config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('admin/rating/config/select')
  createSelectConfig(@Body() data: CreateSelectConfigDto) {
    return this.ratingService.createSelectConfig(data);
  }

  @ApiOperation({ summary: 'แก้ไข select config ตาม id (admin)' })
  @ApiParam({ name: 'id', description: 'รหัส select config', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        choice: {
          type: 'string',
          example: 'จัดส่งเร็ว',
          description: 'Optional; empty string allowed; ข้อความตัวเลือก',
        },
        type: {
          type: 'string',
          enum: ['positive', 'negative'],
          example: 'positive',
          description: 'Optional; ประเภทตัวเลือก',
        },
        status: {
          type: 'boolean',
          example: true,
          description: 'Optional; สถานะเปิดใช้งาน',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'แก้ไข select config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/rating/config/select/:id')
  updateSelectConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateSelectConfigDto,
  ) {
    return this.ratingService.updateSelectConfig(id, data);
  }

  @ApiOperation({ summary: 'ลบ select config ตาม id (admin)' })
  @ApiParam({ name: 'id', description: 'รหัส select config', example: '1' })
  @ApiResponse({ status: 200, description: 'ลบ select config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/rating/config/select/:id')
  deleteSelectConfig(@Param('id', ParseIntPipe) id: number) {
    return this.ratingService.deleteSelectConfig(id);
  }

  @ApiOperation({ summary: 'สร้าง questionnaire config (คำถามแบบสอบถาม) ใหม่ (admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          example: 'พนักงานบริการดีหรือไม่',
          description: 'Required; not empty; ข้อความคำถาม',
        },
        status: {
          type: 'boolean',
          example: true,
          description: 'Optional; สถานะเปิดใช้งาน',
        },
      },
      required: ['question'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้าง questionnaire config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('admin/rating/config/questionnaire')
  createQuestionnaireConfig(@Body() data: CreateQuestionnaireConfigDto) {
    return this.ratingService.createQuestionnaireConfig(data);
  }

  @ApiOperation({ summary: 'แก้ไข questionnaire config ตาม id (admin)' })
  @ApiParam({ name: 'id', description: 'รหัส questionnaire config', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          example: 'พนักงานบริการดีหรือไม่',
          description: 'Optional; empty string allowed; ข้อความคำถาม',
        },
        status: {
          type: 'boolean',
          example: true,
          description: 'Optional; สถานะเปิดใช้งาน',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'แก้ไข questionnaire config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/rating/config/questionnaire/:id')
  updateQuestionnaireConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateQuestionnaireConfigDto,
  ) {
    return this.ratingService.updateQuestionnaireConfig(id, data);
  }

  @ApiOperation({ summary: 'ลบ questionnaire config ตาม id (admin)' })
  @ApiParam({ name: 'id', description: 'รหัส questionnaire config', example: '1' })
  @ApiResponse({ status: 200, description: 'ลบ questionnaire config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/rating/config/questionnaire/:id')
  deleteQuestionnaireConfig(@Param('id', ParseIntPipe) id: number) {
    return this.ratingService.deleteQuestionnaireConfig(id);
  }
}
