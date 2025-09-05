import { Body, Injectable } from '@nestjs/common';
import { BannerEntity } from './banner.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import * as AWS from 'aws-sdk';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class BannerService {
  private s3: AWS.S3;
  constructor(
    @InjectRepository(BannerEntity)
    private readonly bannerRepo: Repository<BannerEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  async DeleteBanner() {
    try {
      const today = new Date();
      await this.bannerRepo.delete({ date_end: LessThan(today) });
    } catch {
      throw new Error('Something Error in DeleteBanner');
    }
  }

  async GetImageUrl() {
    try {
      const today = new Date();

      return this.bannerRepo.find({
        where: {
          date_start: LessThanOrEqual(today),
          date_end: MoreThanOrEqual(today),
        },
        select: {
          banner_image: true,
        },
      });
    } catch {
      throw new Error('Error in GetImageUrl');
    }
  }

  async UploadImage(
    file: Express.Multer.File,
    date_start: Date,
    date_end: Date,
  ) {
    try {
      if (!file) {
        throw new Error('Something Error in Upload Banner');
      }
      const params = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file?.originalname}`,
        Body: file?.buffer,
        ContentType: file?.mimetype,
        ACL: 'public-read',
      };

      const data = await this.s3.upload(params).promise();

      const urlSaved = this.bannerRepo.create({
        banner_image: data.Location,
        date_end: date_end,
        date_start: date_start,
      });

      await this.bannerRepo.save(urlSaved);

      console.log(data);

      return data;
    } catch {
      throw new Error('Something Error in Upload Banner');
    }
  }
}
