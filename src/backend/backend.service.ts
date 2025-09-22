import { Injectable } from '@nestjs/common';
import { LogFileEntity } from './logFile.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class BackendService {
  constructor(
    @InjectRepository(LogFileEntity)
    private readonly logfileRepository: Repository<LogFileEntity>,
  ) {}

  async updateLogFile(
    where: Partial<LogFileEntity>,
    update: Partial<LogFileEntity>,
  ): Promise<void> {
    await this.logfileRepository.update(where, update);
  }

  async getFeatured({
    featured,
  }: {
    featured: string;
  }): Promise<LogFileEntity[]> {
    const findfeatured = await this.logfileRepository.find({
      where: { feature: featured },
    });
    return findfeatured;
  }
}
