/**
 * CivicLens Agent Pipeline Orchestrator
 *
 * Coordinates the 5-stage pipeline with agent memory and feedback loop:
 *   Intent → Data (ReAct) → RAG Knowledge Retrieval → Synthesis → Report
 *
 * Features:
 * - Conversation memory: retains past exchanges for follow-up context
 * - Quality feedback loop: re-fetches data if coverage is insufficient
 */

import { classifyIntent } from './intent-agent.js';
import { fetchData } from './data-agent.js';
import { synthesizeReport } from './synthesis-agent.js';
import { formatReport } from './report-agent.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_PATH = join(__dirname, '..', 'mcp-server', 'data', 'conversation-memory.json');

// ── Agent Memory ────────────────────────────────────────────────────
// Sliding window of recent conversation turns for follow-up context.
// Persisted to disk so memory survives server restarts.
const MAX_MEMORY = 10;
let conversationMemory = [];

// Load persisted memory on startup
try {
  const raw = await readFile(MEMORY_PATH, 'utf-8').catch(() => '[]');
  const loaded = JSON.parse(raw);
  if (Array.isArray(loaded)) conversationMemory = loaded.slice(-MAX_MEMORY);
} catch { /* start fresh */ }

async function persistMemory() {
  try { await writeFile(MEMORY_PATH, JSON.stringify(conversationMemory, null, 2)); } catch { /* non-critical */ }
}

export function getConversationMemory() { return conversationMemory; }
export function clearConversationMemory() { conversationMemory.length = 0; persistMemory(); }

function addToMemory(role, content, metadata = {}) {
  conversationMemory.push({ role, content, metadata, ts: Date.now() });
  if (conversationMemory.length > MAX_MEMORY) conversationMemory.shift();
  persistMemory();
}

// ── Pipeline ────────────────────────────────────────────────────────

/**
 * Run the full CivicLens agent pipeline for a user message.
 */
export async function runPipeline(userMessage, role) {
  return runPipelineStreaming(userMessage, null, role);
}

/**
 * Run the pipeline with optional SSE streaming — emits stage events in real time.
 * Includes memory-augmented intent classification and quality feedback loop.
 */
