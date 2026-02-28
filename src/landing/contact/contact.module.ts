import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactEntity } from './contact.entity';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity]), FeatureFlagsModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
