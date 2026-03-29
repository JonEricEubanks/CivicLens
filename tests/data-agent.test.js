/**
 * Tests for the Data Agent — fallback routing, cache, and fetchData fallback path
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import { markRateLimited, clearRateLimit } from '../agent/rate-limit.js';
import { fetchData, clearToolCache } from '../agent/data-agent.js';

// Force keyword/fallback path for every test
before(() => markRateLimited(600));
after(() => clearRateLimit());
beforeEach(() => clearToolCache());

// ── Helper ──────────────────────────────────────────────────────────
const makeIntent = (intent, filters = {}, action_params = {}, raw_query = 'test query') => ({
  stage: 'intent',
  intent,
  summary: `Test ${intent}`,
  filters,
  action_params,
  raw_query,
});

// ── Fallback Plan Routing ───────────────────────────────────────────
// We verify that the deterministic fallback calls the *correct* tools for each intent
// by inspecting dataResult.tool_calls and dataResult.fallback_used.
// (MCP server is not running so tool calls will err, but we verify tool_calls list.)

describe('Data Agent — fallback plan routing', () => {

  it('routes priority_analysis to get_potholes + get_sidewalk_issues', async () => {
    const result = await fetchData(makeIntent('priority_analysis'));
    assert.ok(result.fallback_used, 'should use fallback');
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_potholes'), 'should call get_potholes');
    assert.ok(tools.includes('get_sidewalk_issues'), 'should call get_sidewalk_issues');
  });

  it('routes school_safety to potholes + sidewalks + schools', async () => {
    const result = await fetchData(makeIntent('school_safety'));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_potholes'));
    assert.ok(tools.includes('get_sidewalk_issues'));
    assert.ok(tools.includes('get_schools'));
  });

  it('passes near_school_only filter for school_safety', async () => {
    const result = await fetchData(makeIntent('school_safety'));
    const potholeTc = result.tool_calls.find(tc => tc.tool === 'get_potholes');
    assert.ok(potholeTc);
    assert.equal(potholeTc.args?.near_school_only, true);
  });

  it('routes zone_summary to 4 data sources', async () => {
    const result = await fetchData(makeIntent('zone_summary', { zone: 'NW-3' }));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_work_orders'));
    assert.ok(tools.includes('get_potholes'));
    assert.ok(tools.includes('get_sidewalk_issues'));
    assert.ok(tools.includes('get_schools'));
  });

  it('passes zone filter through to tool args', async () => {
    const result = await fetchData(makeIntent('zone_summary', { zone: 'SE-2' }));
    const woTc = result.tool_calls.find(tc => tc.tool === 'get_work_orders');
    assert.equal(woTc.args.zone, 'SE-2');
  });

  it('routes service_request_track with tracking_number to get_request_status', async () => {
    const result = await fetchData(makeIntent('service_request_track', {}, { tracking_number: 'SR-2026-005' }));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_request_status'));
    const tc = result.tool_calls.find(tc => tc.tool === 'get_request_status');
    assert.equal(tc.args.tracking_number, 'SR-2026-005');
  });

  it('routes service_request_track without tracking_number to browse', async () => {
    const result = await fetchData(makeIntent('service_request_track'));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_service_requests'));
  });

  it('routes service_request_submit to submit_service_request', async () => {
    const result = await fetchData(makeIntent('service_request_submit', {}, {
      category: 'pothole',
      description: 'Big hole on Main St',
      address: '100 Main St',
    }));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('submit_service_request'));
  });

  it('routes service_request_browse to get_service_requests', async () => {
    const result = await fetchData(makeIntent('service_request_browse'));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_service_requests'));
  });

  it('routes dispatch_action with params to dispatch_crew', async () => {
    const result = await fetchData(makeIntent('dispatch_action', {}, {
      work_order_id: 'WO-001',
      crew_id: 'Crew-A',
    }));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('dispatch_crew'));
  });

  it('routes dispatch_action without params to get_work_orders', async () => {
    const result = await fetchData(makeIntent('dispatch_action'));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_work_orders'));
  });

  it('routes inspection_request with params to schedule_inspection', async () => {
    const result = await fetchData(makeIntent('inspection_request', {}, {
      location: '200 Elm St',
      issue_type: 'pothole',
    }));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('schedule_inspection'));
  });

  it('routes inspection_request without params to done (empty calls)', async () => {
    const result = await fetchData(makeIntent('inspection_request'));
    assert.ok(result.fallback_used);
    assert.equal(result.tool_calls.length, 0);
  });

  it('routes neighborhood_info to 4 data sources', async () => {
    const result = await fetchData(makeIntent('neighborhood_info'));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_work_orders'));
    assert.ok(tools.includes('get_potholes'));
    assert.ok(tools.includes('get_service_requests'));
    assert.ok(tools.includes('get_schools'));
  });

  it('routes status_report to get_work_orders', async () => {
    const result = await fetchData(makeIntent('status_report', { status: 'open' }));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_work_orders'));
    const tc = result.tool_calls.find(tc => tc.tool === 'get_work_orders');
    assert.equal(tc.args.status, 'open');
  });

  it('routes unknown intent to get_work_orders default', async () => {
    const result = await fetchData(makeIntent('totally_unknown_intent'));
    const tools = result.tool_calls.map(tc => tc.tool);
    assert.ok(tools.includes('get_work_orders'));
  });
});

// ── Output structure ────────────────────────────────────────────────
describe('Data Agent — output structure', () => {
  it('returns standard fields on every fetchData call', async () => {
    const result = await fetchData(makeIntent('priority_analysis'));
    assert.equal(result.stage, 'data');
    assert.equal(result.intent, 'priority_analysis');
    assert.ok(Array.isArray(result.tool_calls));
    assert.ok(typeof result.data === 'object');
    assert.ok(Array.isArray(result.errors));
    assert.ok(typeof result.fallback_used === 'boolean');
    assert.ok(Array.isArray(result.agent_reasoning));
  });

  it('agent_reasoning includes at least one thought', async () => {
    const result = await fetchData(makeIntent('priority_analysis'));
    assert.ok(result.agent_reasoning.length >= 1);
    assert.ok(typeof result.agent_reasoning[0] === 'string');
  });
});

// ── Cache ────────────────────────────────────────────────────────────
describe('Data Agent — tool cache', () => {
  it('clearToolCache() does not throw', () => {
    assert.doesNotThrow(() => clearToolCache());
  });
});
