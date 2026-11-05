// ECWC-751: รวมผลค้นหาสินค้าจากทุกแหล่ง (Elasticsearch + เว็บเก่า + DB) เป็นรายการเดียวไม่ซ้ำ
// ลำดับเสมือน = [pinned] + [ผล ES ทั้งหมดตามคะแนน] + [rest]
//   pinned = รหัส/บาร์โค้ดตรงเป๊ะที่ ES หาไม่เจอ (เช่น ES sync ไม่ทัน) — ขึ้นก่อนเพื่อให้สแกนบาร์โค้ดเจอทันที
//   rest   = ตัวที่แหล่งอื่นเจอแต่ ES ไม่เจอ
// ES ถูกดึงมาแค่ช่วง [esFrom, esFrom + esCodes.length) ของหน้าปัจจุบัน ไม่ใช่ทั้งหมด

export const SEARCH_PIN_LIMIT = 5;

export interface SearchCandidateRow {
  pro_code: string;
  pro_barcode1?: string | null;
  pro_barcode2?: string | null;
  pro_barcode3?: string | null;
}

export function isExactCodeMatch(
  keyword: string,
  row: SearchCandidateRow,
): boolean {
  const target = keyword.trim().toLowerCase();
  if (!target) {
    return false;
  }
  return [row.pro_code, row.pro_barcode1, row.pro_barcode2, row.pro_barcode3]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.trim().toLowerCase() === target);
}

// แยกตัวที่ ES ไม่เจอเป็น pinned (ตรงเป๊ะ สูงสุด SEARCH_PIN_LIMIT) กับ rest — คงลำดับเดิม ไม่ซ้ำ
export function splitExtraCandidates(
  keyword: string,
  rows: SearchCandidateRow[],
  esMatchedCodes: Set<string>,
): { pinned: string[]; rest: string[] } {
  const pinned: string[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const code = row.pro_code;
    if (!code || seen.has(code) || esMatchedCodes.has(code)) {
      continue;
    }
    seen.add(code);
    if (pinned.length < SEARCH_PIN_LIMIT && isExactCodeMatch(keyword, row)) {
      pinned.push(code);
    } else {
      rest.push(code);
    }
  }
  return { pinned, rest };
}

// ช่วงที่ต้องดึงจาก ES ให้ครอบคลุมหน้าปัจจุบันไม่ว่า pinned จะมี 0..SEARCH_PIN_LIMIT ตัว
export function esWindowFor(
  offset: number,
  limit: number,
): { from: number; size: number } {
  const from = Math.max(0, offset - SEARCH_PIN_LIMIT);
  return { from, size: limit + (offset - from) };
}

export function mergeSearchPage(params: {
  pinned: string[];
  esCodes: string[];
  esFrom: number;
  esTotal: number;
  rest: string[];
  offset: number;
  limit: number;
}): { codes: string[]; totalCount: number } {
  const { pinned, esCodes, esFrom, esTotal, rest, offset, limit } = params;
  const pinnedCount = pinned.length;
  const totalCount = pinnedCount + esTotal + rest.length;
  const end = Math.min(offset + limit, totalCount);

  const codes: string[] = [];
  const seen = new Set<string>();
  for (let index = Math.max(0, offset); index < end; index++) {
    let code: string | undefined;
    if (index < pinnedCount) {
      code = pinned[index];
    } else if (index < pinnedCount + esTotal) {
      code = esCodes[index - pinnedCount - esFrom];
    } else {
      code = rest[index - pinnedCount - esTotal];
    }
    if (code && !seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return { codes, totalCount };
}
