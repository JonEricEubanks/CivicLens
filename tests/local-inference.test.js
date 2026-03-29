/**
 * Tests for Local Inference — generateLocalReport (pure template-based function)
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { generateLocalReport, isLocalClassifierReady } from '../lib/local-inference.js';

const makeIntent = (overrides = {}) => ({
  intent: 'priority_analysis',
  summary: 'Priority analysis of infrastructure',
  ...overrides,
});

describe('Local Inference — generateLocalReport', () => {

  it('returns a structured report with all required fields', () => {
    const report = generateLocalReport({ potholes: [{ severity: 4, near_school: false }] }, makeIntent());
    assert.ok(typeof report.title === 'string');
    assert.ok(Array.isArray(report.key_findings));
    assert.ok(Array.isArray(report.sections));
    assert.ok(Array.isArray(report.recommended_actions));
    assert.ok(typeof report.confidence === 'number');
    assert.ok(Array.isArray(report.data_sources));
    assert.equal(report._generated_by, 'local-inference-offline');
  });

  it('includes pothole analysis for pothole data', () => {
    const data = {
      potholes: [
        { id: 'PH-1', severity: 5, near_school: true, location: '100 Main St' },
        { id: 'PH-2', severity: 2, near_school: false },
        { id: 'PH-3', severity: 4, near_school: true },
      ],
    };
    const report = generateLocalReport(data, makeIntent());
    const finding = report.key_findings.find(f => f.includes('potholes'));
    assert.ok(finding);
    assert.ok(finding.includes('3 potholes'));
    assert.ok(finding.includes('2 critical'));
    assert.ok(finding.includes('2 near schools'));
    const section = report.sections.find(s => s.heading === 'Pothole Analysis');
    assert.ok(section);
    assert.ok(section.content.includes('40% urgency multiplier'));
  });

  it('generates chart_data for potholes', () => {
    const data = { potholes: [{ severity: 1 }, { severity: 3 }, { severity: 5 }, { severity: 5 }] };
    const report = generateLocalReport(data, makeIntent());
    assert.ok(report.chart_data);
    assert.equal(report.chart_data.type, 'bar');
    assert.equal(report.chart_data.title, 'Potholes by Severity');
    assert.deepStrictEqual(report.chart_data.labels, ['Sev 1', 'Sev 2', 'Sev 3', 'Sev 4', 'Sev 5']);
    assert.deepStrictEqual(report.chart_data.values, [1, 0, 1, 0, 2]);
  });

  it('includes school-zone action when near_school potholes exist', () => {
    const data = { potholes: [{ severity: 4, near_school: true }] };
    const report = generateLocalReport(data, makeIntent());
    assert.ok(report.recommended_actions.some(a => a.toLowerCase().includes('school')));
  });

  it('includes sidewalk analysis with ADA compliance', () => {
    const data = {
      sidewalk_issues: [
        { id: 'SW-1', ada_compliant: false },
        { id: 'SW-2', ada_compliant: true },
        { id: 'SW-3', ada_compliant: false },
      ],
    };
    const report = generateLocalReport(data, makeIntent());
    const finding = report.key_findings.find(f => f.includes('sidewalk'));
    assert.ok(finding);
    assert.ok(finding.includes('3 sidewalk issues'));
    assert.ok(finding.includes('2 ADA non-compliant'));
    const section = report.sections.find(s => s.heading === 'Sidewalk Issues');
    assert.ok(section);
    assert.ok(section.content.includes('ADA'));
    assert.ok(section.content.includes('§7-3-4'));
  });

  it('generates ADA action when non-compliant sidewalks exist', () => {
    const data = { sidewalk_issues: [{ ada_compliant: false }] };
    const report = generateLocalReport(data, makeIntent());
    assert.ok(report.recommended_actions.some(a => a.toLowerCase().includes('ada')));
  });

  it('includes work order analysis with costs', () => {
    const data = {
      work_orders: [
        { id: 'WO-1', status: 'open', estimated_cost: 1200 },
        { id: 'WO-2', status: 'in_progress', estimated_cost: 800 },
        { id: 'WO-3', status: 'completed', estimated_cost: 500 },
      ],
    };
    const report = generateLocalReport(data, makeIntent());
    const finding = report.key_findings.find(f => f.includes('work orders'));
    assert.ok(finding);
    assert.ok(finding.includes('3 work orders'));
    assert.ok(finding.includes('1 open'));
    assert.ok(finding.includes('1 in progress'));
    const section = report.sections.find(s => s.heading === 'Work Order Status');
    assert.ok(section);
    assert.ok(section.content.includes('$2,500'));
  });

  it('handles all data types combined', () => {
    const data = {
      potholes: [{ severity: 4, near_school: true }],
      sidewalk_issues: [{ ada_compliant: false }],
      work_orders: [{ status: 'open', estimated_cost: 1000 }],
    };
    const report = generateLocalReport(data, makeIntent());
    assert.ok(report.key_findings.length >= 3);
    assert.ok(report.sections.length >= 3);
  });

  it('handles empty data gracefully', () => {
    const report = generateLocalReport({}, makeIntent());
    assert.ok(report.key_findings.length > 0);
    assert.ok(report.key_findings[0].includes('No data'));
    assert.ok(report.sections.length > 0);
    assert.equal(report.chart_data, null);
  });

  it('caps findings and actions to 5', () => {
    const data = {
      potholes: [{ severity: 5, near_school: true }],
      sidewalk_issues: [{ ada_compliant: false }],
      work_orders: [{ status: 'open', estimated_cost: 500 }],
    };
    const report = generateLocalReport(data, makeIntent());
    assert.ok(report.key_findings.length <= 5);
    assert.ok(report.recommended_actions.length <= 5);
  });

  it('uses intent summary in title', () => {
    const report = generateLocalReport(
      { potholes: [{ severity: 3, near_school: false }] },
      makeIntent({ summary: 'Pothole overview for zone NW-3' }),
    );
    assert.ok(report.title.includes('Pothole overview for zone NW-3'));
  });

  it('falls back to intent name when summary missing', () => {
    const report = generateLocalReport(
      { potholes: [{ severity: 3, near_school: false }] },
      { intent: 'priority_analysis' },
    );
    assert.ok(report.title.includes('priority_analysis'));
  });

  it('confidence is 0.7 for local report', () => {
    const report = generateLocalReport({ potholes: [{ severity: 1, near_school: false }] }, makeIntent());
    assert.equal(report.confidence, 0.7);
  });

  it('data_sources contains local-inference', () => {
    const report = generateLocalReport({ potholes: [{ severity: 1, near_school: false }] }, makeIntent());
    assert.ok(report.data_sources.includes('local-inference'));
  });
});

describe('Local Inference — isLocalClassifierReady', () => {
  it('returns false when classifier has not been initialized', () => {
    // We don't call initLocalClassifier() so it should be false
    assert.equal(isLocalClassifierReady(), false);
  });
});
