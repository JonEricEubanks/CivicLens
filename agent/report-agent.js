/**
 * Report Agent — Stage 4 of the CivicLens pipeline
 *
 * Formats the synthesized report into the final response
 * with HTML-ready sections, metadata, and agent trace.
 *
 * Responsible AI: Uses evidence-based data coverage scoring
 * instead of fabricated LLM confidence values.
 */

// Human-readable tool name mapping
const TOOL_LABELS = {
  get_work_orders: 'Work Orders Database',
  get_potholes: 'Pothole Reports',
  get_sidewalk_issues: 'Sidewalk Issues Registry',
  get_schools: 'School Zone Data',
  calculate_priority_score: 'Weibull Priority Scoring Engine',
  forecast_deterioration: 'Deterioration Forecasting',
  cost_of_inaction: 'Cost-of-Inaction Calculator',
  whatif_budget: 'Budget Impact Modeler',
  dispatch_crew: 'Crew Dispatch System',
  update_work_order_status: 'Work Order Management',
  schedule_inspection: 'Inspection Scheduler',
  submit_service_request: 'Service Request System',
  get_service_requests: 'Service Requests',
  get_request_status: 'Request Status Tracker',
};

// All available data sources for coverage calculation
const ALL_DATA_SOURCES = ['get_work_orders', 'get_potholes', 'get_sidewalk_issues', 'get_schools'];

/**
 * Calculate evidence-based data coverage score.
 * Unlike LLM "confidence", this measures how many data sources
 * were actually consulted and how many records were retrieved.
 */
function calculateDataCoverage(dataResult) {
  const toolsUsed = dataResult.tool_calls.map(tc => tc.tool);
  const readToolsUsed = toolsUsed.filter(t => ALL_DATA_SOURCES.includes(t));
  const sourceCoverage = readToolsUsed.length / ALL_DATA_SOURCES.length;
  const recordCount = countRecords(dataResult.data);
  const hasData = recordCount > 0 ? 1 : 0;
  // Coverage = weighted: 60% sources consulted + 40% data retrieved
  const coverage = (sourceCoverage * 0.6 + hasData * 0.4);
  return {
    score: Math.round(coverage * 100),
    sources_consulted: readToolsUsed.length,
    total_sources: ALL_DATA_SOURCES.length,
    records_analyzed: recordCount,
    tools_used: toolsUsed.map(t => TOOL_LABELS[t] || t),
  };
}

export function formatReport(synthesisResult, intentResult, dataResult) {
  try {
    return _formatReportInner(synthesisResult, intentResult, dataResult);
  } catch (err) {
    console.error('[report-agent] Unexpected crash — emergency fallback:', err.message);
    const report = synthesisResult?.report || {};
    const title = report.title || 'CivicLens Report';
    const markdown = `## ${title}\n\n${(report.key_findings || ['Report formatting encountered an issue.']).join('\n')}`;
    return {
      markdown,
      report_meta: { title, data_coverage: { score: 0, sources_consulted: 0, total_sources: 4, records_analyzed: 0, tools_used: [] }, timestamp: new Date().toISOString() },
      summary_stats: [],
      chart_data: null,
      key_findings: report.key_findings || [],
      recommended_actions: report.recommended_actions || [],
      actions_taken: [],
      rag_sources_summary: [],
      trace: [],
    };
  }
}