export async function runPipelineStreaming(userMessage, emit, role = 'public') {
  const send = emit || (() => {});
  const startTime = Date.now();
  const stages = [];

  // Record user turn in memory
  addToMemory('user', userMessage);

  // Build context summary from memory for follow-up awareness
  const memoryContext = conversationMemory.length > 1
    ? conversationMemory.slice(0, -1).map(m => `[${m.role}]: ${m.content.slice(0, 200)}`).join('\n')
    : null;

  // Stage 1: Intent Classification (memory-augmented)
  send('stage', { stage: 'intent', status: 'running', index: 0 });
  const t1 = Date.now();
  let intentResult;
  try {
    intentResult = await classifyIntent(userMessage, memoryContext);
  } catch (err) {
    console.error('[pipeline] Stage 1 Intent CRASHED — using emergency fallback:', err.message);
    intentResult = { stage: 'intent', intent: 'general_query', filters: {}, action_params: {}, summary: userMessage, raw_query: userMessage, _fallback: true, _model: 'emergency-fallback' };
  }
  const d1 = Date.now() - t1;
  stages.push({ name: 'intent', duration_ms: d1, detail: {
    intent: intentResult.intent, summary: intentResult.summary, filters: intentResult.filters,
    model: intentResult._model || 'keyword-fallback',
    validator_model: intentResult._validator_model || null,
  } });
  console.log(`[pipeline] Stage 1 Intent: ${d1}ms — ${intentResult.intent}`);
  send('stage', {
    stage: 'intent', status: 'completed', index: 0, duration_ms: d1,
    detail: {
      intent: intentResult.intent, summary: intentResult.summary, filters: intentResult.filters,
      model: intentResult._model || 'keyword-fallback',
      validator_model: intentResult._validator_model || null,
      validator_intent: intentResult._validator_intent || null,
      local_model: intentResult._local_model || null,
      local_intent: intentResult._local_intent || null,
      local_confidence: intentResult._local_confidence || null,
      models_agreed: intentResult._models_agreed,
    },
  });

  // ── Help / guidance shortcut — skip heavy data pipeline ──
  if (intentResult.intent === 'help_guidance') {
    const helpMarkdown = generateHelpResponse(intentResult);
    const helpDuration = Date.now() - startTime;
    ['data', 'synthesis', 'report'].forEach((s, i) => {
      send('stage', { stage: s, status: 'completed', index: i + 1, duration_ms: 0, detail: {} });
      stages.push({ name: s, duration_ms: 0 });
    });
    const helpResult = {
      markdown: helpMarkdown,
      report_meta: { data_coverage: { score: 100, sources_consulted: 0, total_sources: 0, records_analyzed: 0 } },
      actions_taken: [],
      pipeline: { total_duration_ms: helpDuration, stages, agent_reasoning: ['Help/guidance intent — provided direct instructions'], memory_turns: conversationMemory.length },
    };
    addToMemory('assistant', helpMarkdown.slice(0, 500), { intent: 'help_guidance' });
    send('complete', helpResult);
    return helpResult;
  }

  // Stage 2: Data Retrieval via MCP (ReAct agentic loop)
  send('stage', { stage: 'data', status: 'running', index: 1,
    detail: { tool_calls_planned: intentResult.intent },
  });
  const t2 = Date.now();
  let dataResult;
  try {
    dataResult = await fetchData(intentResult, role);
  } catch (err) {
    console.error('[pipeline] Stage 2 Data CRASHED — using empty data fallback:', err.message);
    dataResult = { stage: 'data', intent: intentResult.intent, tool_calls: [], data: {}, errors: [{ tool: 'pipeline', message: err.message }], fallback_used: true, agent_reasoning: ['Data agent crashed — returning empty data'] };
  }
  const d2 = Date.now() - t2;
  const dataToolsCalled = (dataResult.tool_calls || []).map(tc => tc.tool);
  const recordCount = Object.values(dataResult.data || {}).reduce((n, v) =>
    n + (Array.isArray(v) ? v.length : (v ? 1 : 0)), 0);
  stages.push({ name: 'data', duration_ms: d2, detail: {
    tools_called: dataToolsCalled,
    records_fetched: recordCount,
    fallback_used: dataResult.fallback_used || false,
  } });
  console.log(`[pipeline] Stage 2 Data: ${d2}ms — ${(dataResult.tool_calls||[]).length} tool calls, fallback=${dataResult.fallback_used}`);

  send('stage', {
    stage: 'data', status: 'completed', index: 1, duration_ms: d2,
    detail: {
      tools_called: dataToolsCalled,
      records_fetched: recordCount,
      errors: dataResult.errors || [],
      fallback_used: dataResult.fallback_used || false,
      agent_reasoning: dataResult.agent_reasoning || [],
    },
  });

  // Stage 3: Report Synthesis via LLM (includes RAG knowledge retrieval)
  send('stage', { stage: 'synthesis', status: 'running', index: 2,
    detail: { model: 'gpt-4o-mini', rag_enabled: true },
  });
  const t3 = Date.now();
  let synthesisResult;
  try {
    synthesisResult = await synthesizeReport(dataResult, intentResult, role);
  } catch (err) {
    console.error('[pipeline] Stage 3 Synthesis CRASHED — using emergency fallback:', err.message);
    synthesisResult = { stage: 'synthesis', report: { title: 'Service Temporarily Limited', key_findings: ['Our AI analysis is temporarily unavailable, but your data was still retrieved from the municipal database.'], sections: [{ heading: 'What Happened', content: 'The report generation encountered an issue. The raw data from the database is still available.' }], recommended_actions: ['Try asking again in a few minutes'], confidence: 0.3, data_sources: (dataResult.tool_calls || []).map(tc => tc.tool) }, rag_sources: [] };
  }
  const d3 = Date.now() - t3;
  stages.push({ name: 'synthesis', duration_ms: d3, detail: {
    sections: synthesisResult.report?.sections?.length || 0,
    findings: synthesisResult.report?.key_findings?.length || 0,
    recommendations: synthesisResult.report?.recommended_actions?.length || 0,
    rag_sources: synthesisResult.rag_sources || [],
  } });
  console.log(`[pipeline] Stage 3 Synthesis: ${d3}ms — total elapsed: ${Date.now() - startTime}ms`);
  send('stage', {
    stage: 'synthesis', status: 'completed', index: 2, duration_ms: d3,
    detail: {
      sections: synthesisResult.report?.sections?.length || 0,
      findings: synthesisResult.report?.key_findings?.length || 0,
      recommendations: synthesisResult.report?.recommended_actions?.length || 0,
      rag_sources: synthesisResult.rag_sources || [],
    },
  });

  // ── Quality Feedback Loop ─────────────────────────────────────────
  // If data coverage is below threshold, attempt one retry with broader filters
  const coverage = calculateCoverage(dataResult, intentResult);
  if (coverage < 0.4 && !dataResult._retried) {
    send('stage', { stage: 'feedback', status: 'running', index: 3,
      detail: { reason: `Data coverage ${(coverage * 100).toFixed(0)}% below 40% threshold — retrying with broader filters` },
    });
    const broadenedIntent = { ...intentResult, filters: {}, raw_query: intentResult.raw_query };
    const retryResult = await fetchData(broadenedIntent, role);
    retryResult._retried = true;

    // Merge new data with existing (prefer larger datasets)
    for (const [key, val] of Object.entries(retryResult.data || {})) {
      const existing = dataResult.data[key];
      if (!existing || (Array.isArray(val) && val.length > (Array.isArray(existing) ? existing.length : 0))) {
        dataResult.data[key] = val;
      }
    }
    dataResult.tool_calls = [...dataResult.tool_calls, ...retryResult.tool_calls];
    dataResult.agent_reasoning = [...(dataResult.agent_reasoning || []), 'Feedback loop: broadened filters due to low coverage'];

    const fbDetail = { skipped: false, coverage_pct: Math.round(coverage * 100), new_records: Object.values(retryResult.data || {}).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0) };
    stages.push({ name: 'feedback', duration_ms: 0, detail: fbDetail });
    send('stage', { stage: 'feedback', status: 'completed', index: 3, detail: fbDetail });
  } else {
    // Coverage sufficient — emit skipped feedback stage so UI shows all 5 stages
    const fbDetail = { skipped: true, coverage_pct: Math.round(coverage * 100) };
    stages.push({ name: 'feedback', duration_ms: 0, detail: fbDetail });
    send('stage', { stage: 'feedback', status: 'completed', index: 3, duration_ms: 0, detail: fbDetail });
  }

  // Stage 5: Report Formatting
  send('stage', { stage: 'report', status: 'running', index: 4 });
  const t4 = Date.now();
  let reportResult;
  try {
    reportResult = formatReport(synthesisResult, intentResult, dataResult);
  } catch (err) {
    console.error('[pipeline] Stage 5 Report CRASHED — using emergency fallback:', err.message);
    const fallbackMd = `## ${synthesisResult.report?.title || 'CivicLens Report'}\n\n${(synthesisResult.report?.key_findings || ['No findings available']).map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n${(synthesisResult.report?.sections || []).map(s => `### ${s.heading}\n${s.content}`).join('\n\n')}`;
    reportResult = { markdown: fallbackMd, report_meta: { title: synthesisResult.report?.title || 'Report', data_coverage: { score: 0, sources_consulted: 0, total_sources: 4, records_analyzed: 0 }, timestamp: new Date().toISOString() }, summary_stats: [], chart_data: null, key_findings: synthesisResult.report?.key_findings || [], recommended_actions: synthesisResult.report?.recommended_actions || [], actions_taken: [], trace: [] };
  }
  const d4 = Date.now() - t4;
  stages.push({ name: 'report', duration_ms: d4, detail: {
    data_coverage: reportResult.report_meta?.data_coverage,
    actions_taken: reportResult.actions_taken?.length || 0,
    markdown_length: reportResult.markdown?.length || 0,
  } });
  send('stage', {
    stage: 'report', status: 'completed', index: 4, duration_ms: d4,
    detail: {
      data_coverage: reportResult.report_meta?.data_coverage,
      actions_taken: reportResult.actions_taken?.length || 0,
      markdown_length: reportResult.markdown?.length || 0,
    },
  });

  const result = {
    ...reportResult,
    rag_sources: synthesisResult.rag_sources || [],
    pipeline: {
      total_duration_ms: Date.now() - startTime,
      stages,
      agent_reasoning: dataResult.agent_reasoning || [],
      memory_turns: conversationMemory.length,
    },
  };

  // Record assistant response in memory
  addToMemory('assistant', result.markdown?.slice(0, 500) || '', {
    intent: intentResult.intent,
    data_coverage: reportResult.report_meta?.data_coverage,
  });

  send('complete', result);
  return result;
}

