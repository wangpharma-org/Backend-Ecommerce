import { Injectable } from '@nestjs/common';
import { UserEntity } from './users.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findOne(username: string): Promise<UserEntity> {
    try {
      const user = await this.userRepo.findOne({
        where: {
          mem_username: username,
        },
      });
      console.log('User found:', user?.mem_code);
      if (!user) {
        throw new Error('User not found');
      } else {
        return user;
      }
    } catch {
      throw new Error('Error retrieving user');
    }
  }

  async create(user: UserEntity): Promise<UserEntity> {
    try {
      const newUser = this.userRepo.create(user);
      return await this.userRepo.save(newUser);
    } catch {
      throw new Error('Error creating user');
    }
  }

  async update(
    username: string,
    user: Partial<UserEntity>,
  ): Promise<UserEntity> {
    try {
      await this.userRepo.update({ mem_username: username }, user);
      return this.findOne(username);
    } catch {
      throw new Error('Error updating user');
    }
  }

  async findOneByMemCode(mem_code: string): Promise<UserEntity> {
    try {
      const user = await this.userRepo.findOne({
        where: { mem_code: mem_code },
      });
      console.log('User found by mem_code:', user?.mem_code);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch {
      throw new Error('Error retrieving user by mem_code');
    }
  }

  async checkEmail(username: string): Promise<string | null> {
    try {
      const user = await this.userRepo.findOne({
        where: { mem_username: username },
        select: ['mem_email'], // เลือกเฉพาะฟิลด์ mem_email
      });
      console.log(
        'Email found for user',
        username,
        ':',
        user ? user.mem_email : null,
      );
      return user ? user.mem_email : null;
    } catch {
      throw new Error('Error retrieving email');
    }
  }

  async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const isMatch = plainPassword === hashedPassword;
      console.log('Comparing passwords:', plainPassword, hashedPassword);
      console.log('Password comparison result:', isMatch);
      return isMatch;
    } catch {
      throw new Error('Error comparing passwords');
    }
  }

  async checklatestPurchase(mem_code: string): Promise<
    | {
        message: string;
        employee?: { emp_mobile: string; emp_ID_line: string };
      }
    | string
  > {
    try {
      const user = await this.userRepo.findOne({
        where: { mem_code: mem_code },
        relations: {
          employee: true,
        },
        select: {
          mem_code: true,
          latest_purchase: true,
          employee: {
            emp_mobile: true,
            emp_ID_line: true,
          },
          user_VIP: true,
        },
      });
      console.log('User found for latest purchase check:', user);
      if (user?.user_VIP === true) {
        return 'User is VIP, no purchase check needed';
      }
      console.log('User latest_purchase:', user);

      if (!user || !user.latest_purchase) {
        return 'No purchase history';
      }

      const now = new Date();

      // แปลง latest_purchase จาก "10/10/2025" (DD/MM/YYYY) เป็น Date object
      const [day, month, year] = user.latest_purchase.split('/').map(Number);
      const latestPurchaseDate = new Date(year, month - 1, day);

      console.log(
        'Latest purchase date for user',
        mem_code,
        ':',
        user.latest_purchase,
      );
      console.log('Current date:', now);
      console.log('Parsed purchase date:', latestPurchaseDate);

      // คำนวณผลต่างเป็นวัน (now - latestPurchaseDate)
      const diffInMs = now.getTime() - latestPurchaseDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      console.log('Difference in days:', diffInDays);

      if (diffInDays < 30) {
        return `Most recently used within 30 days`;
      } else if (diffInDays >= 30 && diffInDays < 45) {
        console.log(
          'Latest purchase within 30 days:',
          user.latest_purchase,
          diffInDays,
        );
        return `Latest purchase within 30 days`;
      } else if (diffInDays >= 45) {
        console.log('More than 45 days ago', user.latest_purchase, diffInDays);
        return {
          message: 'More than 45 days ago',
          employee: user.employee ?? undefined,
        };
      }
      throw new Error('No recent purchase within 30 days');
    } catch (error) {
      console.error('Error in checklatestPurchase:', error);
      throw new Error('Error retrieving latest purchase date');
    }
  }

  async updateAndDeleteUserVIP(
    mem_code: string,
    message: string,
  ): Promise<{
    mem_code: string;
    message: string;
    emp_id_ref?: string | null;
    mem_nameSite?: string;
  }> {
    try {
      const user = await this.userRepo.findOne({
        where: { mem_code: mem_code },
      });

      console.log('User found for VIP update/delete:', user);

      if (!user || user.mem_code !== mem_code) {
        return { mem_code, message: 'User not found' };
      }

      if (message === 'update') {
        if (user.user_VIP === true) {
          return {
            mem_code,
            message: 'already VIP',
          };
        } else if (user.user_VIP === false) {
          await this.userRepo.update(
            { mem_code: mem_code },
            { user_VIP: true },
          );
          console.log(
            `Successfully updated VIP status to true for ${mem_code}`,
          );
          return {
            mem_code,
            mem_nameSite: user.mem_nameSite,
            emp_id_ref: user.emp_id_ref,
            message: 'updated',
          };
        }
      } else if (message === 'delete') {
        await this.userRepo.update({ mem_code: mem_code }, { user_VIP: false });
        console.log(`Successfully updated VIP status to false for ${mem_code}`);
        return {
          mem_code,
          message: 'deleted',
        };
      } else {
        throw new Error(
          `Invalid message: ${message}. Use 'update' or 'delete'`,
        );
      }
      throw new Error('Unexpected code path');
    } catch (error) {
      console.error('Error updating user VIP status:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error updating user VIP status');
    }
  }

  async getAllUsersVIP(): Promise<
    { mem_code: string; mem_nameSite: string; emp_id_ref: string | null }[]
  > {
    try {
      const vipUsers = await this.userRepo.find({
        where: { user_VIP: true },
        select: ['mem_code', 'mem_nameSite', 'emp_id_ref'],
      });
      console.log(`Found ${vipUsers.length} VIP users`);
      return vipUsers;
    } catch (error) {
      console.error('Error getting all VIP users:', error);
      throw new Error('Error retrieving VIP users');
    }
  }
}
