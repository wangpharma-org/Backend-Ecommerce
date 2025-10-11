import { UsersService } from '../users/users.service';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserEntity } from './users.entity';
import * as bcrypt from 'bcrypt';

@Controller()
export class UsersListner {
  constructor(private readonly usersService: UsersService) {}
  @MessagePattern('member_created_ecom')
  async addUser(@Payload() message: UserEntity) {
    try {
      const saltOrRounds = 8;
      console.log('Received message in users listener:', message);
      message.mem_password = await bcrypt.hash(message.mem_password, saltOrRounds);
      await this.usersService.create(message);
    } catch (error) {
      console.log('Kafka Received message in users listener', error);
    }
  }
}
