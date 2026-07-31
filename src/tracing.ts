import 'dotenv/config'; // ต้องโหลดก่อน Sentry.init() ไม่งั้น process.env.SENTRY_DSN จะยัง undefined (nest/config ยังโหลด .env ไม่ทันตอน import module นี้)
import * as Sentry from '@sentry/node';
import { eventLoopBlockIntegration } from '@sentry/node-native';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

// Event Loop Block Detection: https://docs.sentry.io/platforms/javascript/guides/node/configuration/event-loop-block/
// tracesSampleRate: 0 เพราะ tracing ทำผ่าน OpenTelemetry NodeSDK ด้านล่างอยู่แล้ว ไม่ต้องการให้ Sentry สร้าง trace ซ้ำ
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  tracesSampleRate: 0,
  debug: true, // ชั่วคราว — เอาไว้ debug event-loop-block ทดสอบ ลบออกทีหลัง
  integrations: [
    eventLoopBlockIntegration({
      threshold: Number(process.env.SENTRY_EVENT_LOOP_BLOCK_THRESHOLD_MS ?? 1000),
      maxEventsPerHour: Number(
        process.env.SENTRY_EVENT_LOOP_BLOCK_MAX_PER_HOUR ?? 10,
      ),
    }),
  ],
});

const traceExporter = new OTLPTraceExporter({
  url:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://157.245.202.242:4318/v1/traces',
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME ?? 'ecommerce-backend',
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // ปิด fs เพราะ noisy มาก
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});
