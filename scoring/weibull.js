/**
 * Weibull Decay Priority Scoring Model
 *
 * Calculates infrastructure repair priority using Weibull survival
 * analysis to model how urgency increases non-linearly with age.
 *
 * Score range: 0–400
 */

// Weibull parameters by infrastructure type
const WEIBULL_PARAMS = {
  pothole:  { k: 1.8, lambda: 120 },  // days — fast decay
  sidewalk: { k: 2.2, lambda: 240 },  // days — moderate decay
  concrete: { k: 2.5, lambda: 365 },  // days — slow decay
};

/**
 * Weibull hazard rate: h(t) = (k/λ) * (t/λ)^(k-1)
 * Returns a 0–1 normalized age urgency factor.
 */
function weibullAgeFactor(daysSinceReport, type) {
  const params = WEIBULL_PARAMS[type] || WEIBULL_PARAMS.pothole;
  const { k, lambda } = params;
  const t = Math.max(daysSinceReport, 1);
  const ratio = t / lambda;
  const hazard = (k / lambda) * Math.pow(ratio, k - 1);
  // Normalize to 0–80 range (age can contribute up to 80 points)
  return Math.min(hazard * 60, 80);
}

/**
 * School proximity score: closer to school = higher priority.
 * Max 60 points if within 200 ft of a school.
 * Covers full walk-zone range up to 5280 ft (1 mile).
 */
function schoolProximityScore(distanceFt, nearSchool) {
  if (!nearSchool || distanceFt == null) return 0;
  if (distanceFt <= 200) return 60;
  if (distanceFt <= 500) return 50;
  if (distanceFt <= 1000) return 40;
  if (distanceFt <= 2640) return 25;
  if (distanceFt <= 5280) return 10;
  return 0;
}

/**
 * Traffic multiplier: higher traffic = faster degradation & more risk.
 * Returns 0–40 points.
 */
function trafficMultiplier(trafficVolume) {
  switch (trafficVolume) {
    case 'high':   return 40;
    case 'medium': return 24;
    case 'low':    return 10;
    default:       return 16;
  }
}

/**
 * Weather risk factor based on current month.
 * IL freeze-thaw cycle (Nov–Mar) accelerates pothole growth.
 * Returns 0–30 points.
 */
function weatherRisk(month) {
  const m = month ?? new Date().getMonth() + 1;
  if (m >= 11 || m <= 3) return 30;  // freeze-thaw season
  if (m >= 4 && m <= 5)  return 20;  // spring thaw
  return 10;                          // summer/fall
}

/**
 * Type modifier — some issue types inherently more urgent.
 * Returns 0–30 points.
 */
function typeModifier(issueType) {
  switch (issueType) {
    case 'pothole':  return 30;
    case 'sidewalk': return 20;
    case 'concrete': return 10;
    default:         return 16;
  }
}

/**
 * Calculate the composite priority score for an infrastructure issue.
 *
 * @param {object} params
 * @param {number} params.severity        - Base severity (1–10 scale)
 * @param {string} params.type            - 'pothole' | 'sidewalk' | 'concrete'
 * @param {string} params.reported_date   - ISO date string
 * @param {number} params.school_distance_ft - Distance to nearest school in feet
 * @param {boolean} params.near_school    - Whether near a school
 * @param {string} params.traffic_volume  - 'high' | 'medium' | 'low'
 * @param {number} [params.month]         - Override month for weather calc
 * @returns {{ score: number, breakdown: object }}
 */
export function calculatePriorityScore(params) {
  const {
    severity = 5,
    type = 'pothole',
    reported_date,
    school_distance_ft,
    near_school = false,
    traffic_volume = 'medium',
    month,
  } = params;

  const daysSinceReport = reported_date
    ? Math.floor((Date.now() - new Date(reported_date).getTime()) / 86400000)
    : 30;

  // Severity contributes 0–160 points (scaled from 1–10 input)
  const severityScore = Math.min(severity * 16, 160);
  const ageFactor = weibullAgeFactor(daysSinceReport, type);
  const schoolScore = schoolProximityScore(school_distance_ft, near_school);
  const traffic = trafficMultiplier(traffic_volume);
  const weather = weatherRisk(month);
  const typeMod = typeModifier(type);

  const raw = severityScore + ageFactor + schoolScore + traffic + weather + typeMod;
  const score = Math.round(Math.min(raw, 400));

  return {
    score,
    breakdown: {
      severity: Math.round(severityScore),
      age_factor: Math.round(ageFactor * 10) / 10,
      school_proximity: schoolScore,
      traffic: traffic,
      weather_risk: weather,
      type_modifier: typeMod,
    },
    days_since_report: daysSinceReport,
    risk_level: score >= 300 ? 'critical' : score >= 200 ? 'high' : score >= 120 ? 'medium' : 'low',
  };
}

/**
 * Forecast infrastructure deterioration using Weibull survival analysis.
 * Predicts severity at 30, 90, and 180 days from now.
 *
 * @param {object} params
 * @param {string} params.issue_type       - 'pothole' | 'sidewalk' | 'concrete'
 * @param {number} params.current_severity - Current severity (1–10)
 * @param {string} params.reported_date    - ISO date of first report
 * @param {string} params.traffic_volume   - 'high' | 'medium' | 'low'
 * @returns {object} Forecast with severity projections and expected failure date
 */
