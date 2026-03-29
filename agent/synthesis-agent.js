/**
 * Synthesis Agent — Stage 3 of the CivicLens pipeline
 *
 * Takes raw data from the Data Agent and uses an LLM to generate
 * a structured, plain-language narrative report.
 *
 * RAG Integration: Retrieves relevant municipal code, repair standards,
 * and safety requirements from the knowledge base to ground responses.
 */

import { ChatOpenAI } from '@langchain/openai';
import { retrieve } from '../rag/rag_knowledge_base.js';
import { isRateLimited, markRateLimited } from './rate-limit.js';

const SYSTEM_PROMPT = `You are the CivicLens AI assistant for Lake Forest, IL — helping everyday residents understand what's happening with roads, sidewalks, and infrastructure in their neighborhood.

Write like you're talking to a neighbor — friendly, clear, no jargon. Keep it SHORT.

Rules:
- Lead with what matters most: safety issues, things near schools, what's being fixed
- Use real addresses and numbers: "the pothole at 200 E Deerpath" not "multiple issues reported"
- Keep sentences short. Use bullet points generously.
- Explain priority scores simply: "rated urgent because it's near a school and 45 days old"
- Skip bureaucratic language — say "fix" not "remediate", "check" not "conduct an inspection"
- When citing regulations, translate them: "City code requires sidewalk repairs within 30 days (§7-3-1)"
- Always say how many records you looked at: "Based on 15 open work orders"
- If there are safety concerns, put them FIRST with a clear callout
- Keep the whole response under 400 words when possible — residents don't want to read an essay
- Include a quick "What You Can Do" tip at the end when relevant

Output format: Return a JSON object with:
{
  "title": "Short friendly title",
  "key_findings": ["finding1", "finding2", "finding3"],
  "sections": [
    { "heading": "Section Title", "content": "Markdown content with **bold** for emphasis" }
  ],
  "recommended_actions": ["action1", "action2"],
  "confidence": 0.0-1.0,
  "data_sources": ["tool_name1", "tool_name2"],
  "chart_data": {
    "type": "bar|pie|status",
    "title": "Chart title",
    "labels": ["label1", "label2"],
    "values": [10, 20],
    "colors": ["#006a61", "#3b82f6"]
  }
}

The chart_data field is important — always include a relevant chart when data has categories, counts, or breakdowns. Choose the best chart type:
- "bar" for comparing counts across categories or zones
- "pie" for showing distribution (status breakdown, issue types)
- "status" for showing progress (open vs completed vs in-progress)

Respond ONLY with valid JSON.`;

const SUPERVISOR_PROMPT = `You are the CivicLens Staff Operations AI for Lake Forest, IL — built for municipal supervisors, crew leads, and operations staff managing infrastructure.

Write like you're briefing a colleague — direct, data-driven, actionable. Skip the hand-holding.

Rules:
- Lead with operational metrics: open counts, SLA timelines, cost projections, crew utilization
- Use technical terms freely: "mill and overlay", "Class III patch", "ADA ramp transition"
- Include specific work order IDs, crew assignments, and cost breakdowns
- Reference SLA deadlines and compliance status: "WO-2026-042 is 3 days past 15-day SLA"
- Prioritize by operational impact: crew efficiency, budget burn rate, regulatory deadlines
- Show zone-level breakdowns for dispatch planning
- Flag resource conflicts: "Crew B is double-booked for NW-3 and SE-2 on Thursday"
- Include cost-per-unit metrics when available: "avg pothole repair: $1,200, this zone: $1,800"
- Keep safety/school-proximity flags but frame them operationally: "school-zone repairs require traffic control setup"
- Recommend specific dispatch actions: which crew, which zone, what equipment
- When citing regulations, include the code reference: "Per §7-3-1, 30-day repair window expires April 2"

Output format: Return a JSON object with:
{
  "title": "Short operational title",
  "key_findings": ["finding1", "finding2", "finding3"],
  "sections": [
    { "heading": "Section Title", "content": "Markdown content with **bold** for emphasis" }
  ],
  "recommended_actions": ["action1", "action2"],
  "confidence": 0.0-1.0,
  "data_sources": ["tool_name1", "tool_name2"],
  "chart_data": {
    "type": "bar|pie|status",
    "title": "Chart title",
    "labels": ["label1", "label2"],
    "values": [10, 20],
    "colors": ["#006a61", "#3b82f6"]
  }
}

The chart_data field is important — always include a relevant chart when data has categories, counts, or breakdowns. Choose the best chart type:
- "bar" for comparing counts across categories, zones, or crews
- "pie" for showing distribution (budget allocation, issue types, crew workload)
- "status" for showing progress (open vs completed vs in-progress, SLA compliance)

Respond ONLY with valid JSON.`;

