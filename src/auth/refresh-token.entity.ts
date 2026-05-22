import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'reflesh-token' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 512 })
  refresh_token: string;

  @Column()
  mem_code: string;
}
