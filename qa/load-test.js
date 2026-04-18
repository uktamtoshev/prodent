/**
 * PRODENT — k6 Load Test Script
 *
 * Targets the main public and authenticated endpoints.
 * Run: k6 run --vus 50 --duration 60s qa/load-test.js
 *
 * Prerequisites:
 *   - Backend running at BASE_URL (default http://localhost:8080)
 *   - At least one doctor and clinic seeded in the database
 *   - A test user with known credentials (see TEST_EMAIL/TEST_PASSWORD)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'admin@prodent.uz';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test123!';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');

export const options = {
  stages: [
    { duration: '10s', target: 20 },   // ramp up
    { duration: '30s', target: 50 },   // sustained load
    { duration: '10s', target: 100 },  // spike
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    errors: ['rate<0.05'],              // error rate under 5%
  },
};

// ─── Setup: login once to get token ─────────────────────────

export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }), { headers: { 'Content-Type': 'application/json' } });

  const body = JSON.parse(loginRes.body || '{}');
  return { token: body.access_token || body.token || '' };
}

// ─── Main test scenario ─────────────────────────────────────

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };
  const publicHeaders = { 'Content-Type': 'application/json' };

  // 1. Public: search doctors (heaviest public endpoint)
  const searchRes = http.get(`${BASE_URL}/api/v1/public/doctors/search?page=0&size=20`, {
    headers: publicHeaders,
  });
  check(searchRes, { 'search 200': (r) => r.status === 200 });
  errorRate.add(searchRes.status !== 200);

  sleep(0.5);

  // 2. Public: list clinics
  const clinicsRes = http.get(`${BASE_URL}/api/v1/public/clinics?page=0&size=20`, {
    headers: publicHeaders,
  });
  check(clinicsRes, { 'clinics 200': (r) => r.status === 200 });
  errorRate.add(clinicsRes.status !== 200);

  sleep(0.3);

  // 3. Public: specialties
  const specsRes = http.get(`${BASE_URL}/api/v1/public/specialties`, {
    headers: publicHeaders,
  });
  check(specsRes, { 'specialties 200': (r) => r.status === 200 });
  errorRate.add(specsRes.status !== 200);

  sleep(0.3);

  // 4. Authenticated: my appointments
  if (data.token) {
    const apptRes = http.get(`${BASE_URL}/api/v1/appointments/my?page=0&size=10`, {
      headers,
    });
    check(apptRes, { 'my-appointments 200': (r) => r.status === 200 });
    errorRate.add(apptRes.status !== 200);

    sleep(0.3);

    // 5. Authenticated: notifications
    const notifRes = http.get(`${BASE_URL}/api/v1/notifications?page=0&size=10`, {
      headers,
    });
    check(notifRes, { 'notifications 200': (r) => r.status === 200 });
    errorRate.add(notifRes.status !== 200);
  }

  sleep(0.5);

  // 6. Login stress (most expensive auth endpoint)
  const start = Date.now();
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }), { headers: publicHeaders });
  loginDuration.add(Date.now() - start);
  check(loginRes, { 'login 200': (r) => r.status === 200 });
  errorRate.add(loginRes.status !== 200);

  sleep(1);
}
