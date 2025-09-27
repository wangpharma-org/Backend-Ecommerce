import { Body, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modalmain } from './modalmain.entity';

@Injectable()
export class ModalContentService {
  constructor(
    @InjectRepository(Modalmain)
    private readonly modalmainRepository: Repository<Modalmain>,
  ) {}
  async SaveModalContent(
    @Body()
    body: {
      id: number;
      title: string;
      content?: string;
      show: boolean;
    },
  ): Promise<{ message: string }> {
    await this.modalmainRepository.update(
      { id: body.id },
      {
        title: body.title,
        content: body.content,
        show: body.show,
      },
    );
    return { message: 'Modal content saved successfully' };
  }

  async GetModalContent(): Promise<{ data: Modalmain | null }> {
    const modalContents = await this.modalmainRepository.find();
    return {
      data: modalContents.length > 0 ? modalContents[0] : null,
    };
  }
}
