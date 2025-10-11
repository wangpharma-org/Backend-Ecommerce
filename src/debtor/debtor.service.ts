import { Injectable, Body } from '@nestjs/common';
import { DebtorEntity } from './debtor.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtorDetailEntity } from './debtor-detail.entity';
import { ReductionRT } from './reduct-rt.entity';
import { ReductionRTDetail } from './reduct-rt-detail.entity';
import { Cron } from '@nestjs/schedule';

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
  comments: string;
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
export class DebtorService {
  constructor(
    @InjectRepository(DebtorEntity)
    private readonly debtorRepo: Repository<DebtorEntity>,
    @InjectRepository(DebtorDetailEntity)
    private readonly debtorDetailRepo: Repository<DebtorDetailEntity>,
    @InjectRepository(ReductionRT)
    private readonly reductionRTRepo: Repository<ReductionRT>,
    @InjectRepository(ReductionRTDetail)
    private readonly reductionRTDetailRepo: Repository<ReductionRTDetail>,
  ) {}

  async getAllDebtors(mem_code: string): Promise<
    [
      {
        Debtor: DebtorEntity[];
        RT: ReductionRT[];
        totalCount: number;
      },
    ]
  > {
    try {
      console.log('Fetching all debtors for mem_code:', mem_code);
      const debtors = await this.debtorRepo.find({
        where: {
          mem_code: mem_code,
        },
      });
      console.log('Debtors:', debtors); // เพิ่มบรรทัดนี้เพื่อตรวจสอบค่า debtors
      const reductionRTs = await this.reductionRTRepo.find({
        where: {
          mem_code: mem_code,
        },
      });
      const totalCount = reductionRTs.length + debtors.length;
      console.log('ReductionRTs:', reductionRTs); // เพิ่มบรรทัดนี้เพื่อตรวจสอบค่า reductionRTs
      return [{ Debtor: debtors, RT: reductionRTs, totalCount }];
    } catch {
      throw new Error('Failed to get debtor data');
    }
  }

