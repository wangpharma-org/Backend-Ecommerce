import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberEntity } from './members.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MemberEntity])],
  providers: [MembersService],
})
export class MembersModule {}