function _formatReportInner(synthesisResult, intentResult, dataResult) {
  const { report } = synthesisResult;
  const ragSources = synthesisResult.rag_sources || [];
  const timestamp = new Date().toISOString();

  // Build concise markdown response
  const sections = (report.sections || [])
    .map(s => `### ${s.heading}\n\n${s.content}`)
    .join('\n\n');

  const keyFindings = (report.key_findings || [])
    .map((f, i) => `${i + 1}. ${f}`)
    .join('\n');

  const actions = (report.recommended_actions || [])
    .map((a, i) => `${i + 1}. ${a}`)
    .join('\n');

  let markdown = `## ${report.title || 'Here\'s what we found'}\n\n`;
  markdown += `${keyFindings}\n\n`;
  markdown += sections;

  if (actions) {
    markdown += `\n\n### What You Can Do\n\n${actions}`;
  }

  // Responsible AI: brief data note
  const coverage = calculateDataCoverage(dataResult);
  markdown += `\n\n---\n*Based on ${coverage.records_analyzed} records from ${coverage.sources_consulted} data sources · ${new Date().toLocaleDateString()}*`;

  // Build summary stats for visual cards
  const data = dataResult.data || {};
  const summaryStats = buildSummaryStats(data, intentResult);

  return {
    stage: 'report',
    markdown,
    report_meta: {
      title: report.title,
      data_coverage: coverage,
      data_sources: coverage.tools_used,
      timestamp,
    },
    summary_stats: summaryStats,
    chart_data: report.chart_data || null,
    key_findings: report.key_findings || [],
    recommended_actions: report.recommended_actions || [],
    actions_taken: dataResult.tool_calls
      .filter(tc => ['dispatch_crew', 'update_work_order_status', 'schedule_inspection'].includes(tc.tool))
      .map(tc => ({ tool: tc.tool, label: TOOL_LABELS[tc.tool], args: tc.args })),
    rag_sources_summary: ragSources.slice(0, 3).map(s => ({ title: s.title, score: Math.round((s.score || 0) * 100) })),
    trace: [
      { stage: 'Intent Classification', status: 'completed', result: { intent: intentResult.intent, summary: intentResult.summary, model: intentResult._model || 'gpt-4o-mini', validator_model: intentResult._validator_model || null, models_agreed: intentResult._models_agreed ?? null } },
      { stage: 'Data Retrieval', status: 'completed', result: { tools_called: dataResult.tool_calls.map(tc => TOOL_LABELS[tc.tool] || tc.tool), records_fetched: countRecords(data) } },
      { stage: 'Report Synthesis', status: 'completed', result: { sections: (report.sections || []).length, findings: (report.key_findings || []).length } },
      { stage: 'Report Formatting', status: 'completed', result: { format: 'markdown', length: markdown.length } },
    ],
  };
}

function buildSummaryStats(data, intentResult) {
  const stats = [];

  // Count issues by status
  const allIssues = [
    ...(data.potholes || []),
    ...(data.sidewalk_issues || []),
    ...(data.work_orders || []),
    ...(data.service_requests || []),
  ];

  if (allIssues.length > 0) {
    const open = allIssues.filter(i => ['open', 'reported', 'pending', 'in_progress', 'scheduled'].includes((i.status || '').toLowerCase())).length;
    const completed = allIssues.filter(i => ['completed', 'resolved', 'closed', 'repaired'].includes((i.status || '').toLowerCase())).length;
    const critical = allIssues.filter(i => (i.severity === 'critical' || i.priority === 'critical' || i.priority_score >= 80)).length;

    if (open > 0) stats.push({ label: 'Open Issues', value: open, icon: 'warning', color: '#f59e0b' });
    if (completed > 0) stats.push({ label: 'Resolved', value: completed, icon: 'check_circle', color: '#22c55e' });
    if (critical > 0) stats.push({ label: 'Urgent', value: critical, icon: 'error', color: '#ef4444' });
    stats.push({ label: 'Total Records', value: allIssues.length, icon: 'database', color: '#006a61' });
  }

  // Cost if available
  const costs = allIssues.map(i => i.estimated_cost || i.repair_cost || 0).filter(c => c > 0);
  if (costs.length > 0) {
    const total = costs.reduce((a, b) => a + b, 0);
    stats.push({ label: 'Est. Cost', value: '$' + (total >= 1000 ? (total / 1000).toFixed(1) + 'K' : total), icon: 'payments', color: '#3b82f6' });
  }

  // Near schools
  const nearSchool = allIssues.filter(i => i.near_school || i.school_zone).length;
  if (nearSchool > 0) {
    stats.push({ label: 'Near Schools', value: nearSchool, icon: 'school', color: '#8b5cf6' });
  }

  return stats;
}

function countRecords(data) {
  let count = 0;
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) count += val.length;
    else if (val && typeof val === 'object') count += 1;
  }
  return count;
}
