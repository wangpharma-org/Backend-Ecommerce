import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DrugTypeService, ProductDrugTypeView } from './drug-type.service';

const MAX_CODES_PER_REQUEST = 200;

/** WGDD-427 สินค้าแถม/ขายพ่วงตามประเภทยา (แสดงอย่างเดียว ยังไม่คิดในตะกร้า) */
@Controller('ecom/drug-type')
@UseGuards(JwtAuthGuard)
export class DrugTypeController {
  constructor(private readonly drugTypeService: DrugTypeService) {}

  /** หน้ารายละเอียดสินค้า — null = ไม่มีแถม/พ่วง */
  @Get('product/:proCode')
  async byProduct(
    @Param('proCode') proCode: string,
  ): Promise<{ drug_type: ProductDrugTypeView | null }> {
    await this.drugTypeService.assertEnabled();
    const result = await this.drugTypeService.findByProductCodes([proCode]);
    return { drug_type: result[proCode] ?? null };
  }

  /** ตะกร้า — ส่ง pro_code หลายตัว ได้ map เฉพาะสินค้าที่มีแถม/พ่วง */
  @Post('products')
  async byProducts(
    @Body() body: { pro_codes?: unknown },
  ): Promise<Record<string, ProductDrugTypeView>> {
    await this.drugTypeService.assertEnabled();
    const codes = body?.pro_codes;
    if (
      !Array.isArray(codes) ||
      codes.length > MAX_CODES_PER_REQUEST ||
      codes.some((c) => typeof c !== 'string')
    ) {
      throw new BadRequestException(
        `pro_codes ต้องเป็น array ของรหัสสินค้า ไม่เกิน ${MAX_CODES_PER_REQUEST} รายการ`,
      );
    }
    return this.drugTypeService.findByProductCodes(codes as string[]);
  }
}
