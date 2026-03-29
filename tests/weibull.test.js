/**
 * Unit tests for the Weibull Priority Scoring Model
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { calculatePriorityScore, forecastDeterioration, costOfInaction } from '../scoring/weibull.js';

describe('calculatePriorityScore', () => {
  it('returns a score between 0 and 400', () => {
    const result = calculatePriorityScore({
      severity: 5, type: 'pothole', reported_date: '2025-01-01',
      school_distance_ft: 500, near_school: true, traffic_volume: 'medium',
    });
    assert.ok(result.score >= 0, `Score ${result.score} should be >= 0`);
    assert.ok(result.score <= 400, `Score ${result.score} should be <= 400`);
  });

  it('assigns higher scores to higher severity', () => {
    const low = calculatePriorityScore({ severity: 2, type: 'pothole', reported_date: '2025-06-01', school_distance_ft: 2000, near_school: false, traffic_volume: 'low' });
    const high = calculatePriorityScore({ severity: 9, type: 'pothole', reported_date: '2025-06-01', school_distance_ft: 2000, near_school: false, traffic_volume: 'low' });
    assert.ok(high.score > low.score, `High severity ${high.score} should be > low severity ${low.score}`);
  });

  it('assigns higher scores for school proximity', () => {
    const far = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: '2025-06-01', school_distance_ft: 5000, near_school: false, traffic_volume: 'medium' });
    const near = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: '2025-06-01', school_distance_ft: 100, near_school: true, traffic_volume: 'medium' });
    assert.ok(near.score > far.score, `Near-school ${near.score} should be > far ${far.score}`);
  });

  it('assigns higher scores for older issues (Weibull age factor)', () => {
    const recent = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: new Date().toISOString(), school_distance_ft: 1000, near_school: false, traffic_volume: 'medium' });
    const old = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: '2024-01-01', school_distance_ft: 1000, near_school: false, traffic_volume: 'medium' });
    assert.ok(old.score > recent.score, `Old issue ${old.score} should be > recent ${recent.score}`);
  });

  it('assigns higher scores for high traffic', () => {
    const low = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: '2025-06-01', school_distance_ft: 1000, near_school: false, traffic_volume: 'low' });
    const high = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: '2025-06-01', school_distance_ft: 1000, near_school: false, traffic_volume: 'high' });
    assert.ok(high.score > low.score);
  });

  it('returns correct risk levels', () => {
    const critical = calculatePriorityScore({ severity: 10, type: 'pothole', reported_date: '2024-01-01', school_distance_ft: 100, near_school: true, traffic_volume: 'high', month: 1 });
    assert.equal(critical.risk_level, 'critical');

    const low = calculatePriorityScore({ severity: 1, type: 'concrete', reported_date: new Date().toISOString(), school_distance_ft: 5000, near_school: false, traffic_volume: 'low', month: 7 });
    assert.equal(low.risk_level, 'low');
  });

  it('includes breakdown with all factors', () => {
    const result = calculatePriorityScore({ severity: 5, type: 'sidewalk', reported_date: '2025-06-01', school_distance_ft: 300, near_school: true, traffic_volume: 'high' });
    assert.ok('severity' in result.breakdown);
    assert.ok('age_factor' in result.breakdown);
    assert.ok('school_proximity' in result.breakdown);
    assert.ok('traffic' in result.breakdown);
    assert.ok('weather_risk' in result.breakdown);
    assert.ok('type_modifier' in result.breakdown);
  });

  it('handles missing optional parameters gracefully', () => {
    const result = calculatePriorityScore({ severity: 5, type: 'pothole', reported_date: '2025-06-01' });
    assert.ok(typeof result.score === 'number');
    assert.ok(result.score > 0);
  });

  it('caps score at 400', () => {
    const result = calculatePriorityScore({ severity: 10, type: 'pothole', reported_date: '2020-01-01', school_distance_ft: 50, near_school: true, traffic_volume: 'high', month: 1 });
    assert.ok(result.score <= 400, `Score ${result.score} should be capped at 400`);
  });
});

describe('forecastDeterioration', () => {
  it('returns forecasts at 30, 90, and 180 days', () => {
    const result = forecastDeterioration({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', traffic_volume: 'medium' });
    assert.ok(result.forecasts['30_days']);
    assert.ok(result.forecasts['90_days']);
    assert.ok(result.forecasts['180_days']);
  });

  it('severity should not decrease over time', () => {
    const result = forecastDeterioration({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', traffic_volume: 'medium' });
    assert.ok(result.forecasts['30_days'].severity >= 5);
    assert.ok(result.forecasts['90_days'].severity >= result.forecasts['30_days'].severity);
    assert.ok(result.forecasts['180_days'].severity >= result.forecasts['90_days'].severity);
  });

  it('high traffic accelerates deterioration', () => {
    const low = forecastDeterioration({ issue_type: 'pothole', current_severity: 3, reported_date: '2025-06-01', traffic_volume: 'low' });
    const high = forecastDeterioration({ issue_type: 'pothole', current_severity: 3, reported_date: '2025-06-01', traffic_volume: 'high' });
    assert.ok(high.forecasts['180_days'].severity >= low.forecasts['180_days'].severity);
  });

  it('returns expected failure date', () => {
    const result = forecastDeterioration({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', traffic_volume: 'medium' });
    assert.ok(result.expected_failure_date);
    assert.ok(result.days_until_failure >= 0);
  });

  it('returns a recommendation', () => {
    const result = forecastDeterioration({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', traffic_volume: 'medium' });
    assert.ok(typeof result.recommendation === 'string');
  });
});

describe('costOfInaction', () => {
  it('returns repair cost now and projected costs', () => {
    const result = costOfInaction({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', near_school: false, traffic_volume: 'medium' });
    assert.ok(result.repair_cost_now > 0);
    assert.ok(result.projected_costs['30_days'].total > result.repair_cost_now);
    assert.ok(result.projected_costs['180_days'].total > result.projected_costs['30_days'].total);
  });

  it('near-school increases liability', () => {
    const far = costOfInaction({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', near_school: false, traffic_volume: 'medium' });
    const near = costOfInaction({ issue_type: 'pothole', current_severity: 5, reported_date: '2025-06-01', near_school: true, traffic_volume: 'medium' });
    assert.ok(near.projected_costs['90_days'].liability_exposure > far.projected_costs['90_days'].liability_exposure);
  });

  it('shows savings if repaired now', () => {
    const result = costOfInaction({ issue_type: 'sidewalk', current_severity: 7, reported_date: '2025-01-01', near_school: true, traffic_volume: 'high' });
    assert.ok(result.savings_if_repaired_now > 0);
  });
});
