import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { fork } from 'node:child_process';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';

try { await import('dotenv/config'); } catch { /* dotenv not needed on Azure — env vars come from App Settings */ }
import { runPipeline, runPipelineStreaming, clearConversationMemory } from './agent/pipeline.js';
import { createDataLayer, forecastDeterioration, costOfInaction } from './lib/data-layer.js';
import { sendConfirmationEmail, sendStatusUpdateEmail } from './lib/email-service.js';
import { initLocalClassifier } from './lib/local-inference.js';
import { isRateLimited, clearRateLimit, markRateLimited } from './agent/rate-limit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || process.env.API_PORT || 7072;

// ─── Security: Rate Limiting (token bucket per IP) ──────────────────
const RATE_LIMIT = { windowMs: 60000, maxRequests: 300 };
const rateBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_LIMIT.windowMs) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT.maxRequests;
}

// Cleanup expired buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT.windowMs;
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.start < cutoff) rateBuckets.delete(ip);
  }
}, 300000).unref();

// ─── Security: Input Sanitization ───────────────────────────────────
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  // Use an allowlist approach: strip all HTML entities and tags
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─── Security: HTML Escape for email/template output  ───────────────
function escHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ─── Security: Staff PIN Authentication ─────────────────────────────
const STAFF_PIN_HASH = createHash('sha256')
  .update(process.env.STAFF_PIN || '1234')
  .digest('hex');
const staffSessions = new Map(); // token → { created, ip }
const STAFF_TOKEN_TTL = 8 * 60 * 60 * 1000; // 8 hours

function verifyStaffPin(pin) {
  const inputHash = createHash('sha256').update(String(pin)).digest('hex');
  const a = Buffer.from(inputHash, 'hex');
  const b = Buffer.from(STAFF_PIN_HASH, 'hex');
  return timingSafeEqual(a, b);
}

function createStaffToken(ip) {
  const token = randomBytes(32).toString('hex');
  staffSessions.set(token, { created: Date.now(), ip });
  return token;
}

function validateStaffToken(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const session = staffSessions.get(token);
  if (!session) return false;
  if (Date.now() - session.created > STAFF_TOKEN_TTL) {
    staffSessions.delete(token);
    return false;
  }
  return true;
}

// Cleanup expired staff sessions every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of staffSessions) {
    if (now - sess.created > STAFF_TOKEN_TTL) staffSessions.delete(token);
  }
}, 30 * 60 * 1000).unref();

// ─── Notification Webhooks ──────────────────────────────────────────
const notificationSubscribers = new Map(); // tracking_number → [callback URLs or SSE connections]

// ─── Data Directory ─────────────────────────────────────────────────
const seedDataDir = join(__dirname, 'mcp-server', 'data');
const persistentDataDir = seedDataDir; // Always use source files directly

async function ensurePersistentData() {
  // No-op: always read from deployed source files
}

// ─── Shared Data Layer (eliminates duplication with mcp-server) ─────
const dataLayer = createDataLayer({
  dataDir: persistentDataDir,
  publicDir: join(__dirname, 'public'),
});
const { TOOLS, callToolDirect, initData, getData, AUDIT_LOG_PATH, persistServiceRequests, persistWorkOrders } = dataLayer;

