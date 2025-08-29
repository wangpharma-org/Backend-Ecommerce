import { Injectable } from '@nestjs/common';
import { BannerEntity } from './banner.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as AWS from 'aws-sdk';

@Injectable()
export class BannerService {
  private s3: AWS.S3;
  constructor() { // private readonly bannerRepo: Repository<BannerEntity>, // @InjectRepository(BannerEntity)
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  async getPresignedUrl(filename: string, filetype: string) {
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: `${Date.now()}-${filename}`,
      Expires: 60,
      ContentType: filetype,
    //   ACL: 'public-read',
    };

    const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);

    console.log(
      `https://${process.env.DO_SPACES_BUCKET}.sgp1.digitaloceanspaces.com/${params.Key}`,
    );
    console.log(uploadUrl);

    return {
      uploadUrl,
      fileUrl: `https://${process.env.DO_SPACES_BUCKET}.sgp1.digitaloceanspaces.com/${params.Key}`,
    };
  }
}
