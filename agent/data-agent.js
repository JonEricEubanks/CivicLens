/**
 * Data Agent — Stage 2 of the CivicLens pipeline
 *
 * ReAct-style agentic tool loop: the LLM autonomously decides which
 * MCP tools to call based on the user's intent and intermediate results.
 * Supports multi-step reasoning with up to MAX_ITERATIONS tool calls.
 * Falls back to deterministic routing if LLM is unavailable.
 */

import { callTool } from './mcp-client.js';
import { ChatOpenAI } from '@langchain/openai';
import { retrieve } from '../rag/rag_knowledge_base.js';
import { isRateLimited, markRateLimited } from './rate-limit.js';

const MAX_ITERATIONS = 3;

// ── Tool Call Cache (deduplicates identical calls across iterations) ─
const toolCallCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(name, args) {
  return `${name}:${JSON.stringify(args, Object.keys(args || {}).sort())}`;
}

function getCached(name, args) {
  const key = getCacheKey(name, args);
  const entry = toolCallCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.result;
  if (entry) toolCallCache.delete(key);
  return null;
}

function setCache(name, args, result) {
  // Only cache read tools, not actions
  const actionTools = ['dispatch_crew', 'update_work_order_status', 'schedule_inspection', 'submit_service_request'];
  if (actionTools.includes(name)) return;
  toolCallCache.set(getCacheKey(name, args), { result, ts: Date.now() });
}

export function clearToolCache() { toolCallCache.clear(); }

// ── Available MCP Tools (schema for LLM) ────────────────────────────
const TOOL_SCHEMAS = [
  { name: 'get_work_orders', description: 'Query work orders for infrastructure repairs. Returns array with status, priority, type, location, cost. Use id to look up a specific work order.', parameters: { id: 'specific work order ID e.g. WO-2024-003 (optional)', status: 'open|in_progress|completed (optional)', zone: 'NW-3|NE-1|SE-2|SW-1 (optional)', type: 'pothole_repair|sidewalk_replacement|concrete_repair (optional)', priority: 'critical|high|medium|low (optional)' } },
  { name: 'get_potholes', description: 'Get pothole reports with severity, location, school proximity.', parameters: { zone: '(optional)', severity_min: 'number 1-10 (optional)', near_school_only: 'true to filter school-adjacent (optional)' } },
  { name: 'get_sidewalk_issues', description: 'Get sidewalk issues with ADA compliance status, heave measurements.', parameters: { zone: '(optional)', ada_non_compliant: 'true to filter non-compliant only (optional)' } },
  { name: 'get_schools', description: 'Get school catalog with names, types, enrollment, locations.', parameters: {} },
  { name: 'get_service_requests', description: 'Get resident service requests. Filter by zone, status, or category.', parameters: { zone: '(optional)', status: 'open|in_progress|completed (optional)', category: '(optional)' } },
  { name: 'calculate_priority_score', description: 'Calculate Weibull decay priority score for an infrastructure issue. Returns score 0-200 with risk level.', parameters: { severity: 'number 1-10', type: 'pothole|sidewalk|concrete', reported_date: 'ISO date string', school_distance_ft: 'number', near_school: 'boolean', traffic_volume: 'high|medium|low' } },
  { name: 'forecast_deterioration', description: 'Predict future deterioration for infrastructure issues. Returns 30/90/180 day severity forecasts and expected failure date.', parameters: { issue_type: 'pothole|sidewalk|concrete', current_severity: 'number 1-10', reported_date: 'ISO date string', traffic_volume: 'high|medium|low' } },
  { name: 'dispatch_crew', description: 'Dispatch a repair crew to a work order. REQUIRES CONFIRMATION.', parameters: { work_order_id: 'e.g. WO-001', crew_id: 'e.g. Crew-A', scheduled_date: 'ISO date (optional)' } },
  { name: 'update_work_order_status', description: 'Update the status of a work order. REQUIRES CONFIRMATION.', parameters: { work_order_id: 'e.g. WO-001', new_status: 'open|in_progress|completed', notes: '(optional)' } },
  { name: 'schedule_inspection', description: 'Schedule a new inspection for a location. REQUIRES CONFIRMATION.', parameters: { issue_type: 'pothole|sidewalk|concrete', location: 'street address', zone: 'e.g. NE-1', scheduled_date: 'ISO date (optional)', reason: '(optional)' } },
  { name: 'submit_service_request', description: 'Submit a resident service request. Creates tracking number.', parameters: { category: 'pothole|sidewalk|streetlight|drainage|tree_damage|sign_damage|crosswalk|other', description: 'text', address: 'street address', resident_name: '(optional)', zone: '(optional)' } },
  { name: 'get_request_status', description: 'Look up a service request by tracking number.', parameters: { tracking_number: 'e.g. SR-2026-001' } },
  { name: 'whatif_budget', description: 'Model impact of budget changes. Returns projected outcomes with affected issue counts.', parameters: { budget_change_percent: 'number -100 to 100', zone: '(optional)' } },
  { name: 'retrieve_knowledge', description: 'Search the municipal knowledge base (RAG) for regulations, standards, municipal codes, and best practices. Returns relevant documents with citations.', parameters: { query: 'search query text' } },
];

