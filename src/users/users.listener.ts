import { UsersService } from 'src/users/users.service';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserEntity } from './users.entity';

@Controller()
export class UsersListner {
  constructor(private readonly usersService: UsersService) {}
  @MessagePattern('member_created_ecom')
  async addUser(@Payload() message: UserEntity) {
    try {
      console.log('Received message in users listener:', message);
      await this.usersService.create(message);
    } catch (error) {
      console.log('Kafka Received message in users listener', error);
    }
  }
}
