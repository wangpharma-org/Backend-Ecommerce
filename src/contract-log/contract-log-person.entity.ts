import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
// import { ContractLogBanner } from './contract-log-banner.entity';
import { ContractLogUpload } from './contract-log-upload.entity';
import { ContractLogBanner } from './contract-log-banner.entity';

@Entity()
export class ContractLogPerson {
  @PrimaryGeneratedColumn()
  personId: number;

  @Column()
  personName: string;

  @Column()
  type: 'wang' | 'attestor' | 'creditor';

  @Column({ nullable: true, default: null })
  position: string;

  @OneToOne(() => ContractLogUpload)
  @JoinColumn({ name: 'uploadId' })
  uploads: ContractLogUpload;

  @OneToOne(() => ContractLogBanner, (b) => b.personByCreditor)
  bannerByCreditor: ContractLogBanner;

  @OneToMany(() => ContractLogBanner, (b) => b.personByWangEmp)
  bannerByWang: ContractLogBanner[];

  @OneToMany(() => ContractLogBanner, (b) => b.personByAttestor)
  bannerByAttestor: ContractLogBanner[];
}
