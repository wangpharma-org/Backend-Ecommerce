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
  Query,
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
  price_option?: string;
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

  /** ค้นร้านสำหรับ picker กลุ่มเป้าหมาย — ต้องมาก่อน :collectionId ไม่งั้นถูก route ทับ */
  @Get('shop/search')
  searchShops(@Query('q') keyword: string) {
    return this.specialCollectionService.searchShops(keyword);
  }

  @Post('shop/resolve')
  resolveShops(@Body() dto: SetAudienceDto) {
    return this.specialCollectionService.resolveShops(dto.mem_codes);
  }

  @Get(':collectionId')
  getOne(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Req() req: { user: JwtUser },
  ) {
    const raw = (req.user.price_option ?? '').toUpperCase();
    const option = raw === 'A' || raw === 'B' || raw === 'C' ? raw : 'C';
    return this.specialCollectionService.getCollection(collectionId, option);
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
