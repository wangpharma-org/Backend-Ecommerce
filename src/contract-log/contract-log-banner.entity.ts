import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ContractLogPerson } from './contract-log-person.entity';
import { ContractLogUpload } from './contract-log-upload.entity';
import { CreditorEntity } from 'src/products/creditor.entity';

@Entity()
export class ContractLogBanner {
  @PrimaryGeneratedColumn()
  bannerId: number;

  @Column({ nullable: true, default: null })
  startDate: Date;

  @Column({ nullable: true, default: null })
  endDate: Date;

  @Column({ nullable: true, default: null })
  signingDate: Date;

  @Column({ nullable: true, default: null })
  creditorEmpId: number;

  @Column({ nullable: true, default: null })
  wangEmpId: number;

  @Column({ nullable: true, default: null })
  attestor: number;

  @Column({ nullable: true, default: null })
  img_banner: number;

  @Column({ nullable: true, default: null })
  bannerName: string;

  @Column({ nullable: true, default: null })
  creditor_code: string;

  @Column({ nullable: true, default: null })
  paymentDue: Date;

  @Column({ nullable: true, default: null })
  attestor2: number;

  @Column({ nullable: true, default: null })
  urlContract: number;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByWang, {
    nullable: true,
  })
  @JoinColumn({ name: 'wangEmpId', referencedColumnName: 'personId' })
  personByWangEmp?: ContractLogPerson;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByAttestor, {
    nullable: true,
  })
  @JoinColumn({ name: 'attestor', referencedColumnName: 'personId' })
  personByAttestor?: ContractLogPerson;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByAttestor, {
    nullable: true,
  })
  @JoinColumn({ name: 'attestor2', referencedColumnName: 'personId' })
  personByAttestor2?: ContractLogPerson;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByCreditor, {
    nullable: true,
  })
  @JoinColumn({ name: 'creditorEmpId', referencedColumnName: 'personId' })
  personByCreditor?: ContractLogPerson;

  @OneToOne(() => ContractLogUpload, { nullable: true })
  @JoinColumn({ name: 'img_banner', referencedColumnName: 'uploadId' })
  upload: ContractLogUpload;

  @OneToOne(() => ContractLogUpload, { nullable: true })
  @JoinColumn({ name: 'urlContract', referencedColumnName: 'uploadId' })
  upload2: ContractLogUpload;

  @ManyToOne(() => CreditorEntity, (c) => c.contract_log, { nullable: true })
  @JoinColumn({ name: 'creditor_code', referencedColumnName: 'creditor_code' })
  creditor: CreditorEntity;

  @Column({ type: 'text', nullable: true, default: null })
  address: string;
}
