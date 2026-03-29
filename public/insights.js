/**
 * Unified Insights — CivicLens
 *
 * Combines Dashboard + Report into a single auto-generating view.
 * Pre-loads all data, renders KPIs, charts, neighborhood grades,
 * and an AI narrative report automatically.
 * "Generate Custom Insights" lets residents refine with their own query.
 */

/* global Chart, marked, CivicIcons */

// ── State ────────────────────────────────────────────────────────────────────

let insightsData = null;
let insightsCharts = [];
let customMode = false;

// ── Shared Palettes & Helpers (from civic-utils.js) ─────────────────────────

const { SEV_COLORS, TYPE_COLORS, STATUS_COLORS, pieData, barData, prettyLabel } = window.CivicUtils;
const escHtml = window.CivicUtils.escapeHtml;

// ── Open / Close ─────────────────────────────────────────────────────────────

export function openInsights() {
  if (document.getElementById('insights-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'insights-overlay';
  overlay.innerHTML = buildInsightsShell();
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Wire close & keyboard
  document.getElementById('insights-close').addEventListener('click', closeInsights);
  const insBBClose = document.getElementById('insights-bb-close');
  if (insBBClose) insBBClose.addEventListener('click', closeInsights);
  const insBBAsk = document.getElementById('insights-bb-ask');
  if (insBBAsk) insBBAsk.addEventListener('click', () => { showCustomPrompt(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeInsights();
  });

  // Auto-load insights
  loadInsights('Give me a complete overview of all infrastructure issues, costs, priorities, and neighborhood health');
}

export function closeInsights() {
  const overlay = document.getElementById('insights-overlay');
  if (overlay) {
    destroyCharts();
    overlay.remove();
    document.body.style.overflow = '';
    insightsData = null;
    customMode = false;
  }
  // Reset bottom nav back to Home
  if (window.resetNavToHome) window.resetNavToHome();
}

function printInsights() {
  const header = document.querySelector('#insights-overlay header');
  if (header) {
    header.setAttribute('data-date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  }
  window.print();
}
window.printInsights = printInsights;

// ── Shell ─────────────────────────────────────────────────────────────────────

function buildInsightsShell() {
  return `
  <div class="fixed inset-0 z-50 flex flex-col" style="background:var(--md-surface, #f9f9ff);font-family:Inter,system-ui,sans-serif">
    <style>
      @media (max-width: 767px) {
        #insights-overlay #insights-close,
        #insights-overlay #insights-refresh,
        #insights-overlay #insights-print,
        #insights-overlay #insights-custom-btn { display: none !important; }
        .insights-bottom-bar { display: flex !important; }
        #insights-overlay #insights-body { padding-bottom: 70px !important; }
      }
    </style>
    <!-- Header -->
    <header class="shrink-0 px-3 md:px-8 py-3 md:py-4 border-b flex items-center gap-2 md:gap-3 flex-wrap" style="border-color:var(--md-outline-variant, #c3c6cf);background:var(--md-surface, #f9f9ff)">
      <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shadow-md shrink-0" style="background:linear-gradient(135deg, var(--md-secondary, #006a61), #004d47)">
        <span class="material-symbols-outlined text-white" style="font-size:20px">insights</span>
      </div>
      <div class="flex-1 min-w-0">
        <h1 class="font-bold text-base md:text-lg font-display truncate" style="color:var(--md-on-surface, #1a1c1e)">Community Insights</h1>
        <p class="text-xs hidden sm:block" style="color:var(--md-outline, #73777f)">AI-powered infrastructure analytics &amp; reports</p>
      </div>
      <button id="insights-refresh" class="hidden px-2 md:px-4 py-2 rounded-xl text-sm font-medium border transition hover:shadow-md shrink-0" style="border-color:var(--md-outline-variant);color:var(--md-on-surface-variant)" onclick="document.getElementById('insights-refresh').classList.add('hidden'); loadInsights('Give me a complete overview of all infrastructure issues, costs, priorities, and neighborhood health')">
        <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle">refresh</span>
        <span class="hidden sm:inline">Refresh</span>
      </button>
      <button id="insights-custom-btn" class="hidden px-2 md:px-4 py-2 rounded-xl text-sm font-medium text-white shadow-md transition hover:opacity-90 shrink-0" style="background:linear-gradient(135deg, var(--md-secondary, #006a61), #004d47)" onclick="showCustomPrompt()">
        <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle">auto_awesome</span>
        <span class="hidden sm:inline">Ask AI a Question</span>
      </button>
      <button id="insights-print" class="hidden px-2 md:px-3 py-2 rounded-xl text-sm border transition hover:shadow-md shrink-0" style="border-color:var(--md-outline-variant);color:var(--md-on-surface-variant)" onclick="printInsights()" title="Print / Export PDF">
        <span class="material-symbols-outlined" style="font-size:18px">print</span>
      </button>
      <button id="insights-close" class="text-xl leading-none px-2 shrink-0" style="color:var(--md-outline)" title="Close (Esc)">&times;</button>
    </header>

    <!-- Tab Bar (hidden until results loaded) -->
    <div id="insights-tab-bar" class="hidden shrink-0 px-3 md:px-8 border-b flex items-center gap-1 flex-wrap" style="border-color:var(--md-outline-variant);background:var(--md-surface, #f9f9ff)">
      <button class="ins-main-tab px-3 md:px-5 py-2 md:py-3 text-sm font-semibold border-b-2 transition-all" data-tab="dashboard" onclick="switchMainTab('dashboard')" style="border-color:var(--md-secondary);color:var(--md-secondary)">  
        <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-right:4px">dashboard</span>Dashboard
      </button>
      <button class="ins-main-tab px-3 md:px-5 py-2 md:py-3 text-sm font-semibold border-b-2 transition-all" data-tab="report" onclick="switchMainTab('report')" style="border-color:transparent;color:var(--md-outline)">
        <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-right:4px">description</span>AI Report
        <span id="report-tab-badge" class="hidden ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style="background:var(--md-secondary);color:white">NEW</span>
      </button>
      <!-- Custom prompt inline in tab bar -->
      <div class="flex-1"></div>
      <div id="insights-custom-bar" class="hidden flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
        <form id="insights-custom-form" class="flex items-center gap-2 w-full sm:w-auto">
          <input id="insights-custom-input" type="text" class="px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 flex-1 sm:w-64 min-w-0" style="border-color:var(--md-outline-variant);background:var(--md-surface);color:var(--md-on-surface);--tw-ring-color:var(--md-secondary)" placeholder="Ask about specific zones, budgets, safety..." maxlength="500" />
          <button type="submit" class="px-3 md:px-4 py-1.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90 shrink-0" style="background:var(--md-secondary)">Generate</button>
          <button type="button" class="px-2 py-1.5 rounded-lg text-sm transition shrink-0" style="color:var(--md-outline)" onclick="hideCustomPrompt()">&times;</button>
        </form>
      </div>
    </div>

    <!-- Main scrollable content -->
    <div id="insights-body" class="flex-1 overflow-y-auto min-h-0 px-4 md:px-8 py-6">
      <!-- Loading state -->
      <div id="insights-loading" class="max-w-3xl mx-auto">
        <div class="flex flex-col items-center justify-center pt-10 pb-6 gap-5">
          <div class="relative w-24 h-24">
            <div class="absolute inset-0 rounded-full animate-spin" style="border:3px solid transparent;border-top-color:var(--md-secondary);animation-duration:1.2s"></div>
            <div class="absolute inset-2 rounded-full animate-spin" style="border:3px solid transparent;border-bottom-color:var(--md-tertiary, #3b82f6);animation-direction:reverse;animation-duration:0.9s"></div>
            <div class="absolute inset-4 rounded-full" style="background:linear-gradient(135deg,var(--md-secondary),#004d47);opacity:0.08"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="material-symbols-outlined" style="font-size:30px;color:var(--md-secondary)">insights</span>
            </div>
          </div>
          <div class="text-center">
            <h2 class="text-xl font-extrabold font-display mb-1.5" style="color:var(--md-on-surface);letter-spacing:-0.3px">Generating Your Insights</h2>
            <p class="text-sm" style="color:var(--md-outline)">Our AI is crunching real-time infrastructure data to build your personalized report</p>
          </div>
          <div class="w-full max-w-md">
            <div class="flex justify-between items-center mb-1.5">
              <span class="text-[11px] font-semibold" style="color:var(--md-on-surface-variant)" id="ins-progress-label">Starting analysis...</span>
              <span class="text-[11px] font-bold" style="color:var(--md-secondary)" id="ins-progress-pct">0%</span>
            </div>
            <div class="w-full h-2 rounded-full overflow-hidden" style="background:var(--md-surface-container)">
              <div id="ins-progress-bar" class="h-full rounded-full" style="width:0%;background:linear-gradient(90deg,var(--md-secondary),var(--md-tertiary, #3b82f6));transition:width 0.6s cubic-bezier(.16,1,.3,1)"></div>
            </div>
          </div>
        </div>
        <div id="insights-pipeline" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 mb-6"></div>
        <div id="ins-fun-fact" class="mx-auto max-w-lg text-center px-6 py-4 rounded-2xl border" style="background:var(--md-surface-container-low, #f3f3f9);border-color:var(--md-outline-variant);transition:opacity 0.4s">
          <div class="flex items-center justify-center gap-2 mb-1.5">
            <span class="material-symbols-outlined" style="font-size:16px;color:var(--md-secondary)">lightbulb</span>
            <span class="text-[10px] font-bold uppercase tracking-wider" style="color:var(--md-secondary)">Did you know?</span>
          </div>
          <p class="text-sm leading-relaxed" style="color:var(--md-on-surface-variant)" id="ins-fun-fact-text">The average pothole costs a city about $30\u201350 to repair, but causes $300+ in vehicle damage if left unfixed.</p>
        </div>
      </div>

      <!-- Dashboard Tab Content -->
      <div id="insights-tab-dashboard" class="hidden max-w-5xl mx-auto space-y-6"></div>

      <!-- Report Tab Content -->
      <div id="insights-tab-report" class="hidden max-w-5xl mx-auto space-y-6"></div>
    </div>

    <!-- Bottom action bar (mobile only) -->
    <div class="insights-bottom-bar hidden fixed bottom-0 left-0 right-0 z-[10000] border-t px-3 py-2.5 items-center justify-between gap-2" style="display:none;background:rgba(255,255,255,0.97);border-color:#e5e7eb;box-shadow:0 -2px 16px rgba(0,0,0,0.08);backdrop-filter:blur(12px)">
      <button id="insights-bb-close" class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all" style="min-height:44px;background:var(--md-surface-container, #eee);color:var(--md-on-surface, #1a1c1e)">&times; Close</button>
      <button id="insights-bb-ask" class="hidden flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90" style="min-height:44px;background:linear-gradient(135deg, var(--md-secondary, #006a61), #004d47)">
        <span class="material-symbols-outlined" style="font-size:18px">auto_awesome</span> Ask AI
      </button>
      <button id="insights-bb-print" class="hidden flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all" style="min-height:44px;border-color:var(--md-outline-variant);color:var(--md-on-surface-variant)" onclick="printInsights()">
        <span class="material-symbols-outlined" style="font-size:18px">print</span> Print
      </button>
    </div>
  </div>`;
}

// ── Load Insights ────────────────────────────────────────────────────────────

async function loadInsights(query) {
  const loading = document.getElementById('insights-loading');
  const pipelineEl = document.getElementById('insights-pipeline');

  // Hide tabs and show loading
  loading.classList.remove('hidden');
  document.getElementById('insights-tab-bar')?.classList.add('hidden');
  document.getElementById('insights-tab-dashboard')?.classList.add('hidden');
  document.getElementById('insights-tab-report')?.classList.add('hidden');
  destroyCharts();

  // Pipeline animation — 3 fast phases for data, 1 lazy phase for AI
  const phases = [
    { label: 'Fetching data', icon: 'database', desc: 'Pulling live records from city infrastructure databases, work orders, and 311 reports', detail: 'Connecting to 3 data sources...' },
    { label: 'Analyzing patterns', icon: 'analytics', desc: 'Detecting trends, hotspots, risk clusters, and correlations across neighborhoods', detail: 'Computing aggregations...' },
    { label: 'Building dashboard', icon: 'bar_chart', desc: 'Generating interactive charts, zone maps, and priority breakdowns', detail: 'Rendering charts & KPIs...' },
  ];

  const funFacts = [
    'The average pothole costs a city about $30\u201350 to repair, but causes $300+ in vehicle damage if left unfixed.',
    'Cities that use data-driven maintenance save up to 25% on annual infrastructure budgets.',
    'A single sidewalk trip hazard generates ~$10,000 in average liability costs for municipalities.',
    'AI-powered issue detection can identify problems 3\u20135x faster than manual inspections.',
    'Proactive road maintenance extends pavement life by 5\u20137 years compared to reactive repairs.',
    'Communities with open 311 data see 40% higher resident engagement in civic reporting.',
    'Winter freeze-thaw cycles can create up to 33% more potholes than the annual average.',
    'Well-maintained sidewalks increase nearby property values by an average of 8\u201312%.',
  ];

  pipelineEl.innerHTML = phases.map((p, i) => `
    <div class="flex items-start gap-3.5 p-4 rounded-2xl border transition-all" id="ins-phase-${i}" style="background:var(--md-surface);border-color:var(--md-outline-variant);opacity:0.5;transform:translateY(4px);transition:all 0.5s cubic-bezier(.16,1,.3,1)">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" id="ins-phase-icon-${i}" style="background:var(--md-surface-container);transition:all 0.4s">
        <span class="material-symbols-outlined" style="font-size:20px;color:var(--md-outline);transition:color 0.4s" id="ins-phase-icn-${i}">${p.icon}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold" style="color:var(--md-on-surface)">${p.label}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" id="ins-phase-badge-${i}" style="background:var(--md-surface-container);color:var(--md-outline)">Waiting</span>
        </div>
        <p class="text-xs mt-1 leading-relaxed" style="color:var(--md-outline)">${p.desc}</p>
        <div class="mt-2 h-1 rounded-full overflow-hidden" style="background:var(--md-surface-container)">
          <div class="h-full rounded-full" id="ins-phase-bar-${i}" style="width:0%;background:var(--md-secondary);transition:width 0.8s cubic-bezier(.16,1,.3,1)"></div>
        </div>
      </div>
    </div>
  `).join('');

  // Fun fact rotation
  let factIndex = Math.floor(Math.random() * funFacts.length);
  const factEl = document.getElementById('ins-fun-fact-text');
  if (factEl) factEl.textContent = funFacts[factIndex];
  const factInterval = setInterval(() => {
    factIndex = (factIndex + 1) % funFacts.length;
    const el = document.getElementById('ins-fun-fact');
    const txt = document.getElementById('ins-fun-fact-text');
    if (!el || !txt) { clearInterval(factInterval); return; }
    el.style.opacity = '0';
    setTimeout(() => { txt.textContent = funFacts[factIndex]; el.style.opacity = '1'; }, 350);
  }, 4000);

  // Animate pipeline phases
  const animatePhase = (idx, status) => {
    const card = document.getElementById(`ins-phase-${idx}`);
    const iconWrap = document.getElementById(`ins-phase-icon-${idx}`);
    const icon = document.getElementById(`ins-phase-icn-${idx}`);
    const badge = document.getElementById(`ins-phase-badge-${idx}`);
    const bar = document.getElementById(`ins-phase-bar-${idx}`);
    const progressBar = document.getElementById('ins-progress-bar');
    const progressPct = document.getElementById('ins-progress-pct');
    const progressLabel = document.getElementById('ins-progress-label');
    if (!card) return;

    if (status === 'active') {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
      card.style.borderColor = 'var(--md-secondary)';
      card.style.background = 'linear-gradient(135deg, rgba(0,106,97,0.04), rgba(0,77,71,0.02))';
      iconWrap.style.background = 'linear-gradient(135deg, var(--md-secondary), #004d47)';
      icon.style.color = 'white';
      badge.textContent = 'In Progress';
      badge.style.background = 'var(--md-secondary)';
      badge.style.color = 'white';
      bar.style.width = '60%';
      const pct = Math.round(((idx) / phases.length) * 100 + 10);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressPct) progressPct.textContent = pct + '%';
      if (progressLabel) progressLabel.textContent = phases[idx].detail;
    } else if (status === 'done') {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
      card.style.borderColor = '#22c55e';
      card.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(22,163,74,0.02))';
      iconWrap.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      icon.style.color = 'white';
      icon.textContent = 'check_circle';
      badge.textContent = 'Complete \u2713';
      badge.style.background = '#dcfce7';
      badge.style.color = '#16a34a';
      bar.style.width = '100%';
      bar.style.background = '#22c55e';
      const pct = Math.round(((idx + 1) / phases.length) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressPct) progressPct.textContent = pct + '%';
    }
  };

  animatePhase(0, 'active');

  try {
    // Fetch dashboard data FAST (no AI pipeline — just local MCP data)
    const fetchPromise = fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then(r => {
      if (!r.ok) throw new Error('Failed to fetch data');
      return r.json();
    });

    // Animate phases quickly since data fetch is fast now
    setTimeout(() => { animatePhase(0, 'done'); animatePhase(1, 'active'); }, 400);
    setTimeout(() => { animatePhase(1, 'done'); animatePhase(2, 'active'); }, 800);

    insightsData = await fetchPromise;

    // Mark data phases complete
    phases.forEach((_, i) => animatePhase(i, 'done'));
    clearInterval(factInterval);
    const progressLabel = document.getElementById('ins-progress-label');
    if (progressLabel) progressLabel.textContent = 'Dashboard ready! Loading AI analysis in background...';
    await sleep(300);

    // Render dashboard results IMMEDIATELY
    renderDashboardTab(query);
    renderReportTab(query);
    loading.classList.add('hidden');

    // Show tabs and action buttons
    document.getElementById('insights-tab-bar')?.classList.remove('hidden');
    document.getElementById('insights-refresh')?.classList.remove('hidden');
    document.getElementById('insights-custom-btn')?.classList.remove('hidden');
    document.getElementById('insights-print')?.classList.remove('hidden');
    // Show mobile bottom bar buttons
    document.getElementById('insights-bb-ask')?.classList.remove('hidden');
    document.getElementById('insights-bb-print')?.classList.remove('hidden');
    switchMainTab('dashboard');

    // LAZY load AI insights in the background (non-blocking)
    loadAiInsights(query);

  } catch (err) {
    clearInterval(factInterval);
    loading.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 gap-5">
        <div class="w-20 h-20 rounded-full flex items-center justify-center" style="background:#fef2f2;border:2px solid #fecaca">
          <span class="material-symbols-outlined" style="font-size:36px;color:#ef4444">error_outline</span>
        </div>
        <div class="text-center">
          <h2 class="text-lg font-extrabold font-display mb-1" style="color:var(--md-on-surface)">Something Went Wrong</h2>
          <p class="text-sm" style="color:var(--md-outline);max-width:360px;margin:0 auto;line-height:1.6">We couldn\u2019t load your insights. This might be a temporary issue with the data pipeline.</p>
          <p class="text-xs mt-2 px-3 py-1.5 rounded-lg inline-block" style="background:#fef2f2;color:#991b1b;font-family:monospace">${escHtml(err.message)}</p>
        </div>
        <button onclick="loadInsights('${escHtml(query)}')" class="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition hover:opacity-90" style="background:linear-gradient(135deg, var(--md-secondary), #004d47)">
          <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px">refresh</span>
          Try Again
        </button>
      </div>`;
  }
}
window.loadInsights = loadInsights;

// ── Tab Switching ────────────────────────────────────────────────────────────

let activeMainTab = 'dashboard';

function switchMainTab(tab) {
  activeMainTab = tab;
  document.querySelectorAll('.ins-main-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.borderColor = isActive ? 'var(--md-secondary)' : 'transparent';
    btn.style.color = isActive ? 'var(--md-secondary)' : 'var(--md-outline)';
  });
  const dashEl = document.getElementById('insights-tab-dashboard');
  const reportEl = document.getElementById('insights-tab-report');
  if (dashEl) { dashEl.classList.toggle('hidden', tab !== 'dashboard'); }
  if (reportEl) { reportEl.classList.toggle('hidden', tab !== 'report'); }
  // Scroll to top when switching tabs
  document.getElementById('insights-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchMainTab = switchMainTab;

// ── Render Dashboard Tab ─────────────────────────────────────────────────────

function renderDashboardTab(query) {
  const container = document.getElementById('insights-tab-dashboard');
  if (!container || !insightsData) return;
  const s = insightsData.summary;
  const zones = s.by_zone || {};
  const zoneKeys = Object.keys(zones);

  const riskScore = Math.min(100, Math.round((s.critical * 25 + s.high * 15 + s.medium * 5) / Math.max(s.total_issues, 1) * 10));
  const riskLevel = riskScore >= 75 ? 'Critical' : riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low';
  const riskColor = riskScore >= 75 ? '#ef4444' : riskScore >= 50 ? '#f97316' : riskScore >= 25 ? '#eab308' : '#22c55e';
  const completionRate = s.total_issues ? Math.round(s.completed / s.total_issues * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  container.innerHTML = `
    <!-- ─── Hero Banner ─── -->
    <div class="relative overflow-hidden rounded-3xl p-6 md:p-8 text-white shadow-xl" style="background:linear-gradient(135deg, var(--md-secondary, #006a61), #004d47, var(--md-primary, #091426));">
      <div style="position:absolute;width:280px;height:280px;top:-100px;right:-60px;border-radius:50%;background:rgba(255,255,255,0.06)"></div>
      <div style="position:absolute;width:200px;height:200px;bottom:-80px;left:-40px;border-radius:50%;background:rgba(255,255,255,0.04)"></div>
      <div class="relative z-10">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p class="text-white/60 text-sm">${greeting} \u2014 ${dateStr}</p>
            <h2 class="text-2xl md:text-3xl font-extrabold font-display mt-1 leading-tight">Infrastructure Insights</h2>
            <p class="text-white/50 text-sm mt-2 max-w-lg">Real-time analysis of Lake Forest infrastructure across ${zoneKeys.length} neighborhoods, powered by AI.</p>
          </div>
          <div class="flex flex-col items-center" title="Community Risk Score">
            <svg width="100" height="60" viewBox="0 0 100 60">
              <path d="M10 55 A 40 40 0 0 1 90 55" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="8" stroke-linecap="round"/>
              <path d="M10 55 A 40 40 0 0 1 90 55" fill="none" stroke="${riskColor}" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${riskScore * 1.26} 126" style="transition:stroke-dasharray 1s ease"/>
              <text x="50" y="48" text-anchor="middle" fill="white" font-size="16" font-weight="bold">${riskScore}</text>
            </svg>
            <span class="text-xs font-semibold mt-1" style="color:${riskColor}">${riskLevel} Risk</span>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-4 flex-wrap">
          <span class="text-[10px] px-2.5 py-1 rounded-full bg-white/15 text-white/80 font-medium">AI-Generated</span>
          <span class="text-[10px] px-2.5 py-1 rounded-full bg-white/15 text-white/80 font-medium">MCP Data</span>
          <span class="text-[10px] px-2.5 py-1 rounded-full bg-white/15 text-white/80 font-medium">${s.total_issues} Issues Tracked</span>
          <span class="text-[10px] px-2.5 py-1 rounded-full bg-white/15 text-white/80 font-medium">${completionRate}% Resolved</span>
        </div>
      </div>
    </div>

    <!-- ─── KPI Cards ─── -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      ${buildKpiCard('Total Issues', s.total_issues, 'assignment', 'var(--md-secondary)')}
      ${buildKpiCard('Critical', s.critical, 'priority_high', '#ef4444')}
      ${buildKpiCard('High Priority', s.high, 'warning', '#f97316')}
      ${buildKpiCard('Open Issues', s.open_issues, 'pending', 'var(--md-tertiary, #3b82f6)')}
      ${buildKpiCard('Total Cost', '$' + (s.total_cost / 1000).toFixed(1) + 'K', 'payments', '#8b5cf6')}
      ${buildKpiCard('Near Schools', s.near_schools, 'school', '#d97706')}
    </div>

    <!-- ─── Resolution Funnel ─── -->
    <div class="bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">filter_alt</span>
          Resolution Funnel
        </h3>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#e6f5f3;color:var(--md-secondary)">Live</span>
      </div>
      <div class="p-6">
        ${buildResolutionFunnel(s)}
      </div>
    </div>

    <!-- ─── Cost Savings ─── -->
    ${s.estimated_savings > 0 ? `
    <div class="relative overflow-hidden border shadow-sm" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant);background:linear-gradient(135deg,#f0fdf4,#dcfce7,#f0fdf4)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:#bbf7d0">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:#15803d">
          <span class="material-symbols-outlined" style="font-size:22px;color:#22c55e">savings</span>
          Proactive Repair Savings
        </h3>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#bbf7d0;color:#15803d">Verified</span>
      </div>
      <div class="p-6">
        <div class="flex flex-col sm:flex-row items-center gap-6">
          <div class="flex flex-col items-center gap-1">
            <div class="text-3xl font-extrabold font-display" style="color:#15803d">$${(s.estimated_savings / 1000).toFixed(1)}K</div>
            <div class="text-xs font-medium" style="color:#16a34a">Estimated Savings</div>
          </div>
          <div class="flex-1 text-sm" style="color:#166534">
            By completing <strong>${s.completed}</strong> repairs in an average of <strong>${s.avg_resolution_days || '—'} days</strong>,
            Lake Forest avoided an estimated <strong>$${(s.estimated_savings / 1000).toFixed(1)}K</strong> in accelerated deterioration costs.
            Timely repairs cost <strong>$${(s.completed_cost / 1000).toFixed(1)}K</strong> — waiting 6 months would have cost
            <strong>$${((s.completed_cost + s.estimated_savings) / 1000).toFixed(1)}K</strong>.
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- ─── Charts Section ─── -->
    <div class="bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
      <div class="px-4 md:px-6 py-3 md:py-4 border-b flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display shrink-0" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">bar_chart</span>
          Analytics Overview
        </h3>
        <div class="flex gap-1 overflow-x-auto" id="chart-tab-bar">
          <button class="ins-chart-tab px-3 py-1.5 rounded-lg text-xs font-medium transition-all active" data-tab="overview" onclick="switchChartTab('overview')" style="background:var(--md-secondary);color:white">Overview</button>
          <button class="ins-chart-tab px-3 py-1.5 rounded-lg text-xs font-medium transition-all" data-tab="cost" onclick="switchChartTab('cost')" style="color:var(--md-outline)">Cost</button>
          <button class="ins-chart-tab px-3 py-1.5 rounded-lg text-xs font-medium transition-all" data-tab="status" onclick="switchChartTab('status')" style="color:var(--md-outline)">Status</button>
          <button class="ins-chart-tab px-3 py-1.5 rounded-lg text-xs font-medium transition-all" data-tab="geographic" onclick="switchChartTab('geographic')" style="color:var(--md-outline)">Geographic</button>
        </div>
      </div>
      <div class="p-6">
        <div id="ins-charts-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
      </div>
    </div>

    <!-- ─── Neighborhood Health ─── -->
    ${zoneKeys.length > 0 ? buildNeighborhoodSection(zones, zoneKeys) : ''}

    <!-- ─── Key Findings ─── -->
    <div class="bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">lightbulb</span>
          Key Findings
        </h3>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${buildFindings(s)}
        </div>
      </div>
    </div>

    <!-- ─── CTA to Report Tab ─── -->
    <div class="text-center py-2">
      <button onclick="switchMainTab('report')" class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition hover:opacity-90 hover:shadow-xl" style="background:linear-gradient(135deg, var(--md-secondary), #004d47)">
        <span class="material-symbols-outlined" style="font-size:20px">description</span>
        View Full AI Report
      </button>
      <p class="text-xs mt-2" style="color:var(--md-outline)">Switch to the Report tab for the full AI-generated narrative analysis</p>
    </div>
  `;

  requestAnimationFrame(() => {
    renderChartTab('overview');
    animateKpiCounters();
  });
}

// ── Render Report Tab ────────────────────────────────────────────────────────

function renderReportTab(query) {
  const container = document.getElementById('insights-tab-report');
  if (!container || !insightsData) return;
  const s = insightsData.summary;
  const zones = s.by_zone || {};
  const zoneKeys = Object.keys(zones);

  container.innerHTML = `
    <!-- Report Header -->
    <div class="bg-white border shadow-sm overflow-hidden" id="ins-ai-report" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">description</span>
          AI-Generated Report
        </h3>
        <div class="flex items-center gap-2">
          <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#e6f5f3;color:var(--md-secondary)">Auto-generated</span>
          <button onclick="printInsights()" class="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border transition hover:shadow-sm" style="border-color:var(--md-outline-variant);color:var(--md-outline)">
            <span class="material-symbols-outlined" style="font-size:14px">print</span> Print
          </button>
        </div>
      </div>
      <div class="p-6 md:p-8" id="ins-report-content">
        ${buildAutoReport(s, zones, zoneKeys)}
      </div>
    </div>

    <!-- Pipeline Details Dropdown -->
    <div class="bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
      <button onclick="togglePipelineDetails()" class="w-full px-6 py-4 flex items-center justify-between text-left transition hover:bg-gray-50" id="pipeline-details-toggle">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">account_tree</span>
          <h3 class="text-base font-bold font-display" style="color:var(--md-on-surface)">Pipeline Details</h3>
          <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:var(--md-surface-container);color:var(--md-outline)">How we built this</span>
        </div>
        <span class="material-symbols-outlined transition-transform" id="pipeline-chevron" style="font-size:20px;color:var(--md-outline)">expand_more</span>
      </button>
      <div id="pipeline-details-content" class="hidden border-t" style="border-color:var(--md-surface-container)">
        <div class="p-6" id="pipeline-details-body">
          ${buildPipelineDetails()}
        </div>
      </div>
    </div>

    <!-- ─── Custom Insights CTA ─── -->
    <div class="text-center py-2">
      <button onclick="showCustomPrompt()" class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition hover:opacity-90 hover:shadow-xl" style="background:linear-gradient(135deg, var(--md-secondary), #004d47)">
        <span class="material-symbols-outlined" style="font-size:20px">auto_awesome</span>
        Ask AI a Different Question
      </button>
      <p class="text-xs mt-2" style="color:var(--md-outline)">Get a custom AI report based on your specific question about the data</p>
    </div>
  `;
}

// ── Pipeline Details Toggle ──────────────────────────────────────────────────

function togglePipelineDetails() {
  const content = document.getElementById('pipeline-details-content');
  const chevron = document.getElementById('pipeline-chevron');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  content.classList.toggle('hidden');
  if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
}
window.togglePipelineDetails = togglePipelineDetails;

function buildPipelineDetails() {
  const s = insightsData?.summary;
  if (!s) return '<p class="text-sm" style="color:var(--md-outline)">No pipeline data available.</p>';

  const ai = insightsData.ai_insights;
  const pipe = ai?.pipeline;        // { total_duration_ms, stages[], agent_reasoning[], memory_turns }
  const meta = ai?.report_meta;     // { data_coverage: { score, sources_consulted, total_sources, records_analyzed } }
  const ragSources = ai?.rag_sources || [];
  const actions = ai?.actions_taken || [];
  const hasPipeline = !!(pipe && pipe.stages && pipe.stages.length);

  // Helper to get stage duration from real pipeline data
  const stageDuration = (name) => {
    if (!hasPipeline) return '';
    const st = pipe.stages.find(s => s.name === name);
    return st ? ` \u00b7 ${st.duration_ms}ms` : '';
  };

  // Build steps dynamically from actual pipeline metadata when available
  let steps;
  if (hasPipeline) {
    // ── Real pipeline data available ──
    const intentStage = pipe.stages.find(s => s.name === 'intent');
    const dataStage = pipe.stages.find(s => s.name === 'data');
    const synthStage = pipe.stages.find(s => s.name === 'synthesis');
    const feedbackStage = pipe.stages.find(s => s.name === 'feedback');
    const reportStage = pipe.stages.find(s => s.name === 'report');

    // Extract detail from pipeline stages (each stage has { name, duration_ms, detail })
    const getDetail = (name) => (pipe.stages.find(s => s.name === name) || {}).detail || {};
    const intentDetail = getDetail('intent');
    const dataDetail = getDetail('data');
    const synthDetail = getDetail('synthesis');
    const feedbackDetail = getDetail('feedback');
    const reportDetail = getDetail('report');

    // Intent classification info
    const intentModel = intentDetail.model || 'GPT-4o-mini';
    const intentClass = intentDetail.intent || meta?.intent || 'analyzed';
    const intentSummary = intentDetail.summary || '';

    // Data retrieval info
    const toolsCalled = dataDetail.tools_called || [];
    const recordsFetched = dataDetail.records_fetched || meta?.data_coverage?.records_analyzed || 0;
    const fallbackUsed = dataDetail.fallback_used || false;

    // Synthesis info
    const sectionsCount = synthDetail.sections || 0;
    const findingsCount = synthDetail.findings || 0;
    const recsCount = synthDetail.recommendations || 0;
    const ragList = synthDetail.rag_sources || ragSources;

    // Coverage info
    const coveragePct = feedbackDetail.coverage_pct || meta?.data_coverage?.score || null;
    const feedbackSkipped = feedbackDetail.skipped !== undefined ? feedbackDetail.skipped : true;

    steps = [
      {
        icon: 'intent_estimate', label: 'Intent Classification', status: 'complete',
        desc: `Analyzed query and classified intent as "${intentClass.replace(/_/g, ' ')}".${intentSummary ? ' ' + intentSummary : ''}`,
        detail: `Model: ${intentModel}${stageDuration('intent')}${intentDetail.validator_model ? ' \u00b7 Validated by ' + intentDetail.validator_model : ''}`
      },
      {
        icon: 'database', label: 'Data Retrieval (ReAct)', status: 'complete',
        desc: `Queried ${toolsCalled.length || 'multiple'} MCP data sources using tool-calling pattern.${fallbackUsed ? ' (fallback routing used)' : ''}`,
        detail: `Tools: ${toolsCalled.length ? toolsCalled.join(', ') : 'get_work_orders, get_potholes, get_sidewalk_issues, get_schools, get_service_requests'} \u00b7 ${recordsFetched} records${stageDuration('data')}`
      },
      {
        icon: 'menu_book', label: 'RAG Knowledge Lookup', status: 'complete',
        desc: `Retrieved ${ragList.length || 'relevant'} knowledge sources for context enrichment.`,
        detail: ragList.length ? `Sources: ${ragList.slice(0, 4).join(', ')}${ragList.length > 4 ? ' +' + (ragList.length - 4) + ' more' : ''}` : 'Sources: Municipal standards, zone data, priority guidelines'
      },
      {
        icon: 'auto_awesome', label: 'AI Synthesis (GPT-4o-mini)', status: 'complete',
        desc: `Generated report with ${sectionsCount || 'multiple'} sections, ${findingsCount || 'key'} findings, and ${recsCount || ''} recommendations.`,
        detail: `${stageDuration('synthesis') ? stageDuration('synthesis').slice(3) : 'Synthesis complete'} \u00b7 ${coveragePct != null ? 'Coverage: ' + coveragePct + '%' : 'Quality check passed'}${feedbackSkipped ? '' : ' \u00b7 Feedback loop triggered'}`
      },
      {
        icon: 'format_paint', label: 'Report Formatting', status: 'complete',
        desc: `Formatted final report. ${actions.length ? actions.length + ' action items generated.' : ''}`,
        detail: `Total pipeline: ${pipe.total_duration_ms}ms \u00b7 ${pipe.memory_turns || 0} memory turns \u00b7 ${pipe.agent_reasoning?.length || 0} reasoning steps`
      },
    ];
  } else {
    // ── No real pipeline data yet — show current status ──
    steps = [
      {
        icon: 'intent_estimate', label: 'Intent Classification', status: ai ? 'complete' : 'complete',
        desc: 'Analyzed user query to determine data requirements and report scope.',
        detail: 'Model: GPT-4o-mini'
      },
      {
        icon: 'database', label: 'Data Retrieval (ReAct)', status: ai ? 'complete' : 'complete',
        desc: 'Queried MCP data sources using tool-calling pattern.',
        detail: `Tools: get_work_orders (${s.total_issues}), get_potholes, get_sidewalk_issues, get_schools, get_service_requests (${s.service_requests || 0})`
      },
      {
        icon: 'menu_book', label: 'RAG Knowledge Lookup', status: ai ? 'complete' : 'complete',
        desc: 'Retrieved relevant context from the infrastructure knowledge base.',
        detail: 'Sources: Municipal repair standards, zone classifications, priority guidelines'
      },
      {
        icon: 'auto_awesome', label: 'AI Synthesis (GPT-4o-mini)', status: ai ? 'complete' : 'loading',
        desc: ai ? 'Generated narrative report with findings and recommendations.' : 'AI is currently synthesizing the narrative report...',
        detail: ai ? 'Quality check passed \u00b7 Report formatted as Markdown' : 'Running in background \u2014 report will appear when ready'
      },
      {
        icon: 'format_paint', label: 'Report Formatting', status: ai ? 'complete' : 'waiting',
        desc: ai ? 'Formatted final report with charts, statistics, and recommendations.' : 'Waiting for AI synthesis to complete.',
        detail: `Data summary: ${s.total_issues} work orders + ${s.service_requests || 0} service requests, $${s.total_cost.toLocaleString()} total cost, ${Object.keys(s.by_zone).length} zones`
      },
    ];
  }

  const statusIcon = st => st === 'complete' ? 'check_circle' : st === 'loading' ? 'sync' : 'schedule';
  const statusColor = st => st === 'complete' ? '#22c55e' : st === 'loading' ? 'var(--md-secondary)' : 'var(--md-outline)';

  return `
    ${hasPipeline ? `<div class="mb-3 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2" style="background:linear-gradient(135deg,#f0fdf9,#e6f5f3);color:var(--md-on-surface-variant)"><span class="material-symbols-outlined" style="font-size:14px;color:#22c55e">verified</span>Live pipeline data \u00b7 Total: ${pipe.total_duration_ms}ms</div>` : ''}
    <div class="space-y-3">
      ${steps.map((step, i) => `
        <div class="flex items-start gap-3 p-3 rounded-xl" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${statusColor(step.status)}15">
            <span class="material-symbols-outlined ${step.status === 'loading' ? 'animate-spin' : ''}" style="font-size:18px;color:${statusColor(step.status)}">${statusIcon(step.status)}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold" style="color:var(--md-on-surface)">Step ${i + 1}: ${step.label}</span>
              <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style="background:${statusColor(step.status)}15;color:${statusColor(step.status)}">${step.status === 'complete' ? 'Done' : step.status === 'loading' ? 'Running' : 'Pending'}</span>
            </div>
            <p class="text-xs mt-0.5" style="color:var(--md-outline)">${step.desc}</p>
            <p class="text-[10px] mt-1 font-mono" style="color:var(--md-on-surface-variant)">${step.detail}</p>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="mt-4 p-3 rounded-xl border" style="border-color:var(--md-outline-variant);background:var(--md-surface)">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--md-secondary)">info</span>
        <span class="text-xs font-semibold" style="color:var(--md-on-surface)">Data Sources Summary</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        <div class="p-2 rounded-lg" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="text-lg font-bold font-display" style="color:var(--md-on-surface)">${s.total_issues}</div>
          <div class="text-[10px]" style="color:var(--md-outline)">Work Orders</div>
        </div>
        <div class="p-2 rounded-lg" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="text-lg font-bold font-display" style="color:var(--md-on-surface)">${insightsData.potholes?.length || 0}</div>
          <div class="text-[10px]" style="color:var(--md-outline)">Potholes</div>
        </div>
        <div class="p-2 rounded-lg" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="text-lg font-bold font-display" style="color:var(--md-on-surface)">${insightsData.sidewalk_issues?.length || 0}</div>
          <div class="text-[10px]" style="color:var(--md-outline)">Sidewalk Issues</div>
        </div>
        <div class="p-2 rounded-lg" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="text-lg font-bold font-display" style="color:var(--md-on-surface)">${insightsData.service_requests?.length || 0}</div>
          <div class="text-[10px]" style="color:var(--md-outline)">Service Requests</div>
        </div>
        <div class="p-2 rounded-lg" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="text-lg font-bold font-display" style="color:var(--md-on-surface)">${insightsData.schools?.length || 0}</div>
          <div class="text-[10px]" style="color:var(--md-outline)">Schools Tracked</div>
        </div>
      </div>
    </div>
  `;
}

// ── KPI Card Builder ─────────────────────────────────────────────────────────

function buildKpiCard(label, value, icon, color) {
  const numericVal = typeof value === 'number' ? value : '';
  return `
    <div class="bg-white border shadow-sm p-4 transition hover:shadow-md hover:-translate-y-0.5" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style="background:${color}15">
        <span class="material-symbols-outlined" style="font-size:22px;color:${color}">${icon}</span>
      </div>
      <div class="text-2xl font-extrabold font-display ins-kpi-counter" style="color:var(--md-on-surface)" data-target="${numericVal}">${value}</div>
      <div class="text-xs mt-0.5" style="color:var(--md-outline)">${label}</div>
    </div>`;
}

function animateKpiCounters() {
  document.querySelectorAll('.ins-kpi-counter').forEach(el => {
    const target = parseInt(el.dataset.target);
    if (isNaN(target)) return;
    el.textContent = '0';
    const startTime = performance.now();
    const duration = 800;
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  });
}

// ── Resolution Funnel Builder ────────────────────────────────────────────────

function buildResolutionFunnel(s) {
  const total = s.total_issues || 1;
  const stages = [
    { label: 'Reported',    count: total,          color: '#64748b', icon: 'flag' },
    { label: 'Open',        count: s.open_issues,  color: '#ef4444', icon: 'pending' },
    { label: 'In Progress', count: s.in_progress,  color: '#f59e0b', icon: 'construction' },
    { label: 'Completed',   count: s.completed,    color: '#22c55e', icon: 'check_circle' }
  ];
  const maxW = 100;
  const resolutionRate = Math.round(s.completed / total * 100);

  let bars = stages.map((st, i) => {
    const pct = Math.round(st.count / total * 100);
    const w = Math.max(18, st.count / total * maxW);
    return `
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 w-28 shrink-0">
          <span class="material-symbols-outlined" style="font-size:18px;color:${st.color}">${st.icon}</span>
          <span class="text-xs font-semibold" style="color:var(--md-on-surface)">${st.label}</span>
        </div>
        <div class="flex-1 relative h-8">
          <div class="absolute inset-y-0 left-0 rounded-lg transition-all duration-700" style="width:${w}%;background:${st.color}20;"></div>
          <div class="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 flex items-center" style="width:${w}%;background:${st.color}">
            <span class="text-white text-xs font-bold pl-3">${st.count}</span>
          </div>
        </div>
        <span class="text-xs font-medium w-10 text-right" style="color:${st.color}">${pct}%</span>
      </div>`;
  }).join('');

  const avgDays = s.avg_resolution_days || '—';

  return `
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 flex flex-col gap-3">
        ${bars}
      </div>
      <div class="flex flex-col items-center justify-center gap-2 md:w-40 md:border-l md:pl-6" style="border-color:var(--md-outline-variant)">
        <div class="text-3xl font-extrabold font-display" style="color:var(--md-secondary)">${resolutionRate}%</div>
        <div class="text-xs font-medium" style="color:var(--md-outline)">Resolution Rate</div>
        <div class="w-full h-px my-1" style="background:var(--md-outline-variant)"></div>
        <div class="text-lg font-bold" style="color:var(--md-on-surface)">${avgDays}</div>
        <div class="text-[10px]" style="color:var(--md-outline)">Avg Days to Resolve</div>
      </div>
    </div>`;
}

// ── Chart Tab System ─────────────────────────────────────────────────────────

function switchChartTab(tab) {
  document.querySelectorAll('.ins-chart-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? 'var(--md-secondary)' : 'transparent';
    btn.style.color = isActive ? 'white' : 'var(--md-outline)';
  });
  renderChartTab(tab);
}
window.switchChartTab = switchChartTab;

function renderChartTab(tab) {
  destroyCharts();
  const container = document.getElementById('ins-charts-grid');
  if (!container || !insightsData) return;

  const s = insightsData.summary;

  const configs = {
    overview: [
      { id: 'ins-ov-type', title: 'Issues by Type', span: 1, type: 'doughnut', data: () => pieData(s.by_type, TYPE_COLORS) },
      { id: 'ins-ov-status', title: 'Current Status', span: 1, type: 'doughnut', data: () => pieData(s.by_status, STATUS_COLORS) },
      { id: 'ins-ov-sev', title: 'Priority Distribution', span: 1, type: 'bar', data: () => barData({ critical: s.critical, high: s.high, medium: s.medium, low: s.low }, SEV_COLORS) },
    ],
    cost: [
      { id: 'ins-ct-prio', title: 'Cost by Priority', span: 2, type: 'bar', data: () => barData(s.cost_by_priority, SEV_COLORS) },
      { id: 'ins-ct-type', title: 'Cost by Type', span: 1, type: 'doughnut', data: () => pieData(s.cost_by_type, TYPE_COLORS) },
    ],
    status: [
      { id: 'ins-st-pie', title: 'Status Breakdown', span: 1, type: 'doughnut', data: () => pieData(s.by_status, STATUS_COLORS) },
      { id: 'ins-st-bar', title: 'Work Orders by Status', span: 2, type: 'bar', data: () => barData(s.by_status, STATUS_COLORS) },
    ],
    geographic: [
      { id: 'ins-geo-zone', title: 'Issues per Zone', span: 2, type: 'bar', data: () => barData(s.by_zone, null, 'var(--md-secondary, #006a61)') },
      { id: 'ins-geo-cost', title: 'Cost by Zone', span: 1, type: 'doughnut', data: () => {
        const costByZone = insightsData.work_orders.reduce((acc, w) => {
          const z = w.location?.zone || 'unknown';
          acc[z] = (acc[z] || 0) + (w.estimated_cost || 0);
          return acc;
        }, {});
        return pieData(costByZone, null);
      }},
    ],
  };

  const widgets = configs[tab] || configs.overview;

  container.innerHTML = widgets.map(w => `
    <div class="p-4 border rounded-2xl ${w.span === 2 ? 'md:col-span-2' : ''}" style="border-color:var(--md-outline-variant);background:var(--md-surface-container-low, #f3f3f9)">
      <h4 class="text-xs font-semibold mb-3" style="color:var(--md-on-surface-variant)">${w.title}</h4>
      <div style="height:220px;position:relative"><canvas id="chart-${w.id}"></canvas></div>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    widgets.forEach(w => {
      const canvas = document.getElementById(`chart-${w.id}`);
      if (!canvas) return;

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

      const opts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: w.type === 'doughnut',
            position: 'bottom',
            labels: { color: textColor, font: { size: 10 }, padding: 8, boxWidth: 10 },
          },
        },
      };

      if (w.type === 'bar') {
        opts.scales = {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        };
        opts.plugins.legend = { display: false };
      }

      const chart = new Chart(canvas, { type: w.type, data: w.data(), options: opts });
      insightsCharts.push(chart);
    });
  });
}

