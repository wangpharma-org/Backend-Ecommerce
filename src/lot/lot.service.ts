import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LotEntity } from './lot.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class LotService {
  constructor(
    @InjectRepository(LotEntity)
    private readonly lotRepo: Repository<LotEntity>,
  ) {}

  async addLots(
    data: { lot: string; mfg: string; exp: string; pro_code: string }[],
  ) {
    try {
      if (!data || data.length === 0) return;
      const proCode = new Set(data.map((item) => item.pro_code));
      return await this.lotRepo.manager.transaction(async (manager) => {
        await manager.delete(LotEntity, {
          product: { pro_code: In(Array.from(proCode)) },
        });
        const entities = data.map((item) =>
          manager.create(LotEntity, {
            lot: item.lot,
            mfg: item.mfg,
            exp: item.exp,
            product: { pro_code: item.pro_code },
          }),
        );
        return await manager.save(LotEntity, entities);
      });
    } catch (error) {
      console.log(`${Date()} Error Something in addLots`);
      console.log(error);
      throw new Error('Error Something in addLots');
    }
  }
}
