import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { PreorderNotifierService } from './preorder-notifier.service';

/**
 * ล็อค path ของ notification-service: global prefix `api/notifications` + controller `notifications`
 * → `/api/notifications/notifications/dispatch` (พิสูจน์แล้ว 10 ก.ย. 69 — path เดิม `/api/notifications/dispatch` ได้ 404 ทุกครั้ง)
 */
describe('PreorderNotifierService', () => {
  const post = jest.fn();
  const http = { post } as unknown as HttpService;
  let svc: PreorderNotifierService;

  beforeEach(() => {
    post.mockReset();
    process.env.NOTIFICATION_SERVICE_URL = 'http://notify.test';
    svc = new PreorderNotifierService(http);
  });

  it('ยิง dispatch ไปที่ path ที่ notification-service map ไว้จริง พร้อม payload ตาม DTO', async () => {
    post.mockReturnValue(of({ data: { results: [] } }));
    const ok = await svc.send({
      memCode: '0582',
      title: 'หัวข้อ',
      message: 'ข้อความ',
      data: { campaign_id: 1 },
    });
    expect(ok).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe(
      'http://notify.test/api/notifications/notifications/dispatch',
    );
    expect(body).toMatchObject({
      memCode: '0582',
      type: 'preorder',
      title: 'หัวข้อ',
      message: 'ข้อความ',
      channels: ['FCM', 'LINE'],
      data: { campaign_id: 1 },
    });
  });

  it('service ล่ม → คืน false ไม่ throw (การแจ้งเตือนต้องไม่ทำให้ flow หลักล้ม)', async () => {
    post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    await expect(
      svc.send({ memCode: '0582', title: 't', message: 'm' }),
    ).resolves.toBe(false);
  });

  it('sendMany นับเฉพาะที่ส่งสำเร็จ', async () => {
    post
      .mockReturnValueOnce(of({ data: {} }))
      .mockReturnValueOnce(throwError(() => new Error('x')));
    const n = await svc.sendMany([
      { memCode: 'a', title: 't', message: 'm' },
      { memCode: 'b', title: 't', message: 'm' },
    ]);
    expect(n).toBe(1);
  });
});
