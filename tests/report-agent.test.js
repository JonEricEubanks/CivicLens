/**
 * Unit tests for the Report Agent — formatReport, data coverage calculation,
 * equity disclosure, markdown output, trace, and summary stats
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { formatReport } from '../agent/report-agent.js';

// Helper: build standard test inputs
function makeSynthesis(overrides = {}) {
  return {
    stage: 'synthesis',
    report: {
      title: 'Test Report',
      key_findings: ['Finding 1', 'Finding 2'],
      sections: [
        { heading: 'Overview', content: 'Test content.' },
        { heading: 'Analysis', content: 'More analysis.' },
      ],
      recommended_actions: ['Action 1', 'Action 2'],
      confidence: 0.85,
      data_sources: ['get_work_orders', 'get_potholes'],
      chart_data: { type: 'bar', title: 'Test', labels: ['A', 'B'], values: [10, 20], colors: ['#f00', '#0f0'] },
    },
    rag_sources: [
      { id: 'doc1', title: 'Municipal Code §7-3-1', category: 'legal', score: 0.92 },
      { id: 'doc2', title: 'APWA Standards', category: 'repair_standards', score: 0.78 },
    ],
    ...overrides,
  };
}

function makeIntent(overrides = {}) {
  return {
    stage: 'intent',
    intent: 'priority_analysis',
    summary: 'Priority analysis of potholes',
    filters: {},
    raw_query: 'What are the highest priority potholes?',
    _model: 'gpt-4o-mini',
    _validator_model: 'Phi-3-mini-4k-instruct',
    _models_agreed: true,
    ...overrides,
  };
}

function makeData(overrides = {}) {
  return {
    stage: 'data',
    intent: 'priority_analysis',
    tool_calls: [
      { tool: 'get_potholes', args: {} },
      { tool: 'calculate_priority_score', args: { severity: 8 } },
    ],
    data: {
      potholes: [
        { id: 'PH-001', severity: 8, status: 'open', near_school: true },
        { id: 'PH-002', severity: 5, status: 'open', near_school: false },
      ],
    },
    errors: [],
    fallback_used: false,
    agent_reasoning: ['Fetched potholes', 'Scored priorities'],
    ...overrides,
  };
}

describe('Report Agent — formatReport', () => {

  it('produces markdown with title, findings, sections, and actions', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.ok(result.markdown.includes('## Test Report'));
    assert.ok(result.markdown.includes('Finding 1'));
    assert.ok(result.markdown.includes('Finding 2'));
    assert.ok(result.markdown.includes('### Overview'));
    assert.ok(result.markdown.includes('### Analysis'));
    assert.ok(result.markdown.includes('### What You Can Do'));
    assert.ok(result.markdown.includes('Action 1'));
  });

  it('includes data equity note with record count and source count', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.ok(result.markdown.includes('Based on'));
    assert.ok(result.markdown.includes('records from'));
    assert.ok(result.markdown.includes('data sources'));
  });

  it('returns report_meta with data_coverage', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    const cov = result.report_meta.data_coverage;
    assert.ok(typeof cov.score === 'number');
    assert.ok(cov.score >= 0 && cov.score <= 100);
    assert.ok(typeof cov.sources_consulted === 'number');
    assert.ok(typeof cov.total_sources === 'number');
    assert.ok(typeof cov.records_analyzed === 'number');
    assert.ok(Array.isArray(cov.tools_used));
  });

  it('data_coverage reflects actual tools used', () => {
    const data = makeData({
      tool_calls: [
        { tool: 'get_potholes', args: {} },
        { tool: 'get_sidewalk_issues', args: {} },
        { tool: 'get_work_orders', args: {} },
        { tool: 'get_schools', args: {} },
      ],
      data: {
        potholes: [{ id: 'PH-001' }],
        sidewalk_issues: [{ id: 'SW-001' }],
        work_orders: [{ id: 'WO-001' }],
        schools: [{ id: 'S-001' }],
      },
    });
    const result = formatReport(makeSynthesis(), makeIntent(), data);
    assert.equal(result.report_meta.data_coverage.sources_consulted, 4);
    assert.equal(result.report_meta.data_coverage.total_sources, 4);
    assert.equal(result.report_meta.data_coverage.score, 100);
  });

  it('data_coverage is 0 when no tools called', () => {
    const data = makeData({ tool_calls: [], data: {} });
    const result = formatReport(makeSynthesis(), makeIntent(), data);
    assert.equal(result.report_meta.data_coverage.score, 0);
    assert.equal(result.report_meta.data_coverage.sources_consulted, 0);
  });

  it('returns 4-stage trace with expected stages', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.equal(result.trace.length, 4);
    assert.equal(result.trace[0].stage, 'Intent Classification');
    assert.equal(result.trace[1].stage, 'Data Retrieval');
    assert.equal(result.trace[2].stage, 'Report Synthesis');
    assert.equal(result.trace[3].stage, 'Report Formatting');
    result.trace.forEach(t => assert.equal(t.status, 'completed'));
  });

  it('trace includes model info from intent result', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.equal(result.trace[0].result.model, 'gpt-4o-mini');
    assert.equal(result.trace[0].result.validator_model, 'Phi-3-mini-4k-instruct');
  });

  it('includes chart_data from synthesis', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.ok(result.chart_data);
    assert.equal(result.chart_data.type, 'bar');
    assert.equal(result.chart_data.title, 'Test');
  });

  it('returns null chart_data when synthesis has none', () => {
    const synth = makeSynthesis();
    delete synth.report.chart_data;
    const result = formatReport(synth, makeIntent(), makeData());
    assert.equal(result.chart_data, null);
  });

  it('includes key_findings and recommended_actions arrays', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.deepStrictEqual(result.key_findings, ['Finding 1', 'Finding 2']);
    assert.deepStrictEqual(result.recommended_actions, ['Action 1', 'Action 2']);
  });

  it('tracks action tools in actions_taken', () => {
    const data = makeData({
      tool_calls: [
        { tool: 'get_potholes', args: {} },
        { tool: 'dispatch_crew', args: { work_order_id: 'WO-001', crew_id: 'Crew-A' } },
      ],
    });
    const result = formatReport(makeSynthesis(), makeIntent(), data);
    assert.equal(result.actions_taken.length, 1);
    assert.equal(result.actions_taken[0].tool, 'dispatch_crew');
    assert.equal(result.actions_taken[0].label, 'Crew Dispatch System');
  });

  it('includes RAG sources summary (max 3)', () => {
    const synth = makeSynthesis({
      rag_sources: [
        { id: 'a', title: 'Doc A', category: 'legal', score: 0.9 },
        { id: 'b', title: 'Doc B', category: 'safety', score: 0.8 },
        { id: 'c', title: 'Doc C', category: 'budget', score: 0.7 },
        { id: 'd', title: 'Doc D', category: 'weather', score: 0.6 },
      ],
    });
    const result = formatReport(synth, makeIntent(), makeData());
    assert.ok(result.rag_sources_summary.length <= 3);
  });

  it('handles empty report gracefully', () => {
    const synth = makeSynthesis({
      report: { title: '', key_findings: [], sections: [], recommended_actions: [] },
      rag_sources: [],
    });
    const result = formatReport(synth, makeIntent(), makeData({ tool_calls: [], data: {} }));
    assert.ok(result.markdown.includes('##'));
    assert.equal(result.report_meta.data_coverage.score, 0);
  });

  it('builds summary_stats from data', () => {
    const data = makeData({
      data: {
        potholes: [
          { id: 'PH-001', severity: 8, status: 'open', near_school: true, estimated_cost: 500 },
          { id: 'PH-002', severity: 3, status: 'completed', near_school: false, estimated_cost: 200 },
        ],
        work_orders: [
          { id: 'WO-001', status: 'in_progress', priority: 'critical', estimated_cost: 1200 },
        ],
      },
    });
    const result = formatReport(makeSynthesis(), makeIntent(), data);
    assert.ok(Array.isArray(result.summary_stats));
    assert.ok(result.summary_stats.length > 0);
    // Check that stats have expected shape
    result.summary_stats.forEach(stat => {
      assert.ok(stat.label, 'Stat missing label');
      assert.ok(stat.value !== undefined, 'Stat missing value');
      assert.ok(stat.icon, 'Stat missing icon');
      assert.ok(stat.color, 'Stat missing color');
    });
  });

  it('returns stage: "report"', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.equal(result.stage, 'report');
  });

  it('includes timestamp in report_meta', () => {
    const result = formatReport(makeSynthesis(), makeIntent(), makeData());
    assert.ok(result.report_meta.timestamp);
    // Should be valid ISO date
    assert.ok(!isNaN(Date.parse(result.report_meta.timestamp)));
  });
});