export function forecastDeterioration(params) {
  const {
    issue_type = 'pothole',
    current_severity = 5,
    reported_date,
    traffic_volume = 'medium',
  } = params;

  const wp = WEIBULL_PARAMS[issue_type] || WEIBULL_PARAMS.pothole;
  const daysSince = reported_date
    ? Math.floor((Date.now() - new Date(reported_date).getTime()) / 86400000)
    : 30;

  // Traffic acceleration multiplier
  const trafficAccel = traffic_volume === 'high' ? 1.5 : traffic_volume === 'medium' ? 1.0 : 0.7;

  // Predict severity at future time points using Weibull CDF: F(t) = 1 - exp(-(t/λ)^k)
  function predictSeverity(futureDays) {
    const totalDays = daysSince + futureDays;
    const failureProb = 1 - Math.exp(-Math.pow(totalDays / wp.lambda, wp.k));
    // Map failure probability to severity scale (1-10), accelerated by traffic
    const projected = current_severity + (10 - current_severity) * failureProb * trafficAccel;
    return Math.round(Math.min(Math.max(projected, current_severity), 10) * 10) / 10;
  }

  // Expected failure date: when survival probability drops below 10%
  // S(t) = exp(-(t/λ)^k) < 0.1 → t = λ * (-ln(0.1))^(1/k)
  const failureDays = Math.round(wp.lambda * Math.pow(-Math.log(0.1), 1 / wp.k));
  const daysUntilFailure = Math.max(failureDays - daysSince, 0);
  const failureDate = new Date(Date.now() + daysUntilFailure * 86400000).toISOString().split('T')[0];

  const forecast30 = predictSeverity(30);
  const forecast90 = predictSeverity(90);
  const forecast180 = predictSeverity(180);

  return {
    issue_type,
    current_severity,
    days_since_report: daysSince,
    traffic_volume,
    forecasts: {
      '30_days':  { severity: forecast30,  risk_level: forecast30 >= 8 ? 'critical' : forecast30 >= 6 ? 'high' : 'medium' },
      '90_days':  { severity: forecast90,  risk_level: forecast90 >= 8 ? 'critical' : forecast90 >= 6 ? 'high' : 'medium' },
      '180_days': { severity: forecast180, risk_level: forecast180 >= 8 ? 'critical' : forecast180 >= 6 ? 'high' : 'medium' },
    },
    expected_failure_date: failureDate,
    days_until_failure: daysUntilFailure,
    weibull_params: wp,
    recommendation: daysUntilFailure < 30 ? 'IMMEDIATE repair needed'
      : daysUntilFailure < 90 ? 'Schedule repair within 30 days'
      : daysUntilFailure < 180 ? 'Monitor — schedule in next quarter'
      : 'Low urgency — standard maintenance cycle',
  };
}

/**
 * Calculate cost-of-inaction: project financial and liability exposure
 * if an infrastructure issue is left unrepaired.
 *
 * Based on RAG knowledge base data for Lake Forest liability claims.
 */
export function costOfInaction(params) {
  const {
    issue_type = 'pothole',
    current_severity = 5,
    reported_date,
    near_school = false,
    traffic_volume = 'medium',
  } = params;

  const daysSince = reported_date
    ? Math.floor((Date.now() - new Date(reported_date).getTime()) / 86400000)
    : 30;

  // Base repair costs by type
  const repairCosts = {
    pothole:  { immediate: 350, delayed_30: 800, delayed_90: 2200, delayed_180: 5500 },
    sidewalk: { immediate: 1200, delayed_30: 1800, delayed_90: 4500, delayed_180: 12000 },
    concrete: { immediate: 2000, delayed_30: 3200, delayed_90: 7000, delayed_180: 18000 },
  };

  // Liability exposure (from RAG: $15k-$50k per injury claim)
  const baseLiabilityPerDay = near_school ? 85 : 42;
  const severityMultiplier = current_severity / 5;
  const trafficMult = traffic_volume === 'high' ? 2.0 : traffic_volume === 'medium' ? 1.0 : 0.5;

  const costs = repairCosts[issue_type] || repairCosts.pothole;
  const dailyLiability = baseLiabilityPerDay * severityMultiplier * trafficMult;
  const accumulatedLiability = Math.round(dailyLiability * daysSince);

  return {
    issue_type,
    current_severity,
    days_unrepaired: daysSince,
    repair_cost_now: costs.immediate,
    projected_costs: {
      '30_days':  { repair: costs.delayed_30,  liability_exposure: Math.round(dailyLiability * 30),  total: costs.delayed_30 + Math.round(dailyLiability * 30) },
      '90_days':  { repair: costs.delayed_90,  liability_exposure: Math.round(dailyLiability * 90),  total: costs.delayed_90 + Math.round(dailyLiability * 90) },
      '180_days': { repair: costs.delayed_180, liability_exposure: Math.round(dailyLiability * 180), total: costs.delayed_180 + Math.round(dailyLiability * 180) },
    },
    accumulated_liability: accumulatedLiability,
    total_cost_if_not_repaired: costs.delayed_180 + Math.round(dailyLiability * 180),
    savings_if_repaired_now: (costs.delayed_180 + Math.round(dailyLiability * 180)) - costs.immediate,
    risk_factors: {
      near_school,
      traffic_volume,
      severity_multiplier: severityMultiplier,
    },
  };
}
