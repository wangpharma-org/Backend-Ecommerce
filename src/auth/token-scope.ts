/// ขอบเขตของ token ที่ออกจากลิงก์ที่ส่งทาง LINE (ไม่ได้ผ่านรหัสผ่าน)
///
/// ลิงก์รีวิวพาลูกค้าเข้าหน้ารีวิวโดยไม่ต้อง login — ผู้ถือลิงก์จึงได้ token ของร้าน
/// ถ้า token นั้นใช้ได้ทั้งระบบ ใครได้ลิงก์ไปก็สั่งซื้อและดูข้อมูลของร้านได้ (และถ้าร้านนั้นเป็น
/// บัญชีผู้ดูแล ก็ได้สิทธิ์ผู้ดูแลไปด้วย) token ชนิดนี้จึงใช้ได้เฉพาะเส้นทางที่หน้ารีวิวเรียก
export const REVIEW_SCOPE = 'review';

/// เส้นทางที่ token ขอบเขต review ใช้ได้ (หลัง global prefix `/api`) — หน้ารีวิว (BatchReview) เรียกเท่านี้
const REVIEW_SCOPE_ROUTES: RegExp[] = [
  // ให้คะแนนและแบบสอบถาม (ไม่รวม /ecom/admin/rating)
  /^\/api\/ecom\/rating(\/|$)/,
  /^\/api\/ecom\/review-request\//,
  // session ของหน้ารีวิวเอง — ไม่รวมดู/ปิด session อื่นของร้าน
  /^\/api\/ecom\/session\/(create|logout)$/,
  /^\/api\/ecom\/session\/(validate|active|update-activity)\/[^/]+$/,
];

/// ลิงก์จาก LINE ออก token ขอบเขตไหน — `full` คืนพฤติกรรมเดิม (token เต็มของร้าน)
export function lineLinkLoginScope(): typeof REVIEW_SCOPE | null {
  return (process.env.LINE_LINK_LOGIN_SCOPE ?? REVIEW_SCOPE)
    .trim()
    .toLowerCase() === 'full'
    ? null
    : REVIEW_SCOPE;
}

export function isAllowedForReviewScope(url: string | undefined): boolean {
  return isAllowedFor(REVIEW_SCOPE_ROUTES, url);
}

/// ECWC-706: token ที่ได้จากการเข้าสู่ระบบด้วยรหัสผ่านชั่วคราว — ใช้ได้แค่ตั้งรหัสผ่านใหม่
/// (ไม่ให้สั่งซื้อหรือดูข้อมูลร้านจนกว่าจะตั้งรหัสของตัวเอง)
export const PASSWORD_CHANGE_SCOPE = 'password_change';

const PASSWORD_CHANGE_SCOPE_ROUTES: RegExp[] = [
  /^\/api\/ecom\/password-reset\/set-password$/,
  /^\/api\/ecom\/session\/(create|logout)$/,
  /^\/api\/ecom\/session\/(validate|active|update-activity)\/[^/]+$/,
];

export function isAllowedForPasswordChangeScope(
  url: string | undefined,
): boolean {
  return isAllowedFor(PASSWORD_CHANGE_SCOPE_ROUTES, url);
}

/// ขอบเขตที่ต่ออายุผ่าน refresh token แล้วต้องคงขอบเขตเดิม
export function carriedScope(
  scope: unknown,
): typeof REVIEW_SCOPE | typeof PASSWORD_CHANGE_SCOPE | null {
  return scope === REVIEW_SCOPE || scope === PASSWORD_CHANGE_SCOPE
    ? scope
    : null;
}

function isAllowedFor(routes: RegExp[], url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0].replace(/\/+$/, '');
  // เส้นทางที่ต้องแปลความก่อน (.., // หรือตัวอักษรที่เข้ารหัสมา) ไม่รับ — ไม่เดาว่า router จะตีความอย่างไร
  if (/\.\.|\/\/|\\|%2e|%2f|%5c/i.test(path)) return false;
  return routes.some((route) => route.test(path));
}
