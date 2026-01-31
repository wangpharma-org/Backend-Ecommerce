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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PartnerService } from './partner.service';
import { PartnerEntity } from './partner.entity';

@Controller('ecom')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  // Public: Get all active partners
  @Get('landing/partners')
  async getActivePartners(): Promise<PartnerEntity[]> {
    return this.partnerService.getActivePartners();
  }

  // Public: Get partners by category
  @Get('landing/partners/category/:category')
  async getPartnersByCategory(
    @Param('category') category: string,
  ): Promise<PartnerEntity[]> {
    return this.partnerService.getPartnersByCategory(category);
  }

  // Admin: Get all partners
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/partners')
  async getAllPartners(): Promise<PartnerEntity[]> {
    return this.partnerService.getAllPartners();
  }

  // Admin: Get partner by ID
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/partners/:id')
  async getPartnerById(@Param('id') id: string): Promise<PartnerEntity | null> {
    return this.partnerService.getPartnerById(+id);
  }

  // Admin: Create partner
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/partners')
  async createPartner(
    @Body() data: Partial<PartnerEntity>,
  ): Promise<PartnerEntity> {
    return this.partnerService.createPartner(data);
  }

  // Admin: Update partner
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/partners/:id')
  async updatePartner(
    @Param('id') id: string,
    @Body() data: Partial<PartnerEntity>,
  ): Promise<PartnerEntity | null> {
    return this.partnerService.updatePartner(+id, data);
  }

  // Admin: Delete partner
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/partners/:id')
  async deletePartner(@Param('id') id: string): Promise<void> {
    return this.partnerService.deletePartner(+id);
  }

  // Admin: Toggle partner status
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/partners/:id/toggle')
  async togglePartnerStatus(@Param('id') id: string): Promise<PartnerEntity | null> {
    return this.partnerService.togglePartnerStatus(+id);
  }

  // Admin: Reorder partners
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/partners/reorder')
  async reorderPartners(@Body() body: { ids: number[] }): Promise<void> {
    return this.partnerService.reorderPartners(body.ids);
  }
}