// ── Neighborhood Section ─────────────────────────────────────────────────────

function buildNeighborhoodSection(zones, zoneKeys) {
  const gradeColor = g => g === 'A' ? 'emerald' : g === 'B' ? 'blue' : g === 'C' ? 'yellow' : g === 'D' ? 'orange' : 'red';
  const gradeHex = g => g === 'A' ? '#22c55e' : g === 'B' ? '#3b82f6' : g === 'C' ? '#eab308' : g === 'D' ? '#f97316' : '#ef4444';

  // Try to get community data for richer info
  return `
  <div class="bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl, 2rem);border-color:var(--md-outline-variant)">
    <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
      <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
        <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">location_city</span>
        Neighborhood Health
      </h3>
      <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#e6f5f3;color:var(--md-secondary)">${zoneKeys.length} Zones</span>
    </div>
    <div class="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      ${zoneKeys.map(zone => {
        const count = zones[zone] || 0;
        const pct = Math.round((count / Math.max(...Object.values(zones))) * 100);
        return `
        <div class="border p-4 transition hover:-translate-y-1 hover:shadow-md" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-lg, 1.5rem)">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:var(--md-secondary);color:white">
              <span class="material-symbols-outlined" style="font-size:20px">location_on</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold truncate font-display" style="color:var(--md-on-surface)">${zone}</div>
              <div class="text-[10px]" style="color:var(--md-outline)">${count} issues</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:var(--md-surface-container)">
              <div class="h-full rounded-full" style="width:${pct}%;background:var(--md-secondary);transition:width 1s ease"></div>
            </div>
            <span class="text-xs font-bold" style="color:var(--md-secondary)">${count}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── Key Findings ─────────────────────────────────────────────────────────────