const REACT_SYSTEM_PROMPT = `You are the Data Retrieval Agent for CivicLens, a municipal infrastructure intelligence system for Lake Forest, IL.

Your job is to decide which MCP tools to call to answer the user's question. You reason step-by-step about what data is needed.

## Available Tools
${TOOL_SCHEMAS.map(t => `- **${t.name}**: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`).join('\n')}

## Instructions
1. Think about what data the user needs
2. Choose which tool(s) to call. You may call multiple tools at once by returning multiple tool_calls.
3. After seeing results, decide if you need MORE data (e.g., to score potholes after fetching them)
4. When you have ENOUGH data, set "done": true

## Response Format — JSON only, no markdown fences:
{"thought":"reasoning","tool_calls":[{"tool":"name","args":{}}],"done":false}

When done: {"thought":"have enough data","tool_calls":[],"done":true}

## Rules
- For priority analysis, ALWAYS call calculate_priority_score for each issue after fetching them
- For school safety, ALWAYS fetch schools alongside potholes/sidewalks
- For zone summaries, fetch ALL data types for the zone
- For action tools (dispatch, schedule, update) — only call when user explicitly requests
- Call multiple tools in parallel when independent
- NEVER call the same tool with the same arguments twice
- Maximum ${MAX_ITERATIONS} rounds of tool calling`;

let model;
function getModel() {
  if (!model) {
    model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      timeout: 20000,
      maxRetries: 0,
      configuration: {
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: process.env.GITHUB_TOKEN,
      },
    });
  }
  return model;
}

/** Safe tool call wrapper — returns cached result or calls tool. */
async function safeCallTool(name, args = {}, role = 'public') {
  const cached = getCached(name, args);
  if (cached) return cached;
  try {
    let result;
    if (name === 'retrieve_knowledge') {
      // RAG retrieval is handled locally, not via MCP
      const docs = await retrieve(args.query || '', 3, 0.05);
      result = docs.map(d => ({ id: d.id, title: d.title, category: d.category, content: d.content, score: d.score }));
    } else {
      result = await callTool(name, args, role);
    }
    setCache(name, args, result);
    return result;
  } catch (err) {
    console.error(`[data-agent] Tool "${name}" failed:`, err.message);
    return { _error: true, tool: name, message: err.message };
  }
}

/**
 * ReAct-style agentic data fetching.
 * The LLM autonomously decides which tools to call and when it has enough data.
 */
export async function fetchData(intentResult, role = 'public') {
  try {
    return await _fetchDataInner(intentResult, role);
  } catch (err) {
    console.error('[data-agent] Unexpected crash — emergency fallback:', err.message);
    // Return minimal data structure so downstream stages don't crash
    const intent = intentResult?.intent || 'general_query';
    try {
      const plan = getFallbackPlan(intent, intentResult?.filters || {}, intentResult?.action_params || {});
      const results = await Promise.all(
        (plan.tool_calls || []).map(async (tc) => {
          const result = await safeCallTool(tc.tool, tc.args || {}, role);
          return { tool: tc.tool, args: tc.args, result };
        })
      );
      const data = {};
      const toolCalls = [];
      for (const r of results) {
        toolCalls.push({ tool: r.tool, args: r.args });
        if (r.result && !r.result._error) data[r.tool.replace(/^get_/, '')] = r.result;
      }
      return { stage: 'data', intent, tool_calls: toolCalls, data, errors: [{ tool: 'data-agent', message: err.message }], fallback_used: true, agent_reasoning: ['Data agent crashed — used emergency deterministic fallback'] };
    } catch (fallbackErr) {
      return { stage: 'data', intent, tool_calls: [], data: {}, errors: [{ tool: 'data-agent', message: err.message }], fallback_used: true, agent_reasoning: ['Data agent fully crashed — returning empty data'] };
    }
  }
}

