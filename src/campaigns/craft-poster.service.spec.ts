import axios from 'axios';
import {
  CraftPosterService,
  type PosterImageItem,
} from './craft-poster.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * CraftPosterService unit tests
 * The poster page only sends its form inside the Ideogram prompt, so the prompt below is built
 * the same way promo-sheet-pro's PosterConfigPage.tsx buildPrompt() builds it.
 */
const buildPrompt = (opts: {
  promotionName: string;
  themeDesc: string;
  dateRange?: string;
  minPurchase: number;
  purchaseNames?: string[];
  gifts?: { name: string; quantity: number; unit: string }[];
}): string => {
  const giftLines = (opts.gifts ?? [])
    .map((g, i) => `${i + 1}. ${g.name} ${g.quantity} ${g.unit}`)
    .join(', ');
  let prompt = `สร้างโปสเตอร์โปรโมชั่นสไตล์โมเดิร์น ดีไซน์สดใส มีความเป็นมืออาชีพสูง\n`;
  prompt += `ใช้${opts.themeDesc} พื้นหลัง gradient เรียบหรู มี geometric shapes หรือ abstract elements ประกอบเพื่อความ modern\n`;
  prompt += `ตัวหนังสือต้องชัดเจน อ่านง่าย จัดวางสวยงาม ใช้ font หนา โดดเด่น\n\n`;
  prompt += `ข้อความหลัก (แสดงขนาดใหญ่สุดด้านบน): "${opts.promotionName} PROMOTION"\n`;
  if (opts.dateRange) prompt += `ระยะเวลาโปรโมชั่น: ${opts.dateRange}\n`;
  prompt += `เงื่อนไข: "ซื้อสินค้ากลุ่ม ${opts.promotionName} ครบ ${opts.minPurchase.toLocaleString('th-TH')} บาท" — ตัวเลขจำนวนเงินต้องใหญ่และโดดเด่นมาก\n`;
  if (opts.purchaseNames?.length) {
    prompt += `สินค้าที่ซื้อ: ${opts.purchaseNames.join(', ')} — แสดงภาพสินค้าเหล่านี้ในพื้นที่หลักของโปสเตอร์ให้โดดเด่น\n`;
  }
  if (opts.gifts?.length) {
    prompt += `\nส่วนของแถม (FREE GIFT): แสดงแบนเนอร์ "ของแถม" หรือ "FREE GIFT" ชัดเจน\n`;
    prompt += `รายการของแถม: ${giftLines}\n`;
  }
  return prompt;
};

const COOL = 'โทนสีน้ำเงิน-ฟ้า-ฟ้าอ่อน gradient เรียบสะอาด น่าเชื่อถือ';

