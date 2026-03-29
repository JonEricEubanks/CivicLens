/* ═══════════════════════════════════════════════════════════════
 *  CivicLens Demo Overlay — floating control bar + step info
 *  Renders when demo is running; auto-updates via demoMode.subscribe
 * ═══════════════════════════════════════════════════════════════ */

(function () {
  let bar = null;
  let unsub = null;

  function getCSS() {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    return `
    /* ── Floating bar ── */
    .demo-bar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10001;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 20px;
      background: ${dk ? 'rgba(9, 20, 38, 0.92)' : 'rgba(255, 255, 255, 0.95)'};
      backdrop-filter: blur(24px) saturate(1.4);
      border: 1px solid ${dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'};
      border-radius: 18px;
      box-shadow: ${dk ? '0 8px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05) inset' : '0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04) inset'};
      max-width: 860px;
      width: max-content;
      animation: demo-bar-in 0.45s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Inter', 'Plus Jakarta Sans', sans-serif;
      color: ${dk ? '#e2e3e9' : '#1f2937'};
    }
    @keyframes demo-bar-in {
      from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.96); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
    .demo-bar-exit {
      animation: demo-bar-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes demo-bar-out {
      to { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.97); }
    }

    /* ── Step info ── */
    .demo-step-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 140px;
      max-width: 220px;
    }
    .demo-step-label {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .demo-step-desc {
      font-size: 10px;
      opacity: 0.5;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* ── Progress dots ── */
    .demo-dots {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .demo-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: ${dk ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'};
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      padding: 0;
      position: relative;
    }
    .demo-dot:hover {
      background: ${dk ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'};
      transform: scale(1.2);
    }
    .demo-dot.done {
      background: var(--md-secondary, #006a61);
    }
    .demo-dot.active {
      background: #34d399;
      box-shadow: 0 0 8px #34d399, 0 0 16px rgba(52,211,153,0.3);
      transform: scale(1.35);
    }
    .demo-dot.active:hover { transform: scale(1.45); }

    /* ── Progress bar (thin line under the bar) ── */
    .demo-progress-track {
      position: absolute;
      bottom: 4px;
      left: 20px;
      right: 20px;
      height: 3px;
      border-radius: 2px;
      background: ${dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
      overflow: hidden;
    }
    .demo-progress-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #34d399, #006a61);
      transition: width 0.1s linear;
    }

    /* ── Control buttons ── */
    .demo-ctrl {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid ${dk ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      background: ${dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      color: ${dk ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'};
      cursor: pointer;
      transition: all 0.2s;
      padding: 0;
      font-size: 18px;
      line-height: 1;
      flex-shrink: 0;
    }
    .demo-ctrl:hover {
      background: ${dk ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'};
      border-color: ${dk ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'};
    }
    .demo-ctrl-stop {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.25);
      color: ${dk ? '#fca5a5' : '#dc2626'};
    }
    .demo-ctrl-stop:hover {
      background: rgba(239,68,68,0.3);
    }

    /* ── Step counter ── */
    .demo-counter {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.5;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Divider ── */
    .demo-divider {
      width: 1px;
      height: 28px;
      background: ${dk ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      flex-shrink: 0;
    }

    /* ── Mobile responsive ── */
    @media (max-width: 640px) {
      .demo-bar {
        bottom: 72px; /* above mobile bottom nav */
        padding: 8px 14px;
        gap: 10px;
        max-width: calc(100vw - 24px);
        border-radius: 14px;
      }
      .demo-step-info { min-width: 100px; max-width: 140px; }
      .demo-step-desc { display: none; }
      .demo-ctrl { width: 30px; height: 30px; font-size: 16px; }
      .demo-dot { width: 8px; height: 8px; }
    }
    `;
  }

  function buildBar(state) {
    const step = state.currentStep;
    if (!step) return '';

    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const iconColor = dk ? '#34d399' : '#047857';
    const icon = `<span class="material-symbols-outlined" style="font-size:20px;color:${iconColor};flex-shrink:0">${step.icon}</span>`;

    // Dots
    let dots = '';
    state.steps.forEach((s, i) => {
      const cls = i < state.currentStepIndex ? 'done' : i === state.currentStepIndex ? 'active' : '';
      dots += `<button class="demo-dot ${cls}" data-demo-go="${i}" title="${s.label}"></button>`;
    });

    // Pause / resume icon
    const pauseIcon = state.isPaused ? 'play_arrow' : 'pause';
    const pauseTitle = state.isPaused ? 'Resume' : 'Pause';

    return `
      <style>${getCSS()}</style>
      ${icon}
      <div class="demo-step-info">
        <div class="demo-step-label">${step.label}</div>
        <div class="demo-step-desc">${step.description}</div>
      </div>
      <div class="demo-divider"></div>
      <div class="demo-dots">${dots}</div>
      <div class="demo-divider"></div>
      <button class="demo-ctrl" id="demo-prev" title="Previous"><span class="material-symbols-outlined" style="font-size:18px">skip_previous</span></button>
      <button class="demo-ctrl" id="demo-pause" title="${pauseTitle}"><span class="material-symbols-outlined" style="font-size:18px">${pauseIcon}</span></button>
      <button class="demo-ctrl" id="demo-next" title="Next"><span class="material-symbols-outlined" style="font-size:18px">skip_next</span></button>
      <button class="demo-ctrl demo-ctrl-stop" id="demo-stop" title="Stop Demo"><span class="material-symbols-outlined" style="font-size:18px">stop</span></button>
      <div class="demo-counter">${state.currentStepIndex + 1} / ${state.steps.length}</div>
      <div class="demo-progress-track"><div class="demo-progress-fill" style="width:${state.progress}%"></div></div>
    `;
  }

  function wireEvents() {
    if (!bar) return;
    bar.querySelector('#demo-prev')?.addEventListener('click', () => window.demoMode.prev());
    bar.querySelector('#demo-next')?.addEventListener('click', () => window.demoMode.next());
    bar.querySelector('#demo-stop')?.addEventListener('click', () => window.demoMode.stop());
    bar.querySelector('#demo-pause')?.addEventListener('click', () => {
      const s = window.demoMode.getState();
      s.isPaused ? window.demoMode.resume() : window.demoMode.pause();
    });
    bar.querySelectorAll('[data-demo-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.demoMode.goToStep(parseInt(btn.dataset.demoGo, 10));
      });
    });
  }

  function onStateChange(state) {
    if (state.isRunning && state.currentStepIndex >= 0) {
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'demo-bar';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Demo mode controls');
        document.body.appendChild(bar);
      }

      // Only rebuild full HTML when step changes (not every progress tick)
      const stepChanged = bar.dataset.step !== String(state.currentStepIndex);
      const pauseChanged = bar.dataset.paused !== String(state.isPaused);

      if (stepChanged || pauseChanged) {
        bar.innerHTML = buildBar(state);
        bar.dataset.step = state.currentStepIndex;
        bar.dataset.paused = state.isPaused;
        wireEvents();
      } else {
        // Just update progress bar width
        const fill = bar.querySelector('.demo-progress-fill');
        if (fill) fill.style.width = state.progress + '%';
      }
    } else if (bar) {
      bar.classList.add('demo-bar-exit');
      const ref = bar;
      setTimeout(() => { ref.remove(); }, 300);
      bar = null;
    }

    // Update the sidebar demo button appearance
    updateDemoButton(state.isRunning);
  }

  function updateDemoButton(running) {
    const btn = document.getElementById('demo-nav-btn');
    if (!btn) return;
    const icon = btn.querySelector('.material-symbols-outlined');
    const label = btn.querySelector('.nav-label');
    if (running) {
      if (icon) icon.textContent = 'stop_circle';
      if (label) label.textContent = 'Stop Demo';
      btn.style.color = '#ef4444';
    } else {
      if (icon) icon.textContent = 'play_circle';
      if (label) label.textContent = 'Demo Tour';
      btn.style.color = '';
    }
  }

  /* ── Initialize once demoMode is available ── */
  function init() {
    if (!window.demoMode) {
      setTimeout(init, 100);
      return;
    }
    unsub = window.demoMode.subscribe(onStateChange);
  }

  /* ── Toggle demo from nav button ── */
  window.toggleDemo = function () {
    if (!window.demoMode) return;
    const s = window.demoMode.getState();
    s.isRunning ? window.demoMode.stop() : window.demoMode.start();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