  async importDataInvoice(
    @Body() data: ImportDataRequestInvoice[],
  ): Promise<DebtorEntity[]> {
    try {
      const importedInvoices: DebtorEntity[] = [];

      // ลบข้อมูลอย่างปลอดภัย - ลบ child ก่อน parent
      console.log('Clearing existing data...');

      // Method 1: ใช้ Query Builder เพื่อลบข้อมูลทั้งหมด
      await this.debtorDetailRepo.createQueryBuilder().delete().execute();
      await this.debtorRepo.createQueryBuilder().delete().execute();

      console.log('Data cleared successfully');

      for (const item of data) {
        // แยกข้อมูล header และ detail
        const { bill_list, ...reductionInvoiceData } = item;

        console.log(
          'Processing reduction invoice:',
          reductionInvoiceData.mem_code,
        );

        const cleanedData = {
          date: reductionInvoiceData.date,
          billing_slip_id: reductionInvoiceData.invoice,
          mem_code: reductionInvoiceData.mem_code,
          payment_schedule_date: reductionInvoiceData.date_due,
          total: reductionInvoiceData.total,
          payment: reductionInvoiceData.payment,
          balance: reductionInvoiceData.balance,
        };

        const newReductionInvoice = this.debtorRepo.create(cleanedData);

        const savedReductionInvoice =
          await this.debtorRepo.save(newReductionInvoice);

        if (bill_list && bill_list.length > 0) {
          const reductionInvoiceDetails = bill_list.map((detail) =>
            this.debtorDetailRepo.create({
              date: detail.date,
              price: detail.price,
              sh_running: detail.comments,
              invoice: detail.invoice,
              due_date: item.date_due,
              invoice_bill_id: String(savedReductionInvoice.debtor_id),
            }),
          );
          await this.debtorDetailRepo.save(reductionInvoiceDetails);
        }
        console.log(
          'Imported reduction invoice:',
          savedReductionInvoice.billing_slip_id,
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
      const importedRTs: ReductionRT[] = [];

      // ลบข้อมูลอย่างปลอดภัย - ลบ child ก่อน parent
      console.log('Clearing existing data...');

      // Method 1: ใช้ Query Builder เพื่อลบข้อมูลทั้งหมด
      await this.reductionRTDetailRepo.createQueryBuilder().delete().execute();
      await this.reductionRTRepo.createQueryBuilder().delete().execute();

      console.log('Data cleared successfully');

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
          comment: reductionInvoiceRTData.comments,
        };

        const newReductionInvoiceRT = this.reductionRTRepo.create(cleanedData);

        const savedReductionInvoiceRT = await this.reductionRTRepo.save(
          newReductionInvoiceRT,
        );

        console.log(
          'Saved ReductionInvoiceRT:',
          savedReductionInvoiceRT.comment,
        );

        if (pro_list && pro_list.length > 0) {
          const reductionInvoiceRTDetails = pro_list.map((detail) =>
            this.reductionRTDetailRepo.create({
              reductionRT: savedReductionInvoiceRT, // เชื่อม relationship
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
          await this.reductionRTDetailRepo.save(reductionInvoiceRTDetails);
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

  async findDebtor(
    mem_code: string,
    invoice: string,
  ): Promise<DebtorEntity | string> {
    try {
      console.log('Finding debtor for invoice:', invoice);
      const result = await this.debtorRepo.findOne({
        where: { billing_slip_id: invoice, mem_code: mem_code },
        relations: ['debtorDetail'],
      });
      console.log('Found reduction invoice:', result);
      return result || 'Error finding reduction invoices';
    } catch (error) {
      console.error('Error finding reduction invoices:', error);
      return 'Error finding reduction invoices';
    }
  }

  async findReductionRT(
    mem_code: string,
    invoice: string,
  ): Promise<ReductionRT | string> {
    try {
      console.log('Finding reduction RT for invoice:', invoice);
      const result = await this.reductionRTRepo.findOne({
        where: { invoice: invoice, mem_code: mem_code },
        relations: ['details', 'details.product'],
        select: {
          details: {
            pro_amount: true,
            pro_unit: true,
            pro_price_per_unit: true,
            pro_discount: true,
            product: { pro_code: true, pro_name: true },
          },
        },
      });
      console.log('Found reduction RT:', result);
      return result || 'Error finding reduction RT';
    } catch (error) {
      console.error('Error finding reduction RT:', error);
      return 'Error finding reduction RT';
    }
  }

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

      const expiredInvoices = await this.debtorRepo
        .createQueryBuilder('invoice')
        .where('invoice.date < :date', { date: dateString })
        .getMany();

      console.log(`Found ${expiredInvoices.length} expired invoices`);

      if (expiredInvoices.length > 0) {
        console.log(
          'Expired invoices:',
          expiredInvoices.map((inv) => ({
            billing_slip_id: inv.billing_slip_id,
            date: inv.date,
            mem_code: inv.mem_code,
          })),
        );

        // ลบ details ก่อน
        for (const invoice of expiredInvoices) {
          console.log(
            'Cleaning up details for invoice:',
            invoice.billing_slip_id,
          );
          await this.debtorDetailRepo.delete({
            debtorEntity: { debtor_id: invoice.debtor_id },
          });
        }

        console.log(
          `Successfully cleaned up ${expiredInvoices.length} expired invoices`,
        );
      }
    } catch (error) {
      console.error('Error in daily cleanup:', error);
    }
  }

  @Cron('0 3 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyCleanupOldRTs() {
    try {
      console.log('Running daily cleanup for old Reduction RTs...');

      // สร้างวันที่ 90 วันที่แล้วในรูปแบบ YYYY-MM-DD
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // แปลงเป็น YYYY-MM-DD format เพื่อให้ตรงกับ database
      const dateString = ninetyDaysAgo.toISOString().split('T')[0]; // "2024-07-17"

      console.log('Checking for Reduction RTs older than:', dateString);

      const oldRTs = await this.reductionRTRepo
        .createQueryBuilder('rt')
        .where('rt.date < :date', { date: dateString })
        .getMany();

      console.log(`Found ${oldRTs.length} old Reduction RTs`);

      if (oldRTs.length > 0) {
        console.log(
          'Old Reduction RTs:',
          oldRTs.map((rt) => ({
            invoice: rt.invoice,
            date: rt.date,
            mem_code: rt.mem_code,
          })),
        );

        // ลบ details ก่อน
        for (const rt of oldRTs) {
          console.log('Cleaning up details for RT:', rt.invoice);
          await this.reductionRTDetailRepo.delete({
            reductionRT: { RT_id: rt.RT_id },
          });
        }

        console.log(
          `Successfully cleaned up ${oldRTs.length} old Reduction RTs`,
        );
      }
    } catch (error) {
      console.error('Error in daily cleanup of Reduction RTs:', error);
    }
  }
}
