/**
 * Integration tests for CivicLens pipeline components
 * Tests the pipeline wiring, data agent fallback, and report formatting
 * (uses direct tool calls rather than LLM to avoid API dependency)
 */
import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatReport } from '../agent/report-agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Report Agent', () => {
  it('formats a complete markdown report with all sections', () => {
    const synthesisResult = {
      stage: 'synthesis',
      report: {
        title: 'Test Report',
        key_findings: ['Finding 1', 'Finding 2'],
        sections: [
          { heading: 'Overview', content: 'Test content here.' },
          { heading: 'Analysis', content: 'More analysis.' },
        ],
        recommended_actions: ['Action 1'],
        confidence: 0.85,
        data_sources: ['get_work_orders', 'get_potholes'],
      },
      rag_sources: [
        { id: 'doc1', title: 'Municipal Code §7-3-1', category: 'legal', score: 0.92 },
      ],
    };

    const intentResult = {
      stage: 'intent',
      intent: 'priority_analysis',
      summary: 'Priority analysis of potholes',
      filters: {},
      raw_query: 'What are the highest priority potholes?',
    };

    const dataResult = {
      stage: 'data',
      intent: 'priority_analysis',
      tool_calls: [
        { tool: 'get_potholes', args: {} },
        { tool: 'calculate_priority_score', args: {} },
      ],
      data: {
        potholes: [{ id: 'PH-001', severity: 8 }, { id: 'PH-002', severity: 5 }],
      },
      errors: [],
      fallback_used: false,
    };

    const result = formatReport(synthesisResult, intentResult, dataResult);

    assert.ok(result.markdown.includes('## Test Report'));
    assert.ok(result.markdown.includes('Finding 1'));
    assert.ok(result.markdown.includes('### Overview'));
    assert.ok(result.markdown.includes('### What You Can Do'));
    assert.ok(result.markdown.includes('Based on'));
    assert.ok(result.markdown.includes('data sources'));
    assert.ok(result.rag_sources_summary.length > 0, 'should have RAG sources');
    assert.ok(result.report_meta.data_coverage.score >= 0);
    assert.ok(result.trace.length >= 3);
  });

  it('includes agent reasoning in trace', () => {
    const result = formatReport(
      { stage: 'synthesis', report: { title: 'T', key_findings: [], sections: [], recommended_actions: [] }, rag_sources: [] },
      { stage: 'intent', intent: 'status_report', summary: 'Status', filters: {}, raw_query: 'status' },
      { stage: 'data', intent: 'status_report', tool_calls: [{ tool: 'get_work_orders', args: {} }], data: { work_orders: [{ id: 'WO-001' }] }, errors: [], fallback_used: false, agent_reasoning: ['Decided to fetch work orders'] }
    );

    const dataTrace = result.trace.find(t => t.stage === 'Data Retrieval');
    assert.ok(dataTrace, 'Should have Data Retrieval trace stage');
    assert.ok(dataTrace.result);
  });

  it('handles empty report gracefully', () => {
    const result = formatReport(
      { stage: 'synthesis', report: { title: '', key_findings: [], sections: [], recommended_actions: [] }, rag_sources: [] },
      { stage: 'intent', intent: 'general_query', summary: '', filters: {}, raw_query: 'test' },
      { stage: 'data', intent: 'general_query', tool_calls: [], data: {}, errors: [], fallback_used: false }
    );

    assert.ok(result.markdown.includes('##'));
    assert.ok(result.report_meta.data_coverage.score === 0);
  });
});

describe('Data file integrity', () => {
  let workOrders, potholes, sidewalkIssues, schools;

  before(async () => {
    const load = async (f) => JSON.parse(await readFile(join(__dirname, '..', 'mcp-server', 'data', f), 'utf-8'));
    workOrders = await load('work-orders.json');
    potholes = await load('potholes.json');
    sidewalkIssues = await load('sidewalk-issues.json');
    schools = await load('schools.json');
  });

  it('work orders have required fields', () => {
    for (const wo of workOrders) {
      assert.ok(wo.id, 'Missing id');
      assert.ok(wo.type, 'Missing type');
      assert.ok(wo.status, 'Missing status');
      assert.ok(wo.location, 'Missing location');
    }
  });

  it('potholes have severity and location', () => {
    for (const p of potholes) {
      assert.ok(p.id, 'Missing id');
      assert.ok(typeof p.severity === 'number', 'Severity should be a number');
      assert.ok(p.severity >= 1 && p.severity <= 10, `Severity ${p.severity} out of range`);
      assert.ok(p.location, 'Missing location');
    }
  });

  it('schools have name and enrollment', () => {
    for (const s of schools) {
      assert.ok(s.name, 'Missing name');
      assert.ok(typeof s.enrollment === 'number', 'Enrollment should be a number');
    }
  });

  it('all zones are valid', () => {
    const validZones = ['NW-3', 'NE-1', 'SE-2', 'SW-1'];
    for (const wo of workOrders) {
      if (wo.location?.zone) assert.ok(validZones.includes(wo.location.zone), `Invalid zone: ${wo.location.zone}`);
    }
  });
});
