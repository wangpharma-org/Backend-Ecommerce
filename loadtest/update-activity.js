// Load test: PUT /ecom/session/update-activity/:session_token
// รัน:  k6 run loadtest/update-activity.js --summary-export=loadtest/result-before.json
// ปรับ rate/duration:  k6 run -e RATE=200 -e DURATION=5m loadtest/update-activity.js
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const tokens = new SharedArray('tokens', function () {
  return JSON.parse(open('./seed-tokens.json'));
});
const JWT = open('./seed-jwt.txt').trim();
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    update_activity: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE) || 4, 
      timeUnit: '3s',
      duration: __ENV.DURATION || '3m',
      preAllocatedVUs: 25,
      maxVUs: 1000,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const t = tokens[Math.floor(Math.random() * tokens.length)];
  const res = http.put(
    `${BASE_URL}/api/ecom/session/update-activity/${t.session_token}`,
    null,
    {
      headers: { Authorization: `Bearer ${JWT}` },
      timeout: '30s',
    },
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
