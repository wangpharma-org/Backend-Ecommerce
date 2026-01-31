import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ContactService, CreateContactDto } from './contact.service';
import { ContactEntity, ContactStatus } from './contact.entity';

@Controller('ecom')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // Public: Submit contact form
  @Post('landing/contact')
  async submitContact(@Body() data: CreateContactDto): Promise<ContactEntity> {
    return this.contactService.submitContact(data);
  }

  // Admin: Get all contacts with optional status filter
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts')
  async getAllContacts(
    @Query('status') status?: ContactStatus,
  ): Promise<ContactEntity[]> {
    return this.contactService.getAllContacts(status);
  }

  // Admin: Get contact by ID
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts/:id')
  async getContactById(@Param('id') id: string): Promise<ContactEntity | null> {
    return this.contactService.getContactById(+id);
  }

  // Admin: Get contacts statistics
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts/stats')
  async getContactsStats(): Promise<Record<string, number>> {
    return this.contactService.getContactsStats();
  }

  // Admin: Get pending contacts count
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts/pending-count')
  async getPendingCount(): Promise<{ count: number }> {
    const count = await this.contactService.getPendingCount();
    return { count };
  }

  // Admin: Mark as read
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/read')
  async markAsRead(@Param('id') id: string): Promise<ContactEntity | null> {
    return this.contactService.markAsRead(+id);
  }

  // Admin: Mark as replied
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/replied')
  async markAsReplied(
    @Param('id') id: string,
    @Body() body: { repliedBy: string; adminNotes?: string },
  ): Promise<ContactEntity | null> {
    return this.contactService.markAsReplied(+id, body.repliedBy, body.adminNotes);
  }

  // Admin: Close contact
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/close')
  async closeContact(
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ): Promise<ContactEntity | null> {
    return this.contactService.closeContact(+id, body.adminNotes);
  }

  // Admin: Update contact status
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/status')
  async updateContactStatus(
    @Param('id') id: string,
    @Body() body: { status: ContactStatus; adminNotes?: string; repliedBy?: string },
  ): Promise<ContactEntity | null> {
    return this.contactService.updateContactStatus(
      +id,
      body.status,
      body.adminNotes,
      body.repliedBy,
    );
  }

  // Admin: Delete contact
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/contacts/:id')
  async deleteContact(@Param('id') id: string): Promise<void> {
    return this.contactService.deleteContact(+id);
  }
}
