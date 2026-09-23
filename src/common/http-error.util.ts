import {
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

/**
 * ใช้ใน catch แทน `throw new Error('...')` (ECWC-527)
 *
 * - HttpException (404/409/400 ...) ถูกโยนต่อตามเดิม ไม่ถูกกลบเป็น 500
 * - error อื่นถูก log พร้อม stack แล้วโยน 500 ที่มีข้อความบอกจุดเกิดเหตุ และเก็บ cause ไว้
 *
 * ก่อนหน้านี้ทุกอย่างกลายเป็น 500 ข้อความเดียวกัน ทำให้แยกสาเหตุจาก response ไม่ได้เลย
 */
export function rethrowAsHttp(
  error: unknown,
  logger: Logger,
  context: string,
): never {
  if (error instanceof HttpException) throw error;
  const cause = error instanceof Error ? error : new Error(String(error));
  logger.error(`${context}: ${cause.message}`, cause.stack);
  throw new InternalServerErrorException(context, { cause });
}
