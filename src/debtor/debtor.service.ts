import { Injectable } from '@nestjs/common';
import { DebtorEntity } from './debtor.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class DebtorService {
  constructor(
    @InjectRepository(DebtorEntity)
    private readonly debtorRepo: Repository<DebtorEntity>,
  ) {}

  async updateDebtor(
    data: {
      mem_code: string;
      billing_slip_id: string;
      payment_schedule_date: string;
      billing_amount: number;
    }[],
  ) {
    try {
      await Promise.all(
        data.map(async (item) => {
          const debtorEntities = this.debtorRepo.create({
            billing_slip_id: item.billing_slip_id,
            payment_schedule_date: item.payment_schedule_date,
            billing_amount: item.billing_amount,
            user: { mem_code: item.mem_code },
          });
          await this.debtorRepo.save(debtorEntities);
        }),
      );
    } catch (error) {
      console.log(error);
      throw new Error('Failed to update debtor data');
    }
  }

  async clearData() {
    try {
      await this.debtorRepo.clear();
    } catch (error) {
      console.log(error);
      throw new Error('Failed to clear debtor data');
    }
  }
}
