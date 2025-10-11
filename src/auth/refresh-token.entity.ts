import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reflesh-token' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 512 })
  refresh_token: string;

  @Column()
  mem_code: string;
}
