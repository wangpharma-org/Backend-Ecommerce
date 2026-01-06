import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ProductListner } from './product.listener';
import { CreditorEntity } from './creditor.entity';
import { LogFileEntity } from 'src/backend/logFile.entity';
import { BackendModule } from 'src/backend/backend.module';
import { ImagedebugModule } from 'src/imagedebug/imagedebug.module';
import { UserEntity } from 'src/users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductPharmaEntity,
      CreditorEntity,
      LogFileEntity,
      UserEntity,
    ]),
    BackendModule,
    ImagedebugModule,
  ],
  providers: [ProductsService],
  controllers: [ProductListner],
  exports: [ProductsService],
})
export class ProductsModule {}