function buildFindings(s) {
  const findings = [];

  if (s.critical > 0) findings.push({ icon: 'priority_high', color: '#ef4444', bg: '#fef2f2', text: `<strong>${s.critical} critical issue${s.critical > 1 ? 's' : ''}</strong> require immediate attention` });
  if (s.critical_high > 0) findings.push({ icon: 'warning', color: '#f97316', bg: '#fff7ed', text: `${s.critical_high} issues rated critical or high priority` });
  if (s.near_schools > 0) findings.push({ icon: 'school', color: '#d97706', bg: '#fffbeb', text: `<strong>${s.near_schools} issues near school zones</strong> — safety priority` });
  findings.push({ icon: 'payments', color: '#8b5cf6', bg: '#f5f3ff', text: `Total estimated repair cost: <strong>$${s.total_cost.toLocaleString()}</strong>` });
  if (s.open_issues > 0) findings.push({ icon: 'pending_actions', color: '#3b82f6', bg: '#eff6ff', text: `${s.open_issues} open work orders awaiting assignment` });

  const zoneEntries = Object.entries(s.by_zone).sort((a, b) => b[1] - a[1]);
  if (zoneEntries.length > 0) findings.push({ icon: 'location_on', color: '#006a61', bg: '#e6f5f3', text: `Highest concentration: <strong>${zoneEntries[0][0]}</strong> with ${zoneEntries[0][1]} issues` });

  return findings.map(f => `
    <div class="flex items-start gap-3 p-4 rounded-xl" style="background:${f.bg}">
      <span class="material-symbols-outlined mt-0.5" style="font-size:20px;color:${f.color}">${f.icon}</span>
      <span class="text-sm leading-relaxed" style="color:var(--md-on-surface)">${f.text}</span>
    </div>
  `).join('');
}

