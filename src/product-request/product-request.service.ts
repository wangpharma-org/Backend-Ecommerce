import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as AWS from 'aws-sdk';
import {
  ProductRequestEntity,
  ProductRequestStatus,
} from './product-request.entity';

export interface CreateProductRequestDto {
  mem_code: string;
  keyword: string;
  pro_name: string;
  note?: string;
  source_page?: string;
  shown_products?: string;
  current_page?: number;
}

export interface UpdateProductRequestStatusDto {
  status: ProductRequestStatus;
}

@Injectable()
export class ProductRequestService {
  private s3: AWS.S3;

  constructor(
    @InjectRepository(ProductRequestEntity)
    private readonly repo: Repository<ProductRequestEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  async createRequest(
    dto: CreateProductRequestDto,
    file?: Express.Multer.File,
  ): Promise<ProductRequestEntity> {
    try {
      let img_url: string | undefined;

      if (file) {
        const key = `product-requests/${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const result = await this.s3
          .upload({
            Bucket: 'wang-storage',
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read',
          })
          .promise();
        img_url = result.Location;
      }

      const entity = this.repo.create({ ...dto, img_url });
      return await this.repo.save(entity);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('ไม่สามารถบันทึกคำขอสินค้าได้');
    }
  }

  async getAll(
    page: number,
    limit: number,
    status?: ProductRequestStatus,
  ): Promise<{
    data: ProductRequestEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const qb = this.repo
        .createQueryBuilder('pr')
        .orderBy('pr.created_at', 'DESC');

      if (status) qb.where('pr.status = :status', { status });

      const [data, total] = await qb
        .take(limit)
        .skip((page - 1) * limit)
        .getManyAndCount();

      return { data, total, page, limit };
    } catch {
      throw new InternalServerErrorException('ไม่สามารถดึงรายการคำขอสินค้าได้');
    }
  }

  async updateStatus(
    id: number,
    dto: UpdateProductRequestStatusDto,
  ): Promise<ProductRequestEntity> {
    try {
      const entity = await this.repo.findOne({ where: { id } });
      if (!entity)
        throw new NotFoundException(`ProductRequest ${id} not found`);
      entity.status = dto.status;
      return await this.repo.save(entity);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'ไม่สามารถอัปเดตสถานะคำขอสินค้าได้',
      );
    }
  }
}
