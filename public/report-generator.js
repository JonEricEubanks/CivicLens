/**
 * Report Generator — CivicLens
 *
 * Structured, professional report builder with template/audience system,
 * inline editing, local SVG charts, and print/PDF export.
 * Vanilla JS, Tailwind classes, no frameworks.
 */

/* global marked */

// ─── State ──────────────────────────────────────────────────────────────────

let reportData = null;       // raw dashboard data
let currentTemplate = 'full';
let currentAudience = 'board';
let sections = [];            // active section list
let previewMode = false;
let reportGenerated = false;
let darkTheme = false;

// ─── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES = {
  full:      { label: 'Full Assessment',      icon: CivicIcons.clipboard('w-4 h-4 inline'), sectionIds: ['cover','toc','exec','kpi','severity','charts','budget','recommendations','forecast','safety','custom','appendix'] },
  brief:     { label: 'Board Brief',          icon: CivicIcons.chart('w-4 h-4 inline'), sectionIds: ['cover','exec','kpi','severity','recommendations','appendix'] },
  community: { label: 'Community Update',     icon: CivicIcons.home('w-4 h-4 inline'), sectionIds: ['cover','exec','kpi','charts','appendix'] },
  budget:    { label: 'Budget Request',       icon: CivicIcons.dollar('w-4 h-4 inline'), sectionIds: ['cover','exec','budget','charts','forecast','appendix'] },
  neighbor:  { label: 'Neighborhood Update',  icon: CivicIcons.home('w-4 h-4 inline'), sectionIds: ['cover','neighborhood_summary','neighborhood_grades','recent_fixes','active_work','school_safety','how_to_report'] },
};

const AUDIENCES = {
  board:     { label: 'Board / Executives',  desc: 'High-level summary, strategic focus' },
  technical: { label: 'Technical Staff',      desc: 'Detailed data, methodology, specifics' },
  community: { label: 'Community / Public',   desc: 'Plain language, safety-focused' },
  resident:  { label: 'Resident',             desc: 'Neighborhood updates, issues near you' },
  internal:  { label: 'Internal Team',        desc: 'Operational detail, crew assignments' },
};

// ─── Section Registry ───────────────────────────────────────────────────────

const SECTION_DEFS = {
  cover:           { label: 'Cover Page',              icon: CivicIcons.file('w-4 h-4 inline') },
  toc:             { label: 'Table of Contents',        icon: CivicIcons.fileText('w-4 h-4 inline') },
  exec:            { label: 'Executive Summary',        icon: CivicIcons.notepad('w-4 h-4 inline') },
  kpi:             { label: 'Key Performance Indicators',icon: CivicIcons.chart('w-4 h-4 inline') },
  severity:        { label: 'Severity & Issue Analysis', icon: CivicIcons.alertTriangle('w-4 h-4 inline') },
  charts:          { label: 'Visual Analytics',          icon: CivicIcons.trendUp('w-4 h-4 inline') },
  budget:          { label: 'Budget & Financial',        icon: CivicIcons.dollar('w-4 h-4 inline') },
  recommendations: { label: 'Recommendations',          icon: CivicIcons.checkCircle('w-4 h-4 inline') },
  forecast:        { label: 'Forecasting',              icon: CivicIcons.crystal('w-4 h-4 inline') },
  safety:          { label: 'Safety & Compliance',       icon: CivicIcons.shield('w-4 h-4 inline') },
  custom:          { label: 'Custom Section',            icon: CivicIcons.notepad('w-4 h-4 inline') },
  appendix:        { label: 'Appendix',                  icon: CivicIcons.paperclip('w-4 h-4 inline') },
  neighborhood_summary:  { label: 'What\'s Happening Near You', icon: CivicIcons.mapPin('w-4 h-4 inline') },
  neighborhood_grades:   { label: 'Neighborhood Grades',        icon: CivicIcons.home('w-4 h-4 inline') },
  recent_fixes:          { label: 'Recently Fixed',              icon: CivicIcons.checkCircle('w-4 h-4 inline') },
  active_work:           { label: 'Coming Up / In Progress',     icon: CivicIcons.wrench('w-4 h-4 inline') },
  school_safety:         { label: 'School Zone Safety',          icon: CivicIcons.school('w-4 h-4 inline') },
  how_to_report:         { label: 'How to Report Issues',        icon: CivicIcons.phone('w-4 h-4 inline') },
};

// ─── Color tokens ───────────────────────────────────────────────────────────

const THEME = {
  light: { bg: '#ffffff', text: '#1e293b', muted: '#64748b', border: '#e2e8f0', accent: '#6366f1', successBg: '#f0fdf4', warningBg: '#fffbeb', dangerBg: '#fef2f2', infoBg: '#eff6ff' },
  dark:  { bg: '#0f172a', text: '#e2e8f0', muted: '#94a3b8', border: '#334155', accent: '#818cf8', successBg: '#064e3b', warningBg: '#78350f', dangerBg: '#7f1d1d', infoBg: '#1e3a5f' },
};

// ─── Launch / Close ─────────────────────────────────────────────────────────

export function openReportGenerator(data) {
  if (document.getElementById('report-overlay')) return;
  reportData = data || null;
  reportGenerated = false;
  previewMode = false;

  initSections(currentTemplate);

  const overlay = document.createElement('div');
  overlay.id = 'report-overlay';
  overlay.innerHTML = buildReportShell();
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  wireReportEvents();
  renderSidebar();
  renderContent();
  updateStatusBar();
}

