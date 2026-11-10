/**
 * ECWC-749: ใครเปิด/ปิด/ดูรายการ feature flag ได้
 *
 * ตรงกับฝั่งหน้าเว็บ (Ecommerce-Frontend utils/permissions.ts canAccessAdminPath สำหรับ /admin/feature-flag):
 * role Admin หรือได้เมนู "feature-flag" ใน admin_features — ไม่ใช้ `permission` เฉยๆ เพราะบัญชี Sales ก็มี permission
 * token ขอบเขตจำกัด (เช่นลิงก์รีวิวทาง LINE) ไม่มีสิทธิ์เสมอ
 *
 * flag "all" ปิดแล้วร้านทุกร้านใช้เว็บไม่ได้ — ห้ามผ่อนกติกานี้
 */
export const FEATURE_FLAG_MENU = 'feature-flag';

export interface FeatureFlagCaller {
  role?: unknown;
  admin_features?: unknown;
  scope?: unknown;
}

export function canManageFeatureFlags(
  user: FeatureFlagCaller | null | undefined,
): boolean {
  if (!user || user.scope) return false;
  if (user.role === 'Admin') return true;
  return (
    Array.isArray(user.admin_features) &&
    user.admin_features.includes(FEATURE_FLAG_MENU)
  );
}