async function _fetchDataInner(intentResult, role = 'public') {
  const { intent, filters, action_params } = intentResult;
  const allData = {};
  const allToolCalls = [];
  const errors = [];
  const thoughts = [];

  let llm;
  if (!isRateLimited()) {
    try {
      llm = getModel();
    } catch {
      // LLM unavailable — fall through to fallback below
    }
  } else {
    console.log('[data-agent] Rate limited — using deterministic fallback');
  }

  const messages = [
    { role: 'system', content: REACT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `User query: "${intentResult.raw_query}"
Intent: ${intent}
Filters: ${JSON.stringify(filters)}
Action params: ${JSON.stringify(action_params || {})}

Decide which tools to call to gather the necessary data.`,
    },
  ];

  let usedFallback = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let plan;

    if (llm && !usedFallback) {
      try {
        const response = await llm.invoke(messages);
        const clean = response.content.replace(/```json\n?|```\n?/g, '').trim();
        plan = JSON.parse(clean);
        messages.push({ role: 'assistant', content: response.content });
      } catch (err) {
        console.warn('[data-agent] LLM plan parse failed, using fallback:', err.message);
        if (err.message && err.message.includes('429')) {
          const wait = parseInt((err.message.match(/wait (\d+) seconds/i) || [])[1]) || 300;
          markRateLimited(wait);
        }
        plan = i === 0 ? getFallbackPlan(intent, filters, action_params) : { done: true, tool_calls: [], thought: 'Fallback complete' };
        usedFallback = true;
      }
    } else {
      plan = i === 0 ? getFallbackPlan(intent, filters, action_params) : { done: true, tool_calls: [], thought: 'Fallback complete' };
      usedFallback = true;
    }

    thoughts.push(plan.thought || `Iteration ${i + 1}`);

    if (plan.done || !plan.tool_calls || plan.tool_calls.length === 0) break;

    // Execute tool calls in parallel
    const callResults = await Promise.all(
      plan.tool_calls.map(async (tc) => {
        const result = await safeCallTool(tc.tool, tc.args || {}, role);
        allToolCalls.push({ tool: tc.tool, args: tc.args || {} });
        if (result?._error) errors.push({ tool: result.tool, message: result.message });
        return { tool: tc.tool, result };
      })
    );

    // Merge results
    for (const cr of callResults) {
      const key = cr.tool.replace(/^get_/, '');
      if (cr.result && !cr.result._error) allData[key] = cr.result;
    }

    if (!llm || usedFallback) continue;

    // Build observation for LLM
    const observation = callResults.map(cr => {
      if (cr.result?._error) return `Tool "${cr.tool}" FAILED: ${cr.result.message}`;
      const summary = Array.isArray(cr.result)
        ? `${cr.result.length} records returned`
        : (typeof cr.result === 'object' ? JSON.stringify(cr.result).slice(0, 500) : String(cr.result));
      return `Tool "${cr.tool}" returned: ${summary}`;
    }).join('\n');

    messages.push({
      role: 'user',
      content: `Tool results:\n${observation}\n\nDo you need more data? If you fetched potholes/sidewalks and haven't scored them yet, call calculate_priority_score for each. Respond with JSON.`,
    });
  }

  return {
    stage: 'data',
    intent,
    tool_calls: allToolCalls,
    data: allData,
    errors,
    fallback_used: usedFallback || errors.length > 0,
    agent_reasoning: thoughts,
    rag_results: allData.retrieve_knowledge || null,
  };
}