const server = createServer(async (req, res) => {
  // ─── Security: Rate Limiting (API routes only) ──────────────────
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const isAPI = req.url.startsWith('/api/');
  if (isAPI && !checkRateLimit(clientIP)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    res.end(JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }));
    return;
  }

  // ─── Security Headers ──────────────────────────────────────────
  const origin = req.headers.origin || '';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        `http://localhost:${PORT}`,
        'https://civiclens-app.azurewebsites.net',
      ];
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Role, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org https://tile.openstreetmap.org; connect-src 'self' https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://tile.openstreetmap.org");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── Email diagnostics endpoint (staff-only) ────────────────
  if (req.method === 'GET' && req.url === '/api/email-diag') {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required' }));
      return;
    }
    const config = {
      POWER_AUTOMATE_URL: process.env.POWER_AUTOMATE_URL ? '***set***' : '(not set)',
      SMTP_HOST: process.env.SMTP_HOST || '(not set)',
      SMTP_PORT: process.env.SMTP_PORT || '(not set)',
      SMTP_USER: process.env.SMTP_USER || '(not set)',
      SMTP_PASS: process.env.SMTP_PASS ? '***set***' : '(not set)',
      EMAIL_FROM: process.env.EMAIL_FROM || '(not set)',
    };
    let testResult = 'not tested';
    const transport = process.env.POWER_AUTOMATE_URL ? 'power_automate' : 'smtp';

    if (process.env.POWER_AUTOMATE_URL) {
      try {
        const testRes = await fetch(process.env.POWER_AUTOMATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: 'test@test.com', subject: 'CivicLens Diag Test', body: '<p>Connectivity test</p>' }),
        });
        testResult = testRes.ok
          ? `Power Automate responded ${testRes.status} OK`
          : `Power Automate responded ${testRes.status}: ${await testRes.text().catch(() => '')}`;
      } catch (err) {
        testResult = `Power Automate FAILED: ${err.message}`;
      }
    } else {
      try {
        const nodemailer = await import('nodemailer');
        const smtpTransport = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: (Number(process.env.SMTP_PORT) || 587) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await smtpTransport.verify();
        testResult = 'SMTP connection verified OK';
      } catch (err) {
        testResult = `SMTP verify FAILED: ${err.message}`;
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ transport, config, testResult }, null, 2));
    return;
  }

  // Serve static files from public/
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = await readFile(join(__dirname, 'public', 'index.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    res.end(html);
    return;
  }

  // Serve static files from public/
  if (req.method === 'GET' && req.url.startsWith('/') && /\.(js|css|html|svg|png|jpg|jpeg|webp|gif|ico|json)$/.test(req.url)) {
    const MIME = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.json': 'application/json' };
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const safePath = join('/', urlPath).normalize();
    // Prevent path traversal — resolved path must stay within public/
    const resolvedPath = join(__dirname, 'public', safePath);
    if (!resolvedPath.startsWith(join(__dirname, 'public'))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    const isBinary = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(extname(safePath));
    try {
      const content = await readFile(resolvedPath, isBinary ? undefined : 'utf-8');
      res.writeHead(200, { 'Content-Type': MIME[extname(safePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
    return;
  }

  // Dashboard data API — returns all MCP data + aggregations
  if (req.method === 'POST' && req.url === '/api/dashboard') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    try {
      // Fetch all data from embedded MCP tools directly
      const [woDataRaw, phDataRaw, swDataRaw, schData, srDataRaw] = await Promise.all([
        callToolDirect('get_work_orders', {}),
        callToolDirect('get_potholes', {}),
        callToolDirect('get_sidewalk_issues', {}),
        callToolDirect('get_schools', {}),
        callToolDirect('get_service_requests', {}).catch(() => []),
      ]);

      // ── Query-aware filtering ────────────────────────────────
      const query = ((parsed.query && typeof parsed.query === 'string') ? parsed.query : '').toLowerCase();
      let focus = 'overview'; // default tab to show

      // Detect zone filter
      const zoneMatch = query.match(/zone\s*([a-d])/i) || query.match(/(north|south|east|west|downtown|central)/i);
      const zoneFilter = zoneMatch ? zoneMatch[1].toLowerCase() : null;

      // Detect severity filter
      const sevMatch = query.match(/\b(critical|high|medium|low)\b/i);
      const sevFilter = sevMatch ? sevMatch[1].toLowerCase() : null;

      // Detect type filter
      const typeFilter = /pothole/i.test(query) ? 'pothole_repair'
        : /sidewalk/i.test(query) ? 'sidewalk_replacement'
        : /concrete/i.test(query) ? 'concrete_repair' : null;

      // Detect status filter
      const statusMatch = query.match(/\b(open|in.progress|completed|closed)\b/i);
      const statusFilter = statusMatch ? statusMatch[1].toLowerCase().replace(/\s+/g, '_').replace('in-progress', 'in_progress') : null;

      // Detect focus area from query keywords
      if (/budget|cost|expense|spend|money|dollar|\$/i.test(query)) focus = 'cost';
      else if (/sever|critical|high|priority|urgent/i.test(query)) focus = 'severity';
      else if (/status|open|progress|complete|backlog/i.test(query)) focus = 'status';
      else if (/zone|area|geographic|location|north|south|east|west|downtown/i.test(query)) focus = 'geographic';
      else if (/school|safety|ada|compliance|communit/i.test(query)) focus = 'community';
      else if (/trend|forecast|predict|future|project/i.test(query)) focus = 'overview';

      // Apply filters
      let woData = woDataRaw;
      let phData = phDataRaw;
      let swData = swDataRaw;
      let srData = srDataRaw;

      if (zoneFilter) {
        woData = woData.filter(w => (w.location?.zone || '').toLowerCase().includes(zoneFilter));
        phData = phData.filter(p => (p.location?.zone || '').toLowerCase().includes(zoneFilter));
        swData = swData.filter(s => (s.location?.zone || '').toLowerCase().includes(zoneFilter));
        srData = srData.filter(sr => (sr.location?.zone || sr.zone || '').toLowerCase().includes(zoneFilter));
      }
      if (sevFilter) {
        woData = woData.filter(w => w.priority === sevFilter);
        phData = phData.filter(p => p.severity === sevFilter);
        swData = swData.filter(s => s.severity === sevFilter);
      }
      if (typeFilter) {
        woData = woData.filter(w => w.type === typeFilter);
      }
      if (statusFilter) {
        woData = woData.filter(w => w.status === statusFilter);
        srData = srData.filter(sr => sr.status === statusFilter || (statusFilter === 'open' && sr.status === 'submitted'));
      }
      if (/school|safety/i.test(query)) {
        phData = phData.filter(p => p.near_school);
        swData = swData.filter(s => s.near_school);
      }

      // Compute aggregations
      const totalCost = woData.reduce((s, w) => s + (w.estimated_cost || 0), 0);
      const openWO = woData.filter(w => w.status === 'open');
      const criticalHigh = woData.filter(w => w.priority === 'critical' || w.priority === 'high');
      const nearSchool = [...phData.filter(p => p.near_school), ...swData.filter(s => s.near_school)];

      // Resolution metrics for completed work orders
      const completedWO = woData.filter(w => w.status === 'completed' && w.completed_date && w.reported_date);
      const resolutionDays = completedWO.map(w => Math.round((new Date(w.completed_date) - new Date(w.reported_date)) / 86400000));
      const avgResDays = resolutionDays.length ? Math.round(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length) : null;
      const completedCost = completedWO.reduce((s, w) => s + (w.estimated_cost || 0), 0);
      // Estimate cost-of-inaction savings: waiting 180 days costs ~3x the repair
      const projectedCostIfDelayed = completedWO.reduce((s, w) => {
        const days = Math.round((new Date(w.completed_date) - new Date(w.reported_date)) / 86400000);
        const multiplier = 1 + (180 - Math.min(days, 180)) / 180 * 2;
        return s + (w.estimated_cost || 0) * multiplier;
      }, 0);
      const estimatedSavings = Math.round(projectedCostIfDelayed - completedCost);

      const summary = {
        total_issues: woData.length,
        open_issues: openWO.length,
        in_progress: woData.filter(w => w.status === 'in_progress').length,
        completed: woData.filter(w => w.status === 'completed').length,
        critical: woData.filter(w => w.priority === 'critical').length,
        high: woData.filter(w => w.priority === 'high').length,
        medium: woData.filter(w => w.priority === 'medium').length,
        low: woData.filter(w => w.priority === 'low').length,
        critical_high: criticalHigh.length,
        total_cost: totalCost,
        avg_cost: Math.round(totalCost / woData.length),
        near_schools: nearSchool.length,
        by_type: {
          pothole_repair: woData.filter(w => w.type === 'pothole_repair').length,
          sidewalk_replacement: woData.filter(w => w.type === 'sidewalk_replacement').length,
          concrete_repair: woData.filter(w => w.type === 'concrete_repair').length,
        },
        by_zone: woData.reduce((acc, w) => {
          const z = w.location?.zone || 'unknown';
          acc[z] = (acc[z] || 0) + 1;
          return acc;
        }, {}),
        by_status: { open: openWO.length, in_progress: woData.filter(w => w.status === 'in_progress').length, completed: woData.filter(w => w.status === 'completed').length },
        cost_by_priority: woData.reduce((acc, w) => {
          acc[w.priority] = (acc[w.priority] || 0) + (w.estimated_cost || 0);
          return acc;
        }, {}),
        cost_by_type: woData.reduce((acc, w) => {
          acc[w.type] = (acc[w.type] || 0) + (w.estimated_cost || 0);
          return acc;
        }, {}),
        avg_resolution_days: avgResDays,
        completed_cost: completedCost,
        estimated_savings: estimatedSavings,
        service_requests: srData.length,
        sr_open: srData.filter(sr => sr.status === 'open' || sr.status === 'submitted').length,
        sr_in_progress: srData.filter(sr => sr.status === 'in_progress').length,
        sr_resolved: srData.filter(sr => sr.status === 'completed' || sr.status === 'resolved').length,
        sr_by_category: srData.reduce((acc, sr) => { const c = sr.category || 'other'; acc[c] = (acc[c] || 0) + 1; return acc; }, {}),
      };

      // Return dashboard data immediately — AI insights loaded separately
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        work_orders: woData,
        potholes: phData,
        sidewalk_issues: swData,
        schools: schData,
        service_requests: srData,
        summary,
        ai_insights: null,
        query: parsed.query || null,
        focus,
        filters: { zone: zoneFilter, severity: sevFilter, type: typeFilter, status: statusFilter },
        total_unfiltered: woDataRaw.length,
      }));
    } catch (err) {
      console.error('Dashboard error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch dashboard data. Is the MCP server running?' }));
    }
    return;
  }

  // Lazy AI Insights endpoint — called separately after dashboard renders
  if (req.method === 'POST' && req.url === '/api/dashboard/ai') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const query = (parsed.query && typeof parsed.query === 'string') ? parsed.query.trim() : '';
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Query required' }));
      return;
    }

    try {
      // Race the pipeline against a 120-second timeout (Azure F1 = 230s)
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI analysis timed out — try a more specific question')), 120000)
      );
      const aiInsights = await Promise.race([runPipeline(query), timeout]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ai_insights: aiInsights }));
    } catch (err) {
      console.warn('AI insights failed:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ai_insights: null, error: err.message }));
    }
    return;
  }

  // Streaming Chat API — Server-Sent Events for live pipeline visualization
  if (req.method === 'POST' && req.url === '/api/chat/stream') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const message = parsed.message;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message is required' }));
      return;
    }
    if (message.length > 2000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message too long (max 2000 characters)' }));
      return;
    }

    // Sanitize user input before sending to pipeline
    const cleanMessage = sanitizeInput(message.trim());

    // Extract role — only allow known values
    const VALID_ROLES = ['public', 'supervisor'];
    const role = VALID_ROLES.includes(parsed.role) ? parsed.role : 'public';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    function sendSSE(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    try {
      // Race pipeline against 90s timeout (keeps Azure F1 happy)
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pipeline timed out — try a more specific question')), 90000)
      );
      await Promise.race([runPipelineStreaming(cleanMessage, sendSSE, role), timeout]);
    } catch (err) {
      console.error('Pipeline stream error:', err);
      sendSSE('error', { message: err.message });
    }

    res.end();
    return;
  }

  // Chat API endpoint
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const message = parsed.message;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message is required' }));
      return;
    }

    // Input length guard (Responsible AI)
    if (message.length > 2000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message too long (max 2000 characters)' }));
      return;
    }

    try {
      const result = await runPipeline(sanitizeInput(message.trim()));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('Pipeline error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'An error occurred processing your request.',
        markdown: '**Error**: The CivicLens pipeline encountered an issue. Please try again.',
        trace: [{ stage: 'error', status: 'failed', result: { message: err.message } }],
      }));
    }
    return;
  }

  // AI Rewrite — lightweight LLM call to improve service request descriptions
  if (req.method === 'POST' && req.url === '/api/rewrite') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const text = (parsed.text && typeof parsed.text === 'string') ? parsed.text.trim() : '';
    const style = (parsed.style && typeof parsed.style === 'string') ? parsed.style.trim() : '';
    const validStyles = ['concise', 'descriptive', 'formal', 'urgent', 'friendly'];
    if (!text || text.length < 5) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Text must be at least 5 characters' }));
      return;
    }
    if (!style || !validStyles.includes(style)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid style. Use: ' + validStyles.join(', ') }));
      return;
    }
    if (text.length > 500) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Text too long (max 500 characters)' }));
      return;
    }

    const stylePrompts = {
      concise: 'Rewrite this civic issue report to be shorter and more concise while keeping all key details. Remove filler words and get straight to the point.',
      descriptive: 'Rewrite this civic issue report to be more detailed and descriptive. Add relevant specifics like potential impact, severity indicators, and context that would help a city worker understand and prioritize the issue. Keep it under 500 characters — be descriptive but not lengthy.',
      formal: 'Rewrite this civic issue report in a formal, professional tone suitable for an official city service request. Use clear, objective language.',
      urgent: 'Rewrite this civic issue report to emphasize the urgency and safety implications. Highlight any time-sensitive aspects or potential hazards that require immediate attention.',
      friendly: 'Rewrite this civic issue report in a friendly, conversational tone while still being clear about the issue. Make it approachable and community-minded.',
    };

    // Local fallback rewrite when LLM is unavailable
    function localRewrite(text, style) {
      const clean = text.replace(/\s+/g, ' ').trim();
      switch (style) {
        case 'concise': return clean.split('. ').filter(Boolean).slice(0, 2).join('. ').slice(0, 300) + (clean.length > 300 ? '.' : '');
        case 'formal': return 'I am writing to report the following issue: ' + clean.charAt(0).toLowerCase() + clean.slice(1) + (clean.endsWith('.') ? '' : '.') + ' Prompt attention would be appreciated.';
        case 'urgent': return 'URGENT: ' + clean + (clean.endsWith('.') ? '' : '.') + ' This requires immediate attention due to potential safety concerns.';
        case 'friendly': return 'Hi there! Just wanted to flag something — ' + clean.charAt(0).toLowerCase() + clean.slice(1) + (clean.endsWith('.') ? '' : '.') + ' Thanks for looking into this!';
        case 'descriptive': return clean + (clean.endsWith('.') ? '' : '.') + ' This issue may affect pedestrian safety and accessibility in the area. Timely repair would help prevent further deterioration.';
        default: return clean;
      }
    }

    // If rate limited, use local fallback instead of calling LLM
    if (isRateLimited()) {
      console.log('[rewrite] Rate limited — using local fallback');
      const rewritten = localRewrite(text, style).slice(0, 500);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rewritten, _fallback: true }));
      return;
    }

    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 250,
        timeout: 15000,
        maxRetries: 0,
        configuration: {
          baseURL: 'https://models.inference.ai.azure.com',
          apiKey: process.env.GITHUB_TOKEN,
        },
      });

      const result = await llm.invoke([
        { role: 'system', content: stylePrompts[style] + '\n\nRules:\n- Output ONLY the rewritten text, no explanations or quotes.\n- Keep the meaning the same.\n- Stay under 500 characters. This is a hard limit — be concise.\n- Do not invent facts not implied by the original.' },
        { role: 'user', content: sanitizeInput(text) },
      ]);

      const rewritten = (result.content || '').trim().slice(0, 500);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rewritten }));
    } catch (err) {
      console.warn('Rewrite failed:', err.message);
      // If 429 rate limit, mark it and return fallback instead of 500
      if (err.message && err.message.includes('429')) {
        const wait = parseInt((err.message.match(/wait (\d+) seconds/i) || [])[1]) || 300;
        markRateLimited(wait);
        const rewritten = localRewrite(text, style).slice(0, 500);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rewritten, _fallback: true }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'AI rewrite unavailable — try again later' }));
      }
    }
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      _v: 'deploy-fix-v5',
      _dataDir: persistentDataDir,
      rate_limited: isRateLimited(),
      tools: Object.keys(TOOLS).length,
      data: {
        work_orders: workOrders.length,
        potholes: potholes.length,
        sidewalk_issues: sidewalkIssues.length,
        schools: schools.length,
        service_requests: serviceRequests.length,
      },
      schoolDetail: schools.map(s => ({ id: s.id, name: s.name, lat: s.location?.lat, lng: s.location?.lng })),
    }));
    return;
  }

  // Community API — resident-friendly data endpoint
  if (req.method === 'GET' && req.url.startsWith('/api/community')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const zone = url.searchParams.get('zone');

    // Service requests (filtered by zone if provided, strip sensitive fields)
    let sr = serviceRequests.map(({ contact_email, notify_by_email, ...rest }) => rest);
    if (zone) sr = sr.filter(s => s.location.zone === zone);

    // Compute resident-friendly stats
    const allSR = serviceRequests;
    const openSR = allSR.filter(s => s.status === 'open');
    const inProgressSR = allSR.filter(s => s.status === 'in_progress');
    const completedSR = allSR.filter(s => s.status === 'completed');

    // Average resolution time (completed requests)
    const resolvedWithDates = completedSR.filter(s => s.submitted_date && s.completed_date);
    let avgResolutionDays = null;
    if (resolvedWithDates.length > 0) {
      const totalDays = resolvedWithDates.reduce((sum, s) => {
        return sum + Math.ceil((new Date(s.completed_date) - new Date(s.submitted_date)) / 86400000);
      }, 0);
      avgResolutionDays = Math.round(totalDays / resolvedWithDates.length);
    }

    // Neighborhood scores by zone
    const zones = ['NW-3', 'NE-1', 'SE-2', 'SW-1'];
    const neighborhoodScores = {};
    for (const z of zones) {
      const zoneWO = workOrders.filter(w => w.location?.zone === z);
      const zoneOpen = zoneWO.filter(w => w.status !== 'completed').length;
      const zoneCritical = zoneWO.filter(w => w.priority === 'critical' || w.priority === 'high').length;
      const zoneSchoolIssues = [...potholes.filter(p => p.location?.zone === z && p.near_school), ...sidewalkIssues.filter(s => s.location?.zone === z && s.near_school)].length;
      // Score: 100 minus penalties
      const score = Math.max(0, Math.min(100, 100 - (zoneOpen * 5) - (zoneCritical * 10) - (zoneSchoolIssues * 8)));
      const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
      neighborhoodScores[z] = { score, grade, open_issues: zoneOpen, critical_issues: zoneCritical, school_issues: zoneSchoolIssues };
    }

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recentCompleted = workOrders.filter(w => w.status === 'completed' && w.completed_date >= thirtyDaysAgo);
    const recentRequests = allSR.filter(s => s.submitted_date >= thirtyDaysAgo);

    // Category breakdown for requests
    const byCategory = {};
    for (const s of allSR) { byCategory[s.category] = (byCategory[s.category] || 0) + 1; }

    // ─── Cost savings from completed work orders ──────────────────
    const completedWO = workOrders.filter(w => w.status === 'completed');
    let totalSavings = 0;
    let totalRepairCost = 0;
    for (const wo of completedWO) {
      const woType = wo.type?.includes('pothole') ? 'pothole' : wo.type?.includes('sidewalk') ? 'sidewalk' : 'concrete';
      const coi = costOfInaction({ issue_type: woType, current_severity: wo.severity || 6, reported_date: wo.reported_date, near_school: false, traffic_volume: 'medium' });
      totalSavings += coi.savings_if_repaired_now;
      totalRepairCost += wo.estimated_cost || coi.repair_cost_now;
    }
    // Cost of inaction for open/in-progress work orders
    const unresolvedWO = workOrders.filter(w => w.status !== 'completed');
    let projectedCostIfDelayed = 0;
    for (const wo of unresolvedWO) {
      const woType = wo.type?.includes('pothole') ? 'pothole' : wo.type?.includes('sidewalk') ? 'sidewalk' : 'concrete';
      const coi = costOfInaction({ issue_type: woType, current_severity: wo.severity || 5, reported_date: wo.reported_date, near_school: false, traffic_volume: 'medium' });
      projectedCostIfDelayed += coi.projected_costs['90_days'].total;
    }

    // ─── Chicago 311 benchmarks ───────────────────────────────────
    const chicagoBench = TOOLS.get_chicago_311_benchmarks.handler({});
    const lfCompletionRate = allSR.length > 0 ? Math.round((completedSR.length / allSR.length) * 100) : 0;
    const chicagoCompletionRate = Math.round((chicagoBench.completion_rate || 0) * 100);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service_requests: sr,
      stats: {
        total_requests: allSR.length,
        open: openSR.length,
        in_progress: inProgressSR.length,
        completed: completedSR.length,
        avg_resolution_days: avgResolutionDays,
        by_category: byCategory,
        recent_requests_30d: recentRequests.length,
        recent_fixes_30d: recentCompleted.length,
      },
      neighborhood_scores: neighborhoodScores,
      schools: schools.map(s => ({ name: s.name, type: s.type, zone: s.location.zone, enrollment: s.enrollment })),
      cost_savings: {
        completed_repairs: completedWO.length,
        total_repair_cost: totalRepairCost,
        total_savings: totalSavings,
        projected_cost_if_delayed: projectedCostIfDelayed,
        unresolved_count: unresolvedWO.length,
      },
      benchmarks: {
        lake_forest: {
          avg_resolution_days: avgResolutionDays,
          completion_rate: lfCompletionRate,
          total_requests: allSR.length,
        },
        chicago_311: {
          avg_resolution_days: chicagoBench.avg_resolution_days,
          completion_rate: chicagoCompletionRate,
          total_sample_records: chicagoBench.total_sample_records,
          source: chicagoBench.source,
        },
      },
    }));
    return;
  }

  // Service request submission API
  if (req.method === 'POST' && req.url === '/api/service-request') {
    const MAX_BODY = 6 * 1024 * 1024; // 6 MB (enough for a ~4 MB photo base64)
    let body = '';
    let tooBig = false;
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) { tooBig = true; break; }
    }
    if (tooBig) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request too large. Photo must be under 5 MB.' }));
      return;
    }

    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!parsed.category || !parsed.description || !parsed.address) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Required: category, description, address' }));
      return;
    }

    const result = await TOOLS.submit_service_request.handler({
      resident_name: parsed.name || 'Anonymous',
      contact_phone: parsed.phone || null,
      contact_email: parsed.contact_email || null,
      notify_by_email: !!parsed.notify_by_email,
      category: parsed.category,
      description: parsed.description,
      address: parsed.address,
      zone: parsed.zone || null,
      lat: parsed.lat != null ? Number(parsed.lat) : null,
      lng: parsed.lng != null ? Number(parsed.lng) : null,
      photo: parsed.photo || null,
    });

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));

    // Send confirmation email (fire-and-forget, don't block response)
    if (result.success && result.request) {
      const sr = result.request;
      console.log(`[Email] Attempting confirmation for ${sr.id}, email=${sr.contact_email}, notify=${sr.notify_by_email}`);
      sendConfirmationEmail(sr).then(() => {
        console.log(`[Email] Confirmation sent successfully for ${sr.id}`);
      }).catch(err => {
        console.error('[Email] Confirmation email failed:', err.message || err);
      });
    }
    return;
  }

  // Service request status lookup API
  if (req.method === 'GET' && req.url.startsWith('/api/service-request/')) {
    const trackingNum = req.url.split('/api/service-request/')[1]?.split('?')[0];
    if (!trackingNum) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tracking number required' }));
      return;
    }
    const result = TOOLS.get_request_status.handler({ tracking_number: trackingNum });
    res.writeHead(result.found ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // Add comment to a service request
  if (req.method === 'POST' && req.url.match(/^\/api\/service-request\/[^/]+\/comments$/)) {
    const trackId = req.url.split('/api/service-request/')[1]?.split('/comments')[0];
    const sr = serviceRequests.find(s => s.id === trackId);
    if (!sr) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service request not found' }));
      return;
    }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) break; }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const text = (parsed.comment || '').trim();
    const author = (parsed.author || 'Resident').trim();
    if (!text || text.length > 1000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Comment is required (max 1000 chars)' }));
      return;
    }
    const update = { date: new Date().toISOString().split('T')[0], note: text, by: author };
    sr.updates = sr.updates || [];
    sr.updates.push(update);
    sr.updated_date = update.date;

    // If a status change is included in the comment payload, require staff auth
    const newStatus = (parsed.status || '').trim();
    if (newStatus && ['open', 'received', 'in_progress', 'completed'].includes(newStatus) && newStatus !== sr.status) {
      if (!validateStaffToken(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Staff authentication required for status changes' }));
        return;
      }
      const prevStatus = sr.status;
      sr.status = newStatus;
      if (newStatus === 'completed') sr.completed_date = update.date;
      // Notify via email
      sendStatusUpdateEmail(sr, newStatus, text).catch(() => {});
      notifySubscribers(trackId, { note: text, status: newStatus, by: author });
    }

    persistServiceRequests().catch(() => {});
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, update }));
    return;
  }

  // ─── Update service request status (triggers email notification) ──
  if (req.method === 'PATCH' && req.url.match(/^\/api\/service-request\/[^/]+\/status$/)) {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required for status updates' }));
      return;
    }
    const trackId = req.url.split('/api/service-request/')[1]?.split('/status')[0];
    const sr = serviceRequests.find(s => s.id === trackId);
    if (!sr) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service request not found' }));
      return;
    }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) break; }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const newStatus = (parsed.status || '').trim();
    if (!['open', 'received', 'in_progress', 'completed'].includes(newStatus)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid status. Must be: open, received, in_progress, completed' }));
      return;
    }
    const prevStatus = sr.status;
    sr.status = newStatus;
    sr.updated_date = new Date().toISOString();
    if (newStatus === 'completed') sr.completed_date = sr.updated_date;

    const note = (parsed.note || `Status updated from ${prevStatus} to ${newStatus}`).trim();
    const by = (parsed.by || 'system').trim();
    const update = { date: sr.updated_date, note, by };
    sr.updates = sr.updates || [];
    sr.updates.push(update);

    if (parsed.assigned_crew) sr.assigned_crew = parsed.assigned_crew;
    if (parsed.resolution_eta) sr.resolution_eta = parsed.resolution_eta;

    persistServiceRequests().catch(() => {});
    notifySubscribers(trackId, { note, status: newStatus, by });
    sendStatusUpdateEmail(sr, newStatus, note).catch(() => {});

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, previous_status: prevStatus, new_status: newStatus, update }));
    return;
  }

  // Map data API — all geolocated data for Leaflet
  if (req.method === 'GET' && req.url.startsWith('/api/map-data')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const zone = url.searchParams.get('zone');
    const filterZone = (items) => zone ? items.filter(i => (i.location?.zone || i.zone) === zone) : items;

    const markers = [];

    // Potholes
    for (const p of filterZone(potholes)) {
      if (!p.location?.lat) continue;
      markers.push({ type: 'pothole', lat: p.location.lat, lng: p.location.lng, severity: p.severity, address: p.location.address, zone: p.location.zone, near_school: p.near_school, school_name: p.school_name || null, status: p.status || 'reported', priority: p.severity >= 8 ? 'critical' : p.severity >= 6 ? 'high' : p.severity >= 4 ? 'medium' : 'low', id: p.id });
    }

    // Sidewalk issues
    for (const s of filterZone(sidewalkIssues)) {
      if (!s.location?.lat) continue;
      markers.push({ type: 'sidewalk', lat: s.location.lat, lng: s.location.lng, severity: s.severity, address: s.location.address, zone: s.location.zone, near_school: s.near_school, school_name: s.school_name || null, ada_compliant: s.ada_compliant, status: s.status || 'reported', priority: s.severity >= 8 ? 'critical' : s.severity >= 6 ? 'high' : s.severity >= 4 ? 'medium' : 'low', id: s.id });
    }

    // Work orders
    for (const w of filterZone(workOrders)) {
      if (!w.location?.lat) continue;
      markers.push({ type: 'work_order', lat: w.location.lat, lng: w.location.lng, address: w.location.address, zone: w.location.zone, priority: w.priority, status: w.status, work_type: w.type, estimated_cost: w.estimated_cost, id: w.id });
    }

    // Schools
    for (const s of filterZone(schools)) {
      if (!s.location?.lat) continue;
      markers.push({ type: 'school', lat: s.location.lat, lng: s.location.lng, address: s.location.address || s.name, zone: s.location.zone, name: s.name, enrollment: s.enrollment, school_type: s.type, status: 'active', id: s.id || s.name });
    }

    // Service requests
    for (const sr of filterZone(serviceRequests)) {
      if (!sr.location?.lat) continue;
      markers.push({ type: 'service_request', lat: sr.location.lat, lng: sr.location.lng, address: sr.location.address, zone: sr.location.zone, category: sr.category, status: sr.status, priority: sr.priority, description: sr.description, id: sr.id, submitted_date: sr.submitted_date, updated_date: sr.updated_date || null, assigned_crew: sr.assigned_crew || null, resolution_eta: sr.resolution_eta || null });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ markers, bounds: { north: 42.2798, south: 42.2036, east: -87.8067, west: -87.9014 }, center: { lat: 42.2586, lng: -87.8407 }, _v: 'deploy-fix-v2' }));
    return;
  }

  // ─── Forecast API ─────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/forecast') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const result = forecastDeterioration(parsed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // ─── What-If Budget API ───────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/whatif') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const result = TOOLS.whatif_budget.handler(parsed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // ─── Data Export API (CSV) ────────────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/api/export')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const dataset = url.searchParams.get('dataset') || 'work_orders';
    const format = url.searchParams.get('format') || 'csv';

    const dataSources = {
      work_orders: workOrders,
      potholes: potholes,
      sidewalk_issues: sidewalkIssues,
      schools: schools,
      service_requests: serviceRequests.map(({ contact_email, notify_by_email, ...rest }) => rest),
    };

    const data = dataSources[dataset];
    if (!data) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown dataset: ${dataset}. Available: ${Object.keys(dataSources).join(', ')}` }));
      return;
    }

    if (format === 'json') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${dataset}.json"`,
      });
      res.end(JSON.stringify(data, null, 2));
      return;
    }

    // CSV export
    if (!data.length) {
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${dataset}.csv"` });
      res.end('No data');
      return;
    }

    function flattenObj(obj, prefix = '') {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}_${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          Object.assign(result, flattenObj(v, key));
        } else {
          result[key] = Array.isArray(v) ? v.join('; ') : v;
        }
      }
      return result;
    }

    const flat = data.map(d => flattenObj(d));
    const headers = [...new Set(flat.flatMap(r => Object.keys(r)))];
    const csvRows = [headers.join(',')];
    for (const row of flat) {
      csvRows.push(headers.map(h => {
        const val = row[h] ?? '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','));
    }

    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${dataset}.csv"`,
    });
    res.end(csvRows.join('\n'));
    return;
  }

  // ─── Notification Subscribe (SSE for service request updates) ─────
  if (req.method === 'GET' && req.url.startsWith('/api/notifications/subscribe/')) {
    const trackingNum = req.url.split('/api/notifications/subscribe/')[1]?.split('?')[0];
    if (!trackingNum) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tracking number required' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ tracking_number: trackingNum })}\n\n`);

    if (!notificationSubscribers.has(trackingNum)) notificationSubscribers.set(trackingNum, []);
    const subscribers = notificationSubscribers.get(trackingNum);
    subscribers.push(res);

    req.on('close', () => {
      const idx = subscribers.indexOf(res);
      if (idx !== -1) subscribers.splice(idx, 1);
    });
    return;
  }

  // ─── Clear Conversation Memory ───────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/memory/clear') {
    clearConversationMemory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Conversation memory cleared' }));
    return;
  }

  // ─── Rate Limit Status & Reset (staff-protected) ─────────────────
  if (req.url === '/api/rate-limit') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rate_limited: isRateLimited() }));
      return;
    }
    if (req.method === 'POST') {
      if (!validateStaffToken(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized — staff PIN required' }));
        return;
      }
      clearRateLimit();
      console.log('[admin] Rate limit cleared by staff');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Rate limit cleared — AI pipeline restored' }));
      return;
    }
  }

  // ─── Staff: Direct Dispatch Crew (no chat pipeline) ────────────────
  if (req.method === 'POST' && req.url === '/api/staff/dispatch') {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required' }));
      return;
    }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) break; }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const { work_order_id, crew_id, scheduled_date } = parsed;
    if (!work_order_id || !crew_id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Required: work_order_id, crew_id' }));
      return;
    }
    const result = callToolDirect('dispatch_crew', {
      work_order_id: String(work_order_id).trim(),
      crew_id: String(crew_id).trim(),
      scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
    });
    if (!result.success) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // Trigger Power Automate webhook for dispatch notification
    if (process.env.POWER_AUTOMATE_URL) {
      const woAddr = result.work_order?.location?.address || 'Unknown location';
      const woType = result.work_order?.type?.replace(/_/g, ' ') || 'work order';
      const woId = result.work_order?.id || 'WO';
      const woPriority = result.work_order?.priority || 'medium';
      const woDate = result.work_order?.scheduled_date || 'TBD';
      const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
      const pColor = priorityColors[woPriority] || '#f59e0b';
      const siteUrl = process.env.SITE_URL || 'https://civiclens-app.azurewebsites.net';
      fetch(process.env.POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: process.env.STAFF_EMAIL || process.env.EMAIL_FROM || 'staff@civiclens.app',
          subject: `[CivicLens] Crew Dispatched — ${woId}`,
          body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background-color:#1e3a5f}@media(prefers-color-scheme:dark){.card{background-color:#111827!important}.card-text{color:#f9fafb!important}.muted{color:#9ca3af!important}.detail-row{border-color:#374151!important}.footer{background-color:#111827!important;border-color:#374151!important}}</style></head><body style="margin:0;padding:0;background-color:#1e3a5f"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e3a5f"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden"><tr><td style="background-color:#1e3a5f;padding:36px 32px 28px;text-align:center"><div style="display:inline-block;background-color:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px"><span style="font-size:22px;font-weight:800;color:#fff">&#127963; CivicLens</span></div><h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff">&#128666; Crew Dispatched</h1><p style="margin:0;font-size:14px;color:#bfdbfe">City of Lake Forest, Illinois</p></td></tr><tr><td class="card" style="background-color:#fff;padding:28px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#dbeafe;border:2px solid #93c5fd;border-radius:12px;margin-bottom:24px"><tr><td style="padding:14px 20px;text-align:center"><span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1.2px;display:block;margin-bottom:2px">Work Order</span><span style="font-family:'Courier New',monospace;font-size:20px;font-weight:800;color:#1e40af;letter-spacing:2px">${woId}</span></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;border-radius:12px;border:1px solid #d1d5db"><tr><td style="padding:20px 20px 6px"><span class="muted" style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Dispatch Details</span></td></tr><tr><td style="padding:8px 20px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr class="detail-row"><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;width:110px;border-bottom:1px solid #e5e7eb">Type</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${woType}</td></tr><tr class="detail-row"><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Crew Assigned</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">${crew_id}</td></tr><tr class="detail-row"><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Location</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">&#128205; ${woAddr}</td></tr><tr class="detail-row"><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Scheduled</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">&#128197; ${woDate}</td></tr><tr><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600">Priority</td><td style="padding:10px 0"><span style="display:inline-block;background-color:${pColor};color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:20px;text-transform:uppercase">${woPriority}</span></td></tr></table></td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:24px"><tr><td style="border-radius:10px;background-color:#2563eb;text-align:center"><a href="${siteUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#fff;text-decoration:none">&#128270; View in CivicLens</a></td></tr></table></td></tr><tr><td class="footer" style="background-color:#f9fafb;border-top:1px solid #d1d5db;padding:20px 32px;text-align:center"><p class="muted" style="margin:0 0 4px;font-size:12px;color:#374151;font-weight:600">City of Lake Forest &middot; Powered by CivicLens</p><p class="muted" style="margin:0;font-size:11px;color:#6b7280">Automated dispatch notification &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></td></tr></table></td></tr></table></body></html>`,
        }),
      }).catch(err => console.warn('[Power Automate] Dispatch webhook failed:', err.message));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // ─── Staff: Direct Work Order Status Update ───────────────────────
  if (req.method === 'PATCH' && req.url.match(/^\/api\/staff\/work-order\/[^/]+\/status$/)) {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required' }));
      return;
    }
    const woId = req.url.split('/api/staff/work-order/')[1]?.split('/status')[0];
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) break; }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const { status, notes } = parsed;
    if (!status || !['open', 'in_progress', 'completed'].includes(status)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid status. Must be: open, in_progress, completed' }));
      return;
    }
    const result = callToolDirect('update_work_order_status', {
      work_order_id: String(woId).trim(),
      status,
      notes: notes || '',
    });
    if (!result.success) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // Trigger Power Automate webhook for status change
    if (process.env.POWER_AUTOMATE_URL) {
      const statusLabels = { open: 'Open', in_progress: 'In Progress', completed: 'Completed' };
      const statusColors = { open: '#ef4444', in_progress: '#3b82f6', completed: '#10b981' };
      const statusIcons = { open: '&#128308;', in_progress: '&#128994;', completed: '&#9989;' };
      const sLabel = statusLabels[status] || status;
      const sColor = statusColors[status] || '#3b82f6';
      const sIcon = statusIcons[status] || '';
      const siteUrl = process.env.SITE_URL || 'https://civiclens-app.azurewebsites.net';
      fetch(process.env.POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: process.env.STAFF_EMAIL || process.env.EMAIL_FROM || 'staff@civiclens.app',
          subject: `[CivicLens] Work Order ${woId} — ${sLabel}`,
          body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background-color:#1e3a5f}@media(prefers-color-scheme:dark){.card{background-color:#111827!important}.card-text{color:#f9fafb!important}.muted{color:#9ca3af!important}.footer{background-color:#111827!important;border-color:#374151!important}}</style></head><body style="margin:0;padding:0;background-color:#1e3a5f"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e3a5f"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden"><tr><td style="background-color:#1e3a5f;padding:36px 32px 28px;text-align:center"><div style="display:inline-block;background-color:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px"><span style="font-size:22px;font-weight:800;color:#fff">&#127963; CivicLens</span></div><h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff">Work Order Update</h1><p style="margin:0;font-size:14px;color:#bfdbfe">City of Lake Forest, Illinois</p></td></tr><tr><td class="card" style="background-color:#fff;padding:28px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#dbeafe;border:2px solid #93c5fd;border-radius:12px;margin-bottom:20px"><tr><td style="padding:14px 20px;text-align:center"><span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1.2px;display:block;margin-bottom:2px">Work Order</span><span style="font-family:'Courier New',monospace;font-size:20px;font-weight:800;color:#1e40af;letter-spacing:2px">${woId}</span></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border-left:4px solid ${sColor};border:1.5px solid ${sColor}20;background-color:${sColor}08;margin-bottom:24px"><tr><td width="48" style="padding:18px 20px;vertical-align:middle;text-align:center;font-size:28px">${sIcon}</td><td style="padding:18px 20px 18px 0"><div class="card-text" style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px">Status: ${sLabel}</div>${notes ? `<div class="muted" style="font-size:14px;color:#374151;line-height:1.5">${notes}</div>` : ''}</td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="border-radius:10px;background-color:#2563eb;text-align:center"><a href="${siteUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#fff;text-decoration:none">&#128270; View in CivicLens</a></td></tr></table></td></tr><tr><td class="footer" style="background-color:#f9fafb;border-top:1px solid #d1d5db;padding:20px 32px;text-align:center"><p class="muted" style="margin:0 0 4px;font-size:12px;color:#374151;font-weight:600">City of Lake Forest &middot; Powered by CivicLens</p><p class="muted" style="margin:0;font-size:11px;color:#6b7280">Automated status notification &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></td></tr></table></td></tr></table></body></html>`,
        }),
      }).catch(err => console.warn('[Power Automate] Status webhook failed:', err.message));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // ─── Staff: Direct Schedule Inspection ────────────────────────────
  if (req.method === 'POST' && req.url === '/api/staff/inspect') {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required' }));
      return;
    }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) break; }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const { issue_type, location, zone, scheduled_date, reason, sr_id } = parsed;
    if (!issue_type || !location || !zone) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Required: issue_type, location, zone' }));
      return;
    }
    const inspDate = scheduled_date || new Date().toISOString().split('T')[0];
    const result = callToolDirect('schedule_inspection', {
      issue_type: String(issue_type).trim(),
      location: String(location).trim(),
      zone: String(zone).trim(),
      scheduled_date: inspDate,
      reason: reason || '',
    });

    // Link inspection to the originating service request
    const linkedSR = sr_id ? serviceRequests.find(s => s.id === sr_id) : null;
    if (linkedSR && result.success) {
      // Update SR status to received (or keep in_progress if already further along)
      const statusOrder = { open: 0, received: 1, in_progress: 2, completed: 3 };
      if ((statusOrder[linkedSR.status] || 0) < 1) {
        linkedSR.status = 'received';
      }
      linkedSR.updated_date = new Date().toISOString().split('T')[0];
      linkedSR.updates = linkedSR.updates || [];
      linkedSR.updates.push({
        date: linkedSR.updated_date,
        note: `Inspection scheduled for ${inspDate}. ${reason || ''}`.trim(),
        by: 'Staff',
      });
      // Store the inspection WO ID on the SR for tracking
      linkedSR.inspection_wo_id = result.work_order?.id || null;
      persistServiceRequests().catch(() => {});
      notifySubscribers(linkedSR.id, { note: `Inspection scheduled for ${inspDate}`, status: linkedSR.status, by: 'Staff' });

      // Send email notification to resident
      sendStatusUpdateEmail(linkedSR, linkedSR.status, `An inspection has been scheduled for ${inspDate} at ${location}. A city inspector will assess the reported issue and determine next steps. You'll receive another update once the inspection is complete.`).catch(() => {});
    }

    // Trigger Power Automate webhook for inspection
    if (process.env.POWER_AUTOMATE_URL) {
      const inspRecipient = linkedSR?.contact_email || process.env.STAFF_EMAIL || process.env.EMAIL_FROM || 'staff@civiclens.app';
      const siteUrl = process.env.SITE_URL || 'https://civiclens-app.azurewebsites.net';
      const issueDisplay = issue_type.replace(/_/g, ' ');
      const eSrId = escHtml(sr_id || '');
      const eIssue = escHtml(issueDisplay);
      const eLoc = escHtml(location);
      const eZone = escHtml(zone);
      const eDate = escHtml(inspDate);
      const eReason = escHtml(reason || '');
      fetch(process.env.POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: inspRecipient,
          subject: `[CivicLens] Inspection Scheduled${eSrId ? ' — ' + eSrId : ''} — ${eDate}`,
          body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background-color:#1e3a5f}@media(prefers-color-scheme:dark){.card{background-color:#111827!important}.card-text{color:#f9fafb!important}.muted{color:#9ca3af!important}.footer{background-color:#111827!important;border-color:#374151!important}}</style></head><body style="margin:0;padding:0;background-color:#1e3a5f"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e3a5f"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden"><tr><td style="background-color:#1e3a5f;padding:36px 32px 28px;text-align:center"><div style="display:inline-block;background-color:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px"><span style="font-size:22px;font-weight:800;color:#fff">&#127963; CivicLens</span></div><h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff">&#128269; Inspection Scheduled</h1><p style="margin:0;font-size:14px;color:#bfdbfe">City of Lake Forest, Illinois</p></td></tr><tr><td class="card" style="background-color:#fff;padding:28px 32px">${sr_id ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#dbeafe;border:2px solid #93c5fd;border-radius:12px;margin-bottom:20px"><tr><td style="padding:14px 20px;text-align:center"><span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1.2px;display:block;margin-bottom:2px">Service Request</span><span style="font-family:'Courier New',monospace;font-size:20px;font-weight:800;color:#1e40af;letter-spacing:2px">${eSrId}</span></td></tr></table>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border-left:4px solid #f59e0b;border:1.5px solid #fde68a;background-color:#fffbeb;margin-bottom:24px"><tr><td width="48" style="padding:18px 20px;vertical-align:middle;text-align:center;font-size:36px">&#128197;</td><td style="padding:18px 20px 18px 0"><div class="card-text" style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px">Inspection Date: ${eDate}</div><div class="muted" style="font-size:14px;color:#374151;line-height:1.5">A city inspector will assess the reported issue at the location below.</div></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;border-radius:12px;border:1px solid #d1d5db;margin-bottom:24px"><tr><td style="padding:20px 20px 6px"><span class="muted" style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Inspection Details</span></td></tr><tr><td style="padding:8px 20px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;width:110px;border-bottom:1px solid #e5e7eb">Issue Type</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${eIssue}</td></tr><tr><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Location</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">&#128205; ${eLoc}</td></tr><tr><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Zone</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">${eZone}</td></tr><tr><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Date</td><td class="card-text" style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">&#128197; ${eDate}</td></tr>${reason ? `<tr><td class="muted" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600">Reason</td><td class="card-text" style="padding:10px 0;font-size:14px;color:#111827">${eReason}</td></tr>` : ''}</table></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:24px"><tr><td style="padding:16px 20px"><div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:6px">&#9989; What happens next?</div><div style="font-size:13px;color:#15803d;line-height:1.6">A city inspector will visit the location on the scheduled date to assess the issue. You'll receive another email once the inspection is complete with findings and recommended next steps.</div></td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="border-radius:10px;background-color:#2563eb;text-align:center"><a href="${siteUrl}${sr_id ? '/#track=' + encodeURIComponent(sr_id) : ''}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#fff;text-decoration:none">${sr_id ? '&#128270; Track This Request' : '&#127963; Visit CivicLens'}</a></td></tr></table></td></tr><tr><td class="footer" style="background-color:#f9fafb;border-top:1px solid #d1d5db;padding:20px 32px;text-align:center"><p class="muted" style="margin:0 0 4px;font-size:12px;color:#374151;font-weight:600">City of Lake Forest &middot; Powered by CivicLens</p><p class="muted" style="margin:0;font-size:11px;color:#6b7280">Automated inspection notification &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></td></tr></table></td></tr></table></body></html>`,
        }),
      }).catch(err => console.warn('[Power Automate] Inspection webhook failed:', err.message));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // ─── Staff: Complete Inspection with Results ──────────────────────
  if (req.method === 'POST' && req.url === '/api/staff/inspect/complete') {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required' }));
      return;
    }
    const MAX_BODY = 6 * 1024 * 1024; // 6 MB for photo
    let body = '';
    let tooBig = false;
    for await (const chunk of req) { body += chunk; if (body.length > MAX_BODY) { tooBig = true; break; } }
    if (tooBig) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request too large. Photo must be under 5 MB.' }));
      return;
    }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const { wo_id, sr_id: compSrId, finding, notes, next_action, photo } = parsed;
    const validFindings = ['resolved', 'needs_repair', 'needs_further_review', 'no_issue_found'];
    if (!wo_id || !finding || !validFindings.includes(finding)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Required: wo_id, finding (resolved|needs_repair|needs_further_review|no_issue_found)' }));
      return;
    }

    // Update the inspection work order
    const allWO = getData().workOrders;
    const wo = allWO.find(w => w.id === wo_id);
    if (!wo) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Work order not found' }));
      return;
    }

    // Save inspection photo if provided
    let photoUrl = null;
    if (photo && typeof photo === 'string' && photo.startsWith('data:image/')) {
      try {
        const { randomUUID } = await import('node:crypto');
        const match = photo.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
        if (match) {
          const ext = match[1].replace('jpeg', 'jpg');
          const photoName = `insp_${wo_id.replace(/\s+/g, '_')}_${randomUUID().slice(0, 8)}.${ext}`;
          const uploadsDir = join(__dirname, 'public', 'uploads');
          const { mkdir: mkdirAsync, writeFile: writeFileAsync } = await import('node:fs/promises');
          await mkdirAsync(uploadsDir, { recursive: true });
          await writeFileAsync(join(uploadsDir, photoName), Buffer.from(match[2], 'base64'));
          photoUrl = `/uploads/${photoName}`;
        }
      } catch { /* photo save failed — continue without it */ }
    }

    const findingLabels = { resolved: 'Resolved on-site', needs_repair: 'Needs repair crew', needs_further_review: 'Needs further review', no_issue_found: 'No issue found' };

    wo.status = finding === 'resolved' || finding === 'no_issue_found' ? 'completed' : 'in_progress';
    wo.completed_date = wo.status === 'completed' ? new Date().toISOString() : null;
    wo.notes = `Inspection result: ${findingLabels[finding]}. ${notes || ''}`.trim();
    if (photoUrl) wo.inspection_photo = photoUrl;
    wo.inspection_finding = finding;

    persistWorkOrders().catch(() => {});

    // Update linked service request
    const linkedSR2 = compSrId ? serviceRequests.find(s => s.id === compSrId) : null;
    if (linkedSR2) {
      const srStatusMap = { resolved: 'completed', needs_repair: 'in_progress', needs_further_review: 'in_progress', no_issue_found: 'completed' };
      linkedSR2.status = srStatusMap[finding];
      linkedSR2.updated_date = new Date().toISOString();
      if (linkedSR2.status === 'completed') linkedSR2.completed_date = linkedSR2.updated_date;
      linkedSR2.updates = linkedSR2.updates || [];
      const updateNote = `Inspection complete: ${findingLabels[finding]}.${next_action ? ' Next: ' + next_action : ''}${notes ? ' Notes: ' + notes : ''}`;
      linkedSR2.updates.push({ date: linkedSR2.updated_date, note: updateNote, by: 'Inspector' });
      persistServiceRequests().catch(() => {});
      notifySubscribers(linkedSR2.id, { note: updateNote, status: linkedSR2.status, by: 'Inspector' });

      // Email resident with inspection results
      sendStatusUpdateEmail(linkedSR2, linkedSR2.status, updateNote).catch(() => {});
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, finding, work_order: wo, sr_updated: !!linkedSR2 }));
    return;
  }

  // ─── Staff Auth: PIN verification ──────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/staff/auth') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 256) req.destroy(); });
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        if (!pin || !verifyStaffPin(pin)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid staff PIN' }));
          return;
        }
        const token = createStaffToken(clientIP);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // ─── Staff Auth: Logout ────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/staff/logout') {
    const auth = req.headers['authorization'];
    if (auth?.startsWith('Bearer ')) staffSessions.delete(auth.slice(7));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // ─── Staff Command Center API (supervisor-only, token-protected) ──
  if (req.method === 'GET' && req.url.startsWith('/api/staff/dashboard')) {
    if (!validateStaffToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Staff authentication required' }));
      return;
    }
    try {
      const [woData, srData] = await Promise.all([
        callToolDirect('get_work_orders', {}),
        callToolDirect('get_service_requests', {}),
      ]);
      const openSR = srData.filter(s => s.status === 'open');
      const inProgressSR = srData.filter(s => s.status === 'in_progress');
      const completedSR = srData.filter(s => s.status === 'completed');
      const openWO = woData.filter(w => w.status === 'open');
      const inProgressWO = woData.filter(w => w.status === 'in_progress');
      const criticalWO = woData.filter(w => w.priority === 'critical' || w.priority === 'high');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        service_requests: srData,
        work_orders: woData,
        kpis: {
          sr_open: openSR.length,
          sr_in_progress: inProgressSR.length,
          sr_completed: completedSR.length,
          sr_total: srData.length,
          wo_open: openWO.length,
          wo_in_progress: inProgressWO.length,
          wo_critical: criticalWO.length,
          wo_total: woData.length,
        },
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load staff dashboard' }));
    }
    return;
  }

  // ─── Audit Log Endpoint (supervisor-only) ─────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/api/audit')) {
    const urlParams = new URL(req.url, `http://localhost`).searchParams;
    const role = urlParams.get('role') || 'public';
    if (role !== 'supervisor') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Audit log requires supervisor role' }));
      return;
    }
    const limit = Math.min(parseInt(urlParams.get('limit') || '100', 10), 500);
    try {
      const raw = await readFile(AUDIT_LOG_PATH, 'utf-8').catch(() => '');
      const lines = raw.trim().split('\n').filter(Boolean);
      const entries = lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: lines.length, returned: entries.length, entries }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: 0, returned: 0, entries: [] }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Helper: notify subscribers when a service request is updated
