/**
 * NLP Dashboard Builder — CivicLens
 *
 * Full-screen overlay: NLP prompt → pipeline animation → interactive charts + KPIs
 * Vanilla JS, Chart.js, Tailwind classes.
 */

/* global Chart, marked */

// ─── State ──────────────────────────────────────────────────────────────────

let dashboardData = null;
let dashboardCharts = [];
let activeTab = 'overview';
let editMode = false;
let queryText = '';

// ─── Quick Templates ────────────────────────────────────────────────────────

const TEMPLATES = [
  { icon: () => CivicIcons.chart('w-5 h-5'), label: 'Full Overview', query: 'Give me a complete overview of all infrastructure issues, costs, and priorities' },
  { icon: () => CivicIcons.dollar('w-5 h-5'), label: 'Budget Analysis', query: 'Budget breakdown by severity and zone with cost projections' },
  { icon: () => CivicIcons.shield('w-5 h-5'), label: 'Safety Report', query: 'Show me all school zone safety concerns and ADA compliance issues' },
  { icon: () => CivicIcons.clipboard('w-5 h-5'), label: 'Status Tracker', query: 'What is the status of all open and in-progress work orders?' },
  { icon: () => CivicIcons.map('w-5 h-5'), label: 'Zone Analysis', query: 'Zone-by-zone comparison of issues, severity, and resource needs' },
  { icon: () => CivicIcons.trendUp('w-5 h-5'), label: 'Trend & Forecast', query: 'Show repair trends and forecast for the next 90 days' },
];

// ─── Shared Palettes & Helpers (from civic-utils.js) ─────────────────────

const { SEV_COLORS, TYPE_COLORS, STATUS_COLORS, GRADE_COLORS, pieData, barData, prettyLabel } = window.CivicUtils;
const escHtml = window.CivicUtils.escapeHtml;
const CHART_BG = 'rgba(255,255,255,0.05)';

// ─── Launch / Close ─────────────────────────────────────────────────────────

export function openDashboard() {
  if (document.getElementById('nlp-dashboard-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'nlp-dashboard-overlay';
  overlay.innerHTML = buildShell();
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Wire events
  const textarea = document.getElementById('dash-prompt');
  textarea.focus();
  document.getElementById('dash-prompt-form').addEventListener('submit', onSubmitQuery);
  document.getElementById('dash-close').addEventListener('click', closeDashboard);

  // Quick template cards
  document.querySelectorAll('.dash-template-card').forEach(card => {
    card.addEventListener('click', () => {
      textarea.value = card.dataset.query;
      onSubmitQuery(new Event('submit'));
    });
  });

  // Keyboard
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDashboard();
  });
}

export function closeDashboard() {
  const overlay = document.getElementById('nlp-dashboard-overlay');
  if (overlay) {
    destroyCharts();
    overlay.remove();
    document.body.style.overflow = '';
    dashboardData = null;
    editMode = false;
  }
}

// ─── Theme Detection ────────────────────────────────────────────────────────

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// ─── Shell HTML ─────────────────────────────────────────────────────────────