let model;

function getModel() {
  if (!model) {
    model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      timeout: 30000,
      maxRetries: 0,
      configuration: {
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: process.env.GITHUB_TOKEN,
      },
    });
  }
  return model;
}

export async function synthesizeReport(dataResult, intentResult, role = 'public') {
  try {
    return await _synthesizeReportInner(dataResult, intentResult, role);
  } catch (err) {
    console.error('[synthesis-agent] Unexpected crash — emergency fallback:', err.message);
    return {
      stage: 'synthesis',
      report: {
        title: 'CivicLens Report',
        key_findings: ['Our AI analysis is temporarily unavailable. Data from the municipal database is shown below.'],
        sections: [{ heading: 'Status', content: 'The synthesis engine encountered an issue. Please try again in a few minutes.' }],
        recommended_actions: ['Try your question again shortly'],
        confidence: 0.2,
        data_sources: (dataResult?.tool_calls || []).map(tc => tc.tool),
      },
      rag_sources: [],
    };
  }
}

async function _synthesizeReportInner(dataResult, intentResult, role = 'public') {
  // Fast-fail if rate limited
  if (isRateLimited()) {
    console.log('[synthesis-agent] Rate limited — using fallback report');
    return generateFallbackReport(dataResult, intentResult);
  }

  let llm;
  try {
    llm = getModel();
  } catch {
    // GITHUB_TOKEN missing — generate a structured fallback report from data
    return generateFallbackReport(dataResult, intentResult);
  }

  // RAG: Use results from data agent's agentic RAG tool if available,
  // otherwise retrieve directly (agent-to-agent knowledge sharing)
  let ragContext = '';
  let ragSources = [];
  try {
    const agentRag = dataResult.rag_results;
    const ragResults = agentRag && agentRag.length > 0
      ? agentRag
      : await retrieve(intentResult.raw_query, 3, 0.05);
    if (ragResults.length > 0) {
      ragSources = ragResults.map(r => ({ id: r.id, title: r.title, category: r.category, score: r.score }));
      ragContext = `\n\n--- KNOWLEDGE BASE (cite by title when relevant) ---\n` +
        ragResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join('\n\n') +
        `\n--- END KNOWLEDGE BASE ---`;
    }
  } catch (err) {
    console.warn('RAG retrieval failed (non-blocking):', err.message);
  }

  const userPrompt = `User's original question: "${intentResult.raw_query}"
Intent classified as: ${intentResult.intent}
Summary: ${intentResult.summary}

Here is the raw data retrieved from the municipal database:

${JSON.stringify(dataResult.data, null, 2)}

Tools called: ${dataResult.tool_calls.map(tc => tc.tool).join(', ')}
${ragContext}

Generate a comprehensive report from this data. Reference applicable regulations and standards from the knowledge base.`;

  let response;
  const activePrompt = role === 'supervisor' ? SUPERVISOR_PROMPT : SYSTEM_PROMPT;
  try {
    response = await llm.invoke([
      { role: 'system', content: activePrompt },
      { role: 'user', content: userPrompt },
    ]);
  } catch (err) {
    console.warn('[synthesis-agent] LLM call failed, using fallback:', err.message);
    if (err.message && err.message.includes('429')) {
      const wait = parseInt((err.message.match(/wait (\d+) seconds/i) || [])[1]) || 300;
      markRateLimited(wait);
    }
    return generateFallbackReport(dataResult, intentResult);
  }

  let report;
  try {
    const clean = response.content.replace(/```json\n?|```\n?/g, '').trim();
    report = JSON.parse(clean);
  } catch {
    report = {
      title: 'Infrastructure Report',
      key_findings: ['Report generation encountered an issue. Raw data is available below.'],
      sections: [{ heading: 'Data', content: JSON.stringify(dataResult.data, null, 2) }],
      recommended_actions: [],
      confidence: 0.5,
      data_sources: dataResult.tool_calls.map(tc => tc.tool),
    };
  }

  return {
    stage: 'synthesis',
    report,
    rag_sources: ragSources,
  };
}

