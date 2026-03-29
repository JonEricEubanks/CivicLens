/**
 * Local Inference Module — Offline-Ready AI for CivicLens
 *
 * Uses @huggingface/transformers (transformers.js) to run text classification
 * and text generation locally on the server with ONNX Runtime — no API calls.
 *
 * This enables full pipeline operation when GitHub Models / Azure AI is
 * unavailable, providing true offline-ready AI capability.
 *
 * Models used:
 *   - Zero-shot classification: Xenova/mobilebert-uncased-mnli (fast, ~100MB)
 *   - Text generation fallback: built-in template-based synthesis
 *
 * The local classifier runs as an additional validator alongside GPT-4o-mini
 * and Phi-3, providing a 4th signal for intent classification that requires
 * zero network connectivity.
 */

let pipeline = null;
let classifierReady = false;
let classifierInstance = null;
let initPromise = null;

// CivicLens intent labels mapped to natural-language hypotheses for zero-shot classification
const INTENT_HYPOTHESES = {
  help_guidance: 'This is a question about how to use the platform or get help',
  status_report: 'This is a request for a status report or overview of issues',
  priority_analysis: 'This is asking about the most urgent or highest priority issues',
  zone_summary: 'This is asking about a specific geographic zone or area',
  school_safety: 'This is about safety issues near schools or in school zones',
  dispatch_action: 'This is a request to dispatch or send a repair crew',
  inspection_request: 'This is a request to schedule an inspection',
  service_request_submit: 'This is someone reporting a new problem or issue',
  service_request_track: 'This is someone checking status of an existing service request',
  service_request_browse: 'This is a request to browse or list service requests',
  neighborhood_info: 'This is asking about neighborhood conditions or local area info',
  general_query: 'This is a general question about infrastructure or municipal services',
};

const CANDIDATE_LABELS = Object.values(INTENT_HYPOTHESES);
const INTENT_KEYS = Object.keys(INTENT_HYPOTHESES);

/**
 * Initialize the local zero-shot classifier.
 * Downloads the model on first run (~100MB), then caches locally.
 * Non-blocking — returns immediately if already initialized.
 */
