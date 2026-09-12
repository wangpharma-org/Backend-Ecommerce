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
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { BundleSetService, type PriceOption } from './bundle-set.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { AddSetItemDto } from './dto/add-set-item.dto';

interface JwtUser {
  username: string;
  mem_code: string;
  price_option: string;
}

/** price_option ในโทเคนอาจเป็นตัวเล็กหรือค่าแปลก — normalize ก่อนใช้ */
const toPriceOption = (raw: string | undefined): PriceOption => {
  const upper = (raw ?? '').toUpperCase();
  return upper === 'A' || upper === 'B' || upper === 'C' ? upper : 'C';
};

@Controller('admin/bundle-set')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class BundleSetController {
  private readonly logger = new Logger(BundleSetController.name);

  constructor(private readonly bundleSetService: BundleSetService) {}

  @Get()
  list() {
    return this.bundleSetService.listSets();
  }

  @Get(':setCode')
  getOne(@Param('setCode') setCode: string, @Req() req: { user: JwtUser }) {
    return this.bundleSetService.getSetView(
      setCode,
      toPriceOption(req.user.price_option),
    );
  }

  @Post()
  create(@Body() dto: CreateSetDto, @Req() req: { user: JwtUser }) {
    this.logger.log(`${req.user.username} creating bundle set ${dto.set_code}`);
    return this.bundleSetService.createSet(dto);
  }

  @Patch(':setCode')
  update(@Param('setCode') setCode: string, @Body() dto: UpdateSetDto) {
    return this.bundleSetService.updateSet(setCode, dto);
  }

  @Delete(':setCode')
  remove(@Param('setCode') setCode: string) {
    return this.bundleSetService.deleteSet(setCode);
  }

  @Post(':setCode/item')
  addItem(@Param('setCode') setCode: string, @Body() dto: AddSetItemDto) {
    return this.bundleSetService.addItem(setCode, dto);
  }

  @Delete(':setCode/item/:itemId')
  removeItem(
    @Param('setCode') setCode: string,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.bundleSetService.removeItem(setCode, itemId);
  }
}

/** หน้าบ้าน — ราคาคิดตาม price_option ของร้านที่ล็อกอิน */
@Controller('ecom/bundle-set')
@UseGuards(JwtAuthGuard)
export class BundleSetCustomerController {
  constructor(private readonly bundleSetService: BundleSetService) {}

  @Get()
  listActive(@Req() req: { user: JwtUser }) {
    return this.bundleSetService.listActiveSets(
      toPriceOption(req.user.price_option),
    );
  }

  @Get(':setCode')
  getOne(@Param('setCode') setCode: string, @Req() req: { user: JwtUser }) {
    return this.bundleSetService.getSetView(
      setCode,
      toPriceOption(req.user.price_option),
    );
  }
}
