import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeEntity } from './employees.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeEntity)
    private readonly employeeRepo: Repository<EmployeeEntity>,
  ) {}

  // สร้าง Employee ใหม่
  async UpsertEmployee(
    emp_code?: string,
    data?: Partial<EmployeeEntity>,
  ): Promise<{ message: string; data: EmployeeEntity }> {
    try {
      if (data && emp_code) {
        const existingEmployee = await this.employeeRepo.findOne({
          where: { emp_code: data?.emp_code },
        });

        if (!existingEmployee) {
          const newEmployee = this.employeeRepo.create(data);
          const savedEmployee = await this.employeeRepo.save(newEmployee);
          return {
            message: 'Employee created successfully',
            data: savedEmployee,
          };
        }

        if (existingEmployee && emp_code) {
          if (data.emp_code && data.emp_code !== emp_code) {
            const existing = await this.employeeRepo.findOne({
              where: { emp_code: data.emp_code },
              select: ['emp_code'],
            });
            if (existing) {
              throw new Error(
                `Employee with code ${data.emp_code} already exists`,
              );
            }
          }

          await this.employeeRepo.update({ emp_code }, data);

          const idToFetch = data.emp_code || emp_code;
          const updated = await this.employeeRepo.findOne({
            where: { emp_code: idToFetch },
          });

          if (!updated)
            throw new Error('Updated employee not found (unexpected)');

          console.log('Employee updated successfully:', updated);
          return { message: 'Employee updated successfully', data: updated };
        }
      }
      throw new Error('emp_code and data are required to create an employee');
    } catch (error) {
      console.error('Error creating employee:', error);
      throw new Error(error.message || 'Error creating employee');
    }
  }

  // ดึงข้อมูล Employee ทั้งหมด
  async getAllEmployees(): Promise<EmployeeEntity[]> {
    try {
      const employees = await this.employeeRepo.find();
      console.log(`Found ${employees.length} employees`);
      return employees;
    } catch (error) {
      console.error('Error getting all employees:', error);
      throw new Error('Error retrieving employees');
    }
  }

  async updateEmployee(
    emp_code: string,
    data: Partial<EmployeeEntity>,
  ): Promise<EmployeeEntity> {
    try {
      console.log('=== UPDATE EMPLOYEE DEBUG ===');
      console.log('emp_code:', emp_code);
      console.log('data keys:', Object.keys(data || {}));

      if (!emp_code) throw new Error('Employee code is required');

      const employee = await this.employeeRepo.findOne({
        where: { emp_code },
        select: [
          'emp_code',
          'emp_nickname',
          'emp_firstname',
          'emp_lastname',
          'emp_mobile',
          'emp_email',
          'emp_ID_line',
        ],
      });
      if (!employee)
        throw new Error(`Employee with code ${emp_code} not found`);

      // ✅ ถ้าจะอนุญาตแก้ emp_code ต้องเช็คซ้ำว่ารหัสใหม่ซ้ำหรือไม่
      if (data.emp_code && data.emp_code !== emp_code) {
        const existing = await this.employeeRepo.findOne({
          where: { emp_code: data.emp_code },
          select: ['emp_code'],
        });
        if (existing) {
          throw new Error(`Employee with code ${data.emp_code} already exists`);
        }
      }

      // ✅ ป้องกันการส่งฟิลด์แปลกๆ เข้ามา (whitelist)
      const allowedKeys: (keyof EmployeeEntity)[] = [
        'emp_code',
        'emp_nickname',
        'emp_firstname',
        'emp_lastname',
        'emp_mobile',
        'emp_email',
        'emp_ID_line',
      ];
      const safeData = Object.fromEntries(
        Object.entries(data).filter(([k]) =>
          allowedKeys.includes(k as keyof EmployeeEntity),
        ),
      ) as Partial<EmployeeEntity>;

      // ✅ TypeORM รองรับ Partial (QueryDeepPartialEntity)
      await this.employeeRepo.update({ emp_code }, safeData);

      const idToFetch = safeData.emp_code || emp_code;
      const updated = await this.employeeRepo.findOne({
        where: { emp_code: idToFetch },
      });
      if (!updated) throw new Error('Updated employee not found (unexpected)');

      console.log('Employee updated successfully:', updated);
      return updated;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error updating employee';
      console.error('Error updating employee:', msg);
      throw new Error(msg);
    }
  }

  // ลบ Employee
  async deleteEmployee(emp_code: string): Promise<{ message: string }> {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { emp_code },
      });

      if (!employee) {
        throw new Error(`Employee with code ${emp_code} not found`);
      }

      await this.employeeRepo.delete({ emp_code });
      console.log('Employee deleted successfully:', emp_code);

      return { message: `Employee ${emp_code} deleted successfully` };
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw new Error(error.message || 'Error deleting employee');
    }
  }

  async findOneByEmpCode(emp_code: string): Promise<EmployeeEntity | null> {
    const employee = await this.employeeRepo.findOne({
      where: { emp_code: emp_code },
    });
    return employee || null;
  }
}