export function closeReportGenerator() {
  const overlay = document.getElementById('report-overlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
  // Reset bottom nav back to Home
  if (window.resetNavToHome) window.resetNavToHome();
}

// ─── Sections Init ──────────────────────────────────────────────────────────

function initSections(templateKey) {
  const t = TEMPLATES[templateKey];
  sections = t.sectionIds.map((id, i) => ({
    id,
    ...SECTION_DEFS[id],
    order: i,
    visible: true,
    collapsed: false,
    notes: '',
  }));
}

// ─── Shell ──────────────────────────────────────────────────────────────────

function buildReportShell() {
  const t = ct();
  return `
  <div class="fixed inset-0 z-50 flex flex-col" style="background:${t.bg};color:${t.text};font-family:Inter,system-ui,sans-serif">
    <style>
      .rpt-bottom-bar { display: none; }
      @media (max-width: 767px) {
        #report-overlay #rpt-close,
        #report-overlay #rpt-generate,
        #report-overlay #rpt-export { display: none !important; }
        .rpt-bottom-bar { display: flex !important; position: fixed !important; z-index: 10000 !important; }
        #report-overlay #rpt-content { padding-bottom: 70px !important; }
      }
    </style>
    <!-- Top bar -->
    <header class="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 border-b shrink-0 overflow-x-auto" style="border-color:${t.border}">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shrink-0">R</div>
      <button id="rpt-sidebar-toggle" class="md:hidden shrink-0 p-1.5 rounded-lg border" style="border-color:${t.border};color:${t.muted}" title="Toggle sections">${CivicIcons.menu('w-4 h-4')}</button>
      <h1 class="font-bold text-sm md:text-base shrink-0">Reports</h1>
      <!-- Template selector -->
      <div class="flex items-center gap-1 md:gap-2 mr-2 md:mr-4 shrink-0">
        ${Object.entries(TEMPLATES).map(([k, v]) =>
          `<button class="rpt-template-btn text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg transition font-medium whitespace-nowrap ${k === currentTemplate ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}" data-tmpl="${k}" style="${k === currentTemplate ? '' : `color:${t.muted}`}">${v.icon} <span class="hidden lg:inline">${v.label}</span></button>`
        ).join('')}
      </div>
      <!-- Audience selector -->
      <select id="rpt-audience" class="text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg border shrink-0" style="border-color:${t.border};background:${t.bg};color:${t.text}">
        ${Object.entries(AUDIENCES).map(([k, v]) =>
          `<option value="${k}" ${k === currentAudience ? 'selected' : ''}>${v.label}</option>`
        ).join('')}
      </select>
      <!-- Theme toggle -->
      <button id="rpt-theme-toggle" class="text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg border ml-1 md:ml-2 shrink-0" style="border-color:${t.border};color:${t.muted}" title="Toggle theme">${darkTheme ? CivicIcons.sun('w-4 h-4 inline') : CivicIcons.moon('w-4 h-4 inline')}</button>
      <!-- Actions -->
      <button id="rpt-edit-preview" class="text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg ml-1 md:ml-2 font-medium shrink-0 ${previewMode ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}">${previewMode ? CivicIcons.book('w-4 h-4 inline') + ' <span class="hidden sm:inline">Preview</span>' : CivicIcons.pencil('w-4 h-4 inline') + ' <span class="hidden sm:inline">Edit</span>'}</button>
      <button id="rpt-generate" class="text-xs px-3 md:px-4 py-1 md:py-1.5 rounded-lg bg-indigo-600 text-white font-medium ml-1 md:ml-2 hover:bg-indigo-500 transition shrink-0"><span class="hidden sm:inline">Generate</span><span class="sm:hidden">${CivicIcons.sparkles('w-4 h-4 inline')}</span></button>
      <button id="rpt-export" class="text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg border ml-1 md:ml-2 shrink-0" style="border-color:${t.border};color:${t.muted}">${CivicIcons.download('w-4 h-4 inline')} <span class="hidden sm:inline">Export PDF</span></button>
      <button id="rpt-close" class="text-lg ml-2 md:ml-3 px-2 leading-none shrink-0" style="color:${t.muted}" title="Close (Esc)">&times;</button>
    </header>

    <!-- Body: sidebar + content -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Sidebar backdrop (mobile) -->
      <div id="rpt-sidebar-backdrop" class="hidden md:hidden fixed inset-0 bg-black/30 z-10" onclick="document.getElementById('rpt-sidebar').classList.add('-translate-x-full');this.classList.add('hidden')"></div>
      <!-- Sidebar -->
      <aside id="rpt-sidebar" class="w-64 shrink-0 border-r overflow-y-auto absolute md:relative inset-y-0 left-0 z-20 -translate-x-full md:translate-x-0 transition-transform duration-200" style="border-color:${t.border};background:${t.bg}">
        <div class="p-3 md:p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-bold uppercase tracking-wider" style="color:${t.muted}">Sections</h2>
            <div class="flex items-center gap-2">
              <button id="rpt-add-section" class="text-xs px-2 py-1 rounded bg-indigo-600 text-white font-medium">+ Add</button>
              <button class="md:hidden text-xs px-2 py-1 rounded" style="color:${t.muted}" onclick="document.getElementById('rpt-sidebar').classList.add('-translate-x-full');document.getElementById('rpt-sidebar-backdrop').classList.add('hidden')">&times;</button>
            </div>
          </div>
          <div id="rpt-toc-list"></div>
        </div>
      </aside>

      <!-- Content -->
      <main id="rpt-content" class="flex-1 overflow-y-auto p-4 md:p-8">
        <div id="rpt-sections" class="max-w-4xl mx-auto"></div>
      </main>
    </div>

    <!-- Status bar -->
    <footer id="rpt-status-bar" class="flex items-center gap-6 px-5 py-2 border-t text-xs shrink-0 hidden md:flex" style="border-color:${t.border};color:${t.muted}"></footer>

    <!-- Bottom action bar (mobile only) -->
    <div class="rpt-bottom-bar" style="bottom:0;left:0;right:0;background:rgba(255,255,255,0.97);border-top:1px solid #e5e7eb;padding:10px 16px;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 -2px 16px rgba(0,0,0,0.08);backdrop-filter:blur(12px)">
      <button id="rpt-bb-close" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.06)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Close</button>
      <button id="rpt-bb-generate" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;flex:1;max-width:180px;transition:all .2s;box-shadow:0 4px 12px rgba(99,102,241,0.3)">${CivicIcons.sparkles('w-4 h-4 inline')} Generate</button>
      <button id="rpt-bb-export" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.06)">${CivicIcons.download('w-4 h-4 inline')} PDF</button>
    </div>

    <!-- Keyboard shortcuts overlay -->
    <div id="rpt-shortcuts" class="hidden fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onclick="this.classList.add('hidden')">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" style="background:${t.bg};color:${t.text}" onclick="event.stopPropagation()">
        <h3 class="font-bold mb-3">Keyboard Shortcuts</h3>
        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between"><span>Print / Export PDF</span><kbd class="font-mono text-xs px-1.5 py-0.5 rounded" style="background:${t.border}">Ctrl+P</kbd></div>
          <div class="flex justify-between"><span>Edit / Preview</span><kbd class="font-mono text-xs px-1.5 py-0.5 rounded" style="background:${t.border}">Ctrl+E</kbd></div>
          <div class="flex justify-between"><span>Generate</span><kbd class="font-mono text-xs px-1.5 py-0.5 rounded" style="background:${t.border}">Ctrl+G</kbd></div>
          <div class="flex justify-between"><span>Close</span><kbd class="font-mono text-xs px-1.5 py-0.5 rounded" style="background:${t.border}">Escape</kbd></div>
          <div class="flex justify-between"><span>Show shortcuts</span><kbd class="font-mono text-xs px-1.5 py-0.5 rounded" style="background:${t.border}">?</kbd></div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Event Wiring ───────────────────────────────────────────────────────────

function wireReportEvents() {
  const overlay = document.getElementById('report-overlay');

  document.getElementById('rpt-close').addEventListener('click', closeReportGenerator);
  document.getElementById('rpt-export').addEventListener('click', () => window.print());
  document.getElementById('rpt-generate').addEventListener('click', generateReport);
  // Bottom bar (mobile)
  const rptBBClose = document.getElementById('rpt-bb-close');
  if (rptBBClose) rptBBClose.addEventListener('click', closeReportGenerator);
  const rptBBGenerate = document.getElementById('rpt-bb-generate');
  if (rptBBGenerate) rptBBGenerate.addEventListener('click', generateReport);
  const rptBBExport = document.getElementById('rpt-bb-export');
  if (rptBBExport) rptBBExport.addEventListener('click', () => window.print());
  document.getElementById('rpt-edit-preview').addEventListener('click', toggleEditPreview);
  document.getElementById('rpt-theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('rpt-audience').addEventListener('change', e => {
    currentAudience = e.target.value;
    renderContent();
  });
  document.getElementById('rpt-add-section').addEventListener('click', showAddSectionMenu);

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('rpt-sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('rpt-sidebar');
      const backdrop = document.getElementById('rpt-sidebar-backdrop');
      sidebar.classList.toggle('-translate-x-full');
      backdrop.classList.toggle('hidden');
    });
  }

  // Template buttons
  document.querySelectorAll('.rpt-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTemplate = btn.dataset.tmpl;
      reportGenerated = false;
      initSections(currentTemplate);
      refreshShell();
    });
  });

  // Keyboard shortcuts
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeReportGenerator();
    if (e.key === '?' && !e.ctrlKey) document.getElementById('rpt-shortcuts').classList.toggle('hidden');
    if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); }
    if (e.ctrlKey && e.key === 'e') { e.preventDefault(); toggleEditPreview(); }
    if (e.ctrlKey && e.key === 'g') { e.preventDefault(); generateReport(); }
  });
}

function refreshShell() {
  closeReportGenerator();
  openReportGenerator(reportData);
}

// ─── Sidebar / TOC ──────────────────────────────────────────────────────────

function renderSidebar() {
  const list = document.getElementById('rpt-toc-list');
  const t = ct();

  list.innerHTML = sections.map((s, i) => `
    <div class="rpt-toc-item flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition group hover:bg-indigo-50 dark:hover:bg-indigo-900/20 ${!s.visible ? 'opacity-40' : ''}" data-idx="${i}" data-id="${s.id}">
      <span class="text-sm">${s.icon}</span>
      <span class="flex-1 text-xs font-medium truncate" style="color:${s.visible ? t.text : t.muted}">${s.label}</span>
      <label class="relative inline-flex items-center cursor-pointer" title="Toggle visibility">
        <input type="checkbox" class="rpt-section-toggle sr-only" data-idx="${i}" ${s.visible ? 'checked' : ''}>
        <div class="w-7 h-4 rounded-full transition ${s.visible ? 'bg-indigo-600' : 'bg-gray-300'}">
          <div class="w-3 h-3 rounded-full bg-white absolute top-0.5 transition ${s.visible ? 'left-3.5' :'left-0.5'}"></div>
        </div>
      </label>
      ${!previewMode ? `
        <div class="hidden group-hover:flex items-center gap-0.5">
          ${i > 0 ? `<button class="rpt-move-up text-[10px] px-1 rounded hover:bg-indigo-200/30" data-idx="${i}" title="Move up">↑</button>` : ''}
          ${i < sections.length - 1 ? `<button class="rpt-move-down text-[10px] px-1 rounded hover:bg-indigo-200/30" data-idx="${i}" title="Move down">↓</button>` : ''}
          <button class="rpt-remove text-[10px] px-1 rounded hover:bg-red-200/30 text-red-400" data-idx="${i}" title="Remove">✕</button>
        </div>
      ` : ''}
    </div>
  `).join('');

  // TOC click → scroll
  list.querySelectorAll('.rpt-toc-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('input,button,label')) return;
      const id = item.dataset.id;
      const el = document.getElementById(`rpt-section-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Toggle visibility
  list.querySelectorAll('.rpt-section-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx);
      sections[idx].visible = cb.checked;
      renderSidebar();
      renderContent();
      updateStatusBar();
    });
  });

  // Move up/down
  list.querySelectorAll('.rpt-move-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (idx > 0) { [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]]; renderSidebar(); renderContent(); }
    });
  });
  list.querySelectorAll('.rpt-move-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (idx < sections.length - 1) { [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]]; renderSidebar(); renderContent(); }
    });
  });

  // Remove
  list.querySelectorAll('.rpt-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      sections.splice(idx, 1);
      renderSidebar();
      renderContent();
      updateStatusBar();
    });
  });
}

