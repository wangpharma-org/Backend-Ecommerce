// ECWC-743: ทำความสะอาดหน่วยสินค้าที่มาจาก Kafka ก่อนบันทึกลง product_unit

export const UNIT_NAME_MAX_LENGTH = 30; // ตรงกับ varchar(30) ของ product_unit.unit_name

export interface UnitRowInput {
  level: number;
  unit_name?: string | null;
  ratio?: number | string | null;
}

export interface UnitRow {
  level: number;
  unit_name: string;
  ratio: number;
}

/** ชื่อหน่วยหลัง trim — ค่าว่าง/null/undefined คืน '' */
export function normalizeUnitName(name?: string | null): string {
  return typeof name === 'string' ? name.trim() : '';
}

/** ratio ต้องเป็นจำนวนเต็มบวก — ไม่ใช่ (0, ติดลบ, ทศนิยม, "12a") คืน null */
export function parseUnitRatio(ratio?: number | string | null): number | null {
  if (ratio === null || ratio === undefined) return null;
  if (typeof ratio === 'string' && ratio.trim() === '') return null;
  const value = Number(ratio);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * แปลงหน่วย 3 ระดับจาก payload เป็นแถวที่บันทึกได้
 * ข้ามระดับที่ไม่มีชื่อหน่วย, ratio ที่ไม่ส่งมาหรือไม่ถูกต้อง → 1 (ระบุใน warnings ถ้าส่งมาแต่ผิด)
 */
export function buildUnitRows(inputs: UnitRowInput[]): {
  rows: UnitRow[];
  warnings: string[];
} {
  const rows: UnitRow[] = [];
  const warnings: string[] = [];
  for (const input of inputs) {
    const unit_name = normalizeUnitName(input.unit_name);
    if (!unit_name) continue;
    if (unit_name.length > UNIT_NAME_MAX_LENGTH) {
      warnings.push(
        `level ${input.level}: ชื่อหน่วยยาว ${unit_name.length} ตัว เกิน ${UNIT_NAME_MAX_LENGTH}`,
      );
    }
    let ratio = parseUnitRatio(input.ratio);
    if (ratio === null) {
      if (input.ratio !== null && input.ratio !== undefined) {
        warnings.push(
          `level ${input.level}: ratio ${JSON.stringify(input.ratio)} ไม่ใช่จำนวนเต็มบวก ใช้ 1 แทน`,
        );
      }
      ratio = 1;
    }
    rows.push({ level: input.level, unit_name, ratio });
  }
  return { rows, warnings };
}
