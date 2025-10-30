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
    row_image: string;
    pro_code: string;
    imageUrl?: string;
  }): Promise<string> {
    try {
      const findItem = await this.imagedebugRepository.findOne({
        where: {
          relatedImage: { pro_code: data.pro_code },
          row_image: data.row_image,
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
          row_image: data.row_image,
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
      throw error; // ต้อง throw ต่อไปให้ controller จัดการ
    }
  }

  @Cron('* 1 * * *') // ทุกวันตอนตี 1
  async summaryItem(): Promise<Imagedebug[]> {
    try {
      const findAllItem = await this.imagedebugRepository.find({
        relations: { relatedImage: true },
        select: {
          id: true,
          imageUrl: true,
          count: true,
          row_image: true,
          relatedImage: { pro_code: true, pro_name: true },
        },
      });

      if (!findAllItem?.length) {
        throw new Error(`Can't find Item image`);
      }

      const itemsToReturn = [...findAllItem];
      const slackUrl = this.slackUrl;

      const chunk = <T>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size),
        );

      const batches = chunk(itemsToReturn, 45);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                `*(กำลังทดสอบระบบ) สรุปข้อมูลภาพที่มีข้อผิดพลาด* ` +
                `(ชุดที่ ${i + 1}/${batches.length}, รวม ${itemsToReturn.length} รายการ)`,
            },
          },
          { type: 'divider' },
          ...batch.map((item, index) => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                `*${index + 1 + i * 45}.* ` +
                `*${item?.relatedImage?.pro_code}* – ${item?.relatedImage?.pro_name}\n` +
                `> ${item?.imageUrl === 'No Image' ? '🔹 <ไม่มีภาพ>' : item?.imageUrl}`,
            },
          })),
        ];

        const payload = {
          text: `(กำลังทดสอบระบบ) สรุปข้อมูลภาพที่มีข้อผิดพลาด จำนวน ${itemsToReturn.length} รายการ`,
          blocks,
        };

        await axios.post(slackUrl, payload);
      }

      const ids = findAllItem.map((item) => item.id);
      await this.imagedebugRepository.delete(ids);

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
}
