import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import * as AWS from 'aws-sdk';
import { randomBytes } from 'crypto';
import { UserEntity } from '../users/users.entity';
import { CustomerReturnClient } from './customer-return.client';
import { CreateReturnDto, ReturnCompletedDto } from './customer-return.dto';

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const RECENT_COMPLETED_DAYS = 7;
const SPACES_HOST = 'sgp1.digitaloceanspaces.com';

const METHOD_LABEL: Record<string, string> = {
  exchange: 'เปลี่ยนเป็นสินค้าใหม่',
  refund: 'คืนเป็นเงิน',
  credit: 'หักลดในบัญชี',
};

interface ReturnSummary {
  return_no: string;
  stage: number;
  method: string | null;
  outcome: string | null;
  completed_at: string | null;
  receipt_doc_no: string | null;
  receipt_net_total: string | null;
}

@Injectable()
export class CustomerReturnService {
  private readonly logger = new Logger(CustomerReturnService.name);
  private readonly s3: AWS.S3;
  private readonly bucket = process.env.DO_SPACES_BUCKET || 'wang-storage';
  private readonly notificationUrl =
    process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3005';

  constructor(
    private readonly client: CustomerReturnClient,
    private readonly http: HttpService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint(`https://${SPACES_HOST}`),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  listBills(mem_code: string) {
    return this.client.get(`ecom/${encodeURIComponent(mem_code)}/bills`);
  }

  getBill(mem_code: string, sh_running: string) {
    return this.client.get(
      `ecom/${encodeURIComponent(mem_code)}/bills/${encodeURIComponent(sh_running)}`,
    );
  }

  getPickupOptions() {
    return this.client.get('ecom/pickup-options');
  }

  async uploadPhotos(mem_code: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('กรุณาแนบรูปภาพ');
    if (files.length > 4) throw new BadRequestException('แนบได้ไม่เกิน 4 รูป');
    for (const f of files) {
      if (!PHOTO_MIME[f.mimetype]) {
        throw new BadRequestException('รองรับเฉพาะไฟล์ JPG, PNG, WEBP');
      }
      if (f.size > PHOTO_MAX_BYTES) {
        throw new BadRequestException('รูปต้องมีขนาดไม่เกิน 5MB');
      }
    }
    const urls: string[] = [];
    for (const f of files) {
      const key = `${this.photoPrefix(mem_code)}${Date.now()}-${randomBytes(4).toString('hex')}${PHOTO_MIME[f.mimetype]}`;
      const res = await this.s3
        .upload({
          Bucket: this.bucket,
          Key: key,
          Body: f.buffer,
          ContentType: f.mimetype,
          ACL: 'public-read',
        })
        .promise();
      urls.push(res.Location);
    }
    return { urls };
  }

  async create(mem_code: string, dto: CreateReturnDto) {
    // กันแนบ URL ภายนอก/ของร้านอื่น — รูปต้องมาจาก uploadPhotos ของร้านนี้เท่านั้น
    const prefix = this.photoPrefix(mem_code);
    for (const item of dto.items) {
      for (const url of item.customer_photos) {
        if (!this.isOwnPhoto(url, prefix)) {
          throw new BadRequestException('รูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่');
        }
      }
    }

    const user = await this.userRepo.findOne({ where: { mem_code } });
    return this.client.post('ecom/requests', {
      ...dto,
      mem_code,
      customer_name: user?.mem_nameSite ?? null,
      pickup_address: user ? formatAddress(user) : null,
    });
  }

  // เตือนทันทีตอนลูกค้ากรอก lot ว่าไม่พบในระบบวังเภสัช (ไม่บล็อกการส่งคำขอ)
  lotCheck(pro_code: string, lot: string) {
    const q = new URLSearchParams({ pro_code, lot }).toString();
    return this.client.get<{ found: boolean }>(`ecom/lot-check?${q}`);
  }

  listRequests(mem_code: string) {
    return this.client.get(`ecom/${encodeURIComponent(mem_code)}/requests`);
  }

  getRequest(mem_code: string, return_no: string) {
    return this.client.get(
      `ecom/${encodeURIComponent(mem_code)}/requests/${encodeURIComponent(return_no)}`,
    );
  }

  // สำหรับกระดิ่งแจ้งเตือน — คำขอที่ปิดงานภายใน 7 วันล่าสุด
  async recentCompleted(mem_code: string) {
    const all = await this.listRequests(mem_code);
    const since = Date.now() - RECENT_COMPLETED_DAYS * 86400000;
    return (all as ReturnSummary[])
      .filter(
        (r) =>
          r.stage === 5 &&
          r.completed_at !== null &&
          new Date(r.completed_at).getTime() >= since,
      )
      .map((r) => ({
        return_no: r.return_no,
        method: r.method,
        outcome: r.outcome,
        completed_at: r.completed_at,
        receipt_doc_no: r.receipt_doc_no,
        receipt_net_total: r.receipt_net_total,
      }));
  }

  // Order Picking เรียกเมื่อฝ่ายทำคืนปิดงาน — ส่ง push/LINE ผ่าน notification-service
  async handleCompleted(dto: ReturnCompletedDto) {
    const { title, message } = completedMessage(dto);
    try {
      await lastValueFrom(
        this.http.post(
          `${this.notificationUrl}/api/notifications/notifications/dispatch`,
          {
            memCode: dto.mem_code,
            type: 'customer_return',
            title,
            message,
            channels: ['FCM', 'LINE'],
            data: { return_no: dto.return_no },
          },
          { timeout: 5000 },
        ),
      );
      return { success: true };
    } catch (error: unknown) {
      // แจ้งเตือนล้มไม่ต้องให้ Order Picking ถือว่าล้ม — ลูกค้ายังเห็นในกระดิ่ง/หน้าติดตาม
      this.logger.warn(
        `customer-return notify failed ${dto.return_no}: ${String(error)}`,
      );
      return { success: true, push_sent: false };
    }
  }

  private photoPrefix(mem_code: string) {
    return `customer-return/photos/${mem_code.replace(/[^A-Za-z0-9_-]/g, '')}/`;
  }

  private isOwnPhoto(url: string, prefix: string) {
    try {
      const u = new URL(url);
      const path = decodeURIComponent(u.pathname).replace(/^\//, '');
      // DO Spaces คืน URL ได้ทั้งแบบ bucket.host/key และ host/bucket/key
      const key = u.hostname.startsWith(`${this.bucket}.`)
        ? path
        : path.replace(new RegExp(`^${this.bucket}/`), '');
      return (
        u.hostname.endsWith(SPACES_HOST) &&
        key.startsWith(prefix) &&
        !key.includes('..')
      );
    } catch {
      return false;
    }
  }
}

const formatAddress = (u: UserEntity) =>
  [
    u.mem_address,
    u.mem_village && `หมู่บ้าน ${u.mem_village}`,
    u.mem_alley && `ซอย ${u.mem_alley}`,
    u.mem_tumbon && `ต.${u.mem_tumbon}`,
    u.mem_amphur && `อ.${u.mem_amphur}`,
    u.mem_province && `จ.${u.mem_province}`,
    u.mem_post,
  ]
    .filter(Boolean)
    .join(' ') || null;

// ข้อความแจ้งเตือนตามผลตัดสินของฝ่ายทำคืน (คืนได้ทั้งหมด / บางรายการ / ไม่ได้)
export const completedMessage = (dto: ReturnCompletedDto) => {
  const total =
    dto.receipt_net_total !== null && dto.receipt_net_total !== undefined
      ? ` ยอดเงินสุทธิ ${dto.receipt_net_total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`
      : '';
  const method = dto.method
    ? ` (${METHOD_LABEL[dto.method] ?? dto.method})`
    : '';
  if (dto.outcome === 'rejected') {
    return {
      title: 'คำขอคืนสินค้าไม่ผ่านการตรวจรับ',
      message: `คำขอ ${dto.return_no} · ฝ่ายทำคืนไม่สามารถรับคืนสินค้าได้ ดูเหตุผลในหน้าติดตามการคืน`,
    };
  }
  const partial = dto.outcome === 'partial' ? ' (รับคืนได้บางรายการ)' : '';
  return {
    title: 'คืนสินค้าเรียบร้อย',
    message: `คำขอ ${dto.return_no}${partial} · ใบรับคืน ${dto.receipt_doc_no ?? '-'}${method}${total}`,
  };
};