function buildShell() {
  const dark = isDarkTheme();
  const t = {
    bg: dark ? 'bg-gray-950/95' : 'bg-white/95',
    text: dark ? 'text-white' : 'text-gray-900',
    textMuted: dark ? 'text-white/70' : 'text-gray-600',
    textFaint: dark ? 'text-white/40' : 'text-gray-400',
    textFaintest: dark ? 'text-white/30' : 'text-gray-300',
    border: dark ? 'border-white/10' : 'border-gray-200',
    cardBg: dark ? 'bg-white/5' : 'bg-gray-50',
    cardHover: dark ? 'hover:bg-white/10' : 'hover:bg-gray-100',
    inputBg: dark ? 'bg-white/5' : 'bg-gray-50',
    closeTxt: dark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-900',
    badgeBg1: dark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700',
    badgeBg2: dark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700',
    cardLabel: dark ? 'text-white/90 group-hover:text-white' : 'text-gray-800 group-hover:text-gray-950',
    cardDesc: dark ? 'text-white/40' : 'text-gray-400',
    placeholder: dark ? 'placeholder-white/30' : 'placeholder-gray-400',
  };

  const templateCards = TEMPLATES.map(tp =>
    `<button class="dash-template-card ${t.cardBg} ${t.cardHover} border ${t.border} rounded-xl p-4 text-left transition-all group" data-query="${escHtml(tp.query)}">
       <div class="text-2xl mb-2">${typeof tp.icon === 'function' ? tp.icon() : tp.icon}</div>
       <div class="text-sm font-semibold ${t.cardLabel}">${tp.label}</div>
       <div class="text-xs ${t.cardDesc} mt-1 line-clamp-2">${escHtml(tp.query)}</div>
     </button>`
  ).join('');

  return `
  <style>
    /* Light-mode overrides for NLP Dashboard overlay */
    .nlp-dash-theme[data-dash-dark="false"] .text-white\\/70 { color: rgba(55,65,81,0.85) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .text-white\\/50 { color: rgba(107,114,128,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .text-white\\/40 { color: rgba(156,163,175,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .text-white\\/30 { color: rgba(209,213,219,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .text-white\\/80 { color: rgba(31,41,55,0.9) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .text-white\\/60 { color: rgba(75,85,99,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .text-white { color: #111827 !important; }
    .nlp-dash-theme[data-dash-dark="false"] .bg-white\\/5 { background-color: rgba(243,244,246,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .bg-white\\/10 { background-color: rgba(229,231,235,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .bg-white\\/15 { background-color: rgba(209,213,219,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .border-white\\/10 { border-color: rgba(229,231,235,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .border-white\\/5 { border-color: rgba(243,244,246,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .border-white\\/20 { border-color: rgba(209,213,219,1) !important; }
    .nlp-dash-theme[data-dash-dark="false"] .prose-invert { --tw-prose-body: #374151; --tw-prose-headings: #111827; }
  </style>
  <div class="fixed inset-0 z-50 ${t.bg} backdrop-blur-xl flex flex-col nlp-dash-theme" data-dash-dark="${dark}" style="font-family:Inter,system-ui,sans-serif">
    <!-- Header -->
    <header class="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-b ${t.border} shrink-0">
      <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">AI</div>
      <div class="flex-1 min-w-0">
        <h1 class="${t.text} font-bold text-base md:text-lg">AI Dashboard Builder</h1>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[10px] px-2 py-0.5 rounded-full ${t.badgeBg1} font-medium">Azure Foundry</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full ${t.badgeBg2} font-medium hidden sm:inline">MCP Data</span>
        </div>
      </div>
      <button id="dash-close" class="${t.closeTxt} text-2xl leading-none px-2" title="Close (Esc)">&times;</button>
    </header>

    <!-- Scrollable content -->
    <div id="dash-body" class="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
      <!-- Prompt area -->
      <div id="dash-prompt-area" class="max-w-4xl mx-auto mb-8">
        <form id="dash-prompt-form" class="relative">
          <textarea id="dash-prompt" rows="3"
            class="w-full ${t.inputBg} border ${t.border} rounded-2xl px-5 py-4 pr-14 ${t.text} ${t.placeholder} text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
            placeholder="What would you like to visualize? Try &quot;Budget breakdown by severity and zone&quot;..."
            maxlength="500"></textarea>
          <button type="submit" class="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition text-lg">▶</button>
        </form>

        <!-- Quick templates -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 mt-4 md:mt-5">
          ${templateCards}
        </div>
      </div>

      <!-- Pipeline animation (hidden until query) -->
      <div id="dash-pipeline" class="max-w-4xl mx-auto mb-8 hidden"></div>

      <!-- Results (hidden until generated) -->
      <div id="dash-results" class="hidden">
        <!-- Executive Summary Banner -->
        <div id="dash-exec-summary" class="mb-8"></div>

        <!-- Key Findings -->
        <div id="dash-findings" class="mb-8"></div>

        <!-- Tab bar -->
        <div id="dash-tabs" class="mb-6"></div>

        <!-- Widget grid -->
        <div id="dash-widgets" class="mb-8"></div>

        <!-- AI Processing Panel -->
        <div id="dash-ai-panel" class="mb-8"></div>

        <!-- Actions -->
        <div class="flex items-center gap-3 justify-center pb-8">
          <button id="dash-export-btn" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition">Export Report</button>
          <button id="dash-print-btn" class="px-6 py-2.5 rounded-xl ${t.cardBg} ${t.cardHover} border ${t.border} ${t.textMuted} text-sm font-medium transition">Print</button>
          <button id="dash-edit-toggle" class="px-6 py-2.5 rounded-xl ${t.cardBg} ${t.cardHover} border ${t.border} ${t.textMuted} text-sm font-medium transition">Edit Mode</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Query Submission ───────────────────────────────────────────────────────

async function onSubmitQuery(e) {
  e.preventDefault();
  const textarea = document.getElementById('dash-prompt');
  const query = textarea.value.trim();
  if (!query) return;
  queryText = query;

  // Show pipeline, hide templates
  const promptArea = document.getElementById('dash-prompt-area');
  const pipelineEl = document.getElementById('dash-pipeline');
  const resultsEl = document.getElementById('dash-results');
  pipelineEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  destroyCharts();

  // Collapse prompt bar
  const dk = isDarkTheme();
  promptArea.innerHTML = `
    <div class="flex items-center gap-3 ${dk ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'} border rounded-xl px-5 py-3">
      <span class="text-indigo-400 text-sm">${CivicIcons.notepad('w-4 h-4')}</span>
      <span class="${dk ? 'text-white/70' : 'text-gray-600'} text-sm flex-1 truncate">${escHtml(query)}</span>
      <button id="dash-edit-query" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Edit Query</button>
    </div>`;
  document.getElementById('dash-edit-query').addEventListener('click', () => {
    promptArea.innerHTML = buildPromptBar(query);
    document.getElementById('dash-prompt').focus();
    document.getElementById('dash-prompt-form').addEventListener('submit', onSubmitQuery);
    // Rewire template cards
    document.querySelectorAll('.dash-template-card').forEach(card => {
      card.addEventListener('click', () => {
        document.getElementById('dash-prompt').value = card.dataset.query;
        onSubmitQuery(new Event('submit'));
      });
    });
  });

  // Run pipeline animation
  const phases = [
    { name: 'Intent Parsing', icon: CivicIcons.target('w-4 h-4'), duration: 400 },
    { name: 'Data Retrieval', icon: CivicIcons.chart('w-4 h-4'), duration: 600 },
    { name: 'Aggregation', icon: CivicIcons.cog('w-4 h-4'), duration: 350 },
    { name: 'Visualization', icon: CivicIcons.trendUp('w-4 h-4'), duration: 500 },
    { name: 'AI Insights', icon: CivicIcons.sparkle('w-4 h-4'), duration: 800 },
  ];

  renderPipeline(phases, -1);

  // Fetch dashboard data
  const fetchPromise = fetch('/api/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  }).then(r => r.json());

  // Animate phases with simulated timing
  for (let i = 0; i < phases.length; i++) {
    renderPipeline(phases, i);
    await sleep(phases[i].duration);
  }

  try {
    dashboardData = await fetchPromise;
    renderPipeline(phases, phases.length); // all complete
    await sleep(300);
    renderResults();

    // Lazy-load AI insights in background
    fetchAIInsights(query);
  } catch (err) {
    pipelineEl.innerHTML = `<div class="text-red-400 text-sm text-center">${CivicIcons.alertTriangle('w-4 h-4 inline')} Failed to load data. Ensure MCP server is running on port 3000.</div>`;
  }
}

function buildPromptBar(value = '') {
  const dk = isDarkTheme();
  const templateCards = TEMPLATES.map(t =>
    `<button class="dash-template-card ${dk ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border rounded-xl p-4 text-left transition-all group" data-query="${escHtml(t.query)}">
       <div class="text-2xl mb-2">${typeof t.icon === 'function' ? t.icon() : t.icon}</div>
       <div class="text-sm font-semibold ${dk ? 'text-white/90 group-hover:text-white' : 'text-gray-800 group-hover:text-gray-950'}">${t.label}</div>
       <div class="text-xs ${dk ? 'text-white/40' : 'text-gray-400'} mt-1 line-clamp-2">${escHtml(t.query)}</div>
     </button>`
  ).join('');

  return `
    <form id="dash-prompt-form" class="relative">
      <textarea id="dash-prompt" rows="3"
        class="w-full ${dk ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'} border rounded-2xl px-5 py-4 pr-14 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        placeholder="What would you like to visualize?"
        maxlength="500">${escHtml(value)}</textarea>
      <button type="submit" class="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition text-lg">▶</button>
    </form>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">${templateCards}</div>`;
}

