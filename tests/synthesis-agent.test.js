/**
 * Tests for the Synthesis Agent — fallback report generation
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';
import { markRateLimited, clearRateLimit } from '../agent/rate-limit.js';
import { synthesizeReport } from '../agent/synthesis-agent.js';

// Force fallback path — no LLM calls
before(() => markRateLimited(600));
after(() => clearRateLimit());

// ── Helpers ─────────────────────────────────────────────────────────
const makeDataResult = (data = {}, tool_calls = []) => ({
  stage: 'data',
  intent: 'priority_analysis',
  tool_calls,
  data,
  errors: [],
  fallback_used: true,
  agent_reasoning: ['test'],
});

const makeIntentResult = (overrides = {}) => ({
  stage: 'intent',
  intent: 'priority_analysis',
  summary: 'Priority analysis request',
  filters: {},
  raw_query: 'What are the highest priority potholes?',
  ...overrides,
});

describe('Synthesis Agent — fallback report', () => {

  it('returns stage "synthesis"', async () => {
    const result = await synthesizeReport(makeDataResult(), makeIntentResult());
    assert.equal(result.stage, 'synthesis');
  });

  it('returns a report object with required fields', async () => {
    const result = await synthesizeReport(makeDataResult(), makeIntentResult());
    assert.ok(result.report);
    assert.ok(typeof result.report.title === 'string');
    assert.ok(Array.isArray(result.report.key_findings));
    assert.ok(Array.isArray(result.report.sections));
    assert.ok(Array.isArray(result.report.recommended_actions));
    assert.ok(typeof result.report.confidence === 'number');
    assert.ok(Array.isArray(result.report.data_sources));
  });

  it('includes intent summary in title', async () => {
    const result = await synthesizeReport(makeDataResult(), makeIntentResult({ summary: 'Pothole priority analysis' }));
    assert.ok(result.report.title.includes('Pothole priority analysis'));
  });

  it('includes work order finding when work_orders present', async () => {
    const data = {
      work_orders: [
        { id: 'WO-001', status: 'open', estimated_cost: 1200 },
        { id: 'WO-002', status: 'in_progress', estimated_cost: 800 },
        { id: 'WO-003', status: 'completed', estimated_cost: 600 },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data, [{ tool: 'get_work_orders', args: {} }]), makeIntentResult());
    const finding = result.report.key_findings.find(f => f.includes('work orders'));
    assert.ok(finding, 'should mention work orders in findings');
    assert.ok(finding.includes('3'));
    assert.ok(finding.includes('1 open'));
  });

  it('includes pothole finding with school proximity', async () => {
    const data = {
      potholes: [
        { id: 'PH-001', severity: 5, near_school: true },
        { id: 'PH-002', severity: 3, near_school: false },
        { id: 'PH-003', severity: 4, near_school: true },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data, [{ tool: 'get_potholes', args: {} }]), makeIntentResult());
    const finding = result.report.key_findings.find(f => f.includes('potholes'));
    assert.ok(finding);
    assert.ok(finding.includes('3'));
    assert.ok(finding.includes('2 near schools') || finding.includes('near schools'));
  });

  it('includes pothole high severity count', async () => {
    const data = {
      potholes: [
        { id: 'PH-001', severity: 5, near_school: false },
        { id: 'PH-002', severity: 3, near_school: false },
        { id: 'PH-003', severity: 4, near_school: false },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    const finding = result.report.key_findings.find(f => f.includes('potholes'));
    assert.ok(finding);
    // severity >= 4 is "high"
    assert.ok(finding.includes('2 high severity'));
  });

  it('includes sidewalk issues with ADA non-compliant count', async () => {
    const data = {
      sidewalk_issues: [
        { id: 'SW-001', ada_compliant: false },
        { id: 'SW-002', ada_compliant: true },
        { id: 'SW-003', ada_compliant: false },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    const finding = result.report.key_findings.find(f => f.includes('sidewalk'));
    assert.ok(finding);
    assert.ok(finding.includes('2 ADA non-compliant'));
  });

  it('includes service request finding', async () => {
    const data = {
      service_requests: [
        { id: 'SR-001', status: 'open' },
        { id: 'SR-002', status: 'completed' },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    const finding = result.report.key_findings.find(f => f.includes('service requests'));
    assert.ok(finding);
    assert.ok(finding.includes('2'));
  });

  it('generates recommended actions for open work orders', async () => {
    const data = {
      work_orders: [
        { id: 'WO-001', status: 'open', estimated_cost: 500 },
        { id: 'WO-002', status: 'open', estimated_cost: 700 },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    assert.ok(result.report.recommended_actions.length > 0);
    const action = result.report.recommended_actions.find(a => a.includes('open work orders'));
    assert.ok(action);
  });

  it('generates recommended actions for school-zone potholes', async () => {
    const data = {
      potholes: [
        { id: 'PH-001', severity: 5, near_school: true },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    const action = result.report.recommended_actions.find(a => a.toLowerCase().includes('school'));
    assert.ok(action, 'should recommend fixing school-zone potholes');
  });

  it('generates recommended actions for ADA issues', async () => {
    const data = {
      sidewalk_issues: [
        { id: 'SW-001', ada_compliant: false },
      ],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    const action = result.report.recommended_actions.find(a => a.toLowerCase().includes('ada'));
    assert.ok(action, 'should recommend addressing ADA issues');
  });

  it('handles empty data gracefully', async () => {
    const result = await synthesizeReport(makeDataResult({}), makeIntentResult());
    assert.ok(result.report.key_findings.length > 0, 'should have at least one finding');
    assert.ok(result.report.key_findings[0].includes('No data'));
  });

  it('handles action results in data', async () => {
    const data = {
      dispatch_crew: { success: true, message: 'Crew-A dispatched to WO-001' },
    };
    const result = await synthesizeReport(
      makeDataResult(data, [{ tool: 'dispatch_crew', args: { work_order_id: 'WO-001', crew_id: 'Crew-A' } }]),
      makeIntentResult({ intent: 'dispatch_action' }),
    );
    const finding = result.report.key_findings.find(f => f.includes('dispatched') || f.includes('Crew'));
    assert.ok(finding, 'should include action result in findings');
  });

  it('includes data_sources from tool_calls', async () => {
    const result = await synthesizeReport(
      makeDataResult({}, [{ tool: 'get_potholes', args: {} }, { tool: 'get_schools', args: {} }]),
      makeIntentResult(),
    );
    assert.ok(result.report.data_sources.includes('get_potholes'));
    assert.ok(result.report.data_sources.includes('get_schools'));
  });

  it('sets confidence to 0.6 in fallback', async () => {
    const result = await synthesizeReport(makeDataResult(), makeIntentResult());
    assert.equal(result.report.confidence, 0.6);
  });

  it('returns rag_sources as empty array in fallback', async () => {
    const result = await synthesizeReport(makeDataResult(), makeIntentResult());
    assert.deepStrictEqual(result.rag_sources, []);
  });

  it('creates section per data type', async () => {
    const data = {
      work_orders: [{ id: 'WO-001', status: 'open', estimated_cost: 500 }],
      potholes: [{ id: 'PH-001', severity: 5, near_school: false }],
      sidewalk_issues: [{ id: 'SW-001', ada_compliant: false }],
    };
    const result = await synthesizeReport(makeDataResult(data), makeIntentResult());
    const headings = result.report.sections.map(s => s.heading);
    assert.ok(headings.some(h => h.includes('Work Order')));
    assert.ok(headings.some(h => h.includes('Pothole')));
    assert.ok(headings.some(h => h.includes('Sidewalk')));
  });
});
