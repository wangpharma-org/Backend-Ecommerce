export interface HttpRequestLogInput {
  timestamp: Date;
  durationMs: number;
  method: string;
  route: string;
  user?: unknown;
  body?: unknown;
  statusCode: number;
}

interface Actor {
  memCode: string;
  username: string;
}

export interface HttpRequestLog {
  event: 'http_request';
  timestamp: string;
  durationMs: number;
  method: string;
  route: string;
  actor: Actor | null;
  requestBody: Record<string, unknown> | undefined;
  statusCode: number;
  success: boolean;
}

const SENSITIVE_KEY =
  /^(?:password|access_?token|refresh_?token|authorization|cookie|secret|address|phone|email|lineaccess(token)?|mem_address)$/i;
const IDENTITY_KEY = /^(?:mem_code|username)$/i;
const LOGGABLE_BODY_KEY = new Set([
  'amount',
  'cartVersion',
  'clientVersion',
  'company_day_source',
  'freebies',
  'gift_id',
  'product_code',
  'pro_code',
  'pro_unit',
  'promo_id',
  'promo_name',
  'quantity',
  'qty',
  'search_query',
  'source',
  'tier',
  'type',
]);
const LOGIN_ROUTE = '/api/ecom/login';
const MAX_BODY_DEPTH = 4;
const MAX_BODY_KEYS = 25;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function sanitizeBody(
  value: unknown,
  depth = 0,
): Record<string, unknown> | undefined {
  if (!isRecord(value) || depth >= MAX_BODY_DEPTH) return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value).slice(0, MAX_BODY_KEYS)) {
    if (
      SENSITIVE_KEY.test(key) ||
      IDENTITY_KEY.test(key) ||
      !LOGGABLE_BODY_KEY.has(key)
    ) {
      continue;
    }

    if (isUnknownArray(child)) {
      result[key] = child
        .slice(0, MAX_BODY_KEYS)
        .map((item) => (isRecord(item) ? sanitizeBody(item, depth + 1) : item));
      continue;
    }

    if (isRecord(child)) {
      const sanitizedChild = sanitizeBody(child, depth + 1);
      if (sanitizedChild !== undefined) result[key] = sanitizedChild;
      continue;
    }

    result[key] = child;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function getActor(user: unknown): Actor | null {
  if (!isRecord(user)) return null;
  const memCode = user.mem_code;
  const username = user.username;
  if (typeof memCode !== 'string' || typeof username !== 'string') return null;
  return { memCode, username };
}

export function buildHttpRequestLog(
  input: HttpRequestLogInput,
): HttpRequestLog {
  return {
    event: 'http_request',
    timestamp: input.timestamp.toISOString(),
    durationMs: input.durationMs,
    method: input.method,
    route: input.route,
    actor: getActor(input.user),
    requestBody:
      input.route === LOGIN_ROUTE ? undefined : sanitizeBody(input.body),
    statusCode: input.statusCode,
    success: input.statusCode >= 200 && input.statusCode < 300,
  };
}
