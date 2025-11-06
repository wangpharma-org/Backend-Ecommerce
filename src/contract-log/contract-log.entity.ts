import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ContractLogBanner } from './contract-log-banner.entity';

@Entity()
export class ContractLog {
  @PrimaryGeneratedColumn()
  Id: number;

  @Column()
  contractId: number;

  @Column()
  creditor_code: Date;

  @OneToOne(() => ContractLogBanner)
  @JoinColumn({ name: 'contractId', referencedColumnName: 'bannerId' })
  log: ContractLogBanner;

  // @OneToOne(() => ContractLogBanner)
  // @JoinColumn({ name: 'contractId', referencedColumnName: 'bannerId' })
  // companyDay: ContractLogBanner;
}
