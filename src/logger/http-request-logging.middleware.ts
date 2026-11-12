import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { buildHttpRequestLog } from './http-request-log';

type RequestWithUser = Request & { user?: unknown };

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpRequestLoggingMiddleware.name);

  use(request: RequestWithUser, response: Response, next: NextFunction): void {
    const startedAt = new Date();
    const startedMs = Date.now();

    response.once('finish', () => {
      this.logger.log(
        buildHttpRequestLog({
          timestamp: startedAt,
          durationMs: Date.now() - startedMs,
          method: request.method,
          route: this.getRoute(request),
          user: request.user,
          body: request.body,
          statusCode: response.statusCode,
        }),
      );
    });

    next();
  }

  private getRoute(request: Request): string {
    const route = request.route as unknown;
    const routePath =
      typeof route === 'object' &&
      route !== null &&
      'path' in route &&
      typeof route.path === 'string'
        ? route.path
        : undefined;
    if (typeof routePath === 'string') {
      return `${request.baseUrl}${routePath}`.replace(/\/\/{2,}/g, '/');
    }
    return request.path;
  }
}
