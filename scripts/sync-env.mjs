#!/usr/bin/env node
/**
 * sync-env.mjs — generate .env from Google Secret Manager (โหมด B/C)
 *
 * .env เป็นไฟล์ GENERATED — ห้ามแก้มือ ห้าม commit
 * เปลี่ยนค่า = เปลี่ยนที่ Secret Manager แล้วรัน sync ใหม่ (หรือ deploy ใหม่)
 *
 * วิธีใช้: copy ไฟล์นี้เข้า repo ของระบบ (เช่น scripts/sync-env.mjs)
 * แล้วแก้ 4 ค่าใน CONFIG ด้านล่างให้ตรงระบบตัวเอง จากนั้นเรียกใน deploy step:
 *   node scripts/sync-env.mjs              # sync .env
 *   node scripts/sync-env.mjs --verify-only # เทียบเฉยๆ ไม่เขียนไฟล์ (exit 2 ถ้าต่าง)
 *
 * Auth: ใช้ credentials ของ gcloud CLI ในเครื่อง/CI
 *   - เครื่อง dev: gcloud auth login
 *   - เครื่อง server (โหมด B): gcloud auth activate-service-account --key-file sa.json
 *   - GitHub Actions (โหมด C): google-github-actions/auth ผ่าน WIF — ไม่มี key file
 *
 * พฤติกรรมสำคัญ (ลอกจาก wangpharma-hrsoft ที่รันจริง — HS-675/695):
 *   - ขาด key ที่ REQUIRED → BLOCK ทันที ไม่เขียนไฟล์ (กัน incident แบบ HS-575:
 *     deploy ด้วย env ว่างทับ production)
 *   - Secret Manager ล่ม/ออฟไลน์ → fallback ใช้ .env เดิมในเครื่อง ถ้า validate ผ่าน
 *   - เครื่องใหม่ที่ไม่มีทั้งคู่ → fail — ถูกต้องแล้ว
 */
import { readFileSync, writeFileSync, renameSync } from 'fs';
import { execFile } from 'child_process';

// ── CONFIG — แก้ 4 ค่านี้ต่อระบบ ────────────────────────────────────────────
const PROJECT = 'hronline-59dc8';        // GCP project ที่เก็บ secrets
const PREFIX = 'ecommerce__';            // prefix ของระบบนี้ (ดู naming ใน playbook)
const KEYS = [                           // env var ทุกตัวที่ระบบใช้ (secret จริงชื่อ PREFIX+KEY) — ตรงกับ Joi validation schema ของแอป
  'ACCESS_TOKEN_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_PORT',
  'DB_USERNAME',
  'DO_SPACES_BUCKET',
  'DO_SPACES_KEY',
  'DO_SPACES_SECRET',
  'KAFKA_BROKERS',
  'MAILGUN_API_KEY',
  'MAILGUN_DOMAIN',
  'SLACK_WEBHOOK_URL',
  'SYNCHRONIZE',
  'PORT',
  'KAFKA_GROUP_ID',
  'EMAIL_USER',
  'EMAIL_PASS',
  'OLD_WEBSITE_URL',
  'CARTRACK_AUTH_TOKEN',
  'CARTRACK_URL',
  'ELASTICSEARCH_URL',
  'ELASTICSEARCH_USERNAME',
  'ELASTICSEARCH_PASSWORD',
  'ACCESS_TOKEN_IDEOGRAM',
  'USERID_IDEOGRAM',
  'XIDEO_ORG_IDEOGRAM',
  'HANDLE_IDEOGRAM',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_SERVICE_NAME',
  // PRODUCT_SERVICE_URL, WEBHOOK_SECRET: optional ในแอป + ยังไม่มีค่าจริง — เพิ่มกลับเมื่อมีค่าให้ migrate
];
const REQUIRED = [                       // ตัวที่ขาดแล้วระบบล่ม — ขาด = block deploy (= Joi .required() ในแอป)
  'ACCESS_TOKEN_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_PORT',
  'DB_USERNAME',
  'DO_SPACES_BUCKET',
  'DO_SPACES_KEY',
  'DO_SPACES_SECRET',
  'KAFKA_BROKERS',
  'SLACK_WEBHOOK_URL',
];
const ENV_PATH = process.env.ENV_PATH || '.env';
// ────────────────────────────────────────────────────────────────────────────

