import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactEntity, ContactStatus } from './contact.entity';

export interface CreateContactDto {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
}

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactRepo: Repository<ContactEntity>,
  ) {}

  // Public: Submit contact form
  async submitContact(data: CreateContactDto): Promise<ContactEntity> {
    const contact = this.contactRepo.create({
      ...data,
      status: ContactStatus.PENDING,
    });
    return this.contactRepo.save(contact);
  }

  // Admin: Get all contacts with optional status filter
  async getAllContacts(status?: ContactStatus): Promise<ContactEntity[]> {
    const where = status ? { status } : {};
    return this.contactRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  // Admin: Get contact by ID
  async getContactById(id: number): Promise<ContactEntity | null> {
    return this.contactRepo.findOne({ where: { id } });
  }

  // Admin: Update contact status
  async updateContactStatus(
    id: number,
    status: ContactStatus,
    adminNotes?: string,
    repliedBy?: string,
  ): Promise<ContactEntity | null> {
    const updateData: Partial<ContactEntity> = { status };

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    if (status === ContactStatus.REPLIED && repliedBy) {
      updateData.replied_by = repliedBy;
      updateData.replied_at = new Date();
    }

    await this.contactRepo.update(id, updateData);
    return this.getContactById(id);
  }

  // Admin: Mark as read
  async markAsRead(id: number): Promise<ContactEntity | null> {
    return this.updateContactStatus(id, ContactStatus.READ);
  }

  // Admin: Mark as replied
  async markAsReplied(
    id: number,
    repliedBy: string,
    adminNotes?: string,
  ): Promise<ContactEntity | null> {
    return this.updateContactStatus(
      id,
      ContactStatus.REPLIED,
      adminNotes,
      repliedBy,
    );
  }

  // Admin: Close contact
  async closeContact(id: number, adminNotes?: string): Promise<ContactEntity | null> {
    return this.updateContactStatus(id, ContactStatus.CLOSED, adminNotes);
  }

  // Admin: Delete contact
  async deleteContact(id: number): Promise<void> {
    await this.contactRepo.delete(id);
  }

  // Admin: Get pending contacts count
  async getPendingCount(): Promise<number> {
    return this.contactRepo.count({
      where: { status: ContactStatus.PENDING },
    });
  }

  // Admin: Get contacts statistics
  async getContactsStats(): Promise<Record<string, number>> {
    const stats = await this.contactRepo
      .createQueryBuilder('contact')
      .select('contact.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('contact.status')
      .getRawMany();

    const result: Record<string, number> = {
      pending: 0,
      read: 0,
      replied: 0,
      closed: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      result[stat.status] = parseInt(stat.count, 10);
      result.total += parseInt(stat.count, 10);
    });

    return result;
  }
}
