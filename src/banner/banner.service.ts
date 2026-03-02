import { Injectable } from '@nestjs/common';
import {
  BannerEntity,
  BannerLocation,
  BannerDisplayType,
  TextColor,
  TextPosition,
} from './banner.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import * as AWS from 'aws-sdk';
import { Cron } from '@nestjs/schedule';

export interface UploadBannerDto {
  date_start: Date;
  date_end: Date;
  banner_name?: string;
  banner_location?: BannerLocation;
  link_url?: string;
  display_type?: BannerDisplayType;
  title?: string;
  subtitle?: string;
  description?: string;
  cta_text?: string;
  cta_url?: string;
  cta_secondary_text?: string;
  cta_secondary_url?: string;
  text_color?: TextColor;
  text_position?: TextPosition;
  bg_gradient?: string;
  is_drug?: boolean;
  advertise_code?: string;
  creditor?: string;
  product_list?: string;
}

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

  /**
   * Get active banners, optionally filtered by location
   */
  async GetImageUrl(location?: BannerLocation) {
    try {
      const today = new Date();

      const whereCondition: any = {
        date_start: LessThanOrEqual(today),
        date_end: MoreThanOrEqual(today),
        is_active: true,
      };

      // Filter by location if provided
      if (location) {
        whereCondition.banner_location = location;
      }

      return this.bannerRepo.find({
        where: whereCondition,
        order: {
          sort_order: 'ASC',
          created_at: 'DESC',
        },
      });
    } catch {
      throw new Error('Error in GetImageUrl');
    }
  }

  /**
   * Upload banner with all fields
   */
  async UploadImage(file: Express.Multer.File | null, data: UploadBannerDto) {
    console.log('=== UploadImage START ===');
    console.log(
      'File received:',
      file ? `${file.originalname} (${file.size} bytes)` : 'No file',
    );
    console.log('Data received:', JSON.stringify(data, null, 2));

    try {
      let imageUrl: string | undefined = undefined;

      // Only upload file if provided (text_only banners don't need images)
      if (file) {
        const hasValidCredentials =
          process.env.DO_SPACES_KEY &&
          process.env.DO_SPACES_KEY !== 'placeholder' &&
          process.env.DO_SPACES_SECRET &&
          process.env.DO_SPACES_SECRET !== 'placeholder';

        if (hasValidCredentials) {
          console.log('Uploading to S3...');
          const params = {
            Bucket: 'wang-storage',
            Key: `banners/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file?.originalname}`,
            Body: file?.buffer,
            ContentType: file?.mimetype,
            ACL: 'public-read',
          };

          const uploadResult = await this.s3.upload(params).promise();
          imageUrl = uploadResult.Location;
          console.log('S3 upload success:', imageUrl);
        } else {
          // Local testing mode - use random placeholder image from picsum
          console.log(
            '⚠️ S3 credentials not configured, using placeholder image',
          );
          const randomSeed = Date.now();
          imageUrl = `https://picsum.photos/seed/${randomSeed}/1200/400`;
          console.log('Placeholder URL:', imageUrl);
        }
      }

      // Create banner entity with all fields
      console.log('Creating banner entity...');
      const banner = this.bannerRepo.create({
        banner_image: imageUrl,
        banner_name: data.banner_name,
        banner_location: data.banner_location || 'store_carousel',
        date_start: data.date_start,
        date_end: data.date_end,
        link_url: data.link_url,
        display_type: data.display_type || 'image_only',
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        cta_text: data.cta_text,
        cta_url: data.cta_url,
        cta_secondary_text: data.cta_secondary_text,
        cta_secondary_url: data.cta_secondary_url,
        text_color: data.text_color || 'dark',
        text_position: data.text_position || 'left',
        bg_gradient: data.bg_gradient,
        is_active: true,
        is_drug: data.is_drug,
        advertise_code: data.advertise_code,
        creditor: data.creditor,
        product_list: data.product_list,
      });
      console.log('Banner entity created:', JSON.stringify(banner, null, 2));

      console.log('Saving to database...');
      const savedBanner = await this.bannerRepo.save(banner);
      console.log('Saved successfully, ID:', savedBanner.banner_id);

      return {
        Location: imageUrl,
        banner: savedBanner,
      };
    } catch (error) {
      console.error('=== Upload Banner Error ===');
      console.error(
        'Error message:',
        error instanceof Error ? error.message : error,
      );
      console.error('Full error:', error);
      throw new Error(
        `Upload Banner failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update existing banner
   */
  async updateBanner(bannerId: number, data: Partial<BannerEntity>) {
    try {
      await this.bannerRepo.update(bannerId, data);
      return this.bannerRepo.findOne({ where: { banner_id: bannerId } });
    } catch (error) {
      console.error('Update Banner Error:', error);
      throw new Error('Error updating banner');
    }
  }

  /**
   * Delete banner by ID
   */
  async deleteBannerById(bannerId: number) {
    try {
      const banner = await this.bannerRepo.findOne({ where: { banner_id: bannerId } });

      // Only try to delete from S3 if it's actually an S3/DO Spaces URL
      if (banner?.banner_image && banner.banner_image.includes('digitaloceanspaces.com')) {
        const hasValidCredentials =
          process.env.DO_SPACES_KEY &&
          process.env.DO_SPACES_KEY !== 'placeholder' &&
          process.env.DO_SPACES_SECRET &&
          process.env.DO_SPACES_SECRET !== 'placeholder';

        if (hasValidCredentials) {
          try {
            const url = new URL(banner.banner_image);
            const key = url.pathname.substring(1); // Remove leading slash
            await this.s3.deleteObject({
              Bucket: 'wang-storage',
              Key: key,
            }).promise();
            console.log('S3 file deleted:', key);
          } catch (s3Error) {
            console.warn('Failed to delete S3 file (continuing with DB delete):', s3Error);
          }
        }
      }

      return this.bannerRepo.delete(bannerId);
    } catch (error) {
      console.error('Delete Banner Error:', error);
      throw new Error('Error deleting banner');
    }
  }

  async findAllBanners(): Promise<BannerEntity[]> {
    return this.bannerRepo.find({
      order: {
        banner_location: 'ASC',
        sort_order: 'ASC',
        created_at: 'DESC',
      },
    });
  }

  async findBannerById(bannerId: number): Promise<BannerEntity | null> {
    return this.bannerRepo.findOne({ where: { banner_id: bannerId } });
  }
}
