// "/ฟรี" กลางชื่อ = สินค้าของแถม (PR #320) ยกเว้นคำที่เป็นของสินค้าขายเอง (ECWC-751):
//   ฟรีไซส์ / ฟรีไซด์ / ฟรีไซซ์ (ขนาด) และ ฟรี<ตัวเลข>ชิ้น (แถมในกล่อง เช่น ถุงยางวันทัช/ฟรี1ชิ้น)
// "ฟรีเมื่อซื้อ..." ยังนับเป็นของแถม · ชื่อลงท้าย/ขึ้นต้นด้วย "ฟรี" มีกฎแยกอยู่แล้ว
// ใช้ pattern เดียวกันทั้ง SQL (MySQL REGEXP), JS และ Elasticsearch ให้ผลตรงกันทุกแหล่ง

export const SLASH_FREE_LIKE = '%/ฟรี%';
export const SLASH_FREE_SELLABLE_REGEXP = '/ฟรี ?(ไซ|[0-9]+ ?ชิ้น)';

export function isSlashFreeGiftName(name: string | null | undefined): boolean {
  if (!name || !name.includes('/ฟรี')) {
    return false;
  }
  return !new RegExp(SLASH_FREE_SELLABLE_REGEXP).test(name);
}

// เงื่อนไข SQL "ไม่ใช่ของแถมแบบ /ฟรี" — ต้องส่ง parameters จาก slashFreeGiftParams() คู่กัน
export function notSlashFreeGiftSql(alias: string): string {
  return `NOT (${alias}.pro_name LIKE :slashFree AND ${alias}.pro_name NOT REGEXP :slashFreeSellable)`;
}

export function slashFreeGiftParams(): Record<string, string> {
  return {
    slashFree: SLASH_FREE_LIKE,
    slashFreeSellable: SLASH_FREE_SELLABLE_REGEXP,
  };
}

// must_not ของ ES: มี "/ฟรี" และไม่ใช่คำของสินค้าขาย
export const SLASH_FREE_GIFT_ES_CLAUSE = {
  bool: {
    must: [{ wildcard: { 'pro_name.keyword': { value: '*/ฟรี*' } } }],
    must_not: [
      {
        regexp: {
          'pro_name.keyword': { value: `.*${SLASH_FREE_SELLABLE_REGEXP}.*` },
        },
      },
    ],
  },
};
