import { forwardRef, Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ShoppingCartModule } from 'src/shopping-cart/shopping-cart.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ProductListner } from './product.listener';
import { CreditorEntity } from './creditor.entity';
import { LogFileEntity } from 'src/backend/logFile.entity';
import { BackendModule } from 'src/backend/backend.module';
import { ImagedebugModule } from 'src/imagedebug/imagedebug.module';
import { UserEntity } from 'src/users/users.entity';
import { ElasticsearchModule } from 'src/elasticsearch/elasticsearch.module';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { DeleteCartEntity } from 'src/shopping-cart/delete-cart.enity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductPharmaEntity,
      CreditorEntity,
      LogFileEntity,
      UserEntity,
      ShoppingCartEntity,
      DeleteCartEntity,
    ]),
    BackendModule,
    ImagedebugModule,
    ElasticsearchModule,
    forwardRef(() => ShoppingCartModule),
  ],
  providers: [ProductsService],
  controllers: [ProductListner],
  exports: [ProductsService],
})
export class ProductsModule {}
