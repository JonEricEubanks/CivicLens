/**
 * End-to-end API tests for CivicLens server
 * Spins up the server and tests HTTP endpoints, security headers, and API contracts
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, '..', 'server.js');

let serverProcess;
let BASE_URL;
const TEST_PORT = 17072; // high port to avoid conflicts

// ── Helper: simple fetch with timeout ────────────────────────────────
async function api(path, opts = {}) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function json(path, opts = {}) {
  const res = await api(path, opts);
  const body = await res.json();
  return { res, body };
}

// ── Server lifecycle ─────────────────────────────────────────────────
before(async () => {
  BASE_URL = `http://localhost:${TEST_PORT}`;

  serverProcess = fork(SERVER_PATH, [], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      MCP_PORT: String(TEST_PORT + 1),
      NODE_ENV: 'test',
      // Use default dev STAFF_PIN (1234)
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  // Wait for server to be ready (poll health endpoint)
  const maxWait = 15000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Server did not start within 15s');
});

after(() => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    // Force kill after 3s if still alive
    setTimeout(() => {
      try { serverProcess.kill('SIGKILL'); } catch { /* already dead */ }
    }, 3000).unref();
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  1.  Health endpoint
// ═══════════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const { res, body } = await json('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'ok');
  });

  it('reports tool count and data counts', async () => {
    const { body } = await json('/health');
    assert.ok(typeof body.tools === 'number' && body.tools > 0, 'Should list tool count');
    assert.ok(body.data, 'Should include data counts');
    assert.ok(typeof body.data.work_orders === 'number', 'Should have work_orders count');
    assert.ok(typeof body.data.potholes === 'number', 'Should have potholes count');
    assert.ok(typeof body.data.schools === 'number', 'Should have schools count');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  2.  Security headers
// ═══════════════════════════════════════════════════════════════════════
describe('Security headers', () => {
  it('sets XSS protection headers on API responses', async () => {
    const res = await api('/health');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('x-xss-protection'), '1; mode=block');
    assert.ok(res.headers.get('referrer-policy'), 'Should set Referrer-Policy');
  });

  it('sets Content-Security-Policy', async () => {
    const res = await api('/health');
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'Should have CSP header');
    assert.ok(csp.includes("default-src 'self'"), 'CSP should restrict default-src');
  });

  it('sets Permissions-Policy', async () => {
    const res = await api('/health');
    const pp = res.headers.get('permissions-policy');
    assert.ok(pp, 'Should have Permissions-Policy');
    assert.ok(pp.includes('camera=()'), 'Should restrict camera');
  });

  it('handles CORS preflight', async () => {
    const res = await api('/api/chat', {
      method: 'OPTIONS',
      headers: { 'Origin': `http://localhost:${TEST_PORT}` },
    });
    assert.strictEqual(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-methods')?.includes('POST'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  3.  Static file serving
// ═══════════════════════════════════════════════════════════════════════
describe('Static file serving', () => {
  it('serves index.html on /', async () => {
    const res = await api('/');
    assert.strictEqual(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct?.includes('text/html'), 'Should serve HTML');
    const body = await res.text();
    assert.ok(body.includes('CivicLens'), 'Should contain CivicLens');
  });

  it('serves JavaScript files with correct MIME type', async () => {
    const res = await api('/app.js');
    assert.strictEqual(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct?.includes('javascript'), 'Should serve JS with correct MIME');
  });

  it('serves CSS files with correct MIME type', async () => {
    const res = await api('/styles.css');
    assert.strictEqual(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct?.includes('css'), 'Should serve CSS with correct MIME');
  });

  it('returns 404 for non-existent files', async () => {
    const res = await api('/nonexistent-file-xyz.js');
    assert.strictEqual(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  4.  Dashboard API
// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/dashboard', () => {
  it('returns dashboard data with query', async () => {
    const { res, body } = await json('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Show me all potholes' }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(body.kpis || body.work_orders || body.data, 'Should return dashboard data');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  5.  Service Request API lifecycle
// ═══════════════════════════════════════════════════════════════════════
describe('Service Request API', () => {
  let trackingNumber;

  it('rejects missing required fields', async () => {
    const { res, body } = await json('/api/service-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'pothole' }), // missing description, address
    });
    assert.strictEqual(res.status, 400);
    assert.ok(body.error, 'Should return error message');
  });

  it('rejects invalid JSON body', async () => {
    const res = await api('/api/service-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all',
    });
    assert.strictEqual(res.status, 400);
  });

  it('creates a service request with valid data', async () => {
    const { res, body } = await json('/api/service-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'pothole',
        description: 'Large pothole on Main St near City Hall',
        address: '220 E Deerpath Rd, Lake Forest, IL',
        name: 'Test User',
        zone: 'downtown',
      }),
    });
    assert.strictEqual(res.status, 201);
    assert.ok(body.success || body.request, 'Should indicate success');
    if (body.request) {
      trackingNumber = body.request.tracking_number || body.request.id;
      assert.ok(trackingNumber, 'Should return a tracking number');
    }
  });

  it('looks up service request by tracking number', async () => {
    if (!trackingNumber) return; // skip if create didn't return tracking number
    const { res, body } = await json(`/api/service-request/${trackingNumber}`);
    assert.strictEqual(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  6.  Map Data API
// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/map-data', () => {
  it('returns map data with markers, bounds, and center', async () => {
    const { res, body } = await json('/api/map-data');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(body.markers), 'Should return markers array');
    assert.ok(body.bounds, 'Should return bounds');
    assert.ok(body.center, 'Should return center');
    assert.ok(typeof body.center.lat === 'number', 'Center should have lat');
    assert.ok(typeof body.center.lng === 'number', 'Center should have lng');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  7.  Staff Authentication
// ═══════════════════════════════════════════════════════════════════════
describe('Staff Auth', () => {
  it('rejects invalid PIN', async () => {
    const { res, body } = await json('/api/staff/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '9999' }),
    });
    // Should reject — either 401 or 403
    assert.ok(res.status >= 400, 'Should reject invalid PIN');
  });

  it('accepts correct PIN and returns token', async () => {
    const { res, body } = await json('/api/staff/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(body.token, 'Should return auth token');
    assert.ok(body.token.length >= 32, 'Token should be sufficiently long');
  });

  it('staff dashboard requires auth', async () => {
    const res = await api('/api/staff/dashboard');
    // Without auth header, should be rejected
    assert.ok(res.status >= 400, 'Should reject unauthenticated staff dashboard');
  });

  it('staff dashboard succeeds with valid token', async () => {
    // First get token
    const { body: authBody } = await json('/api/staff/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    // Then use token
    const { res, body } = await json('/api/staff/dashboard', {
      headers: { 'Authorization': `Bearer ${authBody.token}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(body.kpis, 'Should return KPI data');
    assert.ok(typeof body.kpis.sr_total === 'number', 'Should have sr_total');
    assert.ok(typeof body.kpis.wo_total === 'number', 'Should have wo_total');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  8.  Forecast & What-If APIs
// ═══════════════════════════════════════════════════════════════════════
describe('Forecast & What-If', () => {
  it('POST /api/forecast returns forecast data', async () => {
    const { res, body } = await json('/api/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 30 }),
    });
    assert.strictEqual(res.status, 200);
  });

  it('POST /api/whatif returns scenario analysis', async () => {
    const { res, body } = await json('/api/whatif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'delay_all_30_days' }),
    });
    assert.strictEqual(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  9.  404 handling
// ═══════════════════════════════════════════════════════════════════════
describe('Error handling', () => {
  it('returns 404 for unknown API routes', async () => {
    const res = await api('/api/nonexistent');
    assert.strictEqual(res.status, 404);
  });

  it('POST /api/memory/clear returns success', async () => {
    const { res } = await json('/api/memory/clear', { method: 'POST' });
    assert.strictEqual(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10.  Export API
// ═══════════════════════════════════════════════════════════════════════
describe('Export API', () => {
  it('exports work_orders as CSV', async () => {
    const res = await api('/api/export?dataset=work_orders&format=csv');
    assert.strictEqual(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct?.includes('csv') || ct?.includes('text'), 'Should return CSV content type');
    const text = await res.text();
    assert.ok(text.length > 0, 'CSV should not be empty');
  });

  it('exports work_orders as JSON', async () => {
    const { res, body } = await json('/api/export?dataset=work_orders&format=json');
    assert.strictEqual(res.status, 200);
  });
});
