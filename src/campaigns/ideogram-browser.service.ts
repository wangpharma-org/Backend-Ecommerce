import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import puppeteerBase from 'puppeteer';
import type { PuppeteerNode } from 'puppeteer';
import { Browser, Page } from 'puppeteer';

// puppeteer-extra-plugin-stealth uses CJS module.exports without .default
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
puppeteer.use(require('puppeteer-extra-plugin-stealth')());

interface UploadJsonResult {
  id: string;
}

interface IdeogramResultItem {
  request_id: string;
  responses: Array<{ response_id: string }>;
}

interface IdeogramAllResultsJson {
  results: IdeogramResultItem[];
}

export interface GeneratePosterResult {
  request_id: string;
  user_id?: string;
  caption?: string;
}

export interface GetResultsFound {
  response_id: string;
  url: string;
}

export interface GetResultsNotFound {
  message: string;
  requestId: string;
}

@Injectable()
export class IdeogramBrowserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdeogramBrowserService.name);
  private browser: Browser | undefined;
  private readonly accessToken = process.env.ACCESS_TOKEN_IDEOGRAM ?? '';
  private readonly userId = process.env.USERID_IDEOGRAM ?? '';
  private readonly sessionCookie = process.env.SESSION_COOKIE_IDEOGRAM ?? '';
  private readonly xIdeoOrg = process.env.XIDEO_ORG_IDEOGRAM ?? '';
  private readonly handle = process.env.HANDLE_IDEOGRAM ?? '';

  async onModuleInit(): Promise<void> {
    const isLinux = process.platform === 'linux';
    const windowsChromePath =
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const executablePath =
      process.env.CHROME_EXECUTABLE_PATH ??
      (!isLinux ? windowsChromePath : undefined);

    this.browser = await (puppeteer as unknown as PuppeteerNode).launch({
      headless: true,
      executablePath,
      args: isLinux
        ? [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ]
        : [],
    });
    this.logger.log('IdeogramBrowserService: browser initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Open a fresh page, navigate to ideogram.ai (passes CF challenge), set cookies, run fn
  private async withPage<T>(
    sessionCookies: string,
    fn: (page: Page) => Promise<T>,
  ): Promise<T> {
    const page = await this.browser?.newPage();
    if (!page) {
      throw new Error('Browser not initialized');
    }
    try {
      await page.goto('https://ideogram.ai', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      if (sessionCookies) {
        const cookies = sessionCookies.split(';').map((part) => {
          const eqIdx = part.indexOf('=');
          return {
            name: part.slice(0, eqIdx).trim(),
            value: part.slice(eqIdx + 1).trim(),
            domain: '.ideogram.ai',
            path: '/',
          };
        });
        await page.setCookie(...cookies);
      }
      return await fn(page);
    } finally {
      await page.close();
    }
  }

  // Upload one image buffer, return asset ID
  async uploadImage(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    sessionCookies: string,
  ): Promise<string> {
    return this.withPage(sessionCookies, async (page) => {
      const base64Data = buffer.toString('base64');
      const id: string = await page.evaluate(
        async ({
          base64Data,
          mimeType,
          filename,
          accessToken,
        }: {
          base64Data: string;
          mimeType: string;
          filename: string;
          accessToken: string;
        }): Promise<string> => {
          const byteChars = atob(base64Data);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++)
            byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: mimeType });
          const formData = new FormData();
          formData.append('file', blob, filename);
          formData.append('preserve_alpha', 'true');
          formData.append('upload_type', 'UPLOAD');
          const res = await fetch('https://ideogram.ai/api/uploads/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
          const data = (await res.json()) as UploadJsonResult;
          return data.id;
        },
        { base64Data, mimeType, filename, accessToken: this.accessToken },
      );
      return id;
    });
  }

  // Convert ASPECT_9_16 → "9:16" format expected by Ideogram internal API
  private toRatioString(aspectRatio: string): string {
    if (aspectRatio.includes(':')) return aspectRatio;
    const map: Record<string, string> = {
      ASPECT_9_16: '9:16',
      ASPECT_3_4: '3:4',
      ASPECT_1_1: '1:1',
      ASPECT_4_3: '4:3',
      ASPECT_16_9: '16:9',
    };
    return map[aspectRatio] ?? '1:1';
  }

  // Generate poster after images are uploaded
  async generatePosterRequest(
    prompt: string,
    aspectRatio: string,
    imgID: string[],
    sessionCookies: string,
  ): Promise<GeneratePosterResult> {
    const userId = this.userId;
    const ratioString = this.toRatioString(aspectRatio);
    const xIdeoOrg = this.xIdeoOrg;

    return this.withPage(sessionCookies, async (page) => {
      return page.evaluate(
        async ({
          prompt,
          ratioString,
          userId,
          imageIds,
          xIdeoOrg,
        }: {
          prompt: string;
          ratioString: string;
          userId: string;
          imageIds: string[];
          xIdeoOrg: string;
        }): Promise<GeneratePosterResult> => {
          const body: Record<string, unknown> = {
            aspect_ratio: ratioString,
            prompt,
            user_id: userId,
            private: false,
            model_uri: 'model/AUTO/version/0',
            use_autoprompt_option: 'OFF',
            num_images: 1,
          };

          // Only include image references when there are uploaded assets
          if (imageIds.length > 0) {
            body.edit_reference_parents_v2 = [
              {
                asset_identifiers: imageIds.map((id: string) => ({
                  asset_id: id,
                  asset_type: 'UPLOAD',
                })),
              },
            ];
          }

          const res = await fetch('https://ideogram.ai/api/images/sample', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Origin: 'https://ideogram.ai',
              Referer: 'https://ideogram.ai/t/explore',
              'x-ideo-org': xIdeoOrg,
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Generate failed: ${res.status} ${errText}`);
          }
          return (await res.json()) as GeneratePosterResult;
        },
        { prompt, ratioString, userId, imageIds: imgID, xIdeoOrg },
      );
    });
  }

  // Poll for results and return image data
  async getAllResults(
    requestId: string,
    sessionCookies?: string,
  ): Promise<GetResultsFound | GetResultsNotFound> {
    const cookie = sessionCookies ?? this.sessionCookie;
    const accessToken = this.accessToken;
    const handle = this.handle;

    return this.withPage(cookie, async (page) => {
      const allResults = await page.evaluate(
        async ({
          accessToken,
          cookie,
          handle,
        }: {
          accessToken: string;
          cookie: string;
          handle: string;
        }): Promise<IdeogramAllResultsJson> => {
          const res = await fetch(
            `https://ideogram.ai/api/g/u/c?user_id=${handle}&filters=everything&all_privacy=true`,
            {
              credentials: 'include',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Cookie: cookie,
              },
            },
          );
          if (!res.ok) throw new Error(`GetAllResults failed: ${res.status}`);
          return (await res.json()) as IdeogramAllResultsJson;
        },
        { accessToken, cookie, handle },
      );

      const responseId: string | undefined = allResults?.results?.find(
        (r) => r.request_id === requestId,
      )?.responses?.[0]?.response_id;

      if (!responseId) return { message: 'response_id not found', requestId };

      return {
        response_id: responseId,
        url: `https://ideogram.ai/assets/image/balanced/response/${responseId}`,
      };
    });
  }
}
