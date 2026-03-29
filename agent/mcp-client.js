/**
 * MCP Client — calls the CivicLens MCP server via JSON-RPC 2.0
 */

const MCP_URL = `http://localhost:${process.env.MCP_PORT || 3000}/mcp`;
let rpcId = 0;

export async function callMCP(method, params = {}, role = 'public') {
  const body = {
    jsonrpc: '2.0',
    id: ++rpcId,
    method,
    params,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (role === 'supervisor' && process.env.MCP_INTERNAL_SECRET) {
    headers['X-MCP-Role'] = 'supervisor';
    headers['X-MCP-Secret'] = process.env.MCP_INTERNAL_SECRET;
  }

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (json.error) throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  return json.result;
}

/**
 * Call an MCP tool by name with arguments.
 * Optionally pass a role for RBAC (defaults to 'public').
 */
export async function callTool(name, args = {}, role = 'public') {
  const result = await callMCP('tools/call', { name, arguments: args }, role);
  const text = result?.content?.[0]?.text;
  return text ? JSON.parse(text) : result;
}

/**
 * List all available MCP tools.
 */
export async function listTools() {
  const result = await callMCP('tools/list');
  return result.tools;
}
