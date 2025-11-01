import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Imagedebug } from './imagedebug.entity';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
@Injectable()
export class ImagedebugService {
  private readonly slackUrl = process.env.SLACK_WEBHOOK_URL || '';
  constructor(
    @InjectRepository(Imagedebug)
    private readonly imagedebugRepository: Repository<Imagedebug>,
  ) {}

  async UpsercetImg(data: {
    pro_code: string;
    imageUrl?: string;
  }): Promise<string> {
    try {
      const findItem = await this.imagedebugRepository.findOne({
        where: {
          relatedImage: { pro_code: data.pro_code },
        },
        relations: { relatedImage: true },
        select: {
          relatedImage: {
            pro_code: true,
          },
        },
      });
      if (!findItem) {
        await this.imagedebugRepository.save({
          relatedImage: { pro_code: data.pro_code },
          imageUrl: data.imageUrl || 'No Image',
        });
        return 'Inserted new record';
      }
      return 'Checked Item';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        'Error occurred while upserting image debug:',
        errorMessage,
      );
      throw error;
    }
  }

  @Cron('0 1 * * *') // ทุก 2 นาที
  async summaryItem(): Promise<Imagedebug[]> {
    try {
      const findAllItem = await this.imagedebugRepository.find({
        relations: { relatedImage: true },
        select: {
          id: true,
          imageUrl: true,
          relatedImage: { pro_code: true, pro_name: true },
        },
      });

      if (!findAllItem?.length) {
        throw new Error(`Can't find Item image`);
      }

      let CountData: number = 0;
      for (const item of findAllItem) {
        if (item.imageUrl !== 'No Image') {
          try {
            const imageBuffer = await axios.get(item.imageUrl, {
              timeout: 5000,
            });
            if (
              imageBuffer.status === 200 ||
              imageBuffer.status === 201 ||
              imageBuffer.status === 304
            ) {
              await this.imagedebugRepository.delete(item.id);
              continue;
            }
          } catch (error) {
            CountData += 1;
            continue;
          }
        }
        CountData += 1;
      }
      const itemsToReturn = [...findAllItem];
      const slackUrl = this.slackUrl;

      const payload = {
        text: `(กำลังทดสอบระบบ) สรุปข้อมูลภาพที่มีข้อผิดพลาด จำนวน ${CountData} รายการ`,
      };

      await axios.post(slackUrl, payload);

      return itemsToReturn;
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(
        'Error occurred while sending Slack summary:',
        errorMessage,
      );
      throw e;
    }
  }

  async getAllImagedebug(): Promise<Imagedebug[]> {
    try {
      const findAllItem = await this.imagedebugRepository.find({
        relations: { relatedImage: true },
        select: {
          id: true,
          imageUrl: true,
          relatedImage: { pro_code: true, pro_name: true },
        },
      });

      if (!findAllItem?.length) {
        throw new Error(`Can't find Item image`);
      }

      return findAllItem;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        'Error occurred while fetching all image debug:',
        errorMessage,
      );
      throw error;
    }
  }
}
