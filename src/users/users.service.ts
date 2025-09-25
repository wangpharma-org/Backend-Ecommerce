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
      console.log('User found:', user);
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
      console.log('User found by mem_code:', user);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch {
      throw new Error('Error retrieving user by mem_code');
    }
  }
}
