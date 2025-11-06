import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class ContractLogUpload {
  @PrimaryGeneratedColumn()
  uploadId: number;

  @Column()
  urlPath: string;
}