// ─── Pipeline Animation ─────────────────────────────────────────────────────

function renderPipeline(phases, activeIndex) {
  const dk = isDarkTheme();
  const el = document.getElementById('dash-pipeline');
  el.innerHTML = `
    <div class="${dk ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'} border rounded-2xl p-5">
      <div class="text-xs ${dk ? 'text-white/40' : 'text-gray-400'} font-medium mb-3 uppercase tracking-wider">Agent Pipeline</div>
      <div class="flex items-center gap-1">
        ${phases.map((p, i) => {
          let state = 'pending';
          if (i < activeIndex) state = 'complete';
          else if (i === activeIndex) state = 'running';

          const dot = state === 'complete' ? '✓' : state === 'running' ? '●' : '○';
          const color = state === 'complete' ? 'text-green-400' : state === 'running' ? 'text-indigo-400' : (dk ? 'text-white/20' : 'text-gray-300');
          const bg = state === 'running' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-transparent border-transparent';
          const anim = state === 'running' ? 'animate-pulse' : '';

          return `
            <div class="flex-1 flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border ${bg} ${anim} transition-all">
              <span class="${color} text-base">${p.icon}</span>
              <span class="${color} text-[10px] font-semibold">${dot}</span>
              <span class="text-[10px] ${dk ? 'text-white/50' : 'text-gray-500'} text-center">${p.name}</span>
            </div>
            ${i < phases.length - 1 ? `<div class="w-6 h-px ${i < activeIndex ? 'bg-green-400/40' : (dk ? 'bg-white/10' : 'bg-gray-200')}"></div>` : ''}`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Render Results ─────────────────────────────────────────────────────────

function renderResults() {
  const el = document.getElementById('dash-results');
  el.classList.remove('hidden');

  // Auto-select tab based on server's query analysis
  if (dashboardData.focus && DASH_TABS.some(t => t.id === dashboardData.focus)) {
    activeTab = dashboardData.focus;
  }

  renderExecSummary();
  renderFindings();
  renderTabs();
  renderWidgets();
  renderAIPanel();
  wireResultButtons();
}

// ─── Lazy AI Insights ───────────────────────────────────────────────────────

async function fetchAIInsights(query) {
  try {
    const resp = await fetch('/api/dashboard/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await resp.json();
    if (data.ai_insights) {
      dashboardData.ai_insights = data.ai_insights;
      renderAIPanel();
    }
  } catch (e) {
    // AI insights are optional — fail silently
    console.warn('AI insights failed:', e.message);
  }
}

// ─── Executive Summary Banner ───────────────────────────────────────────────

function renderExecSummary() {
  const dk = isDarkTheme();
  const s = dashboardData.summary;
  const riskScore = Math.min(100, Math.round((s.critical * 25 + s.high * 15 + s.medium * 5) / Math.max(s.total_issues, 1) * 10));
  const riskLevel = riskScore >= 75 ? 'Critical' : riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low';
  const riskColor = riskScore >= 75 ? '#ef4444' : riskScore >= 50 ? '#f97316' : riskScore >= 25 ? '#eab308' : '#22c55e';

  // Build dynamic title from query + filters
  const filters = dashboardData.filters || {};
  const activeFilters = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const filterBadge = activeFilters.length > 0
    ? `<span class="text-[10px] px-2 py-0.5 rounded-full ${dk ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'} font-medium">${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied</span>`
    : '';
  const filteredNote = dashboardData.total_unfiltered && dashboardData.total_unfiltered !== s.total_issues
    ? `<div class="${dk ? 'text-white/40' : 'text-gray-400'} text-[10px] mt-1">Showing ${s.total_issues} of ${dashboardData.total_unfiltered} total work orders</div>`
    : '';

  const kpis = [
    { label: 'Total Issues', value: s.total_issues, icon: CivicIcons.clipboard('w-5 h-5'), color: 'indigo' },
    { label: 'Critical + High', value: s.critical_high, icon: CivicIcons.priorityCritical('w-5 h-5'), color: 'red' },
    { label: 'Total Cost', value: `$${(s.total_cost / 1000).toFixed(1)}K`, icon: CivicIcons.dollar('w-5 h-5'), color: 'amber' },
    { label: 'Near Schools', value: s.near_schools, icon: CivicIcons.school('w-5 h-5'), color: 'purple' },
    { label: 'Open Issues', value: s.open_issues, icon: CivicIcons.folder('w-5 h-5'), color: 'orange' },
    { label: 'Avg Cost', value: `$${s.avg_cost.toLocaleString()}`, icon: CivicIcons.chart('w-5 h-5'), color: 'teal' },
  ];

  const gaugeTrack = dk ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const gaugeText = dk ? 'white' : '#1f2937';

  document.getElementById('dash-exec-summary').innerHTML = `
    <div class="${dk ? 'bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-indigo-600/10 border-white/10' : 'bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border-gray-200'} border rounded-2xl p-6">
      <div class="flex items-start gap-6 flex-wrap">
        <div class="flex-1 min-w-[250px]">
          <h2 class="${dk ? 'text-white' : 'text-gray-900'} font-bold text-xl mb-1">Infrastructure Dashboard</h2>
          <p class="${dk ? 'text-white/50' : 'text-gray-500'} text-sm mb-3">${escHtml(queryText)}</p>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] px-2 py-0.5 rounded-full ${dk ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'} font-medium">AI-Generated</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${dk ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'} font-medium">Foundry Pipeline</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'} font-medium">MCP Data</span>
            ${filterBadge}
          </div>
          ${filteredNote}
        </div>
        <!-- Risk Gauge -->
        <div class="flex flex-col items-center">
          <svg width="100" height="60" viewBox="0 0 100 60">
            <path d="M10 55 A 40 40 0 0 1 90 55" fill="none" stroke="${gaugeTrack}" stroke-width="8" stroke-linecap="round"/>
            <path d="M10 55 A 40 40 0 0 1 90 55" fill="none" stroke="${riskColor}" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${riskScore * 1.26} 126" class="transition-all duration-1000"/>
            <text x="50" y="48" text-anchor="middle" fill="${gaugeText}" font-size="14" font-weight="bold">${riskScore}</text>
          </svg>
          <span class="text-[10px] font-semibold" style="color:${riskColor}">${riskLevel} Risk</span>
        </div>
      </div>
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
        ${kpis.map(k => `
          <div class="${dk ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100'} rounded-xl p-3 border">
            <div class="text-lg mb-1">${k.icon}</div>
            <div class="${dk ? 'text-white' : 'text-gray-900'} font-bold text-xl kpi-counter" data-target="${typeof k.value === 'number' ? k.value : ''}">${k.value}</div>
            <div class="${dk ? 'text-white/40' : 'text-gray-400'} text-[10px] mt-0.5">${k.label}</div>
          </div>
        `).join('')}
      </div>
    </div>`;

  // Animate number counters
  animateCounters();
}

function animateCounters() {
  document.querySelectorAll('.kpi-counter').forEach(el => {
    const target = parseInt(el.dataset.target);
    if (isNaN(target)) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(interval); }
      el.textContent = current;
    }, 30);
  });
}

// ─── Key Findings ───────────────────────────────────────────────────────────

function renderFindings() {
  const s = dashboardData.summary;
  const findings = [];

  if (s.critical > 0) findings.push(`<strong>${s.critical} critical issue${s.critical > 1 ? 's' : ''}</strong> require immediate attention`);
  if (s.critical_high > 0) findings.push(`${s.critical_high} issues rated critical or high priority`);
  if (s.near_schools > 0) findings.push(`<strong>${s.near_schools} issues near school zones</strong> — safety priority`);
  findings.push(`Total estimated repair cost: <strong>$${s.total_cost.toLocaleString()}</strong>`);
  if (s.open_issues > 0) findings.push(`${s.open_issues} open work orders awaiting assignment`);

  const zones = Object.entries(s.by_zone).sort((a, b) => b[1] - a[1]);
  if (zones.length > 0) findings.push(`Highest concentration: <strong>${zones[0][0]}</strong> with ${zones[0][1]} issues`);

  document.getElementById('dash-findings').innerHTML = `
    <div class="${isDarkTheme() ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'} border rounded-2xl p-5">
      <h3 class="${isDarkTheme() ? 'text-white' : 'text-gray-900'} font-semibold text-sm mb-3">${CivicIcons.search('w-4 h-4 inline')} Key Findings</h3>
      <ul class="space-y-2">
        ${findings.map(f => `<li class="${isDarkTheme() ? 'text-white/70' : 'text-gray-600'} text-sm flex items-start gap-2"><span class="text-indigo-400 mt-0.5">•</span><span>${f}</span></li>`).join('')}
      </ul>
    </div>`;
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

const DASH_TABS = [
  { id: 'overview', label: 'Overview', icon: CivicIcons.chart('w-4 h-4 inline') },
  { id: 'severity', label: 'Severity', icon: CivicIcons.alertTriangle('w-4 h-4 inline') },
  { id: 'cost', label: 'Cost', icon: CivicIcons.dollar('w-4 h-4 inline') },
  { id: 'status', label: 'Status', icon: CivicIcons.clipboard('w-4 h-4 inline') },
  { id: 'geographic', label: 'Geographic', icon: CivicIcons.map('w-4 h-4 inline') },
  { id: 'community', label: 'Community', icon: CivicIcons.home('w-4 h-4 inline') },
];

function renderTabs() {
  const dk = isDarkTheme();
  const inactiveTab = dk ? 'text-white/50 hover:text-white/70 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100';
  // activeTab is already set by renderResults based on server focus
  document.getElementById('dash-tabs').innerHTML = `
    <div class="flex items-center gap-1 ${dk ? 'bg-white/5' : 'bg-gray-100'} rounded-xl p-1 w-fit">
      ${DASH_TABS.map(t => `
        <button class="dash-tab px-4 py-2 rounded-lg text-sm font-medium transition-all ${t.id === activeTab ? 'bg-indigo-600 text-white' : inactiveTab}" data-tab="${t.id}">
          ${t.icon} ${t.label}
        </button>
      `).join('')}
    </div>`;

  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const dk2 = isDarkTheme();
      const inact = dk2 ? 'text-white/50 hover:text-white/70 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100';
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.dash-tab').forEach(b => {
        b.className = b.dataset.tab === activeTab
          ? 'dash-tab px-4 py-2 rounded-lg text-sm font-medium transition-all bg-indigo-600 text-white'
          : 'dash-tab px-4 py-2 rounded-lg text-sm font-medium transition-all ' + inact;
      });
      renderWidgets();
    });
  });
}

// ─── Widget Grid ────────────────────────────────────────────────────────────

function renderWidgets() {
  destroyCharts();
  const container = document.getElementById('dash-widgets');
  const s = dashboardData.summary;

  const widgetConfigs = {
    overview: [
      { id: 'ov-type', title: 'Issues by Type', span: 1, type: 'doughnut', data: () => pieData(s.by_type, TYPE_COLORS) },
      { id: 'ov-status', title: 'Issues by Status', span: 1, type: 'doughnut', data: () => pieData(s.by_status, STATUS_COLORS) },
      { id: 'ov-priority', title: 'Issues by Priority', span: 1, type: 'bar', data: () => barData({ critical: s.critical, high: s.high, medium: s.medium, low: s.low }, SEV_COLORS) },
      { id: 'ov-zone', title: 'Issues by Zone', span: 2, type: 'bar', data: () => barData(s.by_zone, null, '#6366f1') },
      { id: 'ov-cost-type', title: 'Cost by Type', span: 1, type: 'doughnut', data: () => pieData(s.cost_by_type, TYPE_COLORS) },
    ],
    severity: [
      { id: 'sv-dist', title: 'Priority Distribution', span: 2, type: 'bar', data: () => barData({ critical: s.critical, high: s.high, medium: s.medium, low: s.low }, SEV_COLORS) },
      { id: 'sv-radar', title: 'Severity Overview', span: 1, type: 'radar', data: () => radarData() },
    ],
    cost: [
      { id: 'ct-prio', title: 'Cost by Priority', span: 2, type: 'bar', data: () => barData(s.cost_by_priority, SEV_COLORS) },
      { id: 'ct-type', title: 'Cost by Type', span: 1, type: 'doughnut', data: () => pieData(s.cost_by_type, TYPE_COLORS) },
    ],
    status: [
      { id: 'st-dist', title: 'Status Distribution', span: 1, type: 'doughnut', data: () => pieData(s.by_status, STATUS_COLORS) },
      { id: 'st-bar', title: 'Work Order Status', span: 2, type: 'bar', data: () => barData(s.by_status, STATUS_COLORS) },
    ],
    geographic: [
      { id: 'geo-zone', title: 'Issues per Zone', span: 2, type: 'bar', data: () => barData(s.by_zone, null, '#8b5cf6') },
      { id: 'geo-cost', title: 'Cost by Zone', span: 1, type: 'doughnut', data: () => {
        const costByZone = dashboardData.work_orders.reduce((acc, w) => {
          const z = w.location?.zone || 'unknown';
          acc[z] = (acc[z] || 0) + (w.estimated_cost || 0);
          return acc;
        }, {});
        return pieData(costByZone, null);
      }},
    ],
  };

  const widgets = widgetConfigs[activeTab] || widgetConfigs.overview;

  // Community tab has custom rendering
  if (activeTab === 'community') {
    renderCommunityTab(container);
    return;
  }

  const dk = isDarkTheme();
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${widgets.map(w => `
        <div class="${dk ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'} border rounded-xl p-4 ${w.span === 2 ? 'md:col-span-2' : w.span === 3 ? 'md:col-span-3' : ''} relative group">
          ${editMode ? `
            <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button class="w-6 h-6 rounded ${dk ? 'bg-white/10 text-white/50 hover:text-white' : 'bg-gray-100 text-gray-400 hover:text-gray-700'} text-xs" onclick="this.closest('[class*=border]').remove()">✕</button>
            </div>` : ''}
          <h4 class="${dk ? 'text-white/70' : 'text-gray-600'} text-xs font-semibold mb-3">${w.title}</h4>
          <div class="relative" style="height:220px">
            <canvas id="chart-${w.id}"></canvas>
          </div>
        </div>
      `).join('')}
    </div>`;

  // Render charts
  requestAnimationFrame(() => {
    widgets.forEach(w => {
      const canvas = document.getElementById(`chart-${w.id}`);
      if (!canvas) return;
      const chart = new Chart(canvas, {
        type: w.type === 'doughnut' ? 'doughnut' : w.type === 'radar' ? 'radar' : 'bar',
        data: w.data(),
        options: chartOptions(w.type),
      });
      dashboardCharts.push(chart);
    });
  });
}

