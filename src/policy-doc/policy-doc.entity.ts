import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PolicyDocMember } from './policy-doc-member.entity';
import { PolicyDocCatagory } from './policy-doc-catagory.entity';

@Entity()
export class PolicyDoc {
  @PrimaryGeneratedColumn()
  policyId: number;

  @Column({ type: 'longtext' })
  content: string;

  @Column()
  category: number;

  @Column()
  version: string;

  @OneToMany(() => PolicyDocMember, (member) => member.policyDoc)
  membersPolicy: PolicyDocMember[];

  @OneToMany(() => PolicyDocMember, (member) => member.policyDoc)
  membersProvision: PolicyDocMember[];

  @ManyToOne(() => PolicyDocCatagory, (category) => category.policyDocs)
  @JoinColumn({ name: 'category', referencedColumnName: 'policyCatagoryId' })
  categoryInfo: PolicyDocCatagory;
}
