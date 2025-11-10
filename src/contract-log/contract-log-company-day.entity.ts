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
export class ContractLogCompanyDay {
  @PrimaryGeneratedColumn()
  companyDayId: number;

  @Column({ nullable: false, default: null })
  startDate: Date;

  @Column({ nullable: false, default: null })
  endDate: Date;

  @Column({ nullable: false, default: null })
  signingDate: Date;

  @Column({ nullable: true, default: null })
  creditorEmpId: number;

  @Column({ nullable: false, default: null })
  wangEmpId: number;

  @Column({ nullable: false, default: null })
  attestor: number;

  @Column({ nullable: false, default: null })
  creditor_code: string;

  @Column({ nullable: false, default: null })
  attestor2: number;

  @Column({ nullable: true, default: null })
  urlContract: number;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByWang, {
    nullable: false,
  })
  @JoinColumn({ name: 'wangEmpId', referencedColumnName: 'personId' })
  personByWangEmp?: ContractLogPerson;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByAttestor, {
    nullable: false,
  })
  @JoinColumn({ name: 'attestor', referencedColumnName: 'personId' })
  personByAttestor?: ContractLogPerson;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByAttestor, {
    nullable: false,
  })
  @JoinColumn({ name: 'attestor2', referencedColumnName: 'personId' })
  personByAttestor2?: ContractLogPerson;

  @ManyToOne(() => ContractLogPerson, (p) => p.bannerByCreditor, {
    nullable: false,
  })
  @JoinColumn({ name: 'creditorEmpId', referencedColumnName: 'personId' })
  personByCreditor?: ContractLogPerson;

  @OneToOne(() => ContractLogUpload, { nullable: true })
  @JoinColumn({ name: 'urlContract', referencedColumnName: 'uploadId' })
  upload: ContractLogUpload;

  @ManyToOne(() => CreditorEntity, (c) => c.contract_log, { nullable: false })
  @JoinColumn({ name: 'creditor_code', referencedColumnName: 'creditor_code' })
  creditor: CreditorEntity;

  @Column({ nullable: false, default: null })
  reportDueDate: Date;

  @Column({ nullable: true, default: null })
  finalPaymentAmount: number;

  @Column({ nullable: false, default: null })
  totalSupportValue: number;

  @Column({ nullable: false, default: null })
  supportDeliveryDate: Date;

  @Column({ nullable: false, default: null })
  numberOfInstallments: number;

  @Column({ nullable: false, default: null })
  installmentIntervalDays: number;

  @Column({ nullable: false, default: null })
  firstInstallmentAmount: number;

  @Column({ nullable: false, default: null })
  firstPaymentCondition: string;

  @Column({ nullable: false, default: null })
  finalInstallmentAmount: number;

  @Column({ nullable: false, default: null })
  productsToOrder: string;
}