function notifySubscribers(trackingNumber, update) {
  const subs = notificationSubscribers.get(trackingNumber);
  if (!subs || subs.length === 0) return;
  const data = JSON.stringify({ tracking_number: trackingNumber, ...update, timestamp: new Date().toISOString() });
  for (const res of subs) {
    try { res.write(`event: update\ndata: ${data}\n\n`); } catch { /* client disconnected */ }
  }
}

await ensurePersistentData();
await initData();
const { workOrders, potholes, sidewalkIssues, schools, serviceRequests } = getData();

// Launch standalone MCP server as a child process
const MCP_PORT = process.env.MCP_PORT || 3000;
const MCP_INTERNAL_SECRET = randomBytes(32).toString('hex');
process.env.MCP_INTERNAL_SECRET = MCP_INTERNAL_SECRET; // Share with agent pipeline
const mcpChild = fork(join(__dirname, 'mcp-server', 'server.js'), [], {
  env: { ...process.env, MCP_PORT, MCP_INTERNAL_SECRET },
  stdio: 'inherit',
});
mcpChild.on('error', (err) => console.error('MCP server error:', err.message));

server.listen(PORT, () => {
  console.log(`CivicLens running on http://localhost:${PORT}`);
  console.log(`  UI:        http://localhost:${PORT}/`);
  console.log(`  Chat API:  POST http://localhost:${PORT}/api/chat`);
  console.log(`  Stream:    POST http://localhost:${PORT}/api/chat/stream`);
  console.log(`  Dashboard: POST http://localhost:${PORT}/api/dashboard`);
  console.log(`  Community: GET  http://localhost:${PORT}/api/community`);
  console.log(`  Map Data:  GET  http://localhost:${PORT}/api/map-data`);
  console.log(`  Forecast:  POST http://localhost:${PORT}/api/forecast`);
  console.log(`  What-If:   POST http://localhost:${PORT}/api/whatif`);
  console.log(`  Export:    GET  http://localhost:${PORT}/api/export?dataset=work_orders&format=csv`);
  console.log(`  Notify:    GET  http://localhost:${PORT}/api/notifications/subscribe/:id`);
  console.log(`  Requests:  POST http://localhost:${PORT}/api/service-request`);
  console.log(`  MCP:       POST http://localhost:${MCP_PORT}/mcp (standalone)`);
  console.log(`  Health:    GET  http://localhost:${PORT}/health`);

  // Initialize local inference model in background (non-blocking)
  initLocalClassifier().then(ready => {
    if (ready) console.log('  Local AI:  mobilebert-uncased-mnli (offline-ready)');
    else console.log('  Local AI:  not available (install @huggingface/transformers for offline mode)');
  });
});
