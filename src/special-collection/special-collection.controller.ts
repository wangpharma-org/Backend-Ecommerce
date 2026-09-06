import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SpecialCollectionService } from './special-collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddItemDto } from './dto/add-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { SetAudienceDto } from './dto/set-audience.dto';

interface JwtUser {
  username: string;
  mem_code: string;
  permission?: boolean;
}

/** หลังบ้าน — จัดคอลเลกชัน "ชุดสินค้าพิเศษ" */
@Controller('admin/special-collection')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class SpecialCollectionController {
  private readonly logger = new Logger(SpecialCollectionController.name);

  constructor(
    private readonly specialCollectionService: SpecialCollectionService,
  ) {}

  @Get()
  list() {
    return this.specialCollectionService.listCollections();
  }

  @Get(':collectionId')
  getOne(@Param('collectionId', ParseIntPipe) collectionId: number) {
    return this.specialCollectionService.getCollection(collectionId);
  }

  @Post()
  create(@Body() dto: CreateCollectionDto, @Req() req: { user: JwtUser }) {
    this.logger.log(`${req.user.username} creating special collection`);
    return this.specialCollectionService.createCollection(dto);
  }

  @Patch(':collectionId')
  update(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.specialCollectionService.updateCollection(collectionId, dto);
  }

  @Delete(':collectionId')
  remove(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Req() req: { user: JwtUser },
  ) {
    this.logger.log(
      `${req.user.username} deleting special collection ${collectionId}`,
    );
    return this.specialCollectionService.deleteCollection(collectionId);
  }

  @Post(':collectionId/item')
  addItem(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Body() dto: AddItemDto,
  ) {
    return this.specialCollectionService.addItem(collectionId, dto);
  }

  @Delete(':collectionId/item/:itemId')
  removeItem(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.specialCollectionService.removeItem(collectionId, itemId);
  }

  @Put(':collectionId/item/order')
  reorder(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.specialCollectionService.reorderItems(collectionId, dto);
  }

  @Put(':collectionId/audience')
  setAudience(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Body() dto: SetAudienceDto,
  ) {
    return this.specialCollectionService.setAudience(collectionId, dto);
  }
}
