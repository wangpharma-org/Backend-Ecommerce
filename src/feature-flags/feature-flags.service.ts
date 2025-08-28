import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from '../failed-api/feature_flag.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly flagRepo: Repository<FeatureFlagEntity>,
  ) {}

  async getFlag(flag: string) {
    try {
      const status = await this.flagRepo.findOne({
        where: {
          feature_key: flag,
        },
      });
      if (status) {
        return status.is_enabled;
      } else {
        const status = this.flagRepo.create({
          feature_key: flag,
          is_enabled: true,
        });
        await this.flagRepo.save(status);
        return status.is_enabled;
      }
    } catch {
      throw new Error('Something Error in getFlag');
    }
  }

  async updateFlag(data: { flag: string; status: boolean }) {
    try {
      const status = await this.flagRepo.update(
        {
          feature_key: data.flag,
        },
        {
          is_enabled: data.status,
        },
      );
      if (status) {
        return 'Success';
      } else {
        return 'Not found this flag';
      }
    } catch {
      throw new Error('Something Error in updateFlag');
    }
  }
}