/** Generate a structured report from data when LLM is unavailable. */
function generateFallbackReport(dataResult, intentResult) {
  const data = dataResult.data || {};
  const sections = [];
  const findings = [];
  const actions = [];

  // Work orders summary
  if (data.work_orders && Array.isArray(data.work_orders)) {
    const open = data.work_orders.filter(w => w.status === 'open').length;
    const inProg = data.work_orders.filter(w => w.status === 'in_progress').length;
    findings.push(`${data.work_orders.length} work orders found (${open} open, ${inProg} in progress)`);
    const totalCost = data.work_orders.reduce((s, w) => s + (w.estimated_cost || 0), 0);
    sections.push({ heading: 'Work Orders', content: `Total: ${data.work_orders.length} work orders. Open: ${open}. In Progress: ${inProg}. Estimated total cost: $${totalCost.toLocaleString()}.` });
    if (open > 0) actions.push(`Address ${open} open work orders`);
  }

  // Potholes summary
  if (data.potholes && Array.isArray(data.potholes)) {
    const nearSchool = data.potholes.filter(p => p.near_school).length;
    const highSev = data.potholes.filter(p => p.severity >= 4).length;
    findings.push(`${data.potholes.length} potholes reported (${highSev} high severity, ${nearSchool} near schools)`);
    sections.push({ heading: 'Pothole Analysis', content: `${data.potholes.length} potholes in the dataset. ${highSev} have severity >= 4. ${nearSchool} are near schools and should be prioritized.` });
    if (nearSchool > 0) actions.push(`Prioritize ${nearSchool} potholes near schools for immediate repair`);
  }

  // Sidewalk issues summary
  if (data.sidewalk_issues && Array.isArray(data.sidewalk_issues)) {
    const nonADA = data.sidewalk_issues.filter(s => !s.ada_compliant).length;
    findings.push(`${data.sidewalk_issues.length} sidewalk issues (${nonADA} ADA non-compliant)`);
    sections.push({ heading: 'Sidewalk Issues', content: `${data.sidewalk_issues.length} sidewalk issues reported. ${nonADA} are not ADA compliant and require priority attention.` });
    if (nonADA > 0) actions.push(`Remediate ${nonADA} ADA non-compliant sidewalk issues`);
  }

  // Service requests summary
  if (data.service_requests && Array.isArray(data.service_requests)) {
    findings.push(`${data.service_requests.length} service requests found`);
    sections.push({ heading: 'Service Requests', content: `${data.service_requests.length} resident service requests on file.` });
  }

  // Action results
  for (const tc of dataResult.tool_calls) {
    const key = tc.tool.replace(/^get_/, '');
    const result = data[key];
    if (result && !Array.isArray(result) && result.success !== undefined) {
      findings.push(result.message || `Action ${tc.tool} completed`);
      sections.push({ heading: 'Action Result', content: result.message || JSON.stringify(result) });
    }
  }

  if (findings.length === 0) findings.push('No data retrieved for this query.');
  if (sections.length === 0) sections.push({ heading: 'Results', content: 'No data available for this query. Try broadening your search.' });

  return {
    stage: 'synthesis',
    report: {
      title: `CivicLens Report: ${intentResult.summary || intentResult.intent}`,
      key_findings: findings,
      sections,
      recommended_actions: actions,
      confidence: 0.6,
      data_sources: dataResult.tool_calls.map(tc => tc.tool),
    },
    rag_sources: [],
  };
}
