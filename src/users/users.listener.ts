import { UsersService } from '../users/users.service';
import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserEntity } from './users.entity';
import * as bcrypt from 'bcrypt';
import { SALT_ROUNDS } from 'src/constants/app.constants';

@Controller()
export class UsersListner {
  private readonly logger = new Logger(UsersListner.name);

  constructor(private readonly usersService: UsersService) {}
  @MessagePattern('member_created_ecom')
  async addUser(@Payload() message: UserEntity) {
    try {
      message.mem_password = await bcrypt.hash(message.mem_password, SALT_ROUNDS);
      await this.usersService.create(message);
    } catch (error) {
      this.logger.error('Kafka Received message in users listener', error);
    }
  }
}
