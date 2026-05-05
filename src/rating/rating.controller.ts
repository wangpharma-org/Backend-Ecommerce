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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  RatingService,
  CreateRatingDto,
  CreateQuestionnaireAnswerDto,
  CreateSelectConfigDto,
  UpdateSelectConfigDto,
  CreateQuestionnaireConfigDto,
  UpdateQuestionnaireConfigDto,
} from './rating.service';
import { ReviewSelectType } from './review-config-select.entity';

@Controller('ecom')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // ==================== USER ====================

  @UseGuards(JwtAuthGuard)
  @Get('rating/config/select')
  getActiveSelectOptions(@Query('type') type?: ReviewSelectType) {
    return this.ratingService.getActiveSelectOptions(type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rating/config/questionnaire')
  getActiveQuestions() {
    return this.ratingService.getActiveQuestions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('rating/check/:sh_running')
  getRatingBySh(@Param('sh_running') sh_running: string) {
    return this.ratingService.getRatingBySh(sh_running);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rating')
  submitRating(@Body() data: CreateRatingDto) {
    return this.ratingService.submitRating(data);
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('rating/:id/questionnaire')
  submitQuestionnaire(
    @Param('id', ParseIntPipe) id: number,
    @Body() answers: CreateQuestionnaireAnswerDto[],
  ) {
    return this.ratingService.submitQuestionnaire(id, answers);
  }

  // ==================== ADMIN ====================

  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/stats')
  getRatingStats() {
    return this.ratingService.getRatingStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/config/select')
  getAllSelectConfigs() {
    return this.ratingService.getAllSelectConfigs();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/config/questionnaire')
  getAllQuestionnaireConfigs() {
    return this.ratingService.getAllQuestionnaireConfigs();
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('admin/rating/:id')
  getRatingById(@Param('id', ParseIntPipe) id: number) {
    return this.ratingService.getRatingById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/rating/config/select')
  createSelectConfig(@Body() data: CreateSelectConfigDto) {
    return this.ratingService.createSelectConfig(data);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/rating/config/select/:id')
  updateSelectConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateSelectConfigDto,
  ) {
    return this.ratingService.updateSelectConfig(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/rating/config/select/:id')
  deleteSelectConfig(@Param('id', ParseIntPipe) id: number) {
    return this.ratingService.deleteSelectConfig(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/rating/config/questionnaire')
  createQuestionnaireConfig(@Body() data: CreateQuestionnaireConfigDto) {
    return this.ratingService.createQuestionnaireConfig(data);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/rating/config/questionnaire/:id')
  updateQuestionnaireConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateQuestionnaireConfigDto,
  ) {
    return this.ratingService.updateQuestionnaireConfig(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/rating/config/questionnaire/:id')
  deleteQuestionnaireConfig(@Param('id', ParseIntPipe) id: number) {
    return this.ratingService.deleteQuestionnaireConfig(id);
  }
}
