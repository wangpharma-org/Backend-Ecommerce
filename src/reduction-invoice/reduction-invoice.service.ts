import { Injectable, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReductionInvoice } from './reduction-invoice.entity';
import { Repository } from 'typeorm';
import { ReductionInvoiceDetail } from './reduc-invoice-detail.entity';
import { ReductionInvoiceRTDetail } from './reduct-invoice-rt-detail.entity';
import { ReductionInvoiceRT } from './reduct-invoice-rt.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ImportDataRequestInvoice {
  date: string;
  invoice: string;
  mem_code: string;
  date_due: string;
  total: string;
  payment: string;
  balance: string;
  bill_list: {
    date: string;
    invoice: string;
    price: string;
    comments: string;
  }[];
}

export interface ImportDataRequestRT {
  invoice: string;
  date: string;
  mem_code: string;
  pro_amount: string;
  dis_price: string;
  pro_list: {
    pro_code: string;
    pro_name: string;
    pro_amount: string;
    pro_unit: string;
    pro_price_per_unit: string;
    pro_discount: string;
  }[];
}

@Injectable()
export class ReductionInvoiceService {
  constructor(
    @InjectRepository(ReductionInvoice)
    private readonly reductionInvoiceRepo: Repository<ReductionInvoice>,
    @InjectRepository(ReductionInvoiceDetail)
    private readonly reductionInvoiceDetailRepo: Repository<ReductionInvoiceDetail>,
    @InjectRepository(ReductionInvoiceRTDetail)
    private readonly reductionInvoiceRTDetailRepo: Repository<ReductionInvoiceRTDetail>,
    @InjectRepository(ReductionInvoiceRT)
    private readonly reductionInvoiceRTRepo: Repository<ReductionInvoiceRT>,
  ) { }

