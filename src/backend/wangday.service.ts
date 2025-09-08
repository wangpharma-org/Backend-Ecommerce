import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WangDay } from './wangday.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { WangdaySumPrice } from './wangdaySumPrice.entity';

@Injectable()
export class WangdayService {
    constructor(
        @InjectRepository(WangDay)
        private wangdayRepo: Repository<WangDay>,
        @InjectRepository(WangdaySumPrice)
        private sumPriceRepo: Repository<WangdaySumPrice>,
    ) { }

    excelDateToJSDate(serial: number): string {
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        const mm = date_info.getMonth() + 1;
        const dd = date_info.getDate();
        const yyyy = date_info.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    }

    async importFromExcel(rows: Partial<WangDay>[]): Promise<WangDay[]> {
        const results: WangDay[] = [];
        for (const row of rows) {
            let dateValue = row.date;
            if (typeof dateValue === 'number') {
                dateValue = this.excelDateToJSDate(dateValue);
            }
            if (!dateValue || !row.wang_code) continue;
            try {
                const saved = await this.wangdayRepo.save({ ...row, date: dateValue });
                results.push(saved);
            } catch (err: any) {
                // ถ้า error duplicate entry (unique constraint sh_running) ให้ข้าม
                if (err.code === 'ER_DUP_ENTRY' || (err.message && err.message.includes('Duplicate entry'))) {
                    continue;
                } else {
                    throw err;
                }
            }
        }
        return results;
    }

    async getMonthlySumByWangCode(wang_code: string): Promise<{ wang_code: string, monthly: { [month: number]: number } }> {
        const all = await this.wangdayRepo.find({ where: { wang_code } });
        // Map เดือน (1-12) => ยอดรวม
        const monthMap = new Map<number, number>();
        for (const row of all) {
            if (!row.date) continue;
            // แยกเดือนจาก date (MM/DD/YYYY หรือ M/D/YYYY)
            const month = Number((row.date as string).split('/')[0]);
            const sum = parseFloat(row.sumprice as string) || 0;
            if (monthMap.has(month)) {
                monthMap.set(month, monthMap.get(month)! + sum);
            } else {
                monthMap.set(month, sum);
            }
        }
        // สร้าง object 1-12 ถ้าเดือนไหนไม่มีข้อมูลให้เป็น 0
        const monthly: { [month: number]: number } = {};
        for (let m = 1; m <= 12; m++) {
            monthly[m] = Number((monthMap.get(m) || 0).toFixed(2));
        }
        return { wang_code, monthly };
    }
    /**
 * ดึงข้อมูลทั้งหมดของ wang_code ที่ระบุ
 */
    async getAllWangSumPrice(wang_code: string): Promise<{ data: WangdaySumPrice | null }> {
        const data = await this.sumPriceRepo.findOne({ where: { wang_code } });
        return { data };
    }

}
