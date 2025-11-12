import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PolicyDoc } from './policy-doc.entity';
import { PolicyDocMember } from './policy-doc-member.entity';

@Entity()
export class PolicyDocCatagory {
  @PrimaryGeneratedColumn()
  policyCatagoryId: number;

  @Column()
  nameCatagory: string;

  @Column({ nullable: true })
  latestPolicyId: number;

  @ManyToOne(() => PolicyDoc)
  @JoinColumn({ name: 'latestPolicyId' })
  policyC: PolicyDoc;

  @OneToMany(() => PolicyDocMember, (member) => member.category)
  policyMembers: PolicyDocMember[];

  @OneToMany(() => PolicyDoc, (policyDoc) => policyDoc.categoryInfo)
  policyDocs: PolicyDoc[];
}