const verifyOnly = process.argv.includes('--verify-only');

function fail(reason) {
  console.error('');
  console.error('❌ BLOCKED: deploy without valid runtime config');
  console.error(`   ${reason}`);
  console.error('   Fix Secret Manager access (or restore local .env), then retry.');
  console.error('');
  process.exit(1);
}

function parseEnv(raw) {
  const map = new Map();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    map.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim());
  }
  return map;
}

function validate(map, source) {
  const missing = REQUIRED.filter((k) => !map.get(k));
  if (missing.length) fail(`${source}: missing or empty required keys: ${missing.join(', ')}`);
}

function accessSecret(key) {
  return new Promise((resolve) => {
    execFile(
      'gcloud',
      ['secrets', 'versions', 'access', 'latest',
        '--secret', PREFIX + key, '--project', PROJECT],
      { encoding: 'utf8', timeout: 60_000, shell: process.platform === 'win32' },
      (err, stdout) => {
        if (err) return resolve({ key, error: String(err.message).split('\n')[0] });
        const value = stdout.replace(/\s+$/, '');
        if (!value) return resolve({ key, error: 'empty value' });
        if (value.includes('\n')) return resolve({ key, error: 'multi-line value — เก็บเป็น base64 แทน (ดู playbook ข้อ 06)' });
        resolve({ key, value });
      },
    );
  });
}

const results = await Promise.all(KEYS.map(accessSecret));
const errors = results.filter((r) => r.error);

if (errors.length === 0) {
  const fetched = new Map(results.map((r) => [r.key, r.value]));
  validate(fetched, 'Secret Manager');

  const body =
    '# GENERATED from Secret Manager by sync-env.mjs — do NOT hand-edit\n' +
    `# rotate values in Secret Manager (${PROJECT}, prefix ${PREFIX}) then re-run sync\n` +
    results.map((r) => `${r.key}=${r.value}`).join('\n') + '\n';

  let current = null;
  try { current = readFileSync(ENV_PATH, 'utf8'); } catch { /* fresh checkout */ }
  const changed =
    current === null ||
    JSON.stringify([...parseEnv(current)].sort()) !== JSON.stringify([...fetched].sort());

  if (verifyOnly) {
    console.log(changed
      ? `⚠️  ${ENV_PATH} differs from Secret Manager (would be rewritten)`
      : `✅ ${ENV_PATH} matches Secret Manager`);
    process.exit(changed ? 2 : 0);
  }

  if (changed) {
    const tmp = `${ENV_PATH}.tmp`;
    writeFileSync(tmp, body, { mode: 0o600 });
    renameSync(tmp, ENV_PATH);
    console.log(`✅ ${ENV_PATH} synced from Secret Manager (${results.length} keys)`);
  } else {
    console.log(`✅ ${ENV_PATH} in sync with Secret Manager (${results.length} keys)`);
  }
  process.exit(0);
}

// ── Fallback: Secret Manager unreachable → keep + validate local .env ──────
console.warn(`⚠️  Secret Manager fetch failed for ${errors.length}/${KEYS.length} keys:`);
for (const e of errors.slice(0, 3)) console.warn(`   ${e.key}: ${e.error}`);
console.warn(`   Falling back to existing local ${ENV_PATH}`);

let raw;
try {
  raw = readFileSync(ENV_PATH, 'utf8');
} catch {
  fail(`Secret Manager unreachable AND no local file: ${ENV_PATH}`);
}
const local = parseEnv(raw);
if (local.size === 0) fail(`Secret Manager unreachable AND local file is empty: ${ENV_PATH}`);
validate(local, `local ${ENV_PATH}`);
console.log(`✅ local ${ENV_PATH} OK (${local.size} keys) — NOT synced this run`);
