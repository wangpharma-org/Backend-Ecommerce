import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import * as AWS from 'aws-sdk';
import { RatingEntity } from './rating.entity';
import { ImageReviewEntity } from './image-review.entity';
import {
  ReviewConfigSelectEntity,
  ReviewSelectType,
} from './review-config-select.entity';
import { QuestionnaireConfigEntity } from './questionnaire-config.entity';
import { QuestionnaireEntity } from './questionnaire.entity';

export interface CreateRatingDto {
  sh_running: string;
  mem_code?: string;
  rating_point: number;
  comment?: string;
  positive_select?: string[];
  negative_select?: string[];
}

export interface BatchRatingItemDto {
  sh_running: string;
  mem_code?: string;
  rating_point: number;
  comment?: string;
  positive_select?: string[];
  negative_select?: string[];
}

export interface BatchRatingResult {
  sh_running: string;
  rating_id: number;
}

export interface CreateQuestionnaireAnswerDto {
  question_id: number;
  rating_point: number;
  text_answer?: string;
}

export interface CreateSelectConfigDto {
  choice: string;
  type: ReviewSelectType;
  status?: boolean;
}

export interface UpdateSelectConfigDto {
  choice?: string;
  type?: ReviewSelectType;
  status?: boolean;
}

export interface CreateQuestionnaireConfigDto {
  question: string;
  status?: boolean;
  input_type?: 'star' | 'text';
}

export interface UpdateQuestionnaireConfigDto {
  question?: string;
  status?: boolean;
  input_type?: 'star' | 'text';
}

interface RatingStatsSummary {
  total: string;
  avg_point: string;
  positive_count: string;
  neutral_count: string;
  negative_count: string;
}

interface RatingDistributionItem {
  point: number;
  count: string;
}

export interface RatingStatsResult extends RatingStatsSummary {
  distribution: RatingDistributionItem[];
}

@Injectable()
export class RatingService {
  private s3: AWS.S3;