  async importDataInvoice(
    @Body() data: ImportDataRequestInvoice[],
  ): Promise<ReductionInvoice[]> {
    try {
      const importedInvoices: ReductionInvoice[] = [];

      for (const item of data) {
        const existingInvoices = await this.reductionInvoiceRepo.find({
          where: { date: item.date },
        });
        console.log('Existing invoices for date', item.date, existingInvoices);
        if (existingInvoices.length > 0) {
          for (const existingInvoice of existingInvoices) {
            await this.reductionInvoiceDetailRepo.delete({
              reductionInvoice: { id: existingInvoice.id },
            });
            await this.reductionInvoiceRepo.delete({ id: existingInvoice.id });
          }
        }
      }

      for (const item of data) {
        // แยกข้อมูล header และ detail
        const { bill_list, ...reductionInvoiceData } = item;

        console.log(
          'Processing reduction invoice:',
          reductionInvoiceData.mem_code,
        );

        const cleanedData = {
          date: reductionInvoiceData.date,
          invoice: reductionInvoiceData.invoice,
          mem_code: reductionInvoiceData.mem_code, // ระบุ mem_code ชัดเจน
          date_due: reductionInvoiceData.date_due,
          total: reductionInvoiceData.total,
          payment: reductionInvoiceData.payment,
          balance: reductionInvoiceData.balance,
        };

        const newReductionInvoice = this.reductionInvoiceRepo.create(cleanedData);

        const savedReductionInvoice =
          await this.reductionInvoiceRepo.save(newReductionInvoice);

        if (bill_list && bill_list.length > 0) {
          const reductionInvoiceDetails = bill_list.map((detail) =>
            this.reductionInvoiceDetailRepo.create({
              date: detail.date,
              price: detail.price,
              sh_running: detail.comments,
              due_date: item.date_due,
              reductionInvoice: savedReductionInvoice,
              invoice: detail.invoice,
            }),
          );
          await this.reductionInvoiceDetailRepo.save(reductionInvoiceDetails);
        }
        console.log(
          'Imported reduction invoice:',
          savedReductionInvoice.invoice,
        );
        importedInvoices.push(savedReductionInvoice);
      }
      return importedInvoices;
    } catch (error) {
      console.error('Error importing reduction invoice data:', error);
      throw new Error(
        `Failed to import reduction invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async importDataRT(@Body() data: ImportDataRequestRT[]) {
    try {
      const importedRTs: ReductionInvoiceRT[] = [];

      for (const item of data) {
        const existingRTs = await this.reductionInvoiceRTRepo.find({
          where: { date: item.date },
        });
        if (existingRTs.length > 0) {
          for (const existingRT of existingRTs) {
            if (existingRT.RT_id > 0) {
              await this.reductionInvoiceRTDetailRepo
                .createQueryBuilder()
                .delete()
                .where('RT_id = :rtId', { rtId: existingRT.RT_id })
                .execute();
              // ลบ header หลัง
              await this.reductionInvoiceRTRepo.delete({ RT_id: existingRT.RT_id });
            }
          }
        }
      }

      for (const item of data) {
        // แยกข้อมูล header และ detail
        const { pro_list, ...reductionInvoiceRTData } = item;

        console.log(
          'Processing reduction invoice RT:',
          reductionInvoiceRTData.mem_code,
        );

        const cleanedData = {
          invoice: reductionInvoiceRTData.invoice,
          date: reductionInvoiceRTData.date,
          mem_code: reductionInvoiceRTData.mem_code, // ระบุ mem_code ชัดเจน
          pro_amount: reductionInvoiceRTData.pro_amount,
          dis_price: reductionInvoiceRTData.dis_price,
        };

        const newReductionInvoiceRT = this.reductionInvoiceRTRepo.create(cleanedData);

        const savedReductionInvoiceRT = await this.reductionInvoiceRTRepo.save(
          newReductionInvoiceRT,
        );

        if (pro_list && pro_list.length > 0) {
          const reductionInvoiceRTDetails = pro_list.map((detail) =>
            this.reductionInvoiceRTDetailRepo.create({
              reductionInvoiceRT: savedReductionInvoiceRT, // เชื่อม relationship
              product: {
                pro_code: detail.pro_code,
                pro_name: detail.pro_name,
              },
              pro_amount: detail.pro_amount,
              pro_unit: detail.pro_unit,
              pro_price_per_unit: detail.pro_price_per_unit,
              pro_discount: detail.pro_discount,
            }),
          );
          await this.reductionInvoiceRTDetailRepo.save(reductionInvoiceRTDetails);
        }
        console.log(
          'Imported reduction invoice RT:',
          savedReductionInvoiceRT.invoice,
        );
        importedRTs.push(savedReductionInvoiceRT);
      }
      return importedRTs;
    } catch (error) {
      console.error('Error importing reduction invoice RT data:', error);
      throw new Error(
        `Failed to import reduction invoice RT: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findReductionInvoices(mem_code: string, invoice: string): Promise<ReductionInvoice | string> {
    try {
      console.log('Finding reduction invoice for invoice:', invoice);
      const result = await this.reductionInvoiceRepo.findOne({
        where: { invoice: invoice, mem_code: mem_code },
        relations: ['reducDetail'],
      });
      console.log('Found reduction invoice:', result);
      return result || 'err';
    } catch (error) {
      console.error('Error finding reduction invoices:', error);
      return 'err';
    }
  }

  async findAllInvoices(): Promise<ReductionInvoice[] | string> {
    try {
      const result = await this.reductionInvoiceRepo.find({
        relations: ['reducDetail'],
      });
      return result;
    } catch (error) {
      console.error('Error finding all reduction invoices:', error);
      return 'err';
    }
  }

  // ตัวอย่าง Cron Jobs สำหรับ Reduction Invoice

  // ทำงานทุกวันเวลา 02:00 น.
  @Cron('0 2 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyCleanupExpiredInvoices() {
    try {
      console.log('Running daily cleanup for expired invoices...');

      // สร้างวันที่ 90 วันที่แล้วในรูปแบบ YYYY-MM-DD
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // แปลงเป็น YYYY-MM-DD format เพื่อให้ตรงกับ database
      const dateString = ninetyDaysAgo.toISOString().split('T')[0]; // "2024-07-17"

      console.log('Checking for invoices older than:', dateString);

      const expiredInvoices = await this.reductionInvoiceRepo
        .createQueryBuilder('invoice')
        .where('invoice.date < :date', { date: dateString })
        .getMany();

      console.log(`Found ${expiredInvoices.length} expired invoices`);

      if (expiredInvoices.length > 0) {
        console.log('Expired invoices:', expiredInvoices.map(inv => ({
          invoice: inv.invoice,
          date: inv.date,
          mem_code: inv.mem_code
        })));

        // ลบ details ก่อน
        for (const invoice of expiredInvoices) {
          console.log('Cleaning up details for invoice:', invoice.invoice);
          await this.reductionInvoiceDetailRepo.delete({
            reductionInvoice: { id: invoice.id }
          });
        }

        console.log(`Successfully cleaned up ${expiredInvoices.length} expired invoices`);
      }
    } catch (error) {
      console.error('Error in daily cleanup:', error);
    }
  }
}