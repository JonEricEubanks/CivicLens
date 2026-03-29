/**
 * Intent Agent — Stage 1 of the CivicLens pipeline
 *
 * Classifies the user's query into an intent and extracts
 * structured parameters for downstream data retrieval.
 */

import { ChatOpenAI } from '@langchain/openai';
import { isRateLimited, markRateLimited } from './rate-limit.js';
import { classifyIntentLocally, isLocalClassifierReady } from '../lib/local-inference.js';

const SYSTEM_PROMPT = `You are the Intent Classification Agent for CivicLens, a municipal infrastructure intelligence system for Lake Forest, IL.

Your job is to analyze the user's question and output a structured JSON response with:
1. "intent" — one of: "help_guidance", "status_report", "priority_analysis", "zone_summary", "school_safety", "dispatch_action", "inspection_request", "service_request_submit", "service_request_track", "service_request_browse", "neighborhood_info", "general_query"
2. "filters" — an object with any relevant filters extracted from the query:
   - zone: "NW-3" | "NE-1" | "SE-2" | "SW-1" | null
   - type: "pothole" | "sidewalk" | "concrete" | null
   - status: "open" | "in_progress" | "completed" | null
   - priority: "critical" | "high" | "medium" | "low" | null
   - near_school: true | false | null
   - school_name: string | null
   - category: "pothole" | "sidewalk" | "streetlight" | "drainage" | "tree_damage" | "sign_damage" | "crosswalk" | "other" | null
3. "action_params" — if the intent involves an action (dispatch/inspection/service request), extract:
   - work_order_id, crew_id, location, reason, scheduled_date (as available)
   - For service requests: tracking_number, resident_name, description, address, category
4. "summary" — a one-sentence restatement of what the user is asking

Intent Descriptions:
- "help_guidance": User is asking HOW to do something or wants instructions/help on using the platform (e.g., "how do I report a pothole?", "how can I report or track a service request?", "what can I do here?", "how does this work?", "help me"). ANY question starting with "how do I", "how can I", "how to", "what's the process for", "where do I", "can you help me" that asks about platform features is help_guidance — NOT a data query.
- "service_request_submit": User wants to ACTUALLY report a problem right now (e.g., "I want to report a pothole on Oak Ave", "there's a broken streetlight at 123 Main")
- "service_request_track": User wants to check on a SPECIFIC request by tracking number (e.g., "what's the status of SR-2026-001")
- "service_request_browse": User wants to see service requests in their area (e.g., "what requests are open in my neighborhood", "show service requests")
- "neighborhood_info": User wants resident-friendly info about their neighborhood (e.g., "how's my neighborhood doing", "is my area safe", "what's happening near me")

IMPORTANT: Distinguish between asking HOW to do something (help_guidance) vs actually DOING it (service_request_submit/track). "How do I report an issue?" = help_guidance. "I want to report a pothole on Oak Ave" = service_request_submit.

Respond ONLY with valid JSON. No markdown, no explanation.

Examples of Lake Forest zones:
- NW-3: Western Ave, McKinley Rd, Telegraph Rd area (northwest)
- NE-1: Sheridan Rd, Deerpath, Illinois Rd area (northeast)
- SE-2: Waukegan Rd, Ridge Rd, Laurel Ave area (southeast)
- SW-1: Spruce Ave, Vine Ave area (southwest)`;

let model;
let altModel; // Secondary model for multi-model orchestration

function getModel() {
  if (!model) {
    model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      timeout: 15000,
      maxRetries: 0,
      configuration: {
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: process.env.GITHUB_TOKEN,
      },
    });
  }
  return model;
}

/** Secondary model (Phi-3) for fast intent pre-classification / validation. */
function getAltModel() {
  if (!altModel) {
    altModel = new ChatOpenAI({
      modelName: 'Phi-3-mini-4k-instruct',
      temperature: 0,
      maxTokens: 200,
      timeout: 10000,
      maxRetries: 0,
      configuration: {
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: process.env.GITHUB_TOKEN,
      },
    });
  }
  return altModel;
}

// Simplified prompt for Phi-3 validator — small model needs concise instructions
const VALIDATOR_PROMPT = `Classify the user's message into exactly ONE intent. Respond with JSON only: {"intent":"<value>","summary":"<one sentence>"}

Valid intents: help_guidance, status_report, priority_analysis, zone_summary, school_safety, dispatch_action, inspection_request, service_request_submit, service_request_track, service_request_browse, neighborhood_info, general_query

Rules:
- "how do I..." / "how can I..." = help_guidance
- mentions tracking number (SR-XXXX-XXX) = service_request_track
- "report a pothole" / "there's a broken..." = service_request_submit
- "dispatch" / "send crew" = dispatch_action
- "priority" / "urgent" / "worst" = priority_analysis
- mentions school + safety = school_safety
- mentions a zone (NW-3, NE-1, SE-2, SW-1) = zone_summary`;

export async function classifyIntent(userMessage, memoryContext = null) {
  try {
    return await _classifyIntentInner(userMessage, memoryContext);
  } catch (err) {
    console.error('[intent-agent] Unexpected crash — emergency keyword fallback:', err.message);
    try {
      const kw = classifyByKeywords(userMessage);
      return { stage: 'intent', ...kw, raw_query: userMessage, _fallback: true, _model: 'emergency-keyword-fallback' };
    } catch {
      return { stage: 'intent', intent: 'general_query', filters: {}, action_params: {}, summary: userMessage, raw_query: userMessage, _fallback: true, _model: 'emergency-hardcoded' };
    }
  }
}

async function _classifyIntentInner(userMessage, memoryContext = null) {
  // Fast-fail if rate limited — skip all LLM calls
  if (isRateLimited()) {
    console.log('[intent-agent] Rate limited — using keyword fallback');
    return { stage: 'intent', ...classifyByKeywords(userMessage), raw_query: userMessage, _fallback: true };
  }

  // Keyword baseline — always computed (zero cost, used for 3-way comparison)
  const keywordResult = classifyByKeywords(userMessage);

  let primaryLLM, validatorLLM;
  try {
    primaryLLM = getModel();
    validatorLLM = getAltModel();
  } catch {
    // GITHUB_TOKEN missing — use keyword-based fallback
    return { stage: 'intent', ...keywordResult, raw_query: userMessage, _fallback: true };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // If conversation memory is available, add it for follow-up awareness
  if (memoryContext) {
    messages.push({
      role: 'system',
      content: `Previous conversation context (use to resolve references like "that zone", "those", "same area"):\n${memoryContext}`,
    });
  }

  messages.push({ role: 'user', content: userMessage });

  // ── Multi-Model Validation ────────────────────────────────────────
  // Run GPT-4o-mini (primary), Phi-3 (validator), and local ONNX model
  // in parallel. The local model provides offline-ready classification
  // via transformers.js — no network calls required.
  const [primaryResponse, validatorResponse, localResponse] = await Promise.allSettled([
    primaryLLM.invoke(messages),
    validatorLLM.invoke([
      { role: 'system', content: VALIDATOR_PROMPT },
      { role: 'user', content: userMessage },
    ]),
    isLocalClassifierReady() ? classifyIntentLocally(userMessage) : Promise.resolve(null),
  ]);

  // Parse primary (GPT-4o-mini)
  let parsed;
  if (primaryResponse.status === 'fulfilled') {
    try {
      const clean = primaryResponse.value.content.replace(/```json\n?|```\n?/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { intent: 'general_query', filters: {}, action_params: {}, summary: userMessage };
    }
  } else {
    // Primary failed — use keyword fallback
    const err = primaryResponse.reason;
    console.warn('[intent-agent] Primary (gpt-4o-mini) failed:', err?.message);
    if (err?.message?.includes('429')) {
      const wait = parseInt((err.message.match(/wait (\d+) seconds/i) || [])[1]) || 300;
      markRateLimited(wait);
    }
    parsed = keywordResult;
  }

  // Parse validator (Phi-3) — extract intent for cross-validation
  let validatorIntent = null;
  if (validatorResponse.status === 'fulfilled') {
    try {
      const clean = validatorResponse.value.content.replace(/```json\n?|```\n?/g, '').trim();
      const vParsed = JSON.parse(clean);
      validatorIntent = vParsed.intent;
    } catch {
      // Phi-3 response wasn't valid JSON — non-blocking
      console.warn('[intent-agent] Phi-3 validator response not parseable');
    }
  } else {
    console.warn('[intent-agent] Phi-3 validator failed (non-blocking):', validatorResponse.reason?.message);
  }

  // Parse local ONNX model result — on-device inference via transformers.js
  let localIntent = null;
  let localConfidence = null;
  if (localResponse.status === 'fulfilled' && localResponse.value) {
    localIntent = localResponse.value.intent;
    localConfidence = localResponse.value.confidence;
    console.log(`[intent-agent] Local model (mobilebert): "${localIntent}" (confidence: ${localConfidence})`);
  }

  // ── Cross-Model Agreement Check (4-way) ───────────────────────────
  const modelsAgreed = validatorIntent ? validatorIntent === parsed.intent : null;
  if (validatorIntent && !modelsAgreed) {
    console.log(`[intent-agent] Model disagreement: gpt-4o-mini="${parsed.intent}" vs Phi-3="${validatorIntent}" vs keyword="${keywordResult.intent}" vs local="${localIntent || 'n/a'}"`);
    // If both Phi-3 AND keywords agree but GPT-4o-mini disagrees, flag for review
    if (validatorIntent === keywordResult.intent && validatorIntent !== parsed.intent) {
      console.log(`[intent-agent] ⚠ Phi-3 + keyword agree on "${validatorIntent}" — primary may have misclassified`);
    }
    // If local model agrees with Phi-3 + keywords (3-way consensus), override primary
    if (localIntent && localIntent === validatorIntent && localIntent === keywordResult.intent && localIntent !== parsed.intent) {
      console.log(`[intent-agent] ⚠ 3-way consensus (Phi-3 + keyword + local) on "${localIntent}" — overriding primary`);
      parsed.intent = localIntent;
      parsed._override_reason = '3-way-consensus';
    }
  }

  return {
    stage: 'intent',
    ...parsed,
    raw_query: userMessage,
    _model: primaryResponse.status === 'fulfilled' ? 'gpt-4o-mini' : 'keyword-fallback',
    _validator_model: 'Phi-3-mini-4k-instruct',
    _validator_intent: validatorIntent,
    _keyword_intent: keywordResult.intent,
    _local_model: localIntent ? 'mobilebert-uncased-mnli-local' : null,
    _local_intent: localIntent,
    _local_confidence: localConfidence,
    _models_agreed: modelsAgreed,
  };
}

/**
 * Offline intent classification — keyword-based fallback when LLM is unavailable.
 * Runs entirely locally with zero network calls, enabling full pipeline operation
 * even without API access. Covers all 11 intent types.
 */
function classifyByKeywords(msg) {
  const m = msg.toLowerCase();
  const filters = {};
  const action_params = {};

  // Zone detection
  if (m.includes('nw-3') || m.includes('northwest')) filters.zone = 'NW-3';
  else if (m.includes('ne-1') || m.includes('northeast') || m.includes('deerpath') || m.includes('sheridan')) filters.zone = 'NE-1';
  else if (m.includes('se-2') || m.includes('southeast') || m.includes('waukegan')) filters.zone = 'SE-2';
  else if (m.includes('sw-1') || m.includes('southwest')) filters.zone = 'SW-1';

  // Tracking number detection
  const srMatch = m.match(/sr-\d{4}-\d{3}/i);
  if (srMatch) action_params.tracking_number = srMatch[0].toUpperCase();

  // Intent detection
  let intent = 'general_query';
  let summary = msg;

  // Help / how-to questions — must be checked FIRST before action-oriented intents
  const isHowTo = /^(how\s+(do|can|would|should)\s+i|how\s+to|where\s+(do|can)\s+i|what('s|\s+is)\s+the\s+(process|way|step)|can\s+you\s+(help|show|explain)|help\s+me|what\s+can\s+i\s+do)/i.test(m);
  if (isHowTo) {
    intent = 'help_guidance';
    summary = msg;
  } else if (m.includes('report') && (m.includes('pothole') || m.includes('sidewalk') || m.includes('issue') || m.includes('problem'))) {
    intent = 'service_request_submit';
    if (m.includes('pothole')) { action_params.category = 'pothole'; filters.type = 'pothole'; }
    else if (m.includes('sidewalk')) { action_params.category = 'sidewalk'; filters.type = 'sidewalk'; }
    else if (m.includes('streetlight')) action_params.category = 'streetlight';
    // Extract address-like text after "on" or "at"
    const addrMatch = msg.match(/(?:on|at)\s+([A-Z][\w\s]+(?:Road|Rd|Ave|St|Street|Blvd|Dr|Drive|Way|Ln|Lane|Ct))/i);
    if (addrMatch) action_params.address = addrMatch[1].trim();
    action_params.description = msg;
    summary = `Submit service request: ${msg}`;
  } else if (m.match(/wo-\d{4}-\d{3}/i)) {
    intent = 'work_order_lookup';
    const woMatch = m.match(/wo-\d{4}-\d{3}/i);
    action_params.work_order_id = woMatch[0].toUpperCase();
    summary = `Look up work order ${action_params.work_order_id}`;
  } else if (srMatch || m.includes('status of') || m.includes('track')) {
    intent = 'service_request_track';
    summary = `Track service request ${action_params.tracking_number || ''}`;
  } else if (m.includes('school') && (m.includes('safe') || m.includes('near') || m.includes('zone'))) {
    intent = 'school_safety';
    filters.near_school = true;
    summary = 'School zone safety analysis';
  } else if (m.includes('priority') || m.includes('urgent') || m.includes('highest') || m.includes('worst')) {
    intent = 'priority_analysis';
    summary = 'Priority analysis of open issues';
  } else if (m.includes('dispatch') || m.includes('send crew')) {
    intent = 'dispatch_action';
    const woMatch = m.match(/wo-\w+/i);
    const crewMatch = m.match(/crew[- ]?([a-z0-9]+)/i);
    if (woMatch) action_params.work_order_id = woMatch[0].toUpperCase();
    if (crewMatch) action_params.crew_id = `Crew-${crewMatch[1].toUpperCase()}`;
    summary = 'Dispatch crew to work order';
  } else if (m.includes('inspect')) {
    intent = 'inspection_request';
    summary = 'Schedule an inspection';
  } else if (m.includes('neighborhood') || m.includes('my area') || m.includes('what\'s happening')) {
    intent = 'neighborhood_info';
    summary = 'Neighborhood information request';
  } else if (m.includes('service request') || m.includes('open request')) {
    intent = 'service_request_browse';
    summary = 'Browse service requests';
  } else if (filters.zone || m.includes('zone')) {
    intent = 'zone_summary';
    summary = `Zone summary for ${filters.zone || 'all zones'}`;
  } else if (m.includes('pothole')) {
    intent = 'priority_analysis';
    filters.type = 'pothole';
    summary = 'Pothole analysis';
  } else if (m.includes('sidewalk')) {
    intent = 'priority_analysis';
    filters.type = 'sidewalk';
    summary = 'Sidewalk analysis';
  } else if (m.includes('compar') || m.includes('benchmark') || m.includes('chicago') || m.includes('311')) {
    intent = 'status_report';
    summary = 'Cross-city benchmark comparison';
  } else if (m.includes('cost') || m.includes('budget') || m.includes('spend')) {
    intent = 'status_report';
    summary = 'Budget and cost analysis';
  }

  return { intent, filters, action_params, summary };
}