export async function initLocalClassifier() {
  if (classifierReady) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamic import — only loads transformers.js when this module is used
      const { pipeline: tfPipeline } = await import('@huggingface/transformers');
      pipeline = tfPipeline;

      console.log('[local-inference] Loading zero-shot classifier (Xenova/mobilebert-uncased-mnli)...');
      classifierInstance = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
        quantized: true, // Use INT8 quantized model for speed
      });

      classifierReady = true;
      console.log('[local-inference] Local classifier ready (offline-capable)');
      return true;
    } catch (err) {
      console.warn('[local-inference] Failed to initialize local classifier:', err.message);
      classifierReady = false;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Classify user intent using the local zero-shot model.
 * Runs entirely on-device via ONNX Runtime — no network calls.
 *
 * @param {string} userMessage - The user's natural language query
 * @returns {{ intent: string, confidence: number, scores: object, model: string } | null}
 */
export async function classifyIntentLocally(userMessage) {
  if (!classifierReady || !classifierInstance) {
    return null;
  }

  try {
    const result = await classifierInstance(userMessage, CANDIDATE_LABELS, {
      multi_label: false,
    });

    // Map the highest-scoring label back to our intent key
    const topIndex = CANDIDATE_LABELS.indexOf(result.labels[0]);
    const intent = topIndex >= 0 ? INTENT_KEYS[topIndex] : 'general_query';

    // Build score map for all intents
    const scores = {};
    result.labels.forEach((label, i) => {
      const idx = CANDIDATE_LABELS.indexOf(label);
      if (idx >= 0) scores[INTENT_KEYS[idx]] = Math.round(result.scores[i] * 1000) / 1000;
    });

    return {
      intent,
      confidence: Math.round(result.scores[0] * 1000) / 1000,
      scores,
      model: 'mobilebert-uncased-mnli-local',
    };
  } catch (err) {
    console.warn('[local-inference] Classification failed:', err.message);
    return null;
  }
}

/**
 * Check whether the local classifier is loaded and ready.
 */
export function isLocalClassifierReady() {
  return classifierReady;
}

/**
 * Generate a simple structured report locally when all cloud APIs are down.
 * Uses template-based generation with data-driven content — no LLM needed.
 * This complements the existing fallback in synthesis-agent.js with richer
 * narrative generation.
 *
 * @param {object} data - Raw data from MCP tools
 * @param {object} intent - Classified intent
 * @returns {object} Structured report
 */
export function generateLocalReport(data, intent) {
  const sections = [];
  const findings = [];
  const actions = [];
  let chartData = null;

  // Potholes
  const potholes = data.potholes || [];
  if (potholes.length > 0) {
    const critical = potholes.filter(p => p.severity >= 4);
    const nearSchools = potholes.filter(p => p.near_school);
    findings.push(`${potholes.length} potholes found — ${critical.length} critical, ${nearSchools.length} near schools`);
    sections.push({
      heading: 'Pothole Analysis',
      content: `**${potholes.length} active potholes** in the dataset.\n\n` +
        `- **${critical.length}** rated severity 4-5 (critical)\n` +
        `- **${nearSchools.length}** within school zones — these get a 40% urgency multiplier\n` +
        (critical.length > 0 ? `\nHighest priority: ${critical[0].location || 'location pending'} (severity ${critical[0].severity})` : ''),
    });
    if (nearSchools.length > 0) actions.push(`Prioritize ${nearSchools.length} school-zone potholes for immediate repair`);

    // Build chart
    const bySeverity = [0, 0, 0, 0, 0];
    potholes.forEach(p => { if (p.severity >= 1 && p.severity <= 5) bySeverity[p.severity - 1]++; });
    chartData = {
      type: 'bar',
      title: 'Potholes by Severity',
      labels: ['Sev 1', 'Sev 2', 'Sev 3', 'Sev 4', 'Sev 5'],
      values: bySeverity,
      colors: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'],
    };
  }

  // Sidewalks
  const sidewalks = data.sidewalk_issues || [];
  if (sidewalks.length > 0) {
    const nonADA = sidewalks.filter(s => !s.ada_compliant);
    findings.push(`${sidewalks.length} sidewalk issues — ${nonADA.length} ADA non-compliant`);
    sections.push({
      heading: 'Sidewalk Issues',
      content: `**${sidewalks.length} sidewalk issues** reported.\n\n` +
        `- **${nonADA.length}** fail ADA compliance (heave > 0.5")\n` +
        `- Federal deadline: ADA transition plans due by 2028\n` +
        `- Per Municipal Code §7-3-4, property owners share repair responsibility`,
    });
    if (nonADA.length > 0) actions.push(`Address ${nonADA.length} ADA-noncompliant sidewalks before federal deadline`);
  }

  // Work orders
  const workOrders = data.work_orders || [];
  if (workOrders.length > 0) {
    const open = workOrders.filter(w => w.status === 'open');
    const inProg = workOrders.filter(w => w.status === 'in_progress');
    const totalCost = workOrders.reduce((s, w) => s + (w.estimated_cost || 0), 0);
    findings.push(`${workOrders.length} work orders — ${open.length} open, ${inProg.length} in progress ($${totalCost.toLocaleString()} estimated)`);
    sections.push({
      heading: 'Work Order Status',
      content: `**${workOrders.length} active work orders** tracked.\n\n` +
        `| Status | Count |\n|--------|-------|\n` +
        `| Open | ${open.length} |\n| In Progress | ${inProg.length} |\n` +
        `| Completed | ${workOrders.filter(w => w.status === 'completed').length} |\n\n` +
        `Total estimated cost: **$${totalCost.toLocaleString()}**`,
    });
  }

  if (findings.length === 0) findings.push('No data available for this query — try broadening your search.');
  if (sections.length === 0) sections.push({ heading: 'No Results', content: 'No matching data found.' });

  return {
    title: `CivicLens Report: ${intent.summary || intent.intent}`,
    key_findings: findings.slice(0, 5),
    sections,
    recommended_actions: actions.slice(0, 5),
    confidence: 0.7,
    data_sources: ['local-inference'],
    chart_data: chartData,
    _generated_by: 'local-inference-offline',
  };
}
