import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PartnerService } from './partner.service';
import { PartnerEntity } from './partner.entity';

@ApiTags('Landing - Partners')
@Controller('ecom')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  // Public: Get all active partners
  @ApiOperation({ summary: 'ดึงรายการพาร์ทเนอร์ที่เปิดใช้งานทั้งหมด (Public)' })
  @ApiResponse({ status: 200, description: 'รายการพาร์ทเนอร์', type: [PartnerEntity] })
  @Get('landing/partners')
  async getActivePartners(): Promise<PartnerEntity[]> {
    return this.partnerService.getActivePartners();
  }

  // Public: Get partners by category
  @ApiOperation({ summary: 'ดึงรายการพาร์ทเนอร์ตามหมวดหมู่ (Public)' })
  @ApiParam({ name: 'category', description: 'ชื่อหมวดหมู่ของพาร์ทเนอร์', example: 'ผู้จัดจำหน่าย' })
  @ApiResponse({ status: 200, description: 'รายการพาร์ทเนอร์ตามหมวดหมู่', type: [PartnerEntity] })
  @Get('landing/partners/category/:category')
  async getPartnersByCategory(
    @Param('category') category: string,
  ): Promise<PartnerEntity[]> {
    return this.partnerService.getPartnersByCategory(category);
  }

  // Admin: Get all partners
  @ApiOperation({ summary: 'ดึงรายการพาร์ทเนอร์ทั้งหมด รวมที่ปิดใช้งาน (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'รายการพาร์ทเนอร์ทั้งหมด', type: [PartnerEntity] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/partners')
  async getAllPartners(): Promise<PartnerEntity[]> {
    return this.partnerService.getAllPartners();
  }

  // Admin: Get partner by ID
  @ApiOperation({ summary: 'ดึงข้อมูลพาร์ทเนอร์ตามรหัส (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของพาร์ทเนอร์', example: '1' })
  @ApiResponse({ status: 200, description: 'ข้อมูลพาร์ทเนอร์', type: PartnerEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/partners/:id')
  async getPartnerById(@Param('id') id: string): Promise<PartnerEntity | null> {
    return this.partnerService.getPartnerById(+id);
  }

  // Admin: Create partner
  @ApiOperation({ summary: 'สร้างพาร์ทเนอร์ใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'ชื่อพาร์ทเนอร์', example: 'บริษัท ตัวอย่าง จำกัด' },
        logo_url: { type: 'string', description: 'URL โลโก้พาร์ทเนอร์' },
        website: { type: 'string', description: 'URL เว็บไซต์พาร์ทเนอร์' },
        description: { type: 'string', description: 'คำอธิบายพาร์ทเนอร์' },
        category: { type: 'string', description: 'หมวดหมู่พาร์ทเนอร์' },
        creditor_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'รายการรหัสเจ้าหนี้ที่เกี่ยวข้อง',
        },
        display_order: { type: 'number', description: 'ลำดับการแสดงผล' },
        is_active: { type: 'boolean', description: 'สถานะเปิดใช้งาน' },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้างพาร์ทเนอร์สำเร็จ', type: PartnerEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/partners')
  async createPartner(
    @Body() data: Partial<PartnerEntity>,
  ): Promise<PartnerEntity> {
    return this.partnerService.createPartner(data);
  }

  // Admin: Update partner
  @ApiOperation({ summary: 'แก้ไขข้อมูลพาร์ทเนอร์ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของพาร์ทเนอร์', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'ชื่อพาร์ทเนอร์' },
        logo_url: { type: 'string', description: 'URL โลโก้พาร์ทเนอร์' },
        website: { type: 'string', description: 'URL เว็บไซต์พาร์ทเนอร์' },
        description: { type: 'string', description: 'คำอธิบายพาร์ทเนอร์' },
        category: { type: 'string', description: 'หมวดหมู่พาร์ทเนอร์' },
        creditor_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'รายการรหัสเจ้าหนี้ที่เกี่ยวข้อง',
        },
        display_order: { type: 'number', description: 'ลำดับการแสดงผล' },
        is_active: { type: 'boolean', description: 'สถานะเปิดใช้งาน' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'แก้ไขพาร์ทเนอร์สำเร็จ', type: PartnerEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/partners/:id')
  async updatePartner(
    @Param('id') id: string,
    @Body() data: Partial<PartnerEntity>,
  ): Promise<PartnerEntity | null> {
    return this.partnerService.updatePartner(+id, data);
  }

  // Admin: Delete partner
  @ApiOperation({ summary: 'ลบพาร์ทเนอร์ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของพาร์ทเนอร์', example: '1' })
  @ApiResponse({ status: 200, description: 'ลบพาร์ทเนอร์สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/partners/:id')
  async deletePartner(@Param('id') id: string): Promise<void> {
    return this.partnerService.deletePartner(+id);
  }

  // Admin: Toggle partner status
  @ApiOperation({ summary: 'สลับสถานะเปิด/ปิดใช้งานพาร์ทเนอร์ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของพาร์ทเนอร์', example: '1' })
  @ApiResponse({ status: 200, description: 'สลับสถานะสำเร็จ', type: PartnerEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/partners/:id/toggle')
  async togglePartnerStatus(@Param('id') id: string): Promise<PartnerEntity | null> {
    return this.partnerService.togglePartnerStatus(+id);
  }

  // Admin: Reorder partners
  @ApiOperation({ summary: 'จัดลำดับการแสดงผลพาร์ทเนอร์ใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'รายการรหัสพาร์ทเนอร์เรียงตามลำดับใหม่',
          example: [3, 1, 2],
        },
      },
      required: ['ids'],
    },
  })
  @ApiResponse({ status: 200, description: 'จัดลำดับสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/partners/reorder')
  async reorderPartners(@Body() body: { ids: number[] }): Promise<void> {
    return this.partnerService.reorderPartners(body.ids);
  }
}