// ─── Community Tab (Resident View) ──────────────────────────────────────────

async function renderCommunityTab(container) {
  container.innerHTML = `<div class="text-center text-white/40 py-8">Loading community data...</div>`;
  let cd;
  try {
    const res = await fetch('/api/community');
    cd = await res.json();
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 py-8">Failed to load community data.</div>`;
    return;
  }

  const stats = cd.stats || {};
  const scores = cd.neighborhood_scores || {};
  const schools = cd.schools || [];
  const requests = cd.service_requests || [];

  const gradeColors = CivicUtils.GRADE_COLORS;
  const recentlyFixed = requests.filter(r => r.status === 'completed').slice(0, 5);
  const activeIssues = requests.filter(r => r.status !== 'completed').slice(0, 5);

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Neighborhood Grades -->
      <div class="bg-white/5 border border-white/10 rounded-xl p-5">
        <h4 class="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">${CivicIcons.home('w-4 h-4 inline')} Neighborhood Health Grades</h4>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          ${Object.entries(scores).map(([zone, data]) => `
            <div class="bg-white/5 rounded-xl p-4 text-center border border-white/5">
              <div class="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-2xl mb-2" style="background:${gradeColors[data.grade] || gradeColors.C}">
                ${data.grade}
              </div>
              <div class="text-white font-semibold text-sm">${zone}</div>
              <div class="text-white/40 text-[10px]">${data.score}/100</div>
              <div class="mt-2 space-y-1 text-[10px]">
                <div class="flex justify-between"><span class="text-white/40">Open</span><span class="text-white/70">${data.open_issues}</span></div>
                <div class="flex justify-between"><span class="text-white/40">Critical</span><span class="${data.critical_issues > 0 ? 'text-red-400' : 'text-white/70'}">${data.critical_issues}</span></div>
                <div class="flex justify-between"><span class="text-white/40">Near Schools</span><span class="${data.school_issues > 0 ? 'text-amber-400' : 'text-green-400'}">${data.school_issues}</span></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Community Stats -->
        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
          <h4 class="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">${CivicIcons.chart('w-4 h-4 inline')} Community Snapshot</h4>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-white/50 text-sm">Total Requests</span>
              <span class="text-white font-bold text-lg">${stats.total_requests || 0}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/50 text-sm">Avg. Fix Time</span>
              <span class="text-white font-bold text-lg">${stats.avg_resolution_days || '—'} days</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/50 text-sm">Fixed Last 30 Days</span>
              <span class="text-green-400 font-bold text-lg">${stats.recent_fixes_30d || 0}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/50 text-sm">New Last 30 Days</span>
              <span class="text-amber-400 font-bold text-lg">${stats.recent_requests_30d || 0}</span>
            </div>
          </div>
        </div>

        <!-- Top Issue Types -->
        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
          <h4 class="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">${CivicIcons.clipboard('w-4 h-4 inline')} What's Being Reported</h4>
          <div class="space-y-2">
            ${Object.entries(stats.by_category || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
              const iconFns = { pothole: () => CivicIcons.pothole('w-3 h-3 inline'), sidewalk: () => CivicIcons.sidewalk('w-3 h-3 inline'), streetlight: () => CivicIcons.streetlight('w-3 h-3 inline'), drainage: () => CivicIcons.drainage('w-3 h-3 inline'), tree_damage: () => CivicIcons.tree('w-3 h-3 inline'), sign_damage: () => CivicIcons.sign('w-3 h-3 inline'), crosswalk: () => CivicIcons.crosswalk('w-3 h-3 inline') };
              const pct = Math.round((count / (stats.total_requests || 1)) * 100);
              return `
                <div>
                  <div class="flex items-center justify-between text-xs mb-0.5">
                    <span class="text-white/60">${iconFns[cat] ? iconFns[cat]() : CivicIcons.clipboard('w-3 h-3 inline')} ${prettyLabel(cat)}</span>
                    <span class="text-white/40">${count}</span>
                  </div>
                  <div class="w-full bg-white/5 rounded-full h-1.5"><div class="bg-indigo-500 h-full rounded-full" style="width:${pct}%"></div></div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Schools -->
        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
          <h4 class="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">${CivicIcons.school('w-4 h-4 inline')} School Zone Safety</h4>
          <div class="space-y-2">
            ${schools.map(s => {
              const zoneData = scores[s.zone] || {};
              const safe = (zoneData.school_issues || 0) === 0;
              return `
                <div class="flex items-center gap-2 bg-white/5 rounded-lg p-2.5">
                  <span class="text-lg">${safe ? CivicIcons.checkCircle('w-5 h-5') : CivicIcons.alertTriangle('w-5 h-5')}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-white/80 text-xs font-medium truncate">${escHtml(s.name)}</div>
                    <div class="text-white/30 text-[10px]">${s.enrollment} students · ${s.zone}</div>
                  </div>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full ${safe ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}">${safe ? 'Clear' : zoneData.school_issues + ' issues'}</span>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
          <h4 class="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">${CivicIcons.checkCircle('w-4 h-4 inline')} Recently Fixed</h4>
          ${recentlyFixed.length ? recentlyFixed.map(r => `
            <div class="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <span class="text-green-400 text-sm">✓</span>
              <div class="flex-1 min-w-0">
                <div class="text-white/70 text-xs truncate">${escHtml(r.description)}</div>
                <div class="text-white/30 text-[10px]">${r.location?.address || ''}</div>
              </div>
              <span class="text-white/30 text-[10px] shrink-0">${r.id}</span>
            </div>
          `).join('') : '<div class="text-white/30 text-xs text-center py-4">No recent fixes</div>'}
        </div>
        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
          <h4 class="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">${CivicIcons.circleProgress('w-4 h-4 inline')} Being Worked On</h4>
          ${activeIssues.length ? activeIssues.map(r => `
            <div class="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <span class="${r.status === 'in_progress' ? 'text-blue-400' : 'text-amber-400'} text-sm">${r.status === 'in_progress' ? CivicIcons.cog('w-4 h-4') : CivicIcons.circleAlert('w-4 h-4')}</span>
              <div class="flex-1 min-w-0">
                <div class="text-white/70 text-xs truncate">${escHtml(r.description)}</div>
                <div class="text-white/30 text-[10px]">${r.location?.address || ''} ${r.resolution_eta ? '· ETA: ' + r.resolution_eta : ''}</div>
              </div>
              <span class="text-white/30 text-[10px] shrink-0">${r.id}</span>
            </div>
          `).join('') : '<div class="text-white/30 text-xs text-center py-4">No active issues</div>'}
        </div>
      </div>
    </div>`;
}

// ─── Chart Data Helpers (now from CivicUtils) ─────────────────────────────────

function radarData() {
  const s = dashboardData.summary;
  return {
    labels: ['Critical', 'High', 'Medium', 'Low', 'School Zone', 'Open'],
    datasets: [{
      data: [s.critical * 10, s.high * 5, s.medium * 3, s.low, s.near_schools * 4, s.open_issues * 3],
      backgroundColor: 'rgba(99,102,241,0.15)',
      borderColor: '#6366f1',
      borderWidth: 2,
      pointBackgroundColor: '#6366f1',
    }],
  };
}

function chartOptions(type) {
  const dk = isDarkTheme();
  const labelColor = dk ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const tickColor = dk ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const gridColor = dk ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const radarGrid = dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: type === 'doughnut' || type === 'radar',
        position: 'bottom',
        labels: { color: labelColor, font: { size: 10 }, padding: 8, boxWidth: 10 },
      },
    },
  };
  if (type === 'bar') {
    base.scales = {
      x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } },
    };
    base.plugins.legend = { display: false };
  }
  if (type === 'radar') {
    base.scales = {
      r: {
        ticks: { color: dk ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', backdropColor: 'transparent', font: { size: 9 } },
        grid: { color: radarGrid },
        angleLines: { color: radarGrid },
        pointLabels: { color: labelColor, font: { size: 10 } },
      },
    };
  }
  return base;
}

// ─── AI Processing Panel ────────────────────────────────────────────────────

function renderAIPanel() {
  const dk = isDarkTheme();
  const ai = dashboardData.ai_insights;
  const el = document.getElementById('dash-ai-panel');

  if (!ai) {
    el.innerHTML = '';
    return;
  }

  const pipelineDur = ai.pipeline?.total_duration_ms || 0;
  const stages = ai.pipeline?.stages || [];

  el.innerHTML = `
    <details class="${dk ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'} border rounded-2xl overflow-hidden">
      <summary class="px-5 py-3 cursor-pointer ${dk ? 'text-white/60 hover:text-white/80' : 'text-gray-500 hover:text-gray-700'} text-xs font-medium transition flex items-center gap-2">
        <span>${CivicIcons.cog('w-4 h-4 inline')} AI Processing Details</span>
        <span class="ml-auto ${dk ? 'text-white/30' : 'text-gray-400'}">${pipelineDur}ms total</span>
      </summary>
      <div class="px-5 pb-4 pt-2 border-t ${dk ? 'border-white/5' : 'border-gray-100'}">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div class="${dk ? 'bg-white/5' : 'bg-white border border-gray-100'} rounded-lg p-3"><div class="${dk ? 'text-white/30' : 'text-gray-400'} mb-1">Model</div><div class="${dk ? 'text-white' : 'text-gray-900'} font-medium">gpt-4o-mini</div></div>
          <div class="${dk ? 'bg-white/5' : 'bg-white border border-gray-100'} rounded-lg p-3"><div class="${dk ? 'text-white/30' : 'text-gray-400'} mb-1">Duration</div><div class="${dk ? 'text-white' : 'text-gray-900'} font-medium">${pipelineDur}ms</div></div>
          <div class="${dk ? 'bg-white/5' : 'bg-white border border-gray-100'} rounded-lg p-3"><div class="${dk ? 'text-white/30' : 'text-gray-400'} mb-1">Stages</div><div class="${dk ? 'text-white' : 'text-gray-900'} font-medium">${stages.length}</div></div>
          <div class="${dk ? 'bg-white/5' : 'bg-white border border-gray-100'} rounded-lg p-3"><div class="${dk ? 'text-white/30' : 'text-gray-400'} mb-1">Pipeline</div><div class="${dk ? 'text-white' : 'text-gray-900'} font-medium">4-stage agent</div></div>
        </div>
        ${ai.markdown ? `
          <div class="mt-4 ${dk ? 'text-white/60 prose-invert' : 'text-gray-600'} text-sm prose max-w-none">
            ${marked.parse(ai.markdown)}
          </div>` : ''}
      </div>
    </details>`;
}

// ─── Action Buttons ─────────────────────────────────────────────────────────

function wireResultButtons() {
  document.getElementById('dash-export-btn')?.addEventListener('click', () => {
    closeDashboard();
    if (typeof window.openReportGenerator === 'function') {
      window.openReportGenerator(dashboardData);
    }
  });
  document.getElementById('dash-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('dash-edit-toggle')?.addEventListener('click', () => {
    editMode = !editMode;
    const btn = document.getElementById('dash-edit-toggle');
    btn.textContent = editMode ? 'Preview Mode' : 'Edit Mode';
    btn.className = editMode
      ? 'px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium transition'
      : 'px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-medium transition';
    renderWidgets();
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function destroyCharts() {
  dashboardCharts.forEach(c => c.destroy());
  dashboardCharts = [];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Expose globally ────────────────────────────────────────────────────────

window.openDashboard = openDashboard;
window.closeDashboard = closeDashboard;