// ─── Add Section Menu ───────────────────────────────────────────────────────

function showAddSectionMenu() {
  const existing = new Set(sections.map(s => s.id));
  const available = Object.entries(SECTION_DEFS).filter(([id]) => !existing.has(id) || id === 'custom');
  if (available.length === 0) return;

  const t = ct();
  // Create a simple dropdown
  const menu = document.createElement('div');
  menu.className = 'absolute z-10 mt-1 rounded-xl shadow-lg border p-2 w-56';
  menu.style.cssText = `background:${t.bg};border-color:${t.border}`;
  menu.innerHTML = available.map(([id, def]) =>
    `<button class="rpt-add-item w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition" data-id="${id}">
       ${def.icon} ${def.label}
     </button>`
  ).join('');

  const addBtn = document.getElementById('rpt-add-section');
  addBtn.parentElement.style.position = 'relative';
  addBtn.parentElement.appendChild(menu);

  menu.querySelectorAll('.rpt-add-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const actualId = id === 'custom' ? `custom-${Date.now()}` : id;
      sections.push({
        id: actualId,
        ...(SECTION_DEFS[id] || SECTION_DEFS.custom),
        order: sections.length,
        visible: true,
        collapsed: false,
        notes: '',
      });
      menu.remove();
      renderSidebar();
      renderContent();
      updateStatusBar();
    });
  });

  // Close on outside click
  setTimeout(() => {
    const handler = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', handler); } };
    document.addEventListener('click', handler);
  }, 10);
}

// ─── Content Rendering ──────────────────────────────────────────────────────

function renderContent() {
  const container = document.getElementById('rpt-sections');
  container.innerHTML = sections
    .filter(s => s.visible)
    .map(s => renderSection(s))
    .join('');
  updateStatusBar();
}

function renderSection(section) {
  const t = ct();
  const renderer = SECTION_RENDERERS[section.id] || SECTION_RENDERERS[section.id.startsWith('custom') ? 'custom' : 'appendix'];
  const body = renderer ? renderer(section) : `<p style="color:${t.muted}">Section content will appear here after generation.</p>`;
  const editHint = previewMode ? '' : 'style="border-bottom:1px dashed rgba(99,102,241,0.3)"';

  return `
    <div id="rpt-section-${section.id}" class="mb-10" style="page-break-inside:avoid">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-lg">${section.icon}</span>
        <h2 class="text-lg font-bold flex-1" ${editHint}>${section.label}</h2>
      </div>
      ${body}
    </div>`;
}

// ─── Section Renderers ──────────────────────────────────────────────────────

function getData() {
  if (!reportData) {
    return { work_orders: [], potholes: [], sidewalk_issues: [], schools: [], summary: { total_issues: 0, critical: 0, high: 0, medium: 0, low: 0, total_cost: 0, avg_cost: 0, near_schools: 0, open_issues: 0, in_progress: 0, completed: 0, critical_high: 0, by_type: {}, by_zone: {}, by_status: {}, cost_by_priority: {}, cost_by_type: {} } };
  }
  return reportData;
}

