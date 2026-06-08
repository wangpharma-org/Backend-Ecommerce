import { Injectable } from '@nestjs/common';
import { UserEntity } from './users.entity';
import { AdminActionLogEntity } from './admin-action-log.entity';
import { Like, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

export interface AdminActor {
  mem_code: string;
  username: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AdminActionLogEntity)
    private readonly actionLogRepo: Repository<AdminActionLogEntity>,
  ) {}

  // ECWC-309: persist an audit-trail entry for role/permission/feature changes
  // an admin makes to another user's account.
  private async logAdminAction(
    actor: AdminActor,
    target: { mem_code: string; mem_username: string },
    action_type: 'role_change' | 'feature_change',
    old_value: unknown,
    new_value: unknown,
  ): Promise<void> {
    try {
      await this.actionLogRepo.save(
        this.actionLogRepo.create({
          admin_mem_code: actor.mem_code,
          admin_username: actor.username,
          target_mem_code: target.mem_code,
          target_username: target.mem_username,
          action_type,
          old_value: JSON.stringify(old_value),
          new_value: JSON.stringify(new_value),
        }),
      );
    } catch (error) {
      console.error('Error saving admin action log:', error);
    }
  }

  // ECWC-309: list admin action logs (role/permission/feature changes) for the audit-trail page.
  async getAdminActionLogs(
    page: number,
    limit: number,
  ): Promise<{ data: AdminActionLogEntity[]; total: number; page: number; limit: number }> {
    try {
      const [data, total] = await this.actionLogRepo.findAndCount({
        order: { created_at: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });
      return { data, total, page, limit };
    } catch (error) {
      console.error('Error retrieving admin action logs:', error);
      throw new Error('Error retrieving admin action logs');
    }
  }

  async findOne(username: string): Promise<UserEntity> {
    console.log('Finding user with username:', username);
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
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return isMatch;
    } catch (error) {
      console.error('Error comparing passwords:', error);
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

      if (diffInDays >= 365) {
        console.log('More than 1 year ago', user.latest_purchase, diffInDays);
        return {
          message: 'More than 1 year ago',
          employee: user.employee ?? undefined,
        };
      }
      return 'Purchase within 1 year';
    } catch (error) {
      console.error('Error in checklatestPurchase:', error);
      throw new Error('Error retrieving latest purchase date');
    }
  }

  async updateAndDeleteUserVIP(
    mem_code: string,
    message: string,
    tagVIP?: string,
  ): Promise<{
    mem_code: string;
    message: string;
    emp_id_ref?: string | null;
    mem_nameSite?: string;
    tagVIP?: string | null;
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
            { user_VIP: true, tagVIP: tagVIP },
          );
          console.log(
            `Successfully updated VIP status to true for ${mem_code}`,
          );
          return {
            mem_code,
            mem_nameSite: user.mem_nameSite,
            emp_id_ref: user.emp_id_ref,
            tagVIP: tagVIP || null,
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
    {
      mem_code: string;
      mem_nameSite: string;
      emp_id_ref: string | null;
      tagVIP: string | null;
    }[]
  > {
    try {
      const vipUsers = await this.userRepo.find({
        where: { user_VIP: true },
        select: ['mem_code', 'mem_nameSite', 'emp_id_ref', 'tagVIP'],
      });
      console.log(`Found ${vipUsers.length} VIP users`);
      return vipUsers;
    } catch (error) {
      console.error('Error getting all VIP users:', error);
      throw new Error('Error retrieving VIP users');
    }
  }

  async changeUserRole(
    mem_code: string,
    newRole: 'User' | 'Admin' | 'Sales',
    permission?: boolean,
    actor?: AdminActor,
  ): Promise<UserEntity> {
    try {
      const user = await this.userRepo.findOne({
        where: { mem_code: mem_code },
      });

      console.log('User found for role change:', user);

      if (!user) {
        throw new Error('User not found');
      }

      const oldRole = user.role;
      const oldPermission = user.permision_admin;
      const newPermission = permission === undefined ? oldPermission : permission;

      await this.userRepo.update(
        { mem_code: mem_code },
        permission === undefined
          ? { role: newRole }
          : { role: newRole, permision_admin: permission },
      );
      console.log(`Successfully updated role to ${newRole} for ${mem_code}`);

      if (actor) {
        await this.logAdminAction(
          actor,
          { mem_code: user.mem_code, mem_username: user.mem_username },
          'role_change',
          { role: oldRole, permision_admin: oldPermission },
          { role: newRole, permision_admin: newPermission },
        );
      }

      return this.findOneByMemCode(mem_code);
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new Error('Error updating user role');
    }
  }

  // ECWC-309: list staff accounts (Admin/Sales) so the admin UI can manage
  // role + permission together instead of editing them via raw DB access.
  async getStaffUsers(): Promise<
    {
      mem_code: string;
      mem_username: string;
      mem_nameSite: string;
      role: 'User' | 'Admin' | 'Sales';
      permision_admin: boolean;
      admin_features: string[] | null;
    }[]
  > {
    try {
      return await this.userRepo.find({
        where: [{ role: 'Admin' }, { role: 'Sales' }],
        select: [
          'mem_code',
          'mem_username',
          'mem_nameSite',
          'role',
          'permision_admin',
          'admin_features',
        ],
        order: { role: 'ASC', mem_code: 'ASC' },
      });
    } catch (error) {
      console.error('Error retrieving staff users:', error);
      throw new Error('Error retrieving staff users');
    }
  }

  // ECWC-309: look up any user by mem_code (4-digit numeric only) so an admin
  // can grant Admin/Sales role to accounts outside the existing staff list.
  async findUserForRoleManageByMemCode(mem_code: string): Promise<{
    mem_code: string;
    mem_username: string;
    mem_nameSite: string;
    role: 'User' | 'Admin' | 'Sales';
    permision_admin: boolean;
    admin_features: string[] | null;
  } | null> {
    if (!/^\d{4}$/.test(mem_code)) {
      throw new Error('mem_code must be a 4-digit number');
    }
    try {
      return await this.userRepo.findOne({
        where: { mem_code },
        select: [
          'mem_code',
          'mem_username',
          'mem_nameSite',
          'role',
          'permision_admin',
          'admin_features',
        ],
      });
    } catch (error) {
      console.error('Error looking up user by mem_code:', error);
      throw new Error('Error looking up user by mem_code');
    }
  }

  // ECWC-309: typeahead search — prefix match on mem_code, restricted to
  // 4-digit numeric accounts (same constraint as the exact lookup above).
  async searchUsersForRoleManage(query: string): Promise<
    {
      mem_code: string;
      mem_username: string;
      mem_nameSite: string;
      role: 'User' | 'Admin' | 'Sales';
      permision_admin: boolean;
      admin_features: string[] | null;
    }[]
  > {
    const trimmed = query.trim();
    if (!/^\d{1,4}$/.test(trimmed)) {
      return [];
    }
    try {
      const users = await this.userRepo.find({
        where: { mem_code: Like(`${trimmed}%`) },
        select: [
          'mem_code',
          'mem_username',
          'mem_nameSite',
          'role',
          'permision_admin',
          'admin_features',
        ],
        order: { mem_code: 'ASC' },
        take: 20,
      });
      return users.filter((u) => /^\d{4}$/.test(u.mem_code));
    } catch (error) {
      console.error('Error searching users by mem_code:', error);
      throw new Error('Error searching users by mem_code');
    }
  }

  // ECWC-309: replace the per-user list of admin-menu feature keys they can access.
  async updateUserFeatures(
    mem_code: string,
    features: string[],
    actor?: AdminActor,
  ): Promise<{ mem_code: string; admin_features: string[] }> {
    try {
      const user = await this.userRepo.findOne({ where: { mem_code } });
      if (!user) {
        throw new Error('User not found');
      }

      const oldFeatures = user.admin_features ?? [];
      await this.userRepo.update({ mem_code }, { admin_features: features });
      console.log(`Successfully updated admin_features for ${mem_code}`);

      if (actor) {
        await this.logAdminAction(
          actor,
          { mem_code: user.mem_code, mem_username: user.mem_username },
          'feature_change',
          oldFeatures,
          features,
        );
      }

      return { mem_code, admin_features: features };
    } catch (error) {
      console.error('Error updating user features:', error);
      throw new Error('Error updating user features');
    }
  }
}
