import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserEntity } from 'src/users/users.entity';

@Entity({ name: 'employee' })
export class EmployeeEntity {
  @PrimaryGeneratedColumn()
  emp_id: number;

  @Column({ unique: true, length: 20 })
  emp_code: string;

  @Column({ length: 255, nullable: true })
  emp_nickname: string;

  @Column({ length: 255, nullable: true })
  emp_firstname: string;

  @Column({ length: 255, nullable: true })
  emp_lastname: string;

  @Column({ length: 255, nullable: true })
  emp_moblie: string;

  @Column({ length: 255, nullable: true })
  emp_img_path: string;

  @OneToMany(() => UserEntity, (member) => member.employee)
  members: UserEntity[];
}
