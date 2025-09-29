import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from 'src/users/users.entity';

@Entity()
export class EditAddress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200, nullable: false })
  name: string;

  @Column({ length: 100, nullable: false })
  fullName: string;

  @Column({ length: 120, nullable: false })
  mem_address: string;

  @Column({ length: 120, nullable: false })
  mem_village: string;

  @Column({ length: 120, nullable: false })
  mem_alley: string;

  @Column({ length: 120, nullable: false })
  mem_road: string;

  @Column({ length: 120, nullable: false })
  mem_province: string;

  @Column({ length: 120, nullable: false })
  mem_amphur: string;

  @Column({ length: 120, nullable: false })
  mem_tumbon: string;

  @Column({ length: 50, nullable: false })
  mem_post: string;

  @Column({ length: 100, nullable: false })
  phoneNumber: string;

  @Column({ length: 100, nullable: true })
  Note: string;

  @Column({ default: false })
  defaults: boolean;

  @ManyToOne(() => UserEntity, (user) => user.editAddresses)
  @JoinColumn({ name: 'mem_code' })
  user: UserEntity;
}
