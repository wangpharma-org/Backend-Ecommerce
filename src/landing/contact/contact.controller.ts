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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ContactService, CreateContactDto } from './contact.service';
import { ContactEntity, ContactStatus } from './contact.entity';

@ApiTags('Landing - Contact')
@Controller('ecom')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // Public: Submit contact form
  @ApiOperation({ summary: 'ส่งข้อความติดต่อจากแบบฟอร์มหน้า Landing Page (Public)' })
  @ApiBody({ type: CreateContactDto })
  @ApiResponse({ status: 201, description: 'ส่งข้อความติดต่อสำเร็จ', type: ContactEntity })
  @Post('landing/contact')
  async submitContact(@Body() data: CreateContactDto): Promise<ContactEntity> {
    return this.contactService.submitContact(data);
  }

  // Admin: Get all contacts with optional status filter
  @ApiOperation({ summary: 'ดึงรายการข้อความติดต่อทั้งหมด สามารถกรองตามสถานะได้ (Admin)' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ContactStatus,
    description: 'กรองตามสถานะของข้อความติดต่อ',
  })
  @ApiResponse({ status: 200, description: 'รายการข้อความติดต่อ', type: [ContactEntity] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts')
  async getAllContacts(
    @Query('status') status?: ContactStatus,
  ): Promise<ContactEntity[]> {
    return this.contactService.getAllContacts(status);
  }

  // Admin: Get contact by ID
  @ApiOperation({ summary: 'ดึงข้อมูลข้อความติดต่อตามรหัส (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของข้อความติดต่อ', example: '1' })
  @ApiResponse({ status: 200, description: 'ข้อมูลข้อความติดต่อ', type: ContactEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts/:id')
  async getContactById(@Param('id') id: string): Promise<ContactEntity | null> {
    return this.contactService.getContactById(+id);
  }

  // Admin: Get contacts statistics
  @ApiOperation({ summary: 'ดึงสถิติจำนวนข้อความติดต่อแยกตามสถานะ (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'สถิติจำนวนข้อความติดต่อแยกตามสถานะ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts/stats')
  async getContactsStats(): Promise<Record<string, number>> {
    return this.contactService.getContactsStats();
  }

  // Admin: Get pending contacts count
  @ApiOperation({ summary: 'ดึงจำนวนข้อความติดต่อที่ยังรอดำเนินการ (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'จำนวนข้อความติดต่อที่รอดำเนินการ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/contacts/pending-count')
  async getPendingCount(): Promise<{ count: number }> {
    const count = await this.contactService.getPendingCount();
    return { count };
  }

  // Admin: Mark as read
  @ApiOperation({ summary: 'ตั้งสถานะข้อความติดต่อเป็น "อ่านแล้ว" (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของข้อความติดต่อ', example: '1' })
  @ApiResponse({ status: 200, description: 'อัปเดตสถานะเป็นอ่านแล้วสำเร็จ', type: ContactEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/read')
  async markAsRead(@Param('id') id: string): Promise<ContactEntity | null> {
    return this.contactService.markAsRead(+id);
  }

  // Admin: Mark as replied
  @ApiOperation({ summary: 'ตั้งสถานะข้อความติดต่อเป็น "ตอบกลับแล้ว" (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของข้อความติดต่อ', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        repliedBy: { type: 'string', description: 'ชื่อแอดมินผู้ตอบกลับ', example: 'admin01' },
        adminNotes: { type: 'string', description: 'บันทึกเพิ่มเติม', example: 'ตอบกลับทางอีเมลแล้ว' },
      },
      required: ['repliedBy'],
    },
  })
  @ApiResponse({ status: 200, description: 'อัปเดตสถานะเป็นตอบกลับแล้วสำเร็จ', type: ContactEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/replied')
  async markAsReplied(
    @Param('id') id: string,
    @Body() body: { repliedBy: string; adminNotes?: string },
  ): Promise<ContactEntity | null> {
    return this.contactService.markAsReplied(+id, body.repliedBy, body.adminNotes);
  }

  // Admin: Close contact
  @ApiOperation({ summary: 'ปิดข้อความติดต่อ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของข้อความติดต่อ', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        adminNotes: { type: 'string', description: 'บันทึกเพิ่มเติม', example: 'จบการสนทนาแล้ว' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'ปิดข้อความติดต่อสำเร็จ', type: ContactEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/contacts/:id/close')
  async closeContact(
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ): Promise<ContactEntity | null> {
    return this.contactService.closeContact(+id, body.adminNotes);
  }

  // Admin: Update contact status
  @ApiOperation({ summary: 'อัปเดตสถานะของข้อความติดต่อ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของข้อความติดต่อ', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { enum: Object.values(ContactStatus), description: 'สถานะใหม่ของข้อความติดต่อ' },
        adminNotes: { type: 'string', description: 'บันทึกเพิ่มเติม' },
        repliedBy: { type: 'string', description: 'ชื่อแอดมินผู้ตอบกลับ' },
      },
      required: ['status'],
    },
  })
  @ApiResponse({ status: 200, description: 'อัปเดตสถานะสำเร็จ', type: ContactEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'ลบข้อความติดต่อ (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของข้อความติดต่อ', example: '1' })
  @ApiResponse({ status: 200, description: 'ลบข้อความติดต่อสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/contacts/:id')
  async deleteContact(@Param('id') id: string): Promise<void> {
    return this.contactService.deleteContact(+id);
  }
}
