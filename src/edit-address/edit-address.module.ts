import { Module } from '@nestjs/common';
import { EditAddressService } from './edit-address.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EditAddress } from './edit-address.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([EditAddress]), UsersModule],
  providers: [EditAddressService],
  exports: [EditAddressService],
})
export class EditAddressModule {}
