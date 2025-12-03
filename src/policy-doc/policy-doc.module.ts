import { Module } from '@nestjs/common';
import { PolicyDocService } from './policy-doc.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyDoc } from './policy-doc.entity';
import { PolicyDocMember } from './policy-doc-member.entity';
import { PolicyDocCatagory } from './policy-doc-catagory.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PolicyDoc, PolicyDocMember, PolicyDocCatagory]),
    UsersModule,
  ],
  providers: [PolicyDocService],
  exports: [PolicyDocService],
})
export class PolicyDocModule {}
