import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';
import { RatingEntity } from './rating.entity';
import { ImageReviewEntity } from './image-review.entity';
import { ReviewConfigSelectEntity } from './review-config-select.entity';
import { QuestionnaireConfigEntity } from './questionnaire-config.entity';
import { QuestionnaireEntity } from './questionnaire.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RatingEntity,
      ImageReviewEntity,
      ReviewConfigSelectEntity,
      QuestionnaireConfigEntity,
      QuestionnaireEntity,
    ]),
  ],
  providers: [RatingService],
  controllers: [RatingController],
  exports: [RatingService],
})
export class RatingModule {}
