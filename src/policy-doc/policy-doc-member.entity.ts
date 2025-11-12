import { UserEntity } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PolicyDoc } from './policy-doc.entity';
import { PolicyDocCatagory } from './policy-doc-catagory.entity';

@Entity()
export class PolicyDocMember {
  @PrimaryGeneratedColumn()
  policyMemId: number;

  @Column({ nullable: true, default: null })
  policyID: number;

  @Column()
  policyCategoryId: number;

  @Column()
  user_mem_code: string;

  @CreateDateColumn()
  agreedAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.policyDocMembers)
  @JoinColumn({ name: 'user_mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;

  @ManyToOne(() => PolicyDoc, (policyDoc) => policyDoc.membersPolicy, {
    nullable: true,
  })
  @JoinColumn({ name: 'policyID', referencedColumnName: 'policyId' })
  policyDoc: PolicyDoc;

  @ManyToOne(() => PolicyDocCatagory, (category) => category.policyMembers, {
    nullable: true,
  })
  @JoinColumn({
    name: 'policyCategoryId',
    referencedColumnName: 'policyCatagoryId',
  })
  category: PolicyDocCatagory;
}
