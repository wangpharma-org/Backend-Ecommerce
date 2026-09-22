import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerStoreVisibilityEntity } from './customer-store-visibility.entity';

@Injectable()
export class StoreVisibilityService {
  constructor(
    @InjectRepository(CustomerStoreVisibilityEntity)
    private readonly visibilityRepo: Repository<CustomerStoreVisibilityEntity>,
  ) {}

  async getSetting(mem_code: string): Promise<{ show_store_name: boolean }> {
    const row = await this.visibilityRepo.findOne({ where: { mem_code } });
    return { show_store_name: row?.show_store_name ?? false };
  }

  async setSetting(
    mem_code: string,
    show_store_name: boolean,
  ): Promise<{ show_store_name: boolean }> {
    await this.visibilityRepo.upsert({ mem_code, show_store_name }, [
      'mem_code',
    ]);
    return { show_store_name };
  }

  // ร้านไหนในรายการยอมให้คนอื่นเห็นชื่อร้าน
  async findVisibleMemCodes(memCodes: string[]): Promise<Set<string>> {
    if (memCodes.length === 0) return new Set();
    const rows = await this.visibilityRepo.find({
      where: { mem_code: In(memCodes), show_store_name: true },
      select: { mem_code: true },
    });
    return new Set(rows.map((r) => r.mem_code));
  }
}