/** Deterministic intent-based fallback when LLM reasoning is unavailable. */
function getFallbackPlan(intent, filters, action_params) {
  const zone = filters?.zone;
  const zoneArg = zone ? { zone } : {};

  switch (intent) {
    case 'status_report': {
      const args = { ...zoneArg };
      if (filters?.status) args.status = filters.status;
      if (filters?.type) {
        const typeMap = { pothole: 'pothole_repair', sidewalk: 'sidewalk_replacement', concrete: 'concrete_repair' };
        args.type = typeMap[filters.type] || filters.type;
      }
      return { thought: 'Fallback: fetching work orders for status report', tool_calls: [{ tool: 'get_work_orders', args }], done: false };
    }
    case 'priority_analysis':
      return { thought: 'Fallback: fetching potholes and sidewalks for priority analysis', tool_calls: [{ tool: 'get_potholes', args: zoneArg }, { tool: 'get_sidewalk_issues', args: zoneArg }], done: false };
    case 'zone_summary':
      return { thought: 'Fallback: fetching all data types for zone summary', tool_calls: [{ tool: 'get_work_orders', args: zoneArg }, { tool: 'get_potholes', args: zoneArg }, { tool: 'get_sidewalk_issues', args: zoneArg }, { tool: 'get_schools', args: {} }], done: false };
    case 'school_safety':
      return { thought: 'Fallback: fetching school-adjacent data', tool_calls: [{ tool: 'get_potholes', args: { near_school_only: true } }, { tool: 'get_sidewalk_issues', args: { ada_non_compliant: true } }, { tool: 'get_schools', args: {} }], done: false };
    case 'dispatch_action':
      if (action_params?.work_order_id && action_params?.crew_id)
        return { thought: 'Fallback: dispatching crew', tool_calls: [{ tool: 'dispatch_crew', args: action_params }], done: false };
      return { thought: 'Fallback: fetching open work orders', tool_calls: [{ tool: 'get_work_orders', args: { status: 'open' } }], done: false };
    case 'inspection_request':
      if (action_params?.location && action_params?.issue_type)
        return { thought: 'Fallback: scheduling inspection', tool_calls: [{ tool: 'schedule_inspection', args: { issue_type: action_params.issue_type, location: action_params.location, zone: action_params.zone || filters?.zone || 'NE-1', scheduled_date: action_params.scheduled_date, reason: action_params.reason } }], done: false };
      return { thought: 'Fallback: need inspection params', tool_calls: [], done: true };
    case 'service_request_submit':
      return { thought: 'Fallback: submitting service request', tool_calls: [{ tool: 'submit_service_request', args: { category: action_params?.category || filters?.category || 'other', description: action_params?.description || '', address: action_params?.address || 'Not specified', resident_name: action_params?.resident_name || 'Chat User', zone: action_params?.zone || filters?.zone || null } }], done: false };
    case 'work_order_lookup': {
      const woId = action_params?.work_order_id;
      if (woId) return { thought: `Fallback: looking up work order ${woId}`, tool_calls: [{ tool: 'get_work_orders', args: { id: woId } }], done: false };
      return { thought: 'Fallback: fetching all work orders', tool_calls: [{ tool: 'get_work_orders', args: {} }], done: false };
    }
    case 'service_request_track': {
      const tn = action_params?.tracking_number;
      if (tn) return { thought: `Fallback: tracking request ${tn} and fetching related data`, tool_calls: [{ tool: 'get_request_status', args: { tracking_number: tn } }, { tool: 'get_service_requests', args: {} }, { tool: 'get_work_orders', args: {} }], done: false };
      return { thought: 'Fallback: browsing requests', tool_calls: [{ tool: 'get_service_requests', args: {} }], done: false };
    }
    case 'service_request_browse':
      return { thought: 'Fallback: browsing service requests', tool_calls: [{ tool: 'get_service_requests', args: zoneArg }], done: false };
    case 'neighborhood_info':
      return { thought: 'Fallback: fetching neighborhood data', tool_calls: [{ tool: 'get_work_orders', args: zoneArg }, { tool: 'get_service_requests', args: zoneArg }, { tool: 'get_potholes', args: zoneArg }, { tool: 'get_schools', args: {} }], done: false };
    default:
      return { thought: 'Fallback: general query', tool_calls: [{ tool: 'get_work_orders', args: {} }], done: false };
  }
}