  constructor(
    @InjectRepository(RatingEntity)
    private readonly ratingRepo: Repository<RatingEntity>,
    @InjectRepository(ImageReviewEntity)
    private readonly imageReviewRepo: Repository<ImageReviewEntity>,
    @InjectRepository(ReviewConfigSelectEntity)
    private readonly reviewConfigSelectRepo: Repository<ReviewConfigSelectEntity>,
    @InjectRepository(QuestionnaireConfigEntity)
    private readonly questionnaireConfigRepo: Repository<QuestionnaireConfigEntity>,
    @InjectRepository(QuestionnaireEntity)
    private readonly questionnaireRepo: Repository<QuestionnaireEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  // ==================== USER ====================

  async submitRating(data: CreateRatingDto): Promise<RatingEntity> {
    try {
      const rating = this.ratingRepo.create(data);
      return await this.ratingRepo.save(rating);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถบันทึกรีวิวได้');
    }
  }

  async submitBatchRating(
    items: BatchRatingItemDto[],
  ): Promise<BatchRatingResult[]> {
    try {
      const shRunnings = items.map((i) => i.sh_running);
      const existing = await this.ratingRepo.find({
        where: { sh_running: In(shRunnings) },
        select: { sh_running: true, id: true },
      });
      const existingMap = new Map(existing.map((r) => [r.sh_running, r.id]));

      const results: BatchRatingResult[] = [];
      for (const item of items) {
        const existingId = existingMap.get(item.sh_running);
        if (existingId !== undefined) {
          results.push({ sh_running: item.sh_running, rating_id: existingId });
          continue;
        }
        const rating = this.ratingRepo.create(item);
        const saved = await this.ratingRepo.save(rating);
        results.push({ sh_running: item.sh_running, rating_id: saved.id });
      }
      return results;
    } catch (error) {
      throw new InternalServerErrorException('ไม่สามารถบันทึกรีวิวแบบกลุ่มได้');
    }
  }

  async uploadReviewImages(
    rating_id: number,
    files: Express.Multer.File[],
  ): Promise<ImageReviewEntity[]> {
    try {
      const rating = await this.ratingRepo.findOne({
        where: { id: rating_id },
      });
      if (!rating) throw new NotFoundException(`Rating ${rating_id} not found`);

      const uploaded: ImageReviewEntity[] = [];
      for (const file of files) {
        const key = `reviews/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`;
        const result = await this.s3
          .upload({
            Bucket: 'wang-storage',
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read',
          })
          .promise();

        const image = this.imageReviewRepo.create({
          rating_id,
          img_url: result.Location,
        });
        uploaded.push(await this.imageReviewRepo.save(image));
      }
      return uploaded;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถอัปโหลดรูปภาพรีวิวได้');
    }
  }

  async submitQuestionnaire(
    rating_id: number,
    answers: CreateQuestionnaireAnswerDto[],
  ): Promise<QuestionnaireEntity[]> {
    try {
      const rating = await this.ratingRepo.findOne({
        where: { id: rating_id },
      });
      if (!rating) throw new NotFoundException(`Rating ${rating_id} not found`);

      const questionIds = answers.map((a) => a.question_id).filter(Boolean) as number[];
      const configs = await this.questionnaireConfigRepo.find({
        where: { id: In(questionIds) },
        select: { id: true, question: true },
      });
      const configMap = new Map(configs.map((c) => [c.id, c.question]));

      const saved: QuestionnaireEntity[] = [];
      for (const answer of answers) {
        const q = this.questionnaireRepo.create({
          rating_id,
          question_id: answer.question_id,
          rating_point: answer.rating_point,
          text_answer: answer.text_answer ?? null,
          question_text: configMap.get(answer.question_id) ?? null,
        });
        saved.push(await this.questionnaireRepo.save(q));
      }
      return saved;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถบันทึกแบบสอบถามได้');
    }
  }

  async getActiveSelectOptions(
    type?: ReviewSelectType,
  ): Promise<ReviewConfigSelectEntity[]> {
    try {
      const where: FindOptionsWhere<ReviewConfigSelectEntity> = {
        status: true,
      };
      if (type) where.type = type;
      return await this.reviewConfigSelectRepo.find({
        where,
        order: { id: 'ASC' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงตัวเลือกการรีวิวได้');
    }
  }

  async getActiveQuestions(): Promise<QuestionnaireConfigEntity[]> {
    try {
      return await this.questionnaireConfigRepo.find({
        where: { status: true },
        order: { id: 'ASC' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงคำถามแบบสอบถามได้');
    }
  }

  async getRatingBySh(sh_running: string): Promise<RatingEntity | null> {
    try {
      return await this.ratingRepo.findOne({
        where: { sh_running },
        relations: ['images', 'questionnaires', 'questionnaires.question'],
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงข้อมูลรีวิวได้');
    }
  }

  // ==================== ADMIN ====================

  async getAllRatings(
    page: number,
    limit: number,
    minPoint?: number,
    maxPoint?: number,
  ): Promise<{
    data: RatingEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const qb = this.ratingRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.images', 'images')
        .leftJoinAndSelect('r.questionnaires', 'questionnaires')
        .leftJoinAndSelect('questionnaires.question', 'question')
        .orderBy('r.created_at', 'DESC');

      if (minPoint !== undefined)
        qb.andWhere('r.rating_point >= :minPoint', { minPoint });
      if (maxPoint !== undefined)
        qb.andWhere('r.rating_point <= :maxPoint', { maxPoint });

      const [data, total] = await qb
        .take(limit)
        .skip((page - 1) * limit)
        .getManyAndCount();

      return { data, total, page, limit };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงรายการรีวิวได้');
    }
  }

  async getRatingById(id: number): Promise<RatingEntity> {
    try {
      const rating = await this.ratingRepo.findOne({
        where: { id },
        relations: ['images', 'questionnaires', 'questionnaires.question'],
      });
      if (!rating) throw new NotFoundException(`Rating ${id} not found`);
      return rating;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงข้อมูลรีวิวได้');
    }
  }

  async getRatingStats(): Promise<RatingStatsResult> {
    try {
      const rawSummary = await this.ratingRepo
        .createQueryBuilder('r')
        .select('COUNT(r.id)', 'total')
        .addSelect('AVG(r.rating_point)', 'avg_point')
        .addSelect(
          'SUM(CASE WHEN r.rating_point >= 3 THEN 1 ELSE 0 END)',
          'positive_count',
        )
        .addSelect(
          'SUM(CASE WHEN r.rating_point = 0 THEN 1 ELSE 0 END)',
          'neutral_count',
        )
        .addSelect(
          'SUM(CASE WHEN r.rating_point < 3 THEN 1 ELSE 0 END)',
          'negative_count',
        )
        .getRawOne<RatingStatsSummary>();

      const summary: RatingStatsSummary = rawSummary ?? {
        total: '0',
        avg_point: '0',
        positive_count: '0',
        neutral_count: '0',
        negative_count: '0',
      };

      const distribution = await this.ratingRepo
        .createQueryBuilder('r')
        .select('r.rating_point', 'point')
        .addSelect('COUNT(r.id)', 'count')
        .groupBy('r.rating_point')
        .orderBy('r.rating_point', 'ASC')
        .getRawMany<RatingDistributionItem>();

      return { ...summary, distribution };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงสถิติรีวิวได้');
    }
  }

  // --- Select Config ---

  async getAllSelectConfigs(): Promise<ReviewConfigSelectEntity[]> {
    try {
      return await this.reviewConfigSelectRepo.find({
        order: { type: 'ASC', id: 'ASC' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงตัวเลือกการรีวิวได้');
    }
  }

  async createSelectConfig(
    data: CreateSelectConfigDto,
  ): Promise<ReviewConfigSelectEntity> {
    try {
      const config = this.reviewConfigSelectRepo.create(data);
      return await this.reviewConfigSelectRepo.save(config);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'ไม่สามารถสร้างตัวเลือกการรีวิวได้',
      );
    }
  }

  async updateSelectConfig(
    id: number,
    data: UpdateSelectConfigDto,
  ): Promise<ReviewConfigSelectEntity> {
    try {
      const config = await this.reviewConfigSelectRepo.findOne({
        where: { id },
      });
      if (!config) throw new NotFoundException(`SelectConfig ${id} not found`);
      Object.assign(config, data);
      return await this.reviewConfigSelectRepo.save(config);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'ไม่สามารถแก้ไขตัวเลือกการรีวิวได้',
      );
    }
  }

  async deleteSelectConfig(id: number): Promise<void> {
    try {
      const config = await this.reviewConfigSelectRepo.findOne({
        where: { id },
      });
      if (!config) throw new NotFoundException(`SelectConfig ${id} not found`);
      await this.reviewConfigSelectRepo.delete(id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถลบตัวเลือกการรีวิวได้');
    }
  }

  // --- Questionnaire Config ---

  async getAllQuestionnaireConfigs(): Promise<QuestionnaireConfigEntity[]> {
    try {
      return await this.questionnaireConfigRepo.find({ order: { id: 'ASC' } });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถดึงคำถามแบบสอบถามได้');
    }
  }

  async createQuestionnaireConfig(
    data: CreateQuestionnaireConfigDto,
  ): Promise<QuestionnaireConfigEntity> {
    try {
      const config = this.questionnaireConfigRepo.create(data);
      return await this.questionnaireConfigRepo.save(config);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถสร้างคำถามแบบสอบถามได้');
    }
  }

  async updateQuestionnaireConfig(
    id: number,
    data: UpdateQuestionnaireConfigDto,
  ): Promise<QuestionnaireConfigEntity> {
    try {
      const config = await this.questionnaireConfigRepo.findOne({
        where: { id },
      });
      if (!config)
        throw new NotFoundException(`QuestionnaireConfig ${id} not found`);
      Object.assign(config, data);
      return await this.questionnaireConfigRepo.save(config);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถแก้ไขคำถามแบบสอบถามได้');
    }
  }

  async deleteQuestionnaireConfig(id: number): Promise<void> {
    try {
      const config = await this.questionnaireConfigRepo.findOne({
        where: { id },
      });
      if (!config)
        throw new NotFoundException(`QuestionnaireConfig ${id} not found`);
      await this.questionnaireConfigRepo.delete(id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ไม่สามารถลบคำถามแบบสอบถามได้');
    }
  }
}
