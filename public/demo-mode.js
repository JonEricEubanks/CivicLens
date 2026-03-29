/* ═══════════════════════════════════════════════════════════════
 *  CivicLens Demo Mode — auto-advancing guided tour
 *  Vanilla JS state machine (no React needed)
 * ═══════════════════════════════════════════════════════════════ */

const DEMO_STEPS = [
  { id: 'home',      label: 'Dashboard',        icon: 'home',        overlay: 'home',            durationMs: 7000,
    description: 'Real-time KPIs, severity heatmaps, and live data feeds — city health at a glance.' },
  { id: 'report',    label: 'Report Issue',      icon: 'add_circle',  overlay: 'service-portal',  durationMs: 9000,
    description: 'AI-guided issue reporting: smart category detection, photo upload, and auto map-pinning.' },
  { id: 'map',       label: 'Interactive Map',   icon: 'map',         overlay: 'map',             durationMs: 8000,
    description: 'Geospatial view with color-coded severity markers, school-zone proximity, and filtering.' },
  { id: 'insights',  label: 'AI Insights',       icon: 'insights',    overlay: 'insights',        durationMs: 9000,
    description: 'Multi-model AI generates narrative reports, Weibull forecasts, and budget impact analysis.' },
  { id: 'staff',     label: 'Staff Ops',         icon: 'admin_panel_settings', overlay: 'staff-ops', durationMs: 9000,
    description: 'Triage queue, work-order management, and AI chat — built for city operations teams.' },
  { id: 'dashboard', label: 'NLP Dashboard',     icon: 'dashboard',   overlay: 'dashboard',       durationMs: 9000,
    description: 'Natural-language query engine — ask questions and get interactive charts + KPIs instantly.' },
  { id: 'chat',      label: 'AI Chat',           icon: 'chat_bubble', overlay: 'chat',            durationMs: 8000,
    description: 'Multi-model AI chat: 4-model intent voting, 16 MCP tools, RAG-grounded responses.' },
];

/* ── State ── */
let _isRunning = false;
let _isPaused = false;
let _currentStep = -1;
let _progress = 0;

/* ── Timer refs ── */
let _timer = null;        // setTimeout for auto-advance
let _progInterval = null; // setInterval for progress bar
let _stepStart = 0;       // timestamp when current step began
let _remaining = 0;       // ms remaining when paused

/* ── Listeners ── */
const _listeners = new Set();

function _getState() {
  return {
    isRunning: _isRunning,
    isPaused: _isPaused,
    currentStepIndex: _currentStep,
    progress: _progress,
    steps: DEMO_STEPS,
    currentStep: _currentStep >= 0 ? DEMO_STEPS[_currentStep] : null,
  };
}

function _notify() {
  const s = _getState();
  _listeners.forEach(fn => fn(s));
}

function _clearTimers() {
  clearTimeout(_timer);
  clearInterval(_progInterval);
  _timer = null;
  _progInterval = null;
}

/* ── Close all open overlays so we start clean ── */
function _closeAllOverlays() {
  // Service Portal
  const civic = document.getElementById('civic-connect');
  if (civic) { civic.remove(); document.body.style.overflow = ''; }
  // NLP Dashboard
  if (typeof window.closeDashboard === 'function') window.closeDashboard();
  // Infrastructure Map
  if (typeof window.closeCivicMap === 'function') window.closeCivicMap();
  // Staff Ops
  const staffOpsPage = document.getElementById('staff-ops-page');
  const mainContent = document.querySelector('main.main-with-sidenav');
  if (staffOpsPage && staffOpsPage.style.display !== 'none') {
    staffOpsPage.style.display = 'none';
    if (mainContent) mainContent.style.display = '';
    window._staffOps?.closePage?.();
    const aiBtn = document.getElementById('ai-dashboard-nav');
    if (aiBtn) aiBtn.style.display = 'none';
  }
  // Insights
  if (typeof window.closeInsights === 'function') window.closeInsights();
  // Report Generator
  if (typeof window.closeReportGenerator === 'function') window.closeReportGenerator();
  // Chat — close only if open (detect via DOM since chatWidgetOpen is local)
  const chatWidget = document.getElementById('chat-widget');
  if (chatWidget && !chatWidget.classList.contains('hidden')) {
    window.toggleChatWidget?.();
  }
}

