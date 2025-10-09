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

  async upsertFileLog(data: {
    filename: string;
    feature: string;
  }): Promise<LogFileEntity> {
    const existingLog = await this.logfileRepository.findOne({
      where: { feature: data.feature },
    });

    if (existingLog) {
      existingLog.filename = data.filename;
      existingLog.uploadedAt = new Date();
      return await this.logfileRepository.save(existingLog);
    } else {
      const newLog = this.logfileRepository.create({
        feature: data.feature,
        filename: data.filename,
        uploadedAt: new Date(),
      });
      return await this.logfileRepository.save(newLog);
    }
  }

  async getLogfile(feature: string): Promise<LogFileEntity | null | LogFileEntity[]> {
    if (!feature) {
      return null;
    }
    if (feature === 'all') {
      return await this.logfileRepository.find();
    }
    return await this.logfileRepository.findOne({
      where: { feature },
    });
  }
}