describe('CraftPosterService', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = {
      ...env,
      POSTER_ENGINE: 'craft',
      CRAFT_RENDER_URL: 'http://render.internal:8080/',
    };
    mockedAxios.post.mockReset();
  });
  afterAll(() => {
    process.env = env;
  });

  describe('parsePrompt', () => {
    it('reads the name, dates, amount and theme back out of the page prompt', () => {
      const parsed = CraftPosterService.parsePrompt(
        buildPrompt({
          promotionName: 'แฟงโก้',
          themeDesc: COOL,
          dateRange: '1 ต.ค. 2569 – 31 ต.ค. 2569',
          minPurchase: 12500,
        }),
      );
      expect(parsed).toEqual({
        promotionName: 'แฟงโก้',
        dateRange: '1 ต.ค. 2569 – 31 ต.ค. 2569',
        minPurchase: 12500,
        theme: 'cool',
        giftLines: [],
      });
    });

    it('keeps gift names that contain commas and numbers whole', () => {
      const parsed = CraftPosterService.parsePrompt(
        buildPrompt({
          promotionName: 'X',
          themeDesc: COOL,
          minPurchase: 1000,
          gifts: [
            { name: 'วิตามินซี 1,000 มก.', quantity: 2, unit: 'ขวด' },
            { name: 'กระเป๋าผ้า, สีเขียว', quantity: 1, unit: 'ใบ' },
          ],
        }),
      );
      expect(parsed.giftLines).toEqual([
        'วิตามินซี 1,000 มก. 2 ขวด',
        'กระเป๋าผ้า, สีเขียว 1 ใบ',
      ]);
    });

    it('leaves out what the prompt does not say (no dates, zero amount, unknown theme)', () => {
      const parsed = CraftPosterService.parsePrompt(
        buildPrompt({
          promotionName: 'Y',
          themeDesc: 'สีชมพู',
          minPurchase: 0,
        }),
      );
      expect(parsed.dateRange).toBeUndefined();
      expect(parsed.minPurchase).toBeUndefined();
      expect(parsed.theme).toBeUndefined();
    });
  });

  describe('toRequest', () => {
    const items: PosterImageItem[] = [
      {
        url: 'https://www.wangpharma.com/g1.jpg',
        name: 'กลูโคซาผง',
        quantity: 1,
        unit: 'กล่อง',
        type: 'gift',
      },
      {
        url: 'https://www.wangpharma.com/p1.jpg',
        name: 'แฟงโก้ ครีม 5ก.',
        quantity: 0,
        unit: '',
        type: 'purchase',
      },
      {
        url: 'https://www.wangpharma.com/ref.jpg',
        name: 'Style Reference',
        quantity: 0,
        unit: '',
        type: 'reference',
      },
    ];

    it('splits purchases from gifts, drops style references, and keeps gifts that have no picture', () => {
      const prompt = buildPrompt({
        promotionName: 'แฟงโก้',
        themeDesc: COOL,
        minPurchase: 3000,
        gifts: [
          { name: 'กลูโคซาผง', quantity: 1, unit: 'กล่อง' },
          { name: 'กระเป๋าผ้า', quantity: 2, unit: 'ใบ' },
        ],
      });
      expect(CraftPosterService.toRequest(prompt, '16:9', items)).toEqual({
        promotion_name: 'แฟงโก้',
        date_range: undefined,
        min_purchase: 3000,
        theme: 'cool',
        aspect_ratio: '16:9',
        purchases: [
          { url: 'https://www.wangpharma.com/p1.jpg', name: 'แฟงโก้ ครีม 5ก.' },
        ],
        gifts: [
          {
            url: 'https://www.wangpharma.com/g1.jpg',
            name: 'กลูโคซาผง',
            quantity: 1,
            unit: 'กล่อง',
          },
          { name: 'กระเป๋าผ้า 2 ใบ' },
        ],
      });
    });
  });

  describe('generate and poll', () => {
    it('asks the render service to draw and keep the poster, and polls back its URL', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { id: '0123456789abcdef0123456789abcdef' },
      });
      const service = new CraftPosterService();
      const reply = await service.generatePosterRequest(
        buildPrompt({ promotionName: 'Z', themeDesc: COOL, minPurchase: 500 }),
        '1:1',
        [],
      );

      const [url, body] = mockedAxios.post.mock.calls[0];
      expect(url).toBe('http://render.internal:8080/poster?store=1');
      expect(body).toMatchObject({
        promotion_name: 'Z',
        aspect_ratio: '1:1',
        min_purchase: 500,
      });
      expect(reply.request_id).toBe('craft-0123456789abcdef0123456789abcdef');
      expect(CraftPosterService.isCraftRequest(reply.request_id)).toBe(true);
      expect(service.getResult(reply.request_id)).toEqual({
        url: 'http://render.internal:8080/poster/0123456789abcdef0123456789abcdef.png',
      });
    });

    it('uses the public address for the image when one is set', () => {
      process.env.CRAFT_RENDER_PUBLIC_URL = 'https://posters.example.com';
      expect(
        new CraftPosterService().getResult(
          'craft-0123456789abcdef0123456789abcdef',
        ),
      ).toEqual({
        url: 'https://posters.example.com/poster/0123456789abcdef0123456789abcdef.png',
      });
    });

    it('answers "not found" for a malformed id instead of building a URL from it', () => {
      expect(
        new CraftPosterService().getResult('craft-../../etc/passwd'),
      ).toEqual({
        message: 'response_id not found',
        requestId: 'craft-../../etc/passwd',
      });
    });

    it('fails clearly when the render service address is missing', async () => {
      delete process.env.CRAFT_RENDER_URL;
      await expect(
        new CraftPosterService().generatePosterRequest('', '1:1', []),
      ).rejects.toThrow('CRAFT_RENDER_URL');
    });
  });

  describe('isCraftPosterUrl (what the image proxy may fetch)', () => {
    it('accepts only finished posters on the render service', () => {
      expect(
        CraftPosterService.isCraftPosterUrl(
          'http://render.internal:8080/poster/0123456789abcdef0123456789abcdef.png',
        ),
      ).toBe(true);
      expect(
        CraftPosterService.isCraftPosterUrl(
          'http://render.internal:8080/health',
        ),
      ).toBe(false);
      expect(
        CraftPosterService.isCraftPosterUrl(
          'http://render.internal:8080/poster/../secret.png',
        ),
      ).toBe(false);
      expect(
        CraftPosterService.isCraftPosterUrl(
          'https://evil.example.com/poster/0123456789abcdef0123456789abcdef.png',
        ),
      ).toBe(false);
    });
  });
});