/* ── Navigate to a specific overlay ── */
function _openOverlay(overlayId) {
  _closeAllOverlays();

  // Small delay so close animations finish
  setTimeout(() => {
    switch (overlayId) {
      case 'home':
        // Scroll dashboard to top
        const dash = document.getElementById('dashboard-home');
        if (dash) dash.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'service-portal':
        window.openServicePortal?.();
        break;
      case 'map':
        window.openCivicMap?.();
        break;
      case 'insights':
        window.openInsights?.();
        break;
      case 'staff-ops':
        // Hide main content like sideNavTo does for staff-ops
        const mc = document.querySelector('main.main-with-sidenav');
        if (mc) mc.style.display = 'none';
        window._staffOps?.openPage?.();
        // Also show the AI Dashboard nav button since we're in staff context
        const aiBtn = document.getElementById('ai-dashboard-nav');
        if (aiBtn) aiBtn.style.display = '';
        break;
      case 'dashboard':
        window.openDashboard?.();
        break;
      case 'chat':
        const chatW = document.getElementById('chat-widget');
        const isOpen = chatW && !chatW.classList.contains('hidden');
        if (!isOpen) window.toggleChatWidget?.();
        break;
    }
  }, 250);
}

/* ═══════════════════════════════════════════════════════════════
 *  Core: goToStep
 * ═══════════════════════════════════════════════════════════════ */
function goToStep(index) {
  _clearTimers();

  if (index >= DEMO_STEPS.length) {
    stop();
    return;
  }
  if (index < 0) index = 0;

  const step = DEMO_STEPS[index];
  _currentStep = index;
  _progress = 0;
  _isPaused = false;
  _stepStart = Date.now();
  _remaining = step.durationMs;
  _notify();

  // Navigate
  _openOverlay(step.overlay);

  // Progress bar — update every 100ms
  _progInterval = setInterval(() => {
    const elapsed = Date.now() - _stepStart;
    _progress = Math.min(100, (elapsed / step.durationMs) * 100);
    _notify();
  }, 100);

  // Auto-advance
  _timer = setTimeout(() => goToStep(index + 1), step.durationMs);
}

/* ═══════════════════════════════════════════════════════════════
 *  Public API
 * ═══════════════════════════════════════════════════════════════ */
function start() {
  _isRunning = true;
  _isPaused = false;
  _notify();
  goToStep(0);
}

function stop() {
  _clearTimers();
  _isRunning = false;
  _isPaused = false;
  _currentStep = -1;
  _progress = 0;
  _notify();
  // Return to home
  _closeAllOverlays();
}

function pause() {
  if (!_isRunning || _isPaused) return;
  _clearTimers();
  _isPaused = true;
  const step = DEMO_STEPS[_currentStep];
  if (step) {
    _remaining = step.durationMs - (Date.now() - _stepStart);
    if (_remaining < 0) _remaining = 0;
  }
  _notify();
}

function resume() {
  if (!_isRunning || !_isPaused) return;
  _isPaused = false;
  const step = DEMO_STEPS[_currentStep];
  if (!step) return;

  // Shift start time so progress picks up where it left off
  _stepStart = Date.now() - (step.durationMs - _remaining);
  _notify();

  // Restart progress interval
  _progInterval = setInterval(() => {
    const elapsed = Date.now() - _stepStart;
    _progress = Math.min(100, (elapsed / step.durationMs) * 100);
    _notify();
  }, 100);

  // Restart auto-advance with remaining time
  _timer = setTimeout(() => goToStep(_currentStep + 1), _remaining);
}

function next() { if (_isRunning) goToStep(_currentStep + 1); }
function prev() { if (_isRunning) goToStep(Math.max(0, _currentStep - 1)); }

function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/* ── Expose globally ── */
window.demoMode = {
  start, stop, pause, resume, next, prev, goToStep, subscribe,
  getState: _getState,
  get steps() { return DEMO_STEPS; },
};