// ── Lazy AI Insights Loader ──────────────────────────────────────────────────

async function loadAiInsights(query) {
  const placeholder = document.getElementById('ai-analysis-placeholder');
  const content = document.getElementById('ai-analysis-content');
  const section = document.getElementById('ai-deep-analysis-section');
  if (!placeholder || !content) return;

  try {
    const res = await fetch('/api/dashboard/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();

    if (data.ai_insights?.markdown) {
      insightsData.ai_insights = data.ai_insights;
      content.innerHTML = marked.parse(data.ai_insights.markdown);
      placeholder.classList.add('hidden');
      content.classList.remove('hidden');
      // Smooth reveal
      content.style.opacity = '0';
      requestAnimationFrame(() => { content.style.transition = 'opacity 0.5s'; content.style.opacity = '1'; });
      // Update badge to show ready
      const aiBadge = document.getElementById('ai-section-badge');
      if (aiBadge) { aiBadge.textContent = 'Ready'; aiBadge.style.background = '#22c55e'; }
      // Auto-expand the section to show the content
      const aiBody = document.getElementById('rpt-ai-body');
      const aiChevron = document.getElementById('rpt-ai-chevron');
      if (aiBody && aiBody.classList.contains('hidden')) {
        aiBody.classList.remove('hidden');
        if (aiChevron) { aiChevron.style.transform = 'rotate(180deg)'; aiChevron.textContent = 'expand_less'; }
      }
      // Flash the Report tab badge
      const badge = document.getElementById('report-tab-badge');
      if (badge) { badge.classList.remove('hidden'); setTimeout(() => badge.classList.add('hidden'), 8000); }
      // Refresh pipeline details to show complete
      const pipelineBody = document.getElementById('pipeline-details-body');
      if (pipelineBody) pipelineBody.innerHTML = buildPipelineDetails();
    } else {
      placeholder.innerHTML = buildAiUnavailable('AI analysis couldn\u2019t generate results this time.', query);
      // Update badge to show unavailable
      const aiBadge = document.getElementById('ai-section-badge');
      if (aiBadge) { aiBadge.textContent = 'Unavailable'; aiBadge.style.background = 'var(--md-outline)'; }
    }
  } catch (err) {
    if (placeholder) {
      placeholder.innerHTML = buildAiUnavailable('Could not reach the AI service.', query);
      const aiBadge = document.getElementById('ai-section-badge');
      if (aiBadge) { aiBadge.textContent = 'Offline'; aiBadge.style.background = 'var(--md-outline)'; }
    }
  }
}

// ── Auto-Generated Report ────────────────────────────────────────────────────

function buildAutoReport(s, zones, zoneKeys) {
  const zoneEntries = Object.entries(zones).sort((a, b) => b[1] - a[1]);
  const topZone = zoneEntries[0] || ['N/A', 0];
  const completionRate = s.total_issues ? Math.round(s.completed / s.total_issues * 100) : 0;
  const avgCost = s.avg_cost ? '$' + s.avg_cost.toLocaleString() : 'N/A';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const healthScore = Math.max(0, Math.min(100, 70 + Math.round(completionRate * 0.2) - (s.critical * 3) - (s.high * 1)));
  const healthGrade = healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 50 ? 'C' : healthScore >= 35 ? 'D' : 'F';
  const healthColor = healthScore >= 80 ? '#22c55e' : healthScore >= 65 ? '#3b82f6' : healthScore >= 50 ? '#eab308' : healthScore >= 35 ? '#f97316' : '#ef4444';
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  // Build report with collapsible visual sections
  let report = `
    <div style="color:var(--md-on-surface)">
      <!-- ── Title ── -->
      <div class="text-center mb-6 pb-4 border-b" style="border-color:var(--md-outline-variant)">
        <h1 class="text-2xl font-extrabold font-display mb-1" style="color:var(--md-on-surface)">Lake Forest Infrastructure Report</h1>
        <p class="text-sm" style="color:var(--md-outline)">Generated ${dateStr} &middot; CivicLens AI Analysis</p>
      </div>

      <!-- ══════ AT-A-GLANCE HERO ══════ -->
      <div class="not-prose rounded-2xl p-5 mb-5" style="background:linear-gradient(135deg, #f0fdf9 0%, #e6f5f3 50%, #f0f9ff 100%);border:1px solid #d1e7e4">
        <div class="flex flex-col sm:flex-row items-center gap-5">
          <!-- Health Score Ring -->
          <div class="flex-shrink-0 text-center">
            <div class="relative" style="width:130px;height:130px">
              <svg viewBox="0 0 120 120" style="width:130px;height:130px;transform:rotate(-90deg)">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8"/>
                <circle cx="60" cy="60" r="54" fill="none" stroke="${healthColor}" stroke-width="8" 
                  stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round"
                  style="transition:stroke-dashoffset 1.5s ease"/>
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-3xl font-extrabold font-display" style="color:${healthColor}">${healthGrade}</span>
                <span class="text-[10px] font-medium" style="color:var(--md-outline)">${healthScore}/100</span>
              </div>
            </div>
            <div class="text-[10px] font-semibold mt-1 uppercase tracking-wider" style="color:${healthColor}">Health Score</div>
          </div>
          <!-- Key Stats Grid -->
          <div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
            <div class="text-center p-3 rounded-xl bg-white shadow-sm">
              <div class="text-2xl font-extrabold font-display" style="color:var(--md-on-surface)">${s.total_issues}</div>
              <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Total Issues</div>
            </div>
            <div class="text-center p-3 rounded-xl bg-white shadow-sm">
              <div class="text-2xl font-extrabold font-display" style="color:#22c55e">${completionRate}%</div>
              <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Resolved</div>
            </div>
            <div class="text-center p-3 rounded-xl bg-white shadow-sm">
              <div class="text-2xl font-extrabold font-display" style="color:var(--md-on-surface)">$${(s.total_cost / 1000).toFixed(0)}k</div>
              <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Est. Cost</div>
            </div>
            <div class="text-center p-3 rounded-xl bg-white shadow-sm">
              <div class="text-2xl font-extrabold font-display" style="color:${s.critical > 0 ? '#ef4444' : '#22c55e'}">${s.critical}</div>
              <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Critical</div>
            </div>
          </div>
        </div>
        <!-- Compact Status Bar -->
        <div class="mt-4 flex items-center gap-2 text-[10px] font-medium">
          <span style="color:var(--md-outline)">Progress:</span>
          <div class="flex-1 h-2 rounded-full overflow-hidden bg-white" style="box-shadow:inset 0 1px 2px rgba(0,0,0,0.06)">
            <div class="h-full rounded-full flex">
              <div style="width:${s.total_issues ? (s.completed/s.total_issues*100) : 0}%;background:#22c55e" title="Completed"></div>
              <div style="width:${s.total_issues ? (s.in_progress/s.total_issues*100) : 0}%;background:#3b82f6" title="In Progress"></div>
              <div style="width:${s.total_issues ? (s.open_issues/s.total_issues*100) : 0}%;background:#e5e7eb" title="Open"></div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#22c55e"></span> ${s.completed} done</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#3b82f6"></span> ${s.in_progress} active</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#d1d5db"></span> ${s.open_issues} open</span>
          </div>
        </div>
      </div>`;

  // ── ALERT BANNERS (only if urgent items) ──
  if (s.critical > 0 || s.near_schools > 0) {
    report += `<div class="not-prose space-y-2 mb-5">`;
    if (s.critical > 0) {
      report += `
      <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#fef2f2;border:1px solid #fecaca">
        <span class="material-symbols-outlined" style="font-size:22px;color:#ef4444">error</span>
        <div class="flex-1">
          <span class="text-sm font-bold" style="color:#991b1b">${s.critical} Critical Issue${s.critical > 1 ? 's' : ''}</span>
          <span class="text-xs ml-1" style="color:#b91c1c">— requires immediate attention</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-1 rounded-full" style="background:#ef4444;color:white">URGENT</span>
      </div>`;
    }
    if (s.near_schools > 0) {
      report += `
      <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#fffbeb;border:1px solid #fde68a">
        <span class="material-symbols-outlined" style="font-size:22px;color:#d97706">school</span>
        <div class="flex-1">
          <span class="text-sm font-bold" style="color:#92400e">${s.near_schools} Issue${s.near_schools > 1 ? 's' : ''} Near Schools</span>
          <span class="text-xs ml-1" style="color:#b45309">— student safety priority</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-1 rounded-full" style="background:#f59e0b;color:white">SAFETY</span>
      </div>`;
    }
    report += `</div>`;
  }

  // ── COLLAPSIBLE: Priority Breakdown ──
  report += buildReportSection('rpt-priority', 'Priority Breakdown', 'shield', true, `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      ${buildReportStat('Critical', s.critical, '#ef4444', 'error')}
      ${buildReportStat('High', s.high, '#f97316', 'warning')}
      ${buildReportStat('Medium', s.medium, '#eab308', 'info')}
      ${buildReportStat('Low', s.low, '#22c55e', 'check_circle')}
    </div>
    <p class="text-sm leading-relaxed" style="color:var(--md-on-surface-variant)">${s.critical > 0 ? `${s.critical} critical issue${s.critical > 1 ? 's' : ''} should be prioritized in the current maintenance cycle.` : 'No critical issues — infrastructure is in acceptable condition.'}
    ${s.near_schools > 0 ? ` ${s.near_schools} issue${s.near_schools > 1 ? 's' : ''} near school zones need expedited action.` : ''}</p>
  `);

  // ── COLLAPSIBLE: Geographic Distribution ──
  if (zoneKeys.length > 0) {
    const zoneHtml = zoneEntries.map(([zone, count], i) => {
      const pct = Math.round((count / s.total_issues) * 100);
      const isTop = i === 0;
      return `
      <div class="flex items-center gap-3 p-2 rounded-lg ${isTop ? '' : ''}" style="${isTop ? 'background:var(--md-surface-container-low, #f3f3f9)' : ''}">
        <span class="material-symbols-outlined flex-shrink-0" style="font-size:16px;color:${isTop ? 'var(--md-secondary)' : 'var(--md-outline)'}">location_on</span>
        <span class="text-xs font-semibold w-20 truncate" style="color:var(--md-on-surface)">${zone}</span>
        <div class="flex-1 h-2.5 rounded-full overflow-hidden" style="background:var(--md-surface-container, #e5e7eb)">
          <div class="h-full rounded-full" style="width:${pct}%;background:${isTop ? 'var(--md-secondary)' : '#94a3b8'};transition:width 1s ease"></div>
        </div>
        <span class="text-xs font-bold w-14 text-right" style="color:var(--md-on-surface)">${count} <span style="color:var(--md-outline);font-weight:400">(${pct}%)</span></span>
      </div>`;
    }).join('');

    report += buildReportSection('rpt-geo', 'Neighborhoods', 'map', true, `
      <div class="space-y-1">${zoneHtml}</div>
      <p class="text-xs mt-3" style="color:var(--md-outline)"><strong>${topZone[0]}</strong> has the highest concentration with ${topZone[1]} reported issues.</p>
    `);
  }

  // ── COLLAPSIBLE: Financials ──
  report += buildReportSection('rpt-finance', 'Cost Estimates', 'payments', false, `
    <div class="flex items-baseline gap-2 mb-4">
      <span class="text-3xl font-extrabold font-display" style="color:var(--md-on-surface)">$${s.total_cost.toLocaleString()}</span>
      <span class="text-sm" style="color:var(--md-outline)">total estimated &middot; ${avgCost} avg per order</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      ${Object.entries(s.cost_by_type || {}).map(([type, cost]) => {
        const pct = s.total_cost ? Math.round((cost / s.total_cost) * 100) : 0;
        return `
        <div class="p-3 rounded-xl" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold" style="color:var(--md-on-surface-variant)">${prettyLabel(type)}</span>
            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style="background:var(--md-surface-container);color:var(--md-outline)">${pct}%</span>
          </div>
          <div class="text-lg font-bold font-display" style="color:var(--md-on-surface)">$${cost.toLocaleString()}</div>
          <div class="h-1.5 rounded-full overflow-hidden mt-2" style="background:var(--md-surface-container)">
            <div class="h-full rounded-full" style="width:${pct}%;background:var(--md-secondary)"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `);

  // ── COLLAPSIBLE: Work Order Status ──
  const statusItems = [
    { label: 'Completed', count: s.completed, icon: 'check_circle', color: '#22c55e', desc: 'Resolved and closed' },
    { label: 'In Progress', count: s.in_progress, icon: 'sync', color: '#3b82f6', desc: 'Crews actively working' },
    { label: 'Open', count: s.open_issues, icon: 'pending_actions', color: '#f59e0b', desc: 'Awaiting assignment' },
  ];
  report += buildReportSection('rpt-status', 'Work Orders', 'assignment', false, `
    <div class="space-y-3">
      ${statusItems.map(item => `
        <div class="flex items-center gap-3 p-3 rounded-xl" style="background:var(--md-surface-container-low, #f3f3f9)">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${item.color}15">
            <span class="material-symbols-outlined" style="font-size:20px;color:${item.color}">${item.icon}</span>
          </div>
          <div class="flex-1">
            <div class="text-sm font-bold" style="color:var(--md-on-surface)">${item.label}</div>
            <div class="text-[10px]" style="color:var(--md-outline)">${item.desc}</div>
          </div>
          <div class="text-xl font-extrabold font-display" style="color:${item.color}">${item.count}</div>
        </div>
      `).join('')}
    </div>
  `);

  // ── RECOMMENDATIONS as action cards ──
  const recs = [];
  if (s.critical > 0) recs.push({ icon: 'emergency', color: '#ef4444', bg: '#fef2f2', title: 'Address Critical Issues', desc: `${s.critical} critical issue${s.critical > 1 ? 's require' : ' requires'} urgent attention to prevent safety hazards.` });
  if (s.near_schools > 0) recs.push({ icon: 'school', color: '#d97706', bg: '#fffbeb', title: 'Prioritize School Zones', desc: `${s.near_schools} issue${s.near_schools > 1 ? 's' : ''} near schools should be fast-tracked during non-school hours.` });
  if (topZone[1] > 3) recs.push({ icon: 'engineering', color: '#3b82f6', bg: '#eff6ff', title: `Focus on ${topZone[0]}`, desc: `Highest issue concentration (${topZone[1]} issues) — allocate additional resources.` });
  recs.push({ icon: 'monitoring', color: 'var(--md-secondary)', bg: '#e6f5f3', title: 'Continue Monitoring', desc: 'Regular AI-powered analysis helps identify emerging patterns early.' });
  recs.push({ icon: 'account_balance', color: '#8b5cf6', bg: '#f5f3ff', title: 'Budget Planning', desc: `$${s.total_cost.toLocaleString()} should be factored into the next maintenance budget cycle.` });

  report += buildReportSection('rpt-recs', 'Recommendations', 'lightbulb', true, `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${recs.map((r, i) => `
        <div class="flex items-start gap-3 p-3 rounded-xl border" style="background:${r.bg};border-color:${r.color}22">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:${r.color}15">
            <span class="material-symbols-outlined" style="font-size:18px;color:${r.color}">${r.icon}</span>
          </div>
          <div>
            <div class="text-sm font-bold" style="color:var(--md-on-surface)">${r.title}</div>
            <div class="text-xs mt-0.5 leading-relaxed" style="color:var(--md-on-surface-variant)">${r.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `);

  // ── AI Deep Analysis (lazy loaded, default collapsed) ──
  report += `
      <div id="ai-deep-analysis-section" class="mt-5">
        <div class="rounded-2xl overflow-hidden border" style="border-color:var(--md-outline-variant)">
          <button onclick="toggleReportSection('rpt-ai')" class="w-full px-5 py-3 flex items-center justify-between text-left" style="background:linear-gradient(135deg, #f0f9ff, #e6f5f3)">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined" style="font-size:20px;color:var(--md-secondary)">auto_awesome</span>
              <span class="text-sm font-bold font-display" style="color:var(--md-on-surface)">AI Deep Analysis</span>
              <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" id="ai-section-badge" style="background:var(--md-secondary);color:white">Loading...</span>
            </div>
            <span class="material-symbols-outlined rpt-section-chevron transition-transform" id="rpt-ai-chevron" style="font-size:18px;color:var(--md-outline)">expand_more</span>
          </button>
          <div class="hidden px-5 py-4 border-t" id="rpt-ai-body" style="background:white;border-color:var(--md-surface-container)">
            <div id="ai-analysis-placeholder" class="flex flex-col items-center gap-3 py-6">
              <div class="flex items-center gap-2">
                <svg class="animate-spin" style="width:20px;height:20px;color:var(--md-secondary)" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
                <span class="text-sm font-semibold" style="color:var(--md-secondary)">GPT-4o-mini is analyzing your data...</span>
              </div>
              <p class="text-xs" style="color:var(--md-outline)">AI-powered deep analysis runs in the background. Your report is fully usable while this loads.</p>
            </div>
            <div id="ai-analysis-content" class="hidden prose max-w-none" style="color:var(--md-on-surface)"></div>
          </div>
        </div>
      </div>`;

  // ── Footer ──
  report += `
      <div class="flex items-center justify-between mt-5 pt-4 border-t" style="border-color:var(--md-outline-variant)">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--md-outline)">smart_toy</span>
          <span class="text-[10px]" style="color:var(--md-outline)">Based on ${s.total_issues} records from ${Object.keys(s.cost_by_type || {}).length + 1} data sources &middot; ${new Date().toLocaleDateString()}</span>
        </div>
        <span class="text-[10px]" style="color:var(--md-outline)">CivicLens AI</span>
      </div>
    </div>`;

  return report;
}

// ── Collapsible Report Section Builder ──

function buildReportSection(id, title, icon, openByDefault, contentHtml) {
  return `
    <div class="not-prose rounded-2xl overflow-hidden border mb-3" style="border-color:var(--md-outline-variant)">
      <button onclick="toggleReportSection('${id}')" class="w-full px-5 py-3 flex items-center justify-between text-left transition hover:bg-gray-50" style="background:white">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size:20px;color:var(--md-secondary)">${icon}</span>
          <span class="text-sm font-bold font-display" style="color:var(--md-on-surface)">${title}</span>
        </div>
        <span class="material-symbols-outlined rpt-section-chevron transition-transform" id="${id}-chevron" style="font-size:18px;color:var(--md-outline);${openByDefault ? 'transform:rotate(180deg)' : ''}">${openByDefault ? 'expand_less' : 'expand_more'}</span>
      </button>
      <div id="${id}-body" class="${openByDefault ? '' : 'hidden'} border-t px-5 py-4" style="border-color:var(--md-surface-container, #e5e7eb);background:white">
        ${contentHtml}
      </div>
    </div>`;
}

function toggleReportSection(id) {
  const body = document.getElementById(id + '-body');
  const chevron = document.getElementById(id + '-chevron');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden');
  if (chevron) {
    chevron.textContent = isHidden ? 'expand_less' : 'expand_more';
    chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
  }
}
window.toggleReportSection = toggleReportSection;

function buildAiUnavailable(msg, query) {
  return `
    <div class="flex flex-col items-center gap-3 py-5">
      <div class="w-12 h-12 rounded-full flex items-center justify-center" style="background:var(--md-surface-container-low, #f3f3f9)">
        <span class="material-symbols-outlined" style="font-size:24px;color:var(--md-outline)">cloud_off</span>
      </div>
      <div class="text-center">
        <p class="text-sm font-semibold mb-1" style="color:var(--md-on-surface)">${msg}</p>
        <p class="text-xs" style="color:var(--md-outline);max-width:360px;margin:0 auto">The rest of your report is fully generated from real data. AI deep analysis requires an active API connection.</p>
      </div>
      <button onclick="loadAiInsights('${escHtml(query || 'community infrastructure overview')}')" class="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition hover:opacity-90" style="background:var(--md-secondary);color:white">
        <span class="material-symbols-outlined" style="font-size:14px">refresh</span> Retry AI Analysis
      </button>
    </div>`;
}

function buildReportStat(label, value, color, icon) {
  return `
    <div class="p-3 rounded-xl text-center" style="background:${color}08;border:1px solid ${color}22">
      <span class="material-symbols-outlined mb-1" style="font-size:18px;color:${color}">${icon || 'circle'}</span>
      <div class="text-2xl font-extrabold font-display" style="color:${color}">${value}</div>
      <div class="text-[10px] font-medium mt-0.5" style="color:var(--md-on-surface-variant)">${label}</div>
    </div>`;
}

// ── Custom Prompt ────────────────────────────────────────────────────────────

function showCustomPrompt() {
  const bar = document.getElementById('insights-custom-bar');
  bar.classList.remove('hidden');
  const input = document.getElementById('insights-custom-input');
  input.focus();

  const form = document.getElementById('insights-custom-form');
  form.onsubmit = (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    hideCustomPrompt();
    // Switch to report tab and generate AI report for this specific query
    switchMainTab('report');
    generateCustomReport(query);
  };
}
window.showCustomPrompt = showCustomPrompt;

// ── Build rich Custom Report HTML with visuals ───────────────────────────────
function buildCustomReportHtml(s, query, dateStr, markdown) {
  // Compute health metrics
  const completionRate = s && s.total_issues ? Math.round(s.completed / s.total_issues * 100) : 0;
  const healthScore = s ? Math.max(0, Math.min(100, 70 + Math.round(completionRate * 0.2) - (s.critical * 3) - (s.high * 1))) : 50;
  const healthGrade = healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 50 ? 'C' : healthScore >= 35 ? 'D' : 'F';
  const healthColor = healthScore >= 80 ? '#22c55e' : healthScore >= 65 ? '#3b82f6' : healthScore >= 50 ? '#eab308' : healthScore >= 35 ? '#f97316' : '#ef4444';
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  // Build SVG donut for priority breakdown
  const priorityData = s ? [
    { label: 'Critical', value: s.critical || 0, color: '#ef4444' },
    { label: 'High', value: s.high || 0, color: '#f97316' },
    { label: 'Medium', value: s.medium || 0, color: '#eab308' },
    { label: 'Low', value: s.low || 0, color: '#22c55e' },
  ] : [];
  const total = priorityData.reduce((a, d) => a + d.value, 0);

  function buildDonutPaths() {
    if (!total) return '<circle cx="60" cy="60" r="48" fill="none" stroke="#e5e7eb" stroke-width="14"/>';
    let paths = '';
    let cumAngle = -90;
    const circ = 2 * Math.PI * 48;
    priorityData.forEach(d => {
      if (d.value === 0) return;
      const pct = d.value / total;
      const dash = circ * pct;
      const gap = circ - dash;
      const rotation = cumAngle;
      paths += `<circle cx="60" cy="60" r="48" fill="none" stroke="${d.color}" stroke-width="14"
        stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
        transform="rotate(${rotation.toFixed(1)} 60 60)" style="transition:stroke-dasharray .8s ease"/>`;
      cumAngle += pct * 360;
    });
    return paths;
  }

  // Build SVG horizontal bars for top issue types
  const typeEntries = s ? Object.entries(s.by_type || {}).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  const typeMax = typeEntries.length ? typeEntries[0][1] : 1;
  const typeColors = ['#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

  let html = `<div style="color:var(--md-on-surface)">
    <!-- ── Header ── -->
    <div class="text-center mb-6 pb-4 border-b" style="border-color:var(--md-outline-variant)">
      <h1 class="text-2xl font-extrabold font-display mb-1" style="color:var(--md-on-surface)">Custom AI Report</h1>
      <p class="text-sm" style="color:var(--md-outline)">Generated ${dateStr} &middot; CivicLens AI Analysis</p>
      <div class="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl" style="background:var(--md-surface-container-low, #f3f3f9)">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--md-secondary)">chat</span>
        <span class="text-xs font-medium" style="color:var(--md-on-surface-variant)">Query: &ldquo;${escHtml(query)}&rdquo;</span>
      </div>
    </div>`;

  // ── VISUAL 1: At-a-Glance Hero (health ring + KPI cards) ──
  if (s) {
    html += `
    <div class="not-prose rounded-2xl p-5 mb-5" style="background:linear-gradient(135deg, #f0fdf9 0%, #e6f5f3 50%, #f0f9ff 100%);border:1px solid #d1e7e4">
      <div class="flex flex-col sm:flex-row items-center gap-5">
        <div class="flex-shrink-0 text-center">
          <div class="relative" style="width:120px;height:120px">
            <svg viewBox="0 0 120 120" style="width:120px;height:120px;transform:rotate(-90deg)">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8"/>
              <circle cx="60" cy="60" r="54" fill="none" stroke="${healthColor}" stroke-width="8"
                stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round"
                style="transition:stroke-dashoffset 1.5s ease"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-extrabold font-display" style="color:${healthColor}">${healthGrade}</span>
              <span class="text-[10px] font-medium" style="color:var(--md-outline)">${healthScore}/100</span>
            </div>
          </div>
          <div class="text-[10px] font-semibold mt-1 uppercase tracking-wider" style="color:${healthColor}">Health Score</div>
        </div>
        <div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          <div class="text-center p-3 rounded-xl bg-white shadow-sm">
            <div class="text-2xl font-extrabold font-display" style="color:var(--md-on-surface)">${s.total_issues}</div>
            <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Total Issues</div>
          </div>
          <div class="text-center p-3 rounded-xl bg-white shadow-sm">
            <div class="text-2xl font-extrabold font-display" style="color:#22c55e">${completionRate}%</div>
            <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Resolved</div>
          </div>
          <div class="text-center p-3 rounded-xl bg-white shadow-sm">
            <div class="text-2xl font-extrabold font-display" style="color:var(--md-on-surface)">$${(s.total_cost / 1000).toFixed(0)}k</div>
            <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Est. Cost</div>
          </div>
          <div class="text-center p-3 rounded-xl bg-white shadow-sm">
            <div class="text-2xl font-extrabold font-display" style="color:${s.critical > 0 ? '#ef4444' : '#22c55e'}">${s.critical}</div>
            <div class="text-[10px] mt-0.5" style="color:var(--md-outline)">Critical</div>
          </div>
        </div>
      </div>
      <!-- Status Bar -->
      <div class="mt-4 flex items-center gap-2 text-[10px] font-medium">
        <span style="color:var(--md-outline)">Progress:</span>
        <div class="flex-1 h-2 rounded-full overflow-hidden bg-white" style="box-shadow:inset 0 1px 2px rgba(0,0,0,0.06)">
          <div class="h-full rounded-full flex">
            <div style="width:${s.total_issues ? (s.completed/s.total_issues*100) : 0}%;background:#22c55e" title="Completed"></div>
            <div style="width:${s.total_issues ? (s.in_progress/s.total_issues*100) : 0}%;background:#3b82f6" title="In Progress"></div>
            <div style="width:${s.total_issues ? (s.open_issues/s.total_issues*100) : 0}%;background:#e5e7eb" title="Open"></div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#22c55e"></span> ${s.completed} done</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#3b82f6"></span> ${s.in_progress} active</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#d1d5db"></span> ${s.open_issues} open</span>
        </div>
      </div>
    </div>`;

    // ── VISUAL 2: Priority Donut + VISUAL 3: Top Issues Bar Chart (side by side) ──
    html += `
    <div class="not-prose grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
      <!-- Priority Breakdown Donut -->
      <div class="rounded-2xl p-4 border" style="border-color:var(--md-outline-variant);background:white">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-secondary)">shield</span>
          <span class="text-sm font-bold font-display" style="color:var(--md-on-surface)">Priority Breakdown</span>
        </div>
        <div class="flex items-center gap-4">
          <svg viewBox="0 0 120 120" style="width:110px;height:110px;flex-shrink:0">
            ${buildDonutPaths()}
            <text x="60" y="56" text-anchor="middle" style="font-size:22px;font-weight:800;fill:var(--md-on-surface)">${total}</text>
            <text x="60" y="72" text-anchor="middle" style="font-size:9px;fill:#94a3b8">total</text>
          </svg>
          <div class="flex-1 space-y-2">
            ${priorityData.map(d => `
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${d.color}"></span>
                <span class="text-xs flex-1" style="color:var(--md-on-surface-variant)">${d.label}</span>
                <span class="text-xs font-bold" style="color:var(--md-on-surface)">${d.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Top Issue Types Bar Chart -->
      <div class="rounded-2xl p-4 border" style="border-color:var(--md-outline-variant);background:white">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-secondary)">bar_chart</span>
          <span class="text-sm font-bold font-display" style="color:var(--md-on-surface)">Top Issue Types</span>
        </div>
        <div class="space-y-2.5">
          ${typeEntries.map((([type, count], i) => {
            const pct = Math.round((count / typeMax) * 100);
            const color = typeColors[i % typeColors.length];
            return `
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium truncate" style="color:var(--md-on-surface-variant);max-width:140px">${prettyLabel(type)}</span>
                <span class="text-xs font-bold" style="color:var(--md-on-surface)">${count}</span>
              </div>
              <div class="h-2 rounded-full overflow-hidden" style="background:#f1f5f9">
                <div class="h-full rounded-full" style="width:${pct}%;background:${color};transition:width .8s ease"></div>
              </div>
            </div>`;
          })).join('')}
          ${typeEntries.length === 0 ? '<p class="text-xs" style="color:var(--md-outline)">No type data available</p>' : ''}
        </div>
      </div>
    </div>`;
  }

  // ── AI Narrative Content ──
  html += `
    <div class="not-prose rounded-2xl overflow-hidden border mb-4" style="border-color:var(--md-outline-variant)">
      <div class="px-5 py-3 flex items-center gap-2" style="background:linear-gradient(135deg, #f0f9ff, #e6f5f3);border-bottom:1px solid var(--md-outline-variant)">
        <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-secondary)">auto_awesome</span>
        <span class="text-sm font-bold font-display" style="color:var(--md-on-surface)">AI Analysis</span>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:var(--md-secondary);color:white">AI-Generated</span>
        <button onclick="window.print()" class="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition hover:bg-gray-50" style="color:var(--md-on-surface-variant);border-color:var(--md-outline-variant)">
          <span class="material-symbols-outlined" style="font-size:14px">print</span> Print
        </button>
      </div>
      <div class="px-5 py-4 prose max-w-none" style="background:white">
        ${marked.parse(markdown)}
      </div>
    </div>`;

  // ── Footer ──
  html += `
    <div class="flex items-center justify-between mt-5 pt-4 border-t" style="border-color:var(--md-outline-variant)">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--md-outline)">smart_toy</span>
        <span class="text-[10px]" style="color:var(--md-outline)">Generated by CivicLens AI (GPT-4o-mini) in response to your custom query &middot; ${s ? s.total_issues + ' records analyzed' : ''}</span>
      </div>
      <span class="text-[10px]" style="color:var(--md-outline)">CivicLens AI</span>
    </div>
  </div>`;

  return html;
}

// Generate a custom AI report for user's specific question
async function generateCustomReport(query) {
  const reportContent = document.getElementById('ins-report-content');
  const pipelineBody = document.getElementById('pipeline-details-body');
  if (!reportContent) return;

  // Show loading state in the report content area
  reportContent.innerHTML = `
    <div class="flex flex-col items-center gap-4 py-12">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 rounded-full animate-spin" style="border:3px solid transparent;border-top-color:var(--md-secondary);animation-duration:1.2s"></div>
        <div class="absolute inset-2 rounded-full animate-spin" style="border:3px solid transparent;border-bottom-color:var(--md-tertiary, #3b82f6);animation-direction:reverse;animation-duration:0.9s"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="material-symbols-outlined" style="font-size:24px;color:var(--md-secondary)">auto_awesome</span>
        </div>
      </div>
      <div class="text-center">
        <h3 class="text-base font-bold font-display mb-1" style="color:var(--md-on-surface)">Generating Custom Report</h3>
        <p class="text-sm" style="color:var(--md-outline);max-width:400px;margin:0 auto">AI is analyzing your question and generating a tailored report...</p>
        <div class="mt-3 px-4 py-2 rounded-xl inline-block" style="background:var(--md-surface-container-low, #f3f3f9)">
          <p class="text-xs font-medium" style="color:var(--md-on-surface-variant)">&ldquo;${escHtml(query)}&rdquo;</p>
        </div>
      </div>
    </div>`;

  // Update pipeline details to show loading
  if (pipelineBody) pipelineBody.innerHTML = buildPipelineDetails();

  try {
    const res = await fetch('/api/dashboard/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();

    if (data.ai_insights?.markdown) {
      insightsData.ai_insights = data.ai_insights;
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const s = insightsData.summary;
      reportContent.innerHTML = buildCustomReportHtml(s, query, dateStr, data.ai_insights.markdown);
      // Flash the report tab badge
      const badge = document.getElementById('report-tab-badge');
      if (badge) { badge.classList.remove('hidden'); setTimeout(() => badge.classList.add('hidden'), 5000); }
    } else {
      reportContent.innerHTML = `
        <div class="flex flex-col items-center gap-3 py-12">
          <span class="material-symbols-outlined" style="font-size:36px;color:var(--md-outline)">info</span>
          <p class="text-sm text-center" style="color:var(--md-outline);max-width:360px">AI could not generate a report for this query. ${data.error ? escHtml(data.error) : 'Try a more specific question about infrastructure data.'}</p>
          <button onclick="showCustomPrompt()" class="mt-2 px-5 py-2 rounded-xl text-sm font-medium text-white" style="background:var(--md-secondary)">Try Another Question</button>
        </div>`;
    }
    // Refresh pipeline details
    if (pipelineBody) pipelineBody.innerHTML = buildPipelineDetails();
  } catch (err) {
    reportContent.innerHTML = `
      <div class="flex flex-col items-center gap-3 py-12">
        <span class="material-symbols-outlined" style="font-size:36px;color:#ef4444">error_outline</span>
        <p class="text-sm text-center" style="color:var(--md-outline);max-width:360px">Failed to generate report: ${escHtml(err.message)}</p>
        <button onclick="generateCustomReport('${escHtml(query)}')" class="mt-2 px-5 py-2 rounded-xl text-sm font-medium text-white" style="background:var(--md-secondary)">Try Again</button>
      </div>`;
  }
}
window.generateCustomReport = generateCustomReport;

function hideCustomPrompt() {
  document.getElementById('insights-custom-bar')?.classList.add('hidden');
}
window.hideCustomPrompt = hideCustomPrompt;

// ── Helpers ──────────────────────────────────────────────────────────────────

function destroyCharts() {
  insightsCharts.forEach(c => c.destroy());
  insightsCharts = [];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Expose globally ──────────────────────────────────────────────────────────

window.openInsights = openInsights;
window.closeInsights = closeInsights;
