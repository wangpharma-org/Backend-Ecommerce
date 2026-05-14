import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReviewRequestEntity } from './review-request.entity';

@Injectable()
export class ReviewRequestService {
  constructor(
    @InjectRepository(ReviewRequestEntity)
    private readonly repo: Repository<ReviewRequestEntity>,
  ) {}

  async create(
    memCode: string,
    shRunning: string[],
  ): Promise<ReviewRequestEntity> {
    const entity = this.repo.create({
      mem_code: memCode,
      sh_running: shRunning,
    });
    return this.repo.save(entity);
  }

  async getPending(memCode: string): Promise<ReviewRequestEntity[]> {
    return this.repo.find({
      where: { mem_code: memCode, is_completed: false },
      order: { created_at: 'DESC' },
    });
  }

  async markCompleted(memCode: string, shRunning: string[]): Promise<void> {
    const pending = await this.repo.find({
      where: { mem_code: memCode, is_completed: false },
    });
    const toComplete = pending.filter((req) =>
      req.sh_running.some((s) => shRunning.includes(s)),
    );
    if (toComplete.length === 0) return;
    await this.repo.update(
      { id: In(toComplete.map((r) => r.id)) },
      { is_completed: true },
    );
  }
}