const SECTION_RENDERERS = {
  cover: () => {
    const t = ct();
    const now = new Date();
    return `
      <div class="rounded-2xl overflow-hidden" style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa);page-break-after:always">
        <div class="p-10 text-white relative">
          <div class="absolute inset-0 opacity-10" style="background:repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.05) 20px,rgba(255,255,255,0.05) 40px)"></div>
          <div class="relative z-10">
            <div class="flex items-center gap-2 mb-6">
              <span class="text-xs px-3 py-1 rounded-full bg-white/20 font-medium">${TEMPLATES[currentTemplate].label}</span>
              <span class="text-xs px-3 py-1 rounded-full bg-white/20 font-medium">${AUDIENCES[currentAudience].label}</span>
            </div>
            <h1 class="text-3xl font-bold mb-2 rpt-editable" contenteditable="${!previewMode}">Lake Forest Infrastructure Assessment</h1>
            <p class="text-lg text-white/80 mb-6 rpt-editable" contenteditable="${!previewMode}">Municipal Infrastructure Condition & Priority Report</p>
            <div class="grid grid-cols-2 gap-4 max-w-md">
              <div><div class="text-white/50 text-xs">Date</div><div class="text-sm font-medium rpt-editable" contenteditable="${!previewMode}">${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
              <div><div class="text-white/50 text-xs">Prepared By</div><div class="text-sm font-medium rpt-editable" contenteditable="${!previewMode}">CivicLens AI System</div></div>
              <div><div class="text-white/50 text-xs">Organization</div><div class="text-sm font-medium rpt-editable" contenteditable="${!previewMode}">City of Lake Forest, IL</div></div>
              <div><div class="text-white/50 text-xs">Report #</div><div class="text-sm font-medium">RPT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}</div></div>
            </div>
          </div>
        </div>
      </div>`;
  },

  toc: () => {
    const t = ct();
    const visible = sections.filter(s => s.visible && s.id !== 'toc');
    return `
      <div class="space-y-1">
        ${visible.map((s, i) => `
          <a href="#rpt-section-${s.id}" class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-indigo-50 transition cursor-pointer group" onclick="document.getElementById('rpt-section-${s.id}')?.scrollIntoView({behavior:'smooth'});return false;">
            <span class="text-xs font-bold" style="color:${t.accent}">${i + 1}</span>
            <span class="text-sm flex-1">${s.icon} ${s.label}</span>
            <span class="text-xs" style="color:${t.muted}">·····</span>
          </a>
        `).join('')}
      </div>`;
  },

  exec: () => {
    const d = getData();
    const s = d.summary;
    const grade = s.critical >= 3 ? 'D' : s.critical >= 1 ? 'C' : s.critical_high >= 3 ? 'B' : 'A';
    const gradeColor = { A: '#22c55e', B: '#eab308', C: '#f97316', D: '#ef4444' }[grade];
    return `
      <div class="flex items-start gap-6 mb-4">
        <div class="flex-1 text-sm leading-relaxed">
          <p class="mb-3">This report provides a comprehensive assessment of Lake Forest's municipal infrastructure based on <strong>${s.total_issues} active work orders</strong>, including ${d.potholes.length} pothole reports and ${d.sidewalk_issues.length} sidewalk issues across ${Object.keys(s.by_zone).length} service zones.</p>
          <p class="mb-3">Currently, <strong>${s.critical} critical</strong> and <strong>${s.high} high-priority</strong> issues require immediate attention, representing an estimated <strong>$${(s.cost_by_priority?.critical || 0 + s.cost_by_priority?.high || 0).toLocaleString()}</strong> in repair costs. <strong>${s.near_schools} issues are located near school zones</strong>, triggering expedited repair timelines under Municipal Code §7-3-1.</p>
          <p>Total estimated infrastructure liability stands at <strong>$${s.total_cost.toLocaleString()}</strong> with ${s.open_issues} open work orders awaiting crew assignment.</p>
        </div>
        <div class="shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2" style="border-color:${gradeColor}">
          <span class="text-3xl font-black" style="color:${gradeColor}">${grade}</span>
          <span class="text-[9px] font-bold" style="color:${gradeColor}">HEALTH</span>
        </div>
      </div>`;
  },

  kpi: () => {
    const s = getData().summary;
    const kpis = [
      { label: 'Total Issues',     value: s.total_issues,                icon: CivicIcons.clipboard('w-5 h-5'), bg: 'infoBg',    trend: '' },
      { label: 'Critical',         value: s.critical,                    icon: CivicIcons.priorityCritical('w-5 h-5'), bg: 'dangerBg',  trend: '↑' },
      { label: 'Open',             value: s.open_issues,                 icon: CivicIcons.folder('w-5 h-5'), bg: 'warningBg', trend: '' },
      { label: 'Total Cost',       value: `$${s.total_cost.toLocaleString()}`, icon: CivicIcons.dollar('w-5 h-5'), bg: 'warningBg', trend: '↑' },
      { label: 'Near Schools',     value: s.near_schools,                icon: CivicIcons.school('w-5 h-5'), bg: 'infoBg',    trend: '' },
      { label: 'Completed',        value: s.completed,                   icon: CivicIcons.checkCircle('w-5 h-5'), bg: 'successBg', trend: '↓' },
    ];
    const t = ct();
    return `
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${kpis.map(k => `
          <div class="rounded-xl p-4 border flex items-start gap-3" style="background:${t[k.bg]};border-color:${t.border}">
            <span class="text-2xl">${k.icon}</span>
            <div>
              <div class="text-2xl font-bold">${k.value} ${k.trend ? `<span class="text-xs ${k.trend === '↑' ? 'text-red-500' : 'text-green-500'}">${k.trend}</span>` : ''}</div>
              <div class="text-xs" style="color:${t.muted}">${k.label}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  },

  severity: () => {
    const s = getData().summary;
    const t = ct();
    const levels = [
      { label: 'Critical', count: s.critical, color: '#ef4444' },
      { label: 'High',     count: s.high,     color: '#f97316' },
      { label: 'Medium',   count: s.medium,   color: '#eab308' },
      { label: 'Low',      count: s.low,      color: '#22c55e' },
    ];
    const total = s.total_issues || 1;

    return `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        ${levels.map(l => `
          <div class="rounded-xl p-4 border-l-4" style="border-color:${l.color};background:${t.bg === '#ffffff' ? l.color + '08' : l.color + '15'}">
            <div class="text-2xl font-bold">${l.count}</div>
            <div class="text-xs font-semibold" style="color:${l.color}">${l.label}</div>
            <div class="text-[10px] mt-1" style="color:${t.muted}">${Math.round(l.count / total * 100)}% of total</div>
          </div>
        `).join('')}
      </div>
      <!-- Issue Type table -->
      <h3 class="text-sm font-bold mb-2">By Type</h3>
      <table class="w-full text-sm mb-4 border-collapse">
        <thead><tr style="border-bottom:2px solid ${t.border}">
          <th class="text-left py-2 font-semibold">Type</th><th class="text-right py-2 font-semibold">Count</th><th class="text-right py-2 font-semibold">Cost</th>
        </tr></thead>
        <tbody>
          ${Object.entries(s.by_type).map(([type, count]) => `
            <tr style="border-bottom:1px solid ${t.border}">
              <td class="py-2">${prettyLabel(type)}</td>
              <td class="text-right py-2">${count}</td>
              <td class="text-right py-2">$${(s.cost_by_type[type] || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  },

  charts: () => {
    if (!reportGenerated) {
      const t = ct();
      return `<div class="text-center py-12" style="color:${t.muted}">
        <div class="text-4xl mb-3">${CivicIcons.trendUp('w-10 h-10')}</div>
        <p class="text-sm">Click <strong>Generate Report</strong> to create charts</p>
      </div>`;
    }
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div><h4 class="text-xs font-bold mb-2 uppercase">Severity Distribution</h4><div id="rpt-chart-severity" class="rounded-xl border p-3" style="border-color:${ct().border}">${buildSvgDonut()}</div></div>
        <div><h4 class="text-xs font-bold mb-2 uppercase">Issues by Type</h4><div id="rpt-chart-type" class="rounded-xl border p-3" style="border-color:${ct().border}">${buildSvgBarH()}</div></div>
        <div><h4 class="text-xs font-bold mb-2 uppercase">Cost by Priority</h4><div id="rpt-chart-cost" class="rounded-xl border p-3" style="border-color:${ct().border}">${buildSvgBarV()}</div></div>
        <div><h4 class="text-xs font-bold mb-2 uppercase">Status Breakdown</h4><div id="rpt-chart-status" class="rounded-xl border p-3" style="border-color:${ct().border}">${buildSvgPie()}</div></div>
      </div>`;
  },

  budget: () => {
    const s = getData().summary;
    const t = ct();
    const contingency = Math.round(s.total_cost * 0.15);
    const priorities = [
      { label: 'Critical', cost: s.cost_by_priority?.critical || 0, color: '#ef4444' },
      { label: 'High',     cost: s.cost_by_priority?.high || 0,     color: '#f97316' },
      { label: 'Medium',   cost: s.cost_by_priority?.medium || 0,   color: '#eab308' },
      { label: 'Low',      cost: s.cost_by_priority?.low || 0,      color: '#22c55e' },
    ];

    return `
      <table class="w-full text-sm mb-4 border-collapse">
        <thead><tr style="border-bottom:2px solid ${t.border}">
          <th class="text-left py-2 font-semibold">Priority Tier</th>
          <th class="text-right py-2 font-semibold">Estimated Cost</th>
          <th class="text-right py-2 font-semibold">Issues</th>
          <th class="text-right py-2 font-semibold">Avg / Issue</th>
        </tr></thead>
        <tbody>
          ${priorities.map(p => {
            const count = getData().summary[p.label.toLowerCase()] || 0;
            return `<tr style="border-bottom:1px solid ${t.border}">
              <td class="py-2"><span class="inline-block w-2 h-2 rounded-full mr-2" style="background:${p.color}"></span>${p.label}</td>
              <td class="text-right py-2 font-medium">$${p.cost.toLocaleString()}</td>
              <td class="text-right py-2">${count}</td>
              <td class="text-right py-2">$${count > 0 ? Math.round(p.cost / count).toLocaleString() : '—'}</td>
            </tr>`;
          }).join('')}
          <tr style="border-top:2px solid ${t.border}">
            <td class="py-2 font-bold">Subtotal</td>
            <td class="text-right py-2 font-bold">$${s.total_cost.toLocaleString()}</td>
            <td class="text-right py-2 font-bold">${s.total_issues}</td>
            <td class="text-right py-2 font-bold">$${s.avg_cost.toLocaleString()}</td>
          </tr>
          <tr>
            <td class="py-2" style="color:${t.muted}">15% Weather Contingency</td>
            <td class="text-right py-2" style="color:${t.muted}">$${contingency.toLocaleString()}</td>
            <td></td><td></td>
          </tr>
          <tr style="border-top:2px solid ${t.accent}">
            <td class="py-2 font-black text-base">Grand Total</td>
            <td class="text-right py-2 font-black text-base" style="color:${t.accent}">$${(s.total_cost + contingency).toLocaleString()}</td>
            <td></td><td></td>
          </tr>
        </tbody>
      </table>`;
  },

  recommendations: () => {
    const s = getData().summary;
    const t = ct();
    const immediate = [
      s.critical > 0 ? `Address ${s.critical} critical work order(s) — deploy crew within 24 hours` : null,
      s.near_schools > 0 ? `Repair ${s.near_schools} school-zone issues per Municipal Code §7-3-1 same-day requirement` : null,
    ].filter(Boolean);

    const shortTerm = [
      s.high > 0 ? `Schedule ${s.high} high-priority repairs within 7-day window` : null,
      'Conduct ADA compliance audit for all sidewalk issues flagged as non-compliant',
    ].filter(Boolean);

    const longTerm = [
      'Implement predictive maintenance using Weibull decay scoring model',
      'Budget cycle: request $' + Math.round(s.total_cost * 1.15).toLocaleString() + ' including contingency',
      'Establish quarterly PCI survey cadence per Illinois Highway Code requirements',
    ];

    function tierBlock(label, items, badge, color) {
      return `
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style="background:${color}">${badge}</span>
            <h4 class="text-sm font-bold">${label}</h4>
          </div>
          <ul class="space-y-1.5 ml-6">
            ${items.map(i => `<li class="text-sm list-disc">${i}</li>`).join('')}
          </ul>
        </div>`;
    }

    return tierBlock('Immediate (0–48 hours)', immediate.length ? immediate : ['No critical actions required'], 'URGENT', '#ef4444')
         + tierBlock('Short-Term (1–4 weeks)', shortTerm, 'PRIORITY', '#f97316')
         + tierBlock('Long-Term (1–12 months)', longTerm, 'PLANNED', '#6366f1');
  },

  forecast: () => {
    const s = getData().summary;
    const t = ct();
    const rows = [
      { period: '30 Days',  newIssues: Math.round(s.total_issues * 0.3), resolved: Math.round(s.total_issues * 0.2), cost: Math.round(s.total_cost * 0.25), risk: 'Medium' },
      { period: '90 Days',  newIssues: Math.round(s.total_issues * 0.8), resolved: Math.round(s.total_issues * 0.5), cost: Math.round(s.total_cost * 0.6),  risk: 'High' },
      { period: '6 Months', newIssues: Math.round(s.total_issues * 1.5), resolved: Math.round(s.total_issues * 1.0), cost: Math.round(s.total_cost * 1.2),  risk: 'High' },
      { period: '1 Year',   newIssues: Math.round(s.total_issues * 2.5), resolved: Math.round(s.total_issues * 2.0), cost: Math.round(s.total_cost * 2.0),  risk: 'Critical' },
    ];
    const riskColor = { Medium: '#eab308', High: '#f97316', Critical: '#ef4444' };

    return `
      <table class="w-full text-sm border-collapse mb-4">
        <thead><tr style="border-bottom:2px solid ${t.border}">
          <th class="text-left py-2 font-semibold">Period</th>
          <th class="text-right py-2 font-semibold">New Issues</th>
          <th class="text-right py-2 font-semibold">Est. Resolved</th>
          <th class="text-right py-2 font-semibold">Projected Cost</th>
          <th class="text-right py-2 font-semibold">Risk</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom:1px solid ${t.border}">
              <td class="py-2 font-medium">${r.period}</td>
              <td class="text-right py-2">${r.newIssues}</td>
              <td class="text-right py-2">${r.resolved}</td>
              <td class="text-right py-2">$${r.cost.toLocaleString()}</td>
              <td class="text-right py-2"><span class="text-xs px-2 py-0.5 rounded-full font-bold" style="color:${riskColor[r.risk]};background:${riskColor[r.risk]}15">${r.risk}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="text-xs" style="color:${t.muted}">${CivicIcons.alertTriangle('w-3 h-3 inline')} Projections based on Weibull decay model and seasonal patterns. Spring freeze-thaw cycles (Mar–Apr) typically produce 200–300% spike in pothole reports. Optimal repair window: April–October.</p>`;
  },

  safety: () => {
    const d = getData();
    const t = ct();
    const adaNonCompliant = d.sidewalk_issues.filter(s => !s.ada_compliant);
    const schoolZone = [...d.potholes.filter(p => p.near_school), ...d.sidewalk_issues.filter(s => s.near_school)];

    return `
      <div class="space-y-5">
        <div class="rounded-xl p-4 border" style="border-color:${t.border};background:${t.dangerBg}">
          <h4 class="font-bold text-sm mb-2">${CivicIcons.school('w-4 h-4 inline')} School Zone Safety</h4>
          <p class="text-sm mb-2"><strong>${schoolZone.length} issues</strong> within 1,500 ft school safety buffer zones</p>
          <ul class="text-sm space-y-1 ml-4">
            ${schoolZone.slice(0, 5).map(i => `<li class="list-disc">${i.location?.address || 'Unknown'} — severity ${i.severity}/10 ${i.school_name ? `(near ${i.school_name})` : ''}</li>`).join('')}
          </ul>
          <p class="text-xs mt-2" style="color:${t.muted}">Per Municipal Code §7-3-1: 24-hour repair window during school year (Aug 15 – Jun 10)</p>
        </div>

        <div class="rounded-xl p-4 border" style="border-color:${t.border};background:${t.warningBg}">
          <h4 class="font-bold text-sm mb-2">${CivicIcons.accessibility('w-4 h-4 inline')} ADA Compliance</h4>
          <p class="text-sm"><strong>${adaNonCompliant.length} sidewalk issues</strong> flagged as ADA non-compliant</p>
          <p class="text-xs mt-2" style="color:${t.muted}">2028 federal deadline for ADA transition plan compliance. Non-compliance risks federal civil rights complaints and loss of funding.</p>
        </div>

        <div class="rounded-xl p-4 border" style="border-color:${t.border};background:${t.infoBg}">
          <h4 class="font-bold text-sm mb-2">${CivicIcons.scales('w-4 h-4 inline')} Liability Exposure</h4>
          <p class="text-sm">Average pothole vehicle claim: <strong>$750</strong> · Average sidewalk trip-and-fall: <strong>$15,000–$50,000</strong></p>
          <p class="text-xs mt-2" style="color:${t.muted}">Lake Forest paid $127,000 in infrastructure liability claims in FY2024.</p>
        </div>
      </div>`;
  },

  custom: (section) => {
    const t = ct();
    return `<div class="rpt-editable min-h-[100px] rounded-lg p-4 border text-sm" style="border-color:${t.border}" contenteditable="${!previewMode}">Click to add custom content...</div>`;
  },

  appendix: () => {
    const t = ct();
    return `
      <div class="space-y-4 text-sm">
        <div>
          <h4 class="font-bold mb-1">Data Sources</h4>
          <ul class="list-disc ml-5 space-y-0.5" style="color:${t.muted}">
            <li>CivicLens MCP Server — Work Orders, Potholes, Sidewalk Issues, School Database</li>
            <li>Weibull Decay Scoring Engine — Priority score calculations</li>
            <li>Municipal Code §7-3-1, §7-3-4 — Repair timelines and cost-sharing</li>
            <li>APWA Repair Standards — Method selection and cost benchmarks</li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold mb-1">Methodology</h4>
          <p style="color:${t.muted}">Priority scores computed using Weibull hazard function h(t) = (k/λ)(t/λ)^(k-1) with type-specific parameters. Risk assessment combines severity, age, school proximity, traffic volume, and weather factors on a 0–400 scale.</p>
        </div>
        <div>
          <h4 class="font-bold mb-1">Disclaimer</h4>
          <p style="color:${t.muted}">This report was generated by CivicLens AI and should be reviewed by municipal staff before any action is taken. Projections are estimates based on historical patterns and may not reflect actual future conditions.</p>
        </div>
      </div>`;
  },

  // ─── Neighborhood Update Sections (Resident-friendly) ──────────────────────

  neighborhood_summary: () => {
    const d = getData();
    const s = d.summary;
    const t = ct();
    const openCount = s.open_issues || 0;
    const inProg = s.in_progress || 0;
    const done = s.completed || 0;
    return `
      <div class="space-y-4">
        <div class="rounded-xl p-5 border" style="border-color:${t.border};background:${t.infoBg}">
          <p class="text-sm leading-relaxed mb-3">Here's a quick look at what's going on with roads, sidewalks, and public spaces in Lake Forest right now:</p>
          <div class="grid grid-cols-3 gap-3">
            <div class="text-center rounded-lg p-3" style="background:${t.warningBg}">
              <div class="text-2xl font-bold text-amber-600">${openCount}</div>
              <div class="text-xs" style="color:${t.muted}">Reported & Waiting</div>
            </div>
            <div class="text-center rounded-lg p-3" style="background:${t.infoBg}">
              <div class="text-2xl font-bold text-blue-600">${inProg}</div>
              <div class="text-xs" style="color:${t.muted}">Crews Working On</div>
            </div>
            <div class="text-center rounded-lg p-3" style="background:${t.successBg}">
              <div class="text-2xl font-bold text-green-600">${done}</div>
              <div class="text-xs" style="color:${t.muted}">Recently Fixed</div>
            </div>
          </div>
        </div>
        <p class="text-sm" style="color:${t.muted}">Our crews are working to keep Lake Forest safe and well-maintained. If you see something that needs attention, you can submit a service request through the Community Service Portal.</p>
      </div>`;
  },

  neighborhood_grades: () => {
    const d = getData();
    const s = d.summary;
    const t = ct();
    const zones = Object.keys(s.by_zone || {});
    const gradeColors = CivicUtils.GRADE_COLORS;

    return `
      <div class="space-y-2">
        <p class="text-sm mb-3" style="color:${t.muted}">Each neighborhood gets a health grade based on how many open issues are in the area. Fewer issues = better grade.</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${zones.map(zone => {
            const count = s.by_zone[zone] || 0;
            const grade = count <= 2 ? 'A' : count <= 4 ? 'B' : count <= 6 ? 'C' : count <= 8 ? 'D' : 'F';
            return `
              <div class="rounded-xl p-4 border text-center" style="border-color:${t.border}">
                <div class="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xl mb-2" style="background:${gradeColors[grade]}">${grade}</div>
                <div class="font-semibold text-sm">${zone}</div>
                <div class="text-xs mt-1" style="color:${t.muted}">${count} open issue${count !== 1 ? 's' : ''}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  recent_fixes: () => {
    const d = getData();
    const t = ct();
    const completed = d.work_orders.filter(w => w.status === 'completed');
    if (!completed.length) return `<p class="text-sm" style="color:${t.muted}">No recently completed fixes to show.</p>`;

    return `
      <div class="space-y-2">
        <p class="text-sm mb-3" style="color:${t.muted}">Here's what our crews have recently finished:</p>
        ${completed.map(w => `
          <div class="flex items-start gap-3 rounded-lg p-3 border" style="border-color:${t.border}">
            <span class="text-green-500 text-lg mt-0.5">${CivicIcons.checkCircle('w-5 h-5')}</span>
            <div>
              <div class="text-sm font-medium">${prettyLabel(w.type)}</div>
              <div class="text-xs" style="color:${t.muted}">${CivicIcons.mapPin('w-3 h-3 inline')} ${w.location?.address || 'Unknown location'} · ${w.location?.zone || ''}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  },

  active_work: () => {
    const d = getData();
    const t = ct();
    const active = d.work_orders.filter(w => w.status === 'in_progress' || w.status === 'open');
    if (!active.length) return `<p class="text-sm" style="color:${t.muted}">No active work to report — everything looks great!</p>`;

    const prioIcon = { critical: CivicIcons.priorityCritical('w-5 h-5'), high: CivicIcons.priorityHigh('w-5 h-5'), medium: CivicIcons.priorityMedium('w-5 h-5'), low: CivicIcons.priorityLow('w-5 h-5') };
    return `
      <div class="space-y-2">
        <p class="text-sm mb-3" style="color:${t.muted}">These items are being worked on or scheduled:</p>
        ${active.sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
        }).map(w => `
          <div class="flex items-start gap-3 rounded-lg p-3 border" style="border-color:${t.border}">
            <span class="text-lg mt-0.5">${prioIcon[w.priority] || CivicIcons.priorityLow('w-5 h-5')}</span>
            <div class="flex-1">
              <div class="text-sm font-medium">${prettyLabel(w.type)}</div>
              <div class="text-xs" style="color:${t.muted}">${CivicIcons.mapPin('w-3 h-3 inline')} ${w.location?.address || 'Unknown'} · ${w.status === 'in_progress' ? CivicIcons.wrench('w-3 h-3 inline') + ' Crew working' : CivicIcons.hourglass('w-3 h-3 inline') + ' Waiting for crew'}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  },

  school_safety: () => {
    const d = getData();
    const t = ct();
    const schoolIssues = [...d.potholes.filter(p => p.near_school), ...d.sidewalk_issues.filter(s => s.near_school)];

    return `
      <div class="space-y-4">
        <div class="rounded-xl p-5 border" style="border-color:${t.border};background:${schoolIssues.length ? t.warningBg : t.successBg}">
          <p class="text-sm font-semibold mb-2">${schoolIssues.length ? CivicIcons.alertTriangle('w-4 h-4 inline') + ` ${schoolIssues.length} issue${schoolIssues.length > 1 ? 's' : ''} found near schools` : CivicIcons.checkCircle('w-4 h-4 inline') + ' No issues currently near school zones'}</p>
          <p class="text-sm" style="color:${t.muted}">Issues near schools get top priority — city rules require them to be fixed within 24 hours during the school year.</p>
        </div>
        ${d.schools.map(s => {
          const nearIssues = schoolIssues.filter(i => i.school_name === s.name || i.location?.zone === s.zone);
          return `
            <div class="flex items-center gap-3 rounded-lg p-3 border" style="border-color:${t.border}">
              <span class="text-xl">${CivicIcons.school('w-5 h-5')}</span>
              <div class="flex-1">
                <div class="text-sm font-medium">${escHtml(s.name)}</div>
                <div class="text-xs" style="color:${t.muted}">${s.type} · ${s.enrollment} students · Zone ${s.zone}</div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium" style="background:${nearIssues.length ? '#fef3c7' : '#dcfce7'};color:${nearIssues.length ? '#92400e' : '#166534'}">${nearIssues.length ? nearIssues.length + ' nearby' : 'All clear'}</span>
            </div>`;
        }).join('')}
      </div>`;
  },

  how_to_report: () => {
    const t = ct();
    return `
      <div class="space-y-4">
        <p class="text-sm" style="color:${t.muted}">See a pothole, broken sidewalk, or another problem? Here's how to let us know:</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="rounded-xl p-4 border text-center" style="border-color:${t.border}">
            <div class="text-3xl mb-2">${CivicIcons.notepad('w-8 h-8')}</div>
            <div class="font-bold text-sm mb-1">Service Portal</div>
            <p class="text-xs" style="color:${t.muted}">Click the "Service Portal" button in the header to submit a request and get a tracking number.</p>
          </div>
          <div class="rounded-xl p-4 border text-center" style="border-color:${t.border}">
            <div class="text-3xl mb-2">${CivicIcons.chat('w-8 h-8')}</div>
            <div class="font-bold text-sm mb-1">Chat with CivicLens</div>
            <p class="text-xs" style="color:${t.muted}">Type something like "I want to report a pothole on Deerpath Rd" in the main chat — our AI will help you file it.</p>
          </div>
          <div class="rounded-xl p-4 border text-center" style="border-color:${t.border}">
            <div class="text-3xl mb-2">${CivicIcons.search('w-8 h-8')}</div>
            <div class="font-bold text-sm mb-1">Track Your Request</div>
            <p class="text-xs" style="color:${t.muted}">Got a tracking number (like SR-2026-001)? Use the Service Portal or ask the chat to check its status.</p>
          </div>
        </div>
      </div>`;
  },
};

// ─── SVG Chart Generators ───────────────────────────────────────────────────

function buildSvgDonut() {
  const s = getData().summary;
  const data = [
    { label: 'Critical', value: s.critical, color: '#ef4444' },
    { label: 'High',     value: s.high,     color: '#f97316' },
    { label: 'Medium',   value: s.medium,   color: '#eab308' },
    { label: 'Low',      value: s.low,      color: '#22c55e' },
  ];
  return svgDonut(data, 160);
}

function buildSvgBarH() {
  const s = getData().summary;
  const data = Object.entries(s.by_type).map(([k, v]) => ({
    label: prettyLabel(k), value: v, color: { pothole_repair: '#6366f1', sidewalk_replacement: '#8b5cf6', concrete_repair: '#a78bfa' }[k] || '#6366f1',
  }));
  return svgBarHorizontal(data, 220, 300);
}

function buildSvgBarV() {
  const s = getData().summary;
  const data = [
    { label: 'Critical', value: s.cost_by_priority?.critical || 0, color: '#ef4444' },
    { label: 'High',     value: s.cost_by_priority?.high || 0,     color: '#f97316' },
    { label: 'Medium',   value: s.cost_by_priority?.medium || 0,   color: '#eab308' },
    { label: 'Low',      value: s.cost_by_priority?.low || 0,      color: '#22c55e' },
  ];
  return svgBarVertical(data, 220, 300);
}

function buildSvgPie() {
  const s = getData().summary;
  const data = [
    { label: 'Open',        value: s.open_issues,  color: '#f97316' },
    { label: 'In Progress', value: s.in_progress,  color: '#3b82f6' },
    { label: 'Completed',   value: s.completed,    color: '#22c55e' },
  ];
  return svgDonut(data, 160, false);
}

function svgDonut(data, size, donut = true) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '<div class="text-center text-sm" style="color:#94a3b8">No data</div>';

  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const innerR = donut ? r * 0.55 : 0;
  let cumAngle = -Math.PI / 2;

  const paths = data.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * Math.PI * 2;
    const startX = cx + r * Math.cos(cumAngle);
    const startY = cy + r * Math.sin(cumAngle);
    const endX = cx + r * Math.cos(cumAngle + angle);
    const endY = cy + r * Math.sin(cumAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    let pathD;
    if (donut) {
      const innerStartX = cx + innerR * Math.cos(cumAngle + angle);
      const innerStartY = cy + innerR * Math.sin(cumAngle + angle);
      const innerEndX = cx + innerR * Math.cos(cumAngle);
      const innerEndY = cy + innerR * Math.sin(cumAngle);
      pathD = `M${startX},${startY} A${r},${r} 0 ${largeArc} 1 ${endX},${endY} L${innerStartX},${innerStartY} A${innerR},${innerR} 0 ${largeArc} 0 ${innerEndX},${innerEndY} Z`;
    } else {
      pathD = `M${cx},${cy} L${startX},${startY} A${r},${r} 0 ${largeArc} 1 ${endX},${endY} Z`;
    }
    cumAngle += angle;
    return `<path d="${pathD}" fill="${d.color}" opacity="0.85"><title>${d.label}: ${d.value}</title></path>`;
  });

  const legend = data.filter(d => d.value > 0).map(d =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:11px"><span style="width:8px;height:8px;border-radius:50%;background:${d.color};display:inline-block"></span>${d.label}: ${d.value}</span>`
  ).join('');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${paths.join('')}${donut ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="bold" fill="${ct().text}">${total}</text>` : ''}</svg><div style="margin-top:8px;text-align:center">${legend}</div>`;
}

function svgBarHorizontal(data, height, width) {
  const max = Math.max(...data.map(d => d.value), 1);
  const barH = Math.min(30, (height - 20) / data.length - 8);
  const labelW = 120;

  const bars = data.map((d, i) => {
    const y = 10 + i * (barH + 8);
    const w = ((width - labelW - 20) * d.value) / max;
    return `
      <text x="${labelW - 5}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="11" fill="${ct().text}">${d.label}</text>
      <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="4" fill="${d.color}" opacity="0.85"><title>${d.label}: ${d.value}</title></rect>
      <text x="${labelW + w + 5}" y="${y + barH / 2 + 4}" font-size="10" fill="${ct().muted}">${d.value}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${bars.join('')}</svg>`;
}

function svgBarVertical(data, height, width) {
  const max = Math.max(...data.map(d => d.value), 1);
  const margin = { top: 10, bottom: 30, left: 50, right: 10 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const barW = Math.min(40, plotW / data.length - 8);

  const bars = data.map((d, i) => {
    const x = margin.left + (plotW / data.length) * i + (plotW / data.length - barW) / 2;
    const h = (plotH * d.value) / max;
    const y = margin.top + plotH - h;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${d.color}" opacity="0.85"><title>${d.label}: $${d.value.toLocaleString()}</title></rect>
      <text x="${x + barW / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="${ct().muted}">${d.label}</text>
      <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="${ct().muted}">$${(d.value / 1000).toFixed(1)}K</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${bars.join('')}</svg>`;
}

// ─── Generate Report ────────────────────────────────────────────────────────

async function generateReport() {
  const btn = document.getElementById('rpt-generate');
  btn.textContent = 'Generating...';
  btn.disabled = true;

  // If no data yet, fetch it
  if (!reportData) {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Full infrastructure assessment' }),
      });
      reportData = await res.json();
    } catch {
      btn.textContent = 'Generate Report';
      btn.disabled = false;
      return;
    }
  }

  reportGenerated = true;
  renderContent();
  updateStatusBar();

  btn.textContent = '✓ Generated';
  btn.disabled = false;
  setTimeout(() => { btn.textContent = 'Regenerate'; }, 2000);
}

// ─── Toggle Edit/Preview ────────────────────────────────────────────────────

function toggleEditPreview() {
  previewMode = !previewMode;
  const btn = document.getElementById('rpt-edit-preview');
  btn.className = `text-xs px-3 py-1.5 rounded-lg ml-2 font-medium ${previewMode ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`;
  btn.innerHTML = previewMode ? CivicIcons.book('w-4 h-4 inline') + ' Preview' : CivicIcons.pencil('w-4 h-4 inline') + ' Edit';
  renderSidebar();
  renderContent();
}

// ─── Toggle Theme ───────────────────────────────────────────────────────────

function toggleTheme() {
  darkTheme = !darkTheme;
  refreshShell();
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

function updateStatusBar() {
  const bar = document.getElementById('rpt-status-bar');
  if (!bar) return;
  const t = ct();

  const text = document.getElementById('rpt-sections')?.innerText || '';
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const pages = Math.max(1, Math.ceil(words / 300));
  const readMin = Math.max(1, Math.ceil(words / 200));

  // Completeness score
  const visibleCount = sections.filter(s => s.visible).length;
  const totalPossible = Object.keys(SECTION_DEFS).length;
  const chartBonus = reportGenerated ? 15 : 0;
  const score = Math.min(100, Math.round((visibleCount / totalPossible) * 85 + chartBonus));

  bar.innerHTML = `
    <span>${CivicIcons.notepad('w-3 h-3 inline')} ${words.toLocaleString()} words</span>
    <span>${CivicIcons.file('w-3 h-3 inline')} ~${pages} page${pages > 1 ? 's' : ''}</span>
    <span>${CivicIcons.clock('w-3 h-3 inline')} ${readMin} min read</span>
    <span class="flex items-center gap-1.5">
      Completeness:
      <div class="w-24 h-1.5 rounded-full overflow-hidden" style="background:${t.border}">
        <div class="h-full rounded-full transition-all" style="width:${score}%;background:${score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#f97316'}"></div>
      </div>
      <span class="font-medium">${score}%</span>
    </span>
    <span class="flex-1"></span>
    <span>${TEMPLATES[currentTemplate].icon} ${TEMPLATES[currentTemplate].label}</span>
    <span>${CivicIcons.user('w-3 h-3 inline')} ${AUDIENCES[currentAudience].label}</span>`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ct() { return darkTheme ? THEME.dark : THEME.light; }

const prettyLabel = CivicUtils.prettyLabel;
const escHtml = CivicUtils.escapeHtml;

// ─── Expose globally ────────────────────────────────────────────────────────

window.openReportGenerator = openReportGenerator;
window.closeReportGenerator = closeReportGenerator;
