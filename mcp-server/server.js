import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createDataLayer } from '../lib/data-layer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.MCP_PORT || 3000;

// Shared secret for internal supervisor calls (set by parent process or env)
const MCP_INTERNAL_SECRET = process.env.MCP_INTERNAL_SECRET || randomBytes(32).toString('hex');

// ─── Shared Data Layer ──────────────────────────────────────────────
const dataLayer = createDataLayer({
  dataDir: join(__dirname, 'data'),
  publicDir: join(__dirname, '..', 'public'),
});
const { TOOLS, initData, getData } = dataLayer;

// ─── Security: RBAC Roles ───────────────────────────────────────────
const RBAC_ROLES = {
  public: ['get_work_orders', 'get_potholes', 'get_sidewalk_issues', 'get_schools', 'get_service_requests', 'calculate_priority_score', 'forecast_deterioration', 'whatif_budget', 'get_request_status', 'submit_service_request', 'cost_of_inaction', 'get_chicago_311_benchmarks', 'get_data_provenance'],
  supervisor: ['dispatch_crew', 'update_work_order_status', 'schedule_inspection'],
};

function checkRBAC(toolName, role = 'public') {
  if (RBAC_ROLES.public.includes(toolName)) return true;
  if (role === 'supervisor' && RBAC_ROLES.supervisor.includes(toolName)) return true;
  return false;
}

// ─── JSON-RPC 2.0 Handler ───────────────────────────────────────────
function makeResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function makeError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleRPC(body, req) {
  const { id, method, params } = body;

  if (!method) return makeError(id, -32600, 'Invalid Request: missing method');

  // MCP protocol methods
  if (method === 'initialize') {
    return makeResponse(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'civiclens-mcp', version: '1.0.0' },
      capabilities: { tools: {} },
    });
  }

  if (method === 'tools/list') {
    const toolList = Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: def.inputSchema,
    }));
    return makeResponse(id, { tools: toolList });
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    if (!toolName || !TOOLS[toolName]) {
      return makeError(id, -32602, `Unknown tool: ${toolName}`);
    }

    // RBAC check — supervisor role requires internal secret header
    const role = (req.headers['x-mcp-role'] === 'supervisor' && req.headers['x-mcp-secret'] === MCP_INTERNAL_SECRET) ? 'supervisor' : 'public';
    if (!checkRBAC(toolName, role)) {
      return makeError(id, -32603, `Access denied: tool "${toolName}" requires supervisor role`);
    }

    const result = await TOOLS[toolName].handler(toolArgs);
    return makeResponse(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    });
  }

  return makeError(id, -32601, `Method not found: ${method}`);
}

// ─── HTTP Server ────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  // CORS: only allow localhost origins (internal service)
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    `http://localhost:${PORT}`,
    `http://localhost:${process.env.API_PORT || 7072}`,
    'http://127.0.0.1',
  ];
  const corsOrigin = allowedOrigins.some(o => origin.startsWith(o)) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MCP-Role, X-MCP-Secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/mcp') {
    const MAX_BODY = 1024 * 1024; // 1MB limit
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(makeError(null, -32600, 'Request too large')));
        return;
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(makeError(null, -32700, 'Parse error')));
      return;
    }

    const result = await handleRPC(parsed, req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    const { workOrders, potholes, sidewalkIssues, schools, serviceRequests } = getData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      tools: Object.keys(TOOLS).length,
      data: {
        work_orders: workOrders.length,
        potholes: potholes.length,
        sidewalk_issues: sidewalkIssues.length,
        schools: schools.length,
        service_requests: serviceRequests.length,
      },
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found. Use POST /mcp for JSON-RPC.' }));
});

await initData();

server.listen(PORT, () => {
  console.log(`CivicLens MCP Server running on http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Tools registered: ${Object.keys(TOOLS).join(', ')}`);
});