/** Generate direct help/guidance responses for how-to questions. */
function generateHelpResponse(intentResult) {
  const q = (intentResult.raw_query || '').toLowerCase();

  if (q.includes('report') || q.includes('submit') || q.includes('issue') || q.includes('problem')) {
    return `## How to Report an Issue\n\nReporting a problem in Lake Forest is easy — here's how:\n\n### Option 1: Service Portal (Recommended)\n1. Click the **"Report an Issue"** button on the home screen, or tap **Report** in the navigation bar\n2. Our AI wizard will guide you step-by-step:\n   - **Step 1:** Describe the issue in your own words — the AI will auto-detect the category\n   - **Step 2:** Set the location using the interactive map or type an address\n   - **Step 3:** Optionally attach a photo for faster resolution\n   - **Step 4:** Review and submit\n3. You'll receive a **tracking number** (e.g., SR-2026-001) to check on your request later\n\n### Option 2: Tell the AI Assistant\nJust describe the problem right here in this chat! For example:\n- *"There's a pothole on Oak Avenue"*\n- *"Broken streetlight at 500 Western Ave"*\n\nI'll pre-fill the service request form for you.\n\n### What Can You Report?\nPotholes, broken sidewalks, streetlight outages, drainage issues, tree damage, damaged signs, crosswalk problems, and more.`;
  }

  if (q.includes('track') || q.includes('status') || q.includes('check') || q.includes('follow up')) {
    return `## How to Track a Service Request\n\nOnce you've submitted a report, tracking it is simple:\n\n### Option 1: Service Portal\n1. Click **"Track a Request"** on the home screen or open the **Service Portal**\n2. Enter your **tracking number** (e.g., SR-2026-001)\n3. You'll see the current status, any crew assignments, and estimated completion\n\n### Option 2: Ask the AI\nJust type your tracking number in this chat, like:\n- *"What's the status of SR-2026-001?"*\n\nI'll look it up instantly and give you an update.\n\n### Request Statuses\n- **Open** — Received and under review\n- **In Progress** — A crew has been assigned and work is underway\n- **Completed** — The issue has been resolved`;
  }

  // Generic help
  return `## Welcome to CivicLens — Here's What You Can Do\n\nCivicLens is your AI-powered gateway to Lake Forest community infrastructure. Here's how to get started:\n\n### Report an Issue\nSee a pothole, broken sidewalk, or streetlight out? Click **"Report an Issue"** on the home screen. Our AI wizard walks you through it in seconds.\n\n### Track a Request\nAlready reported something? Open the **Service Portal** and enter your tracking number to see real-time status updates.\n\n### Explore the Map\nClick **"Explore the Map"** to see all reported issues, active repairs, and infrastructure across Lake Forest on an interactive map.\n\n### Ask the AI Assistant\nThat's me! You can ask me anything about Lake Forest infrastructure:\n- *"What are the top open issues?"*\n- *"Are there potholes near Deer Path School?"*\n- *"How's the southeast neighborhood doing?"*\n\n### Analytics & Reports\nNeed deeper insights? Use the **Analytics Dashboard** for data trends or **Generate Reports** for AI-powered analysis documents.`;
}

/** Estimate data coverage ratio for the feedback loop. */
function calculateCoverage(dataResult, intentResult) {
  const data = dataResult.data || {};
  const hasData = Object.values(data).some(v =>
    Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object' && !v._error)
  );
  if (!hasData) return 0;

  // Simple heuristic: expected data sources per intent
  const expected = {
    zone_summary: ['work_orders', 'potholes', 'sidewalk_issues', 'schools'],
    school_safety: ['potholes', 'sidewalk_issues', 'schools'],
    priority_analysis: ['potholes', 'sidewalk_issues'],
    neighborhood_info: ['work_orders', 'potholes', 'schools', 'service_requests'],
    help_guidance: [],
    service_request_track: ['request_status'],
    service_request_browse: ['service_requests'],
    service_request_submit: ['service_requests'],
    status_report: ['work_orders'],
    dispatch_action: ['work_orders'],
    inspection_request: ['work_orders'],
    general_query: ['work_orders'],
  };
  const keys = expected[intentResult.intent] || ['work_orders'];
  const found = keys.filter(k => {
    const v = data[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
  return found.length / keys.length;
}
