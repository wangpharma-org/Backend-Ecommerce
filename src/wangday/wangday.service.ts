import { Injectable } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { WangDay } from './wangday.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { WangdaySumPrice } from './wangdaySumPrice.entity';

@Injectable()
export class WangdayService {
  private accumulatedRows: Partial<WangDay>[] = [];
  constructor(
    @InjectRepository(WangDay)
    private wangdayRepo: Repository<WangDay>,
    @InjectRepository(WangdaySumPrice)
    private sumPriceRepo: Repository<WangdaySumPrice>,
  ) {}

  excelDateToJSDate(serial: number): string {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const mm = date_info.getMonth() + 1;
    const dd = date_info.getDate();
    const yyyy = date_info.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  async importFromExcel(
    rows: Partial<WangDay>[],
    isLastChunk: boolean,
    isFirstChunk: boolean,
  ): Promise<WangDay[]> {
    // 1. เตรียมข้อมูลใหม่ทั้งหมด (แปลงวันที่และ filter ข้อมูลที่จำเป็น)
    const newRows: Partial<WangDay>[] = [];
    const dateSet = new Set<string>();
    if (isFirstChunk === true) {
      this.accumulatedRows = [];
    }
    for (const row of rows) {
      // trim ทุก field ที่เป็น string
      const trimmedRow: Partial<WangDay> = {};
      for (const key in row) {
        if (typeof row[key] === 'string') {
          trimmedRow[key] = (row[key] as string).trim();
        } else {
          trimmedRow[key] = row[key];
        }
      }
      let dateValue = trimmedRow.date;
      if (typeof dateValue === 'number') {
        dateValue = this.excelDateToJSDate(dateValue);
      }
      if (!dateValue || !trimmedRow.wang_code) continue;
      newRows.push({ ...trimmedRow, date: dateValue });
      dateSet.add(dateValue);
    }
    if (newRows.length === 0) return [];

    // ถ้าข้อมูลที่เข้ามาเท่ากับ 300 ให้เก็บสะสมไว้ก่อนและรอข้อมูลรอบถัดไป (return [])
    if (isLastChunk !== true) {
      this.accumulatedRows.push(...newRows);
      return [];
    }

    // ถ้าน้อยกว่า 300 ให้รวมกับข้อมูลสะสม (ถ้ามี) แล้วลบและ insert
    const allRows =
      this.accumulatedRows.length > 0
        ? [...this.accumulatedRows, ...newRows]
        : newRows;
    // trim อีกครั้งสำหรับข้อมูลสะสม (กันข้อมูลข้ามรอบที่อาจยังไม่ถูก trim)
    for (let i = 0; i < allRows.length; i++) {
      for (const key in allRows[i]) {
        if (typeof allRows[i][key] === 'string') {
          allRows[i][key] = (allRows[i][key] as string).trim();
        }
      }
    }
    // clear ข้อมูลสะสม
    this.accumulatedRows = [];

    // รวมวันที่ทั้งหมดจาก allRows
    const allDateSet = new Set<string>();
    for (const row of allRows) {
      if (row.date) allDateSet.add(row.date as string);
    }
    await this.wangdayRepo.delete({ date: In(Array.from(allDateSet)) });
    const inserted = await this.wangdayRepo.save(allRows);
    return inserted;
  }

  async getMonthlySumByWangCode(
    wang_code: string,
  ): Promise<{ wang_code: string; monthly: { [month: number]: number } }> {
    const result = await this.wangdayRepo
      .createQueryBuilder('wangday')
      .select('wangday.wang_code', 'wang_code')
      .addSelect("SUBSTRING_INDEX(wangday.date, '/', 1)", 'month')
      .addSelect('SUM(wangday.sumprice)', 'total')
      .where('wangday.wang_code = :wang_code', { wang_code })
      .andWhere('wangday.date IS NOT NULL')
      .groupBy('month')
      .getRawMany();
    const monthly: { [month: number]: number } = {};
    for (let m = 1; m <= 12; m++) {
      const found = result.find((row) => Number(row.month) === m);
      monthly[m] = found ? Number(found.total) : 0;
    }
    return { wang_code, monthly };
  }
  /**
   * ดึงข้อมูลทั้งหมดของ wang_code ที่ระบุ
   */
  async getAllWangSumPrice(
    wang_code: string,
  ): Promise<{ data: WangdaySumPrice | null }> {
    const data = await this.sumPriceRepo.findOne({ where: { wang_code } });
    return { data };
  }
}
