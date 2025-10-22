import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeEntity } from './employees.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeEntity])],
  exports: [EmployeesService],
  providers: [EmployeesService],
})
export class EmployeesModule {}
