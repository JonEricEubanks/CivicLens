/**
 * Unit tests for the Intent Agent — keyword-based classification
 * Tests the offline keyword fallback path (no LLM calls needed)
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';

// We test the keyword fallback by importing classifyIntent with rate limit forced
// so it always uses the keyword path (no API calls).
import { markRateLimited, clearRateLimit } from '../agent/rate-limit.js';

// Force rate limit so classifyIntent uses keyword fallback only
before(() => { markRateLimited(600); });

// Dynamic import after rate limit is set
let classifyIntent;
before(async () => {
  const mod = await import('../agent/intent-agent.js');
  classifyIntent = mod.classifyIntent;
});

describe('Intent Agent — keyword classification', () => {

  // ── Help / guidance intents ──────────────────────────────────────
  it('classifies "how do I report a pothole?" as help_guidance', async () => {
    const result = await classifyIntent('how do I report a pothole?');
    assert.equal(result.intent, 'help_guidance');
    assert.equal(result.stage, 'intent');
  });

  it('classifies "how can I track my request?" as help_guidance', async () => {
    const result = await classifyIntent('how can I track my request?');
    assert.equal(result.intent, 'help_guidance');
  });

  it('classifies "help me" as help_guidance', async () => {
    const result = await classifyIntent('help me understand the system');
    assert.equal(result.intent, 'help_guidance');
  });

  it('classifies "what can I do here?" as help_guidance', async () => {
    const result = await classifyIntent('what can I do here?');
    assert.equal(result.intent, 'help_guidance');
  });

  // ── Service request submission ────────────────────────────────────
  it('classifies "report a pothole on Oak Ave" as service_request_submit', async () => {
    const result = await classifyIntent('I want to report a pothole on Oak Ave');
    assert.equal(result.intent, 'service_request_submit');
    assert.ok(result.action_params?.category === 'pothole' || result.filters?.type === 'pothole');
  });

  it('classifies "report a sidewalk issue" as service_request_submit', async () => {
    const result = await classifyIntent('report a broken sidewalk on Main Street');
    assert.equal(result.intent, 'service_request_submit');
  });

  // ── Service request tracking ──────────────────────────────────────
  it('classifies tracking number queries as service_request_track', async () => {
    const result = await classifyIntent('what is the status of SR-2026-001?');
    assert.equal(result.intent, 'service_request_track');
    assert.equal(result.action_params?.tracking_number, 'SR-2026-001');
  });

  it('classifies "track my request" as service_request_track', async () => {
    const result = await classifyIntent('track my request status');
    assert.equal(result.intent, 'service_request_track');
  });

  // ── Priority analysis ─────────────────────────────────────────────
  it('classifies "highest priority issues" as priority_analysis', async () => {
    const result = await classifyIntent('what are the highest priority issues?');
    assert.equal(result.intent, 'priority_analysis');
  });

  it('classifies "most urgent potholes" as priority_analysis', async () => {
    const result = await classifyIntent('show me the most urgent potholes');
    assert.equal(result.intent, 'priority_analysis');
    // 'urgent' keyword fires before standalone 'pothole' check — no type filter
  });

  it('classifies "worst issues" as priority_analysis', async () => {
    const result = await classifyIntent('what are the worst issues right now?');
    assert.equal(result.intent, 'priority_analysis');
  });

  // ── School safety ─────────────────────────────────────────────────
  it('classifies "potholes near schools" as school_safety', async () => {
    const result = await classifyIntent('are there potholes near schools?');
    assert.equal(result.intent, 'school_safety');
    assert.equal(result.filters?.near_school, true);
  });

  it('classifies "school zone safety" as school_safety', async () => {
    const result = await classifyIntent('what is the school zone safety status?');
    assert.equal(result.intent, 'school_safety');
  });

  // ── Dispatch action ───────────────────────────────────────────────
  it('classifies "dispatch crew" as dispatch_action', async () => {
    const result = await classifyIntent('dispatch a crew to fix the pothole');
    assert.equal(result.intent, 'dispatch_action');
  });

  it('classifies "send crew to WO-2024-003" as work_order_lookup (WO pattern fires first)', async () => {
    const result = await classifyIntent('send crew to WO-2024-003');
    assert.equal(result.intent, 'work_order_lookup');
    assert.equal(result.action_params?.work_order_id, 'WO-2024-003');
  });

  // ── Zone summary ──────────────────────────────────────────────────
  it('classifies zone-specific queries correctly', async () => {
    const result = await classifyIntent('show me issues in zone NW-3');
    assert.equal(result.intent, 'zone_summary');
    assert.equal(result.filters?.zone, 'NW-3');
  });

  it('extracts NE-1 zone from Deerpath mention', async () => {
    const result = await classifyIntent('what is happening on Deerpath?');
    assert.equal(result.filters?.zone, 'NE-1');
  });

  it('extracts SE-2 zone from Waukegan mention', async () => {
    const result = await classifyIntent('issues on Waukegan Road');
    assert.equal(result.filters?.zone, 'SE-2');
  });

  // ── Inspection request ────────────────────────────────────────────
  it('classifies "schedule an inspection" as inspection_request', async () => {
    const result = await classifyIntent('schedule an inspection for the sidewalk');
    assert.equal(result.intent, 'inspection_request');
  });

  // ── Neighborhood info ─────────────────────────────────────────────
  it('classifies "how is my neighborhood" as neighborhood_info', async () => {
    const result = await classifyIntent('how is my neighborhood doing?');
    assert.equal(result.intent, 'neighborhood_info');
  });

  // ── Service request browsing ──────────────────────────────────────
  it('classifies "show open service requests" as service_request_browse', async () => {
    const result = await classifyIntent('show me open service requests');
    assert.equal(result.intent, 'service_request_browse');
  });

  // ── General query fallback ────────────────────────────────────────
  it('classifies ambiguous messages as general_query', async () => {
    const result = await classifyIntent('tell me about Lake Forest');
    assert.equal(result.intent, 'general_query');
  });

  // ── Benchmark / comparison ────────────────────────────────────────
  it('classifies "compare to Chicago 311" as status_report', async () => {
    const result = await classifyIntent('compare to Chicago 311 performance');
    assert.equal(result.intent, 'status_report');
  });

  // ── Output structure ──────────────────────────────────────────────
  it('returns required output fields', async () => {
    const result = await classifyIntent('show all potholes');
    assert.equal(result.stage, 'intent');
    assert.ok(typeof result.intent === 'string');
    assert.ok(typeof result.raw_query === 'string');
    assert.ok(typeof result.summary === 'string');
    assert.ok(typeof result.filters === 'object');
  });

  it('sets _fallback flag when rate limited', async () => {
    const result = await classifyIntent('test query');
    assert.equal(result._fallback, true);
  });

  // ── Memory context parameter ──────────────────────────────────────
  it('accepts memory context without error', async () => {
    const result = await classifyIntent('what about that zone?', '[user]: show me NW-3 issues');
    assert.ok(result.intent);
  });
});

// Cleanup
after(() => { clearRateLimit(); });
