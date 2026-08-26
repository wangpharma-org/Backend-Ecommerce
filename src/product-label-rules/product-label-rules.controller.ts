import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductLabelRuleDto } from './dto/create-product-label-rule.dto';
import { UpdateProductLabelRuleDto } from './dto/update-product-label-rule.dto';
import { ProductLabelRulesService } from './product-label-rules.service';

interface JwtPayload {
  permission?: boolean;
}

@Controller('ecom/admin/product-label-rules')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ProductLabelRulesController {
  constructor(private readonly productLabelRulesService: ProductLabelRulesService) {}

  @Get()
  async findAll(@Req() req: { user?: JwtPayload }) {
    this.ensureAdmin(req.user);
    return this.productLabelRulesService.findAll();
  }

  @Post()
  async create(
    @Body() data: CreateProductLabelRuleDto,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    return this.productLabelRulesService.create(data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductLabelRuleDto,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    return this.productLabelRulesService.update(id, data);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: JwtPayload },
  ) {
    this.ensureAdmin(req.user);
    await this.productLabelRulesService.remove(id);
    return { message: 'ลบ Label เรียบร้อยแล้ว' };
  }

  private ensureAdmin(user?: JwtPayload) {
    if (user?.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
