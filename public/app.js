const messagesDiv = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const traceContent = document.getElementById("trace-content");

// â”€â”€ Side Navigation helper â”€â”€
function sideNavTo(btn, page) {
  document
    .querySelectorAll(".side-nav-item")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  // Also sync mobile bottom nav
  document.querySelectorAll(".bottom-nav-item").forEach((b) => {
    b.classList.remove("active");
    b.style.color = "var(--md-outline)";
    b.querySelector(".material-symbols-outlined")?.classList.remove(
      "filled",
    );
  });
  const mobileBtn = document.querySelector(
    `.bottom-nav-item[data-nav="${page}"]`,
  );
  if (mobileBtn) {
    mobileBtn.classList.add("active");
    mobileBtn.style.color = "var(--md-secondary)";
    mobileBtn
      .querySelector(".material-symbols-outlined")
      ?.classList.add("filled");
  }
  // Handle Staff Ops full-page transitions
  const staffOpsPage = document.getElementById('staff-ops-page');
  const mainContent = document.querySelector('main.main-with-sidenav');
  const aiDashBtn = document.getElementById('ai-dashboard-nav');
  if (page === 'staff-ops') {
    if (mainContent) mainContent.style.display = 'none';
    if (aiDashBtn) aiDashBtn.style.display = '';
    // staff-ops.js openPage() handles showing the page
  } else {
    // Leaving staff-ops - restore main, close staff page
    if (mainContent) mainContent.style.display = '';
    if (staffOpsPage) staffOpsPage.style.display = 'none';
    if (aiDashBtn) aiDashBtn.style.display = 'none';
    window._staffOps?.closePage?.();
  }
}
window.sideNavTo = sideNavTo;

// â”€â”€ Mobile Navigation â”€â”€
let chatWidgetOpen = false;
let tracePanelOpen = false;
let chatSize = "compact";
let currentPageContext = "home";
let messageCount = 0;
let chatRole = "public"; // 'public' or 'supervisor'

function setActiveNav(btn) {
  document.querySelectorAll(".bottom-nav-item").forEach((b) => {
    b.classList.remove("active");
    b.style.color = "var(--md-outline)";
    b.querySelector(".material-symbols-outlined")?.classList.remove(
      "filled",
    );
  });
  btn.classList.add("active");
  btn.style.color = "var(--md-secondary)";
  btn
    .querySelector(".material-symbols-outlined")
    ?.classList.add("filled");

  // Also sync desktop side nav
  const navKey = btn.getAttribute("data-nav");
  document
    .querySelectorAll(".side-nav-item")
    .forEach((b) => b.classList.remove("active"));
  const deskBtn = document.querySelector(
    `.side-nav-item[data-nav="${navKey}"]`,
  );
  if (deskBtn) deskBtn.classList.add("active");
}

// Reset bottom nav to Home (called when overlays close)
function resetNavToHome() {
  const homeBtn = document.querySelector('.bottom-nav-item[data-nav="home"]');
  if (homeBtn) setActiveNav(homeBtn);
}
window.resetNavToHome = resetNavToHome;


// â”€â”€ Chat Size Management â”€â”€
function setChatSize(size) {
  const widget = document.getElementById("chat-widget");
  chatSize = size;
  widget.classList.remove(
    "chat-compact",
    "chat-expanded",
    "chat-fullscreen",
  );
  widget.classList.add("chat-" + size);

  document
    .querySelectorAll(".size-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("chat-size-" + size)?.classList.add("active");

  const tracePanel = document.getElementById("trace-panel");

  if (size === "compact") {
    widget.style.cssText = "";
    document.body.style.overflow = "";
    // Hide trace panel in compact mode
    if (tracePanel) {
      tracePanel.classList.add("hidden");
      tracePanelOpen = false;
    }
  } else if (size === "expanded") {
    widget.style.cssText = "top:0;bottom:0;right:0;left:auto;";
    document.body.style.overflow = "";
    // Auto-show trace panel in expanded mode
    if (tracePanel) {
      tracePanel.classList.remove("hidden");
      tracePanelOpen = true;
    }
  } else if (size === "fullscreen") {
    widget.style.cssText = "inset:0;";
    document.body.style.overflow = "hidden";
    // Auto-show trace panel in fullscreen mode
    if (tracePanel) {
      tracePanel.classList.remove("hidden");
      tracePanelOpen = true;
    }
  }

  setTimeout(() => input.focus(), 100);
}
window.setChatSize = setChatSize;

function maybeAutoExpand() {
  if (chatSize === "compact" && messageCount >= 4) {
    setChatSize("expanded");
  }
}

// â”€â”€ Page Context Awareness â”€â”€
const PAGE_CONTEXTS = {
  home: {
    label: "Dashboard",
    icon: '<span class="material-symbols-outlined" style="font-size:14px">home</span>',
    suggestions: [
      {
        text: "What's the overall status of open issues?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">monitoring</span>',
      },
      {
        text: "Which areas need attention?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">map</span>',
      },
      {
        text: "Any recent updates or trends?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">trending_up</span>',
      },
    ],
  },
  map: {
    label: "Map View",
    icon: '<span class="material-symbols-outlined" style="font-size:14px">map</span>',
    suggestions: [
      {
        text: "Where are the most reported issues?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">location_on</span>',
      },
      {
        text: "Any safety concerns in this area?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">warning</span>',
      },
      {
        text: "Show me high-priority locations",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">school</span>',
      },
    ],
  },
  portal: {
    label: "Service Portal",
    icon: '<span class="material-symbols-outlined" style="font-size:14px">edit_square</span>',
    suggestions: [
      {
        text: "How do I submit a request?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">build</span>',
      },
      {
        text: "Can I check on an existing request?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">search</span>',
      },
      {
        text: "What types of issues can I report?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">help</span>',
      },
    ],
  },
  insights: {
    label: "Community Insights",
    icon: '<span class="material-symbols-outlined" style="font-size:14px">insights</span>',
    suggestions: [
      {
        text: "What do the numbers look like?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">payments</span>',
      },
      {
        text: "Generate a custom analysis for Zone A",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span>',
      },
      {
        text: "How are different areas comparing?",
        icon: '<span class="material-symbols-outlined" style="font-size:14px">bar_chart</span>',
      },
    ],
  },
};

function setPageContext(context) {
  currentPageContext = context;
  updateContextBar();
}
window.setPageContext = setPageContext;

function updateContextBar() {
  const ctx = PAGE_CONTEXTS[currentPageContext] || PAGE_CONTEXTS.home;
  const contextText = document.getElementById("chat-context-text");
  const suggestionsDiv = document.getElementById("context-suggestions");

  contextText.textContent =
    ctx.label + " â€” Ask anything relevant to this view";

  suggestionsDiv.innerHTML = ctx.suggestions
    .map(
      (s) =>
        `<button onclick="askSuggestion(this)" class="context-chip text-xs bg-white/80 border px-2.5 py-1.5 rounded-full hover:bg-white flex items-center gap-1.5 whitespace-nowrap" style="border-color:var(--md-outline-variant);color:var(--md-on-surface)">
    ${s.icon} ${escapeHtml(s.text)}
  </button>`,
    )
    .join("");
}

const _origOpenMap = window.openCivicMap;
const _origOpenPortal = window.openServicePortal;
function hookPageContextTracking() {
  if (window.openCivicMap && window.openCivicMap !== hookOpenCivicMap) {
    const orig = window.openCivicMap;
    window.openCivicMap = function () {
      setPageContext("map");
      return orig.apply(this, arguments);
    };
  }
  if (
    window.openServicePortal &&
    window.openServicePortal !== hookOpenServicePortal
  ) {
    const orig = window.openServicePortal;
    window.openServicePortal = function () {
      setPageContext("portal");
      return orig.apply(this, arguments);
    };
  }
  if (window.openInsights && window.openInsights !== hookOpenInsights) {
    const orig = window.openInsights;
    window.openInsights = function () {
      setPageContext("insights");
      return orig.apply(this, arguments);
    };
  }
}
function hookOpenCivicMap() {}
function hookOpenServicePortal() {}
function hookOpenInsights() {}

// â”€â”€ Clear Chat â”€â”€
function clearChatHistory() {
  messagesDiv.innerHTML = "";
  messageCount = 0;
  updateChatWelcome(chatRole);
  updateContextBar();
  if (chatSize !== "compact") setChatSize("compact");
}
window.clearChatHistory = clearChatHistory;

// â”€â”€ Role-aware chat welcome & suggestions â”€â”€
function updateChatWelcome(role) {
  const msgs = document.getElementById("messages");
  if (!msgs) return;
  // Only reset if chat is showing the welcome (no user messages yet)
  if (messageCount > 0) return;
  msgs.innerHTML = "";
  if (role === "supervisor") {
    msgs.innerHTML = `
    <div class="rounded-2xl p-4 border msg-animate" style="background:linear-gradient(135deg, #e8eaf6, #c5cae9);border-color:#9fa8da;">
      <p class="text-sm font-semibold mb-2 font-display" style="color:#1a237e">Staff Operations Assistant</p>
      <p class="text-xs mb-3" style="color:var(--md-on-surface-variant)">I'm in <strong>staff mode</strong> â€” ask about work order status, crew dispatch, SLA compliance, budget projections, or zone operations.</p>
      <div class="space-y-1.5" id="welcome-suggestions">
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:#1a237e">assignment</span>
          Show all open work orders past SLA deadline
        </button>
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:#f57c00">groups</span>
          What's the crew utilization and dispatch plan for this week?
        </button>
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:#d32f2f">paid</span>
          Budget burn rate and cost breakdown by zone
        </button>
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:#388e3c">priority_high</span>
          Critical issues needing immediate dispatch
        </button>
      </div>
    </div>`;
  } else {
    msgs.innerHTML = `
    <div class="rounded-2xl p-4 border msg-animate" style="background:linear-gradient(135deg, #e6f5f3, #ccebe8);border-color:#b2dfdb;">
      <p class="text-sm font-semibold mb-2 font-display" style="color:var(--md-secondary)">Welcome to CivicLens AI</p>
      <p class="text-xs mb-3" style="color:var(--md-on-surface-variant)">I can help with infrastructure questions, service requests, safety reports, and data analysis. Try a suggestion below or ask anything.</p>
      <div class="space-y-1.5" id="welcome-suggestions">
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--md-secondary)">crisis_alert</span>
          Show me all critical infrastructure issues with priority scores
        </button>
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:#f59e0b">school</span>
          Which potholes are near schools and need urgent repair?
        </button>
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:#22c55e">monitoring</span>
          What happens if we cut the budget by 20%?
        </button>
        <button onclick="askSuggestion(this)" class="suggestion-chip w-full text-left text-xs bg-white border px-3 py-2 rounded-lg hover:bg-white/80 flex items-center gap-2" style="border-color:var(--md-outline-variant);color:var(--md-on-surface);">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--md-tertiary)">compare_arrows</span>
          How does our response time compare to Chicago 311?
        </button>
      </div>
    </div>`;
  }
}

// â”€â”€ Chat Widget Toggle â”€â”€
function toggleChatWidget() {
  const widget = document.getElementById("chat-widget");
  const fab = document.getElementById("chat-fab");
  const unread = document.getElementById("fab-unread");
  if (chatWidgetOpen) {
    widget.classList.add("chat-close");
    widget.classList.remove("chat-open");
    setTimeout(() => {
      widget.classList.add("hidden");
      widget.classList.remove("chat-close");
    }, 280);
    fab.classList.remove("hidden");
    chatWidgetOpen = false;
    if (chatSize === "fullscreen") document.body.style.overflow = "";
  } else {
    widget.classList.remove("hidden");
    widget.classList.add("chat-open");
    setTimeout(() => widget.classList.remove("chat-open"), 320);
    fab.classList.add("hidden");
    unread?.classList.add("hidden");
    chatWidgetOpen = true;
    input.focus();
    updateContextBar();
  }
}
window.toggleChatWidget = toggleChatWidget;

// â”€â”€ Trace Panel Toggle â”€â”€
document
  .getElementById("chat-trace-toggle")
  ?.addEventListener("click", () => {
    const panel = document.getElementById("trace-panel");
    tracePanelOpen = !tracePanelOpen;
    panel.classList.toggle("hidden", !tracePanelOpen);
    updateMobilePipelineBtn();
  });

// â”€â”€ Mobile Pipeline Toggle (compact mode only) â”€â”€
function toggleMobilePipeline() {
  const panel = document.getElementById("trace-panel");
  tracePanelOpen = !tracePanelOpen;
  panel.classList.toggle("hidden", !tracePanelOpen);
  updateMobilePipelineBtn();
  if (tracePanelOpen) {
    // Scroll trace panel into view on mobile
    setTimeout(
      () =>
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      100,
    );
  }
}
window.toggleMobilePipeline = toggleMobilePipeline;

function updateMobilePipelineBtn() {
  const btn = document.getElementById("mobile-pipeline-btn");
  const label = document.getElementById("mobile-pipeline-label");
  const chevron = document.getElementById("mobile-pipeline-chevron");
  if (!btn) return;
  if (tracePanelOpen) {
    label.textContent = "Hide AI Pipeline";
    chevron.textContent = "expand_less";
  } else {
    label.textContent = "View AI Pipeline";
    chevron.textContent = "expand_more";
  }
}

// â”€â”€ Role Toggle (Citizen â†” Supervisor) â”€â”€
let staffDashboardData = null;
let staffSelectedCard = null;
let staffCurrentAction = null;
let staffAuthToken = null; // Session token from PIN auth

function toggleChatRole() {
  if (chatRole === "public") {
    // Trying to switch TO supervisor â€” require PIN
    showStaffPinModal();
    return;
  }
  // Switching BACK to citizen â€” always allowed
  deactivateStaffMode();
}

function activateStaffMode() {
  chatRole = "supervisor";
  const icon = document.getElementById("role-icon");
  const label = document.getElementById("role-label");
  const btn = document.getElementById("chat-role-toggle");
  const contextText = document.getElementById("chat-context-text");
  const staffPanel = document.getElementById("staff-command-center");
  const chatBody = document.getElementById("chat-body-wrapper");
  const contextBar = document.getElementById("chat-context-bar");

  icon.textContent = "shield_person";
  label.textContent = "Staff";
  btn.style.background = "rgba(255,255,255,0.2)";
  btn.style.color = "#fff";
  btn.title = "Switch back to Citizen mode (clears staff session)";
  contextText.textContent = "Staff Command Center";
  staffPanel.classList.remove("hidden");
  chatBody.classList.add("hidden");
  contextBar.classList.add("hidden");
  if (chatSize === "compact") setChatSize("expanded");

  // Adapt chat to staff mode
  const chatInput = document.getElementById("chat-input");
  chatInput.placeholder = "Ask about work orders, crews, SLAs, budgets...";
  updateChatWelcome("supervisor");

  loadStaffDashboard();
}

function deactivateStaffMode() {
  chatRole = "public";
  staffAuthToken = null;
  // Optionally tell server to invalidate token
  fetch("/api/staff/logout", {
    method: "POST",
    headers: { Authorization: "Bearer " + staffAuthToken },
  }).catch(() => {});
  const icon = document.getElementById("role-icon");
  const label = document.getElementById("role-label");
  const btn = document.getElementById("chat-role-toggle");
  const contextText = document.getElementById("chat-context-text");
  const staffPanel = document.getElementById("staff-command-center");
  const chatBody = document.getElementById("chat-body-wrapper");
  const contextBar = document.getElementById("chat-context-bar");

  icon.textContent = "person";
  label.textContent = "Citizen";
  btn.style.background = "";
  btn.style.color = "";
  btn.title = "Switch between Citizen and Staff Supervisor mode";
  contextText.textContent = "Ask about infrastructure, services, or data";
  staffPanel.classList.add("hidden");
  chatBody.classList.remove("hidden");
  contextBar.classList.remove("hidden");
  updateContextBar();

  // Restore chat to citizen mode
  const chatInput = document.getElementById("chat-input");
  chatInput.placeholder = "Ask about infrastructure...";
  updateChatWelcome("public");
}

// â”€â”€ Staff PIN Modal â”€â”€
function showStaffPinModal() {
  const modal = document.getElementById("staff-pin-modal");
  const input = document.getElementById("staff-pin-input");
  const error = document.getElementById("staff-pin-error");
  error.classList.add("hidden");
  input.value = "";
  modal.classList.remove("hidden");
  setTimeout(() => input.focus(), 100);
}

function closeStaffPinModal() {
  document.getElementById("staff-pin-modal").classList.add("hidden");
  document.getElementById("staff-pin-input").value = "";
}
window.closeStaffPinModal = closeStaffPinModal;

async function submitStaffPin() {
  const input = document.getElementById("staff-pin-input");
  const error = document.getElementById("staff-pin-error");
  const btn = document.getElementById("staff-pin-submit");
  const pin = input.value.trim();
  if (!pin) {
    input.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML =
    '<span class="material-symbols-outlined align-middle animate-spin" style="font-size:14px">progress_activity</span> Verifying...';
  try {
    const res = await fetch("/api/staff/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      staffAuthToken = data.token;
      error.classList.add("hidden");
      closeStaffPinModal();
      activateStaffMode();
    } else {
      error.textContent = data.error || "Incorrect PIN. Try again.";
      error.classList.remove("hidden");
      input.value = "";
      input.focus();
    }
  } catch (err) {
    error.textContent = "Connection error. Is the server running?";
    error.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<span class="material-symbols-outlined align-middle mr-1" style="font-size:14px">lock_open</span> Unlock';
  }
}
window.submitStaffPin = submitStaffPin;

window.toggleChatRole = toggleChatRole;

// â”€â”€ Staff Dashboard Data Loader â”€â”€
async function loadStaffDashboard() {
  try {
    const res = await fetch("/api/staff/dashboard?role=supervisor", {
      headers: { Authorization: "Bearer " + staffAuthToken },
    });
    if (res.status === 401) {
      deactivateStaffMode();
      showStaffToast("Session expired â€” please re-authenticate");
      return;
    }
    if (!res.ok) throw new Error("Failed to load");
    staffDashboardData = await res.json();
    renderStaffKPIs(staffDashboardData.kpis);
    renderStaffRequests(staffDashboardData.service_requests);
    renderStaffWorkOrders(staffDashboardData.work_orders);
  } catch (err) {
    document.getElementById("staff-requests-list").innerHTML =
      '<div class="text-center py-8 text-xs" style="color:#ef4444"><span class="material-symbols-outlined" style="font-size:16px">error</span> Failed to load data. Is the server running?</div>';
  }
}
window.loadStaffDashboard = loadStaffDashboard;

function renderStaffKPIs(kpis) {
  document.getElementById("staff-kpi-open").textContent = kpis.sr_open;
  document.getElementById("staff-kpi-progress").textContent =
    kpis.sr_in_progress;
  document.getElementById("staff-kpi-completed").textContent =
    kpis.sr_completed;
  document.getElementById("staff-kpi-critical").textContent =
    kpis.wo_critical;
}

// timeAgo and CATEGORY_ICONS moved to civic-utils.js (window.CivicUtils)
const timeAgo = (window.CivicUtils && window.CivicUtils.timeAgo) || function(d) { return ''; };
const CATEGORY_ICONS = (window.CivicUtils && window.CivicUtils.CATEGORY_ICONS) || { default: 'report' };

function renderStaffRequests(requests) {
  const list = document.getElementById("staff-requests-list");
  if (!requests || requests.length === 0) {
    list.innerHTML =
      '<div class="text-center py-8 text-xs" style="color:var(--md-outline)">No service requests found</div>';
    return;
  }
  // Sort: open first, then in_progress, then completed
  const order = { open: 0, received: 1, in_progress: 2, completed: 3 };
  const sorted = [...requests].sort(
    (a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4),
  );

  list.innerHTML = sorted
    .map((sr) => {
      const icon = CATEGORY_ICONS[sr.category] || CATEGORY_ICONS.default;
      const statusClass = sr.status.replace(" ", "_");
      const isActionable = sr.status !== "completed";
      return `
    <div class="staff-request-card" data-sr-id="${sr.id}" onclick="selectStaffCard(this, '${sr.id}')">
      <div class="flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:#e0f2f1">
          <span class="material-symbols-outlined" style="font-size:16px; color:var(--md-secondary)">${icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[11px] font-bold" style="color:var(--md-on-surface)">${sr.id}</span>
            <span class="staff-status-pill ${statusClass}">${sr.status.replace("_", " ")}</span>
            <span class="text-[10px] ml-auto" style="color:var(--md-outline)">${timeAgo(sr.submitted_date || sr.updated_date)}</span>
          </div>
          <p class="text-[11px] truncate mb-0.5" style="color:var(--md-on-surface-variant)">${escapeHtml((sr.description || "").slice(0, 80))}${(sr.description || "").length > 80 ? "..." : ""}</p>
          <div class="flex items-center gap-2 text-[10px]" style="color:var(--md-outline)">
            <span class="flex items-center gap-0.5"><span class="material-symbols-outlined" style="font-size:12px">location_on</span>${escapeHtml((sr.location?.address || sr.address || "No location").slice(0, 30))}</span>
            ${sr.assigned_crew ? '<span class="flex items-center gap-0.5"><span class="material-symbols-outlined" style="font-size:12px">group</span>' + escapeHtml(sr.assigned_crew) + "</span>" : ""}
          </div>
        </div>
      </div>
      ${
        isActionable
          ? `
      <div class="staff-card-actions">
        <button onclick="event.stopPropagation(); openStaffActionForSR('${sr.id}', 'dispatch')" class="staff-card-action" style="background:#eff6ff; border-color:#93c5fd; color:#1d4ed8">
          <span class="material-symbols-outlined" style="font-size:12px">local_shipping</span> Assign
        </button>
        <button onclick="event.stopPropagation(); openStaffActionForSR('${sr.id}', 'status')" class="staff-card-action" style="background:#f0fdf4; border-color:#86efac; color:#166534">
          <span class="material-symbols-outlined" style="font-size:12px">check_circle</span> Status
        </button>
        <button onclick="event.stopPropagation(); openStaffActionForSR('${sr.id}', 'inspect')" class="staff-card-action" style="background:#fefce8; border-color:#fcd34d; color:#92400e">
          <span class="material-symbols-outlined" style="font-size:12px">search</span> Inspect
        </button>
      </div>`
          : '<div class="mt-1.5 text-[10px] flex items-center gap-1" style="color:#16a34a"><span class="material-symbols-outlined" style="font-size:12px">check_circle</span> Resolved</div>'
      }
    </div>`;
    })
    .join("");
}

function renderStaffWorkOrders(workOrders) {
  const list = document.getElementById("staff-wo-list");
  if (!workOrders || workOrders.length === 0) {
    list.innerHTML =
      '<div class="text-center py-8 text-xs" style="color:var(--md-outline)">No work orders found</div>';
    return;
  }
  const order = { open: 0, in_progress: 1, completed: 2 };
  const sorted = [...workOrders].sort((a, b) => {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusDiff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    return (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
  });

  list.innerHTML = sorted
    .map((wo) => {
      const statusClass = wo.status.replace(" ", "_");
      const isActionable = wo.status !== "completed";
      return `
    <div class="staff-request-card" data-wo-id="${wo.id}">
      <div class="flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:${wo.priority === "critical" ? "#fef2f2" : wo.priority === "high" ? "#fffbeb" : "#f0f9ff"}">
          <span class="staff-priority-dot ${wo.priority || "medium"}"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[11px] font-bold" style="color:var(--md-on-surface)">${wo.id}</span>
            <span class="staff-status-pill ${statusClass}">${wo.status.replace("_", " ")}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style="background:#f1f5f9; color:var(--md-on-surface-variant)">${wo.priority || "medium"}</span>
          </div>
          <p class="text-[11px] truncate mb-0.5" style="color:var(--md-on-surface-variant)">${escapeHtml(wo.type || "Unknown type")} â€” ${escapeHtml((wo.location?.address || "").slice(0, 40))}</p>
          <div class="flex items-center gap-2 text-[10px]" style="color:var(--md-outline)">
            ${wo.crew_assigned ? '<span class="flex items-center gap-0.5"><span class="material-symbols-outlined" style="font-size:12px">group</span>' + escapeHtml(wo.crew_assigned) + "</span>" : '<span style="color:#f59e0b">Unassigned</span>'}
            ${wo.estimated_cost ? "<span>$" + wo.estimated_cost.toLocaleString() + "</span>" : ""}
            <span>${wo.location?.zone || ""}</span>
          </div>
        </div>
      </div>
      ${
        isActionable
          ? `
      <div class="staff-card-actions">
        <button onclick="event.stopPropagation(); openStaffActionForWO('${wo.id}', 'dispatch')" class="staff-card-action" style="background:#eff6ff; border-color:#93c5fd; color:#1d4ed8">
          <span class="material-symbols-outlined" style="font-size:12px">local_shipping</span> Dispatch
        </button>
        <button onclick="event.stopPropagation(); openStaffActionForWO('${wo.id}', 'status')" class="staff-card-action" style="background:#f0fdf4; border-color:#86efac; color:#166534">
          <span class="material-symbols-outlined" style="font-size:12px">check_circle</span> Complete
        </button>
      </div>`
          : '<div class="mt-1.5 text-[10px] flex items-center gap-1" style="color:#16a34a"><span class="material-symbols-outlined" style="font-size:12px">check_circle</span> Done</div>'
      }
    </div>`;
    })
    .join("");
}

// â”€â”€ Staff Tab Switching â”€â”€
function staffTabSwitch(tab) {
  document
    .querySelectorAll(".staff-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.staff-tab[data-tab="${tab}"]`)
    ?.classList.add("active");
  document
    .querySelectorAll(".staff-tab-content")
    .forEach((c) => c.classList.add("hidden"));
  document.getElementById(`staff-tab-${tab}`)?.classList.remove("hidden");

  // If switching to chat tab, move chat elements into it
  if (tab === "chat") {
    const chatTab = document.getElementById("staff-tab-chat");
    if (chatTab.children.length === 0) {
      chatTab.innerHTML = `
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div class="rounded-xl p-3 border text-xs" style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border-color:#fed7aa">
            <p class="font-semibold mb-1" style="color:#9a3412">ðŸ›¡ï¸ Staff AI Chat</p>
            <p style="color:#c2410c">Type commands like "Dispatch Crew-B to WO-2024-003" or ask questions about infrastructure data.</p>
          </div>
          <div class="space-y-1.5">
            <button onclick="staffChatCommand('What are all the open service requests?')" class="w-full text-left text-[11px] bg-white border px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2" style="border-color:var(--md-outline-variant)">
              <span class="material-symbols-outlined" style="font-size:14px;color:#ef4444">inbox</span> Show all open service requests
            </button>
            <button onclick="staffChatCommand('Which work orders are critical priority?')" class="w-full text-left text-[11px] bg-white border px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2" style="border-color:var(--md-outline-variant)">
              <span class="material-symbols-outlined" style="font-size:14px;color:#f59e0b">warning</span> Show critical priority work orders
            </button>
            <button onclick="staffChatCommand('What potholes are near schools and need urgent repair?')" class="w-full text-left text-[11px] bg-white border px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2" style="border-color:var(--md-outline-variant)">
              <span class="material-symbols-outlined" style="font-size:14px;color:#3b82f6">school</span> School-zone urgent repairs
            </button>
            <button onclick="staffChatCommand('Generate a status report for all zones')" class="w-full text-left text-[11px] bg-white border px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2" style="border-color:var(--md-outline-variant)">
              <span class="material-symbols-outlined" style="font-size:14px;color:var(--md-secondary)">summarize</span> Generate zone status report
            </button>
          </div>
        </div>`;
    }
  }
}
window.staffTabSwitch = staffTabSwitch;

function staffChatCommand(msg) {
  // Switch back to main chat view temporarily, send the command
  const staffPanel = document.getElementById("staff-command-center");
  const chatBody = document.getElementById("chat-body-wrapper");
  staffPanel.classList.add("hidden");
  chatBody.classList.remove("hidden");
  if (!chatWidgetOpen) toggleChatWidget();
  const input = document.getElementById("chat-input");
  input.value = msg;
  document.getElementById("chat-form").dispatchEvent(new Event("submit"));
}
window.staffChatCommand = staffChatCommand;

function selectStaffCard(el, id) {
  document
    .querySelectorAll(".staff-request-card.selected")
    .forEach((c) => c.classList.remove("selected"));
  el.classList.add("selected");
  staffSelectedCard = id;
}
window.selectStaffCard = selectStaffCard;

// â”€â”€ Staff Quick Actions (bottom bar buttons) â”€â”€
function staffQuickAction(action) {
  staffCurrentAction = action;
  openStaffModal(action, null, null);
}
window.staffQuickAction = staffQuickAction;

function openStaffActionForSR(srId, action) {
  staffCurrentAction = { type: "sr", id: srId, action };
  openStaffModal(action, "sr", srId);
}
window.openStaffActionForSR = openStaffActionForSR;

function openStaffActionForWO(woId, action) {
  staffCurrentAction = { type: "wo", id: woId, action };
  openStaffModal(action, "wo", woId);
}
window.openStaffActionForWO = openStaffActionForWO;

function openStaffModal(action, entityType, entityId) {
  const modal = document.getElementById("staff-action-modal");
  const title = document.getElementById("staff-modal-title");
  const body = document.getElementById("staff-modal-body");

  if (action === "dispatch") {
    title.innerHTML =
      '<span class="material-symbols-outlined align-middle mr-1" style="font-size:18px;color:#1d4ed8">local_shipping</span> Dispatch Crew';
    body.innerHTML = `
      <div class="space-y-3">
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Work Order / Request ID</label>
          <input id="staff-modal-id" type="text" value="${entityId || ""}" placeholder="e.g. WO-2024-003" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Crew</label>
          <select id="staff-modal-crew" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
            <option value="Crew-A">Crew-A (Pothole Repair)</option>
            <option value="Crew-B">Crew-B (Sidewalk Team)</option>
            <option value="Crew-C">Crew-C (Concrete Repair)</option>
            <option value="Crew-D">Crew-D (Emergency Response)</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Scheduled Date</label>
          <input id="staff-modal-date" type="date" value="${new Date().toISOString().split("T")[0]}" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
        </div>
      </div>`;
  } else if (action === "status") {
    title.innerHTML =
      '<span class="material-symbols-outlined align-middle mr-1" style="font-size:18px;color:#16a34a">check_circle</span> Update Status';
    body.innerHTML = `
      <div class="space-y-3">
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Request ID</label>
          <input id="staff-modal-id" type="text" value="${entityId || ""}" placeholder="e.g. SR-2026-001" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">New Status</label>
          <select id="staff-modal-status" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
            <option value="received">Received</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Note</label>
          <textarea id="staff-modal-note" rows="2" placeholder="Update note..." class="w-full px-3 py-2 rounded-lg border text-xs resize-none" style="border-color:var(--md-outline-variant)"></textarea>
        </div>
      </div>`;
  } else if (action === "inspect") {
    const sr = staffDashboardData?.service_requests?.find(
      (s) => s.id === entityId,
    );
    title.innerHTML =
      '<span class="material-symbols-outlined align-middle mr-1" style="font-size:18px;color:#92400e">search</span> Schedule Inspection';
    body.innerHTML = `
      <input type="hidden" id="staff-modal-srid" value="${entityId || ''}" />
      <div class="space-y-3">
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Issue Type</label>
          <select id="staff-modal-issuetype" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
            <option value="pothole" ${sr?.category === "pothole" ? "selected" : ""}>Pothole</option>
            <option value="sidewalk" ${sr?.category === "sidewalk" ? "selected" : ""}>Sidewalk</option>
            <option value="concrete">Concrete</option>
            <option value="streetlight" ${sr?.category === "streetlight" ? "selected" : ""}>Streetlight</option>
            <option value="drainage" ${sr?.category === "drainage" ? "selected" : ""}>Drainage</option>
            <option value="tree_damage" ${sr?.category === "tree_damage" ? "selected" : ""}>Tree Damage</option>
            <option value="sign_damage" ${sr?.category === "sign_damage" ? "selected" : ""}>Sign Damage</option>
            <option value="crosswalk" ${sr?.category === "crosswalk" ? "selected" : ""}>Crosswalk</option>
            <option value="other" ${sr?.category === "other" ? "selected" : ""}>Other</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Location</label>
          <input id="staff-modal-location" type="text" value="${sr?.location?.address || sr?.address || ""}" placeholder="Address" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Zone</label>
          <select id="staff-modal-zone" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
            <option value="NE-1" ${sr?.location?.zone === "NE-1" ? "selected" : ""}>NE-1</option>
            <option value="NW-3" ${sr?.location?.zone === "NW-3" ? "selected" : ""}>NW-3</option>
            <option value="SE-2" ${sr?.location?.zone === "SE-2" ? "selected" : ""}>SE-2</option>
            <option value="SW-1" ${sr?.location?.zone === "SW-1" ? "selected" : ""}>SW-1</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Scheduled Date</label>
          <input id="staff-modal-inspdate" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
        </div>
        <div>
          <label class="block text-[11px] font-semibold mb-1" style="color:var(--md-on-surface-variant)">Reason</label>
          <input id="staff-modal-reason" type="text" value="${entityId ? "Resident report " + entityId : ""}" placeholder="Inspection reason" class="w-full px-3 py-2 rounded-lg border text-xs" style="border-color:var(--md-outline-variant)">
        </div>
      </div>`;
  }

  modal.classList.remove("hidden");
}

function closeStaffModal() {
  document.getElementById("staff-action-modal").classList.add("hidden");
  staffCurrentAction = null;
}
window.closeStaffModal = closeStaffModal;

async function executeStaffAction() {
  const action = staffCurrentAction;
  if (!action) return;
  const confirmBtn = document.getElementById("staff-modal-confirm");
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="material-symbols-outlined align-middle animate-spin" style="font-size:14px">progress_activity</span> Processing...';

  try {
    if (action.action === "dispatch" || action === "dispatch") {
      const woId = document.getElementById("staff-modal-id").value.trim();
      const crew = document.getElementById("staff-modal-crew").value;
      const date = document.getElementById("staff-modal-date").value;
      if (!woId) { showStaffToast('âŒ Work Order ID is required'); return; }
      // Direct REST call â€” no chat pipeline
      const res = await fetch('/api/staff/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + staffAuthToken,
        },
        body: JSON.stringify({
          work_order_id: woId,
          crew_id: crew,
          scheduled_date: date || new Date().toISOString().split('T')[0],
        }),
      });
      if (res.status === 401) { deactivateStaffMode(); showStaffToast('Session expired'); return; }
      const result = await res.json();
      if (result.success) {
        closeStaffModal();
        showStaffToast(`âœ… ${crew} dispatched to ${woId}`);
        loadStaffDashboard();
      } else {
        showStaffToast(`âŒ ${result.error || 'Dispatch failed'}`);
      }
    } else if (action.action === "status" || action === "status") {
      const entityId = document.getElementById("staff-modal-id").value.trim();
      const newStatus = document.getElementById("staff-modal-status").value;
      const note = document.getElementById("staff-modal-note")?.value?.trim() || "";
      if (!entityId) { showStaffToast('âŒ ID is required'); return; }
      // Detect if this is a WO or SR and call the right endpoint
      const isWO = entityId.toUpperCase().startsWith('WO');
      const url = isWO
        ? `/api/staff/work-order/${encodeURIComponent(entityId)}/status`
        : `/api/service-request/${encodeURIComponent(entityId)}/status`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + staffAuthToken,
        },
        body: JSON.stringify({
          status: newStatus,
          notes: note || `Status changed to ${newStatus}`,
          note: note || `Status changed to ${newStatus}`,
          by: 'Staff',
        }),
      });
      if (res.status === 401) { deactivateStaffMode(); showStaffToast('Session expired'); return; }
      const result = await res.json();
      if (result.success) {
        closeStaffModal();
        showStaffToast(`âœ… ${entityId} â†’ ${newStatus.replace('_', ' ')}`);
        loadStaffDashboard();
      } else {
        showStaffToast(`âŒ ${result.error || 'Update failed'}`);
      }
    } else if (action.action === "inspect" || action === "inspect") {
      const issueType = document.getElementById("staff-modal-issuetype").value;
      const location = document.getElementById("staff-modal-location").value.trim();
      const zone = document.getElementById("staff-modal-zone").value;
      const reason = document.getElementById("staff-modal-reason")?.value?.trim() || "";
      if (!location) { showStaffToast('âŒ Location is required'); return; }
      // Direct REST call â€” no chat pipeline
      const scheduledDate = document.getElementById("staff-modal-inspdate")?.value || new Date().toISOString().split('T')[0];
      const srId = document.getElementById("staff-modal-srid")?.value || null;
      const res = await fetch('/api/staff/inspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + staffAuthToken,
        },
        body: JSON.stringify({
          issue_type: issueType,
          location: location,
          zone: zone,
          scheduled_date: scheduledDate,
          reason: reason || `Inspection for ${issueType} at ${location}`,
          sr_id: srId,
        }),
      });
      if (res.status === 401) { deactivateStaffMode(); showStaffToast('Session expired'); return; }
      const result = await res.json();
      if (result.success) {
        closeStaffModal();
        showStaffToast(`âœ… Inspection scheduled for ${issueType} at ${location}`);
        loadStaffDashboard();
      } else {
        showStaffToast(`âŒ ${result.error || 'Scheduling failed'}`);
      }
    }
  } catch (err) {
    showStaffToast("âŒ Action failed: " + err.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirm";
  }
}
window.executeStaffAction = executeStaffAction;

function showStaffToast(msg) {
  const toast = document.createElement("div");
  toast.className =
    "fixed bottom-24 right-8 z-[100] px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold";
  toast.style.cssText =
    "background:#1e293b;color:white;animation:staffFadeIn 0.3s ease;";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// â”€â”€ Keyboard Shortcuts â”€â”€
document.addEventListener("keydown", (e) => {
  // Close overlays first
  if (e.key === "Escape") {
    const cmdPalette = document.getElementById("cmd-palette-overlay");
    const shortcutOverlay = document.getElementById("shortcut-overlay");
    if (cmdPalette) {
      cmdPalette.remove();
      return;
    }
    if (shortcutOverlay) {
      shortcutOverlay.remove();
      return;
    }
    if (chatWidgetOpen) {
      if (chatSize === "fullscreen") {
        setChatSize("expanded");
        return;
      }
      if (chatSize === "expanded") {
        setChatSize("compact");
        return;
      }
      toggleChatWidget();
    }
    return;
  }
  // Command palette
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    toggleCommandPalette();
    return;
  }
  // Chat toggle
  if (e.ctrlKey && e.shiftKey && e.key === "K") {
    e.preventDefault();
    toggleChatWidget();
    return;
  }
  // Sidebar toggle
  if ((e.ctrlKey || e.metaKey) && e.key === "b") {
    e.preventDefault();
    toggleSidebar();
    return;
  }
  // Dark mode toggle
  if (e.ctrlKey && e.shiftKey && e.key === "D") {
    e.preventDefault();
    toggleDarkMode();
    return;
  }
  // Keyboard shortcut overlay
  if (
    e.key === "?" &&
    !e.ctrlKey &&
    !e.metaKey &&
    document.activeElement?.tagName !== "INPUT" &&
    document.activeElement?.tagName !== "TEXTAREA"
  ) {
    showKeyboardShortcuts();
    return;
  }
});

// â”€â”€ Sidebar Toggle â”€â”€
function toggleSidebar() {
  const nav = document.getElementById('side-nav');
  nav.classList.toggle('collapsed');
  const isCollapsed = nav.classList.contains('collapsed');
  localStorage.setItem('civicLensSidebarCollapsed', isCollapsed ? '1' : '0');
}
window.toggleSidebar = toggleSidebar;

// Restore sidebar state on load
(function restoreSidebar() {
  if (localStorage.getItem('civicLensSidebarCollapsed') === '1') {
    const nav = document.getElementById('side-nav');
    if (nav) nav.classList.add('collapsed');
  }
})();

// â”€â”€ Dark Mode Toggle â”€â”€
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem("civicLensTheme", isDark ? "light" : "dark");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");
  if (icon) icon.textContent = isDark ? "dark_mode" : "light_mode";
  if (label) label.textContent = isDark ? "Dark Mode" : "Light Mode";
  showToast(isDark ? "Light mode enabled" : "Dark mode enabled", "info");
}
window.toggleDarkMode = toggleDarkMode;

// Restore theme on load
(function restoreTheme() {
  const saved = localStorage.getItem("civicLensTheme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    const icon = document.getElementById("theme-icon");
    const label = document.getElementById("theme-label");
    if (icon) icon.textContent = "light_mode";
    if (label) label.textContent = "Light Mode";
  }
})();

// â”€â”€ Toast Notification System â”€â”€
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const icons = {
    success: "check_circle",
    error: "error",
    info: "info",
    warning: "warning",
  };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
  <span class="material-symbols-outlined" style="font-size:20px">${icons[type] || "info"}</span>
  <span style="flex:1">${message}</span>
  <button onclick="this.parentElement.remove()" style="color:inherit;opacity:0.5;background:none;border:none;cursor:pointer;font-size:18px">&times;</button>
  <div class="toast-progress" style="animation-duration:${duration}ms"></div>
`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
window.showToast = showToast;

// â”€â”€ Command Palette â”€â”€
const CMD_ACTIONS = [
  {
    icon: "home",
    label: "Go to Home",
    shortcut: "",
    action: () => {
      document.querySelector('[data-nav="home"]')?.click();
    },
  },
  {
    icon: "add_circle",
    label: "Report an Issue",
    shortcut: "",
    action: () => {
      window.openServicePortal?.();
    },
  },
  {
    icon: "map",
    label: "Open Map",
    shortcut: "",
    action: () => {
      window.openCivicMap?.();
    },
  },
  {
    icon: "insights",
    label: "View Insights",
    shortcut: "",
    action: () => {
      window.openInsights?.();
    },
  },
  {
    icon: "chat_bubble",
    label: "Open Chat",
    shortcut: "Ctrl+Shift+K",
    action: () => {
      if (!chatWidgetOpen) toggleChatWidget();
    },
  },
  {
    icon: "dark_mode",
    label: "Toggle Dark Mode",
    shortcut: "Ctrl+Shift+D",
    action: () => {
      toggleDarkMode();
    },
  },
  {
    icon: "keyboard",
    label: "Keyboard Shortcuts",
    shortcut: "?",
    action: () => {
      showKeyboardShortcuts();
    },
  },
  {
    icon: "help",
    label: "How It Works",
    shortcut: "",
    action: () => {
      window.showHowItWorks?.();
    },
  },
  {
    icon: "priority_high",
    label: "Ask: Priority Areas",
    shortcut: "",
    action: () => {
      toggleChatWidget();
      setTimeout(() => {
        input.value = "What areas need the most attention right now?";
        form.dispatchEvent(new Event("submit"));
      }, 300);
    },
  },
  {
    icon: "shield",
    label: "Ask: Safety Analysis",
    shortcut: "",
    action: () => {
      toggleChatWidget();
      setTimeout(() => {
        input.value = "Give me a safety analysis across all zones";
        form.dispatchEvent(new Event("submit"));
      }, 300);
    },
  },
  {
    icon: "trending_up",
    label: "Ask: Trend Forecast",
    shortcut: "",
    action: () => {
      toggleChatWidget();
      setTimeout(() => {
        input.value = "Show me infrastructure trends and forecasts";
        form.dispatchEvent(new Event("submit"));
      }, 300);
    },
  },
];

function toggleCommandPalette() {
  const existing = document.getElementById("cmd-palette-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "cmd-palette-overlay";
  overlay.className = "cmd-palette-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  let activeIdx = 0;
  overlay.innerHTML = `
  <div class="cmd-palette">
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0 1.25rem;border-bottom:1px solid var(--md-outline-variant)">
      <span class="material-symbols-outlined" style="font-size:20px;color:var(--md-outline)">search</span>
      <input class="cmd-palette-input" placeholder="Type a command..." autofocus style="border:none;padding-left:0"/>
    </div>
    <div class="cmd-palette-results" id="cmd-results"></div>
    <div style="padding:0.5rem 1rem;border-top:1px solid var(--md-outline-variant);display:flex;gap:1rem;align-items:center">
      <span style="font-size:0.7rem;color:var(--md-outline)"><span class="kbd" style="font-size:0.65rem">â†‘â†“</span> navigate</span>
      <span style="font-size:0.7rem;color:var(--md-outline)"><span class="kbd" style="font-size:0.65rem">â†µ</span> select</span>
      <span style="font-size:0.7rem;color:var(--md-outline)"><span class="kbd" style="font-size:0.65rem">Esc</span> close</span>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  const inputEl = overlay.querySelector(".cmd-palette-input");
  const resultsEl = document.getElementById("cmd-results");

  function renderResults(filter) {
    const filtered = CMD_ACTIONS.filter((a) =>
      a.label.toLowerCase().includes((filter || "").toLowerCase()),
    );
    activeIdx = 0;
    resultsEl.innerHTML = filtered
      .map(
        (a, i) => `
    <div class="cmd-result ${i === 0 ? "active" : ""}" data-idx="${i}">
      <span class="material-symbols-outlined">${a.icon}</span>
      <span>${a.label}</span>
      ${a.shortcut ? `<span class="cmd-result-shortcut">${a.shortcut}</span>` : ""}
    </div>
  `,
      )
      .join("");
    resultsEl.querySelectorAll(".cmd-result").forEach((el, i) => {
      el.onclick = () => {
        overlay.remove();
        filtered[i].action();
      };
    });
    return filtered;
  }

  let filteredActions = renderResults("");

  inputEl.addEventListener("input", () => {
    filteredActions = renderResults(inputEl.value);
  });

  inputEl.addEventListener("keydown", (e) => {
    const items = resultsEl.querySelectorAll(".cmd-result");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
    }
    items.forEach((el, i) =>
      el.classList.toggle("active", i === activeIdx),
    );
    items[activeIdx]?.scrollIntoView({ block: "nearest" });
    if (e.key === "Enter" && items[activeIdx]) {
      overlay.remove();
      filteredActions[activeIdx]?.action();
    }
  });
}
window.toggleCommandPalette = toggleCommandPalette;

// â”€â”€ Keyboard Shortcut Overlay â”€â”€
function showKeyboardShortcuts() {
  const existing = document.getElementById("shortcut-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "shortcut-overlay";
  overlay.className = "shortcut-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  const shortcuts = [
    ["Open Command Palette", "Ctrl", "K"],
    ["Toggle Chat Widget", "Ctrl", "Shift", "K"],
    ["Toggle Dark Mode", "Ctrl", "Shift", "D"],
    ["Toggle Sidebar", "Ctrl", "B"],
    ["Close / Shrink Panel", "Esc"],
    ["Show Shortcuts", "?"],
  ];

  overlay.innerHTML = `
  <div class="shortcut-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
      <h2 class="text-lg font-bold font-display" style="color:var(--md-on-surface)">
        <span class="material-symbols-outlined" style="vertical-align:middle;margin-right:0.5rem;color:var(--md-secondary)">keyboard</span>
        Keyboard Shortcuts
      </h2>
      <button onclick="document.getElementById('shortcut-overlay').remove()" style="color:var(--md-outline);background:none;border:none;cursor:pointer;font-size:1.25rem">&times;</button>
    </div>
    ${shortcuts
      .map(
        ([label, ...keys]) => `
      <div class="shortcut-row">
        <span style="font-size:0.875rem;color:var(--md-on-surface)">${label}</span>
        <div style="display:flex;gap:0.25rem">${keys.map((k) => `<span class="kbd">${k}</span>`).join('<span style="color:var(--md-outline);font-size:0.75rem;display:flex;align-items:center">+</span>')}</div>
      </div>
    `,
      )
      .join("")}
    <div style="margin-top:1.5rem;text-align:center">
      <span style="font-size:0.75rem;color:var(--md-outline)">Press <span class="kbd">Esc</span> to close</span>
    </div>
  </div>`;

  document.body.appendChild(overlay);
}
window.showKeyboardShortcuts = showKeyboardShortcuts;

// â”€â”€ Material Ripple Effect â”€â”€
document.addEventListener("click", (e) => {
  const container = e.target.closest(".ripple-container");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = e.clientX - rect.left - size / 2 + "px";
  ripple.style.top = e.clientY - rect.top - size / 2 + "px";
  container.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

// â”€â”€ Animated Counter â”€â”€
function animateCount(el, target, duration = 800) {
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

// Auto-animate counters when dashboard loads
const dashObserver = new MutationObserver(() => {
  document
    .querySelectorAll(".pulse-stat .font-extrabold")
    .forEach((el) => {
      const val = parseInt(el.textContent);
      if (!isNaN(val) && !el.dataset.animated) {
        el.dataset.animated = "1";
        el.textContent = "0";
        setTimeout(() => animateCount(el, val), 200);
      }
    });
});
const dashContent = document.getElementById("dash-content");
if (dashContent)
  dashObserver.observe(dashContent, { childList: true, subtree: true });

// â”€â”€ Scroll Reveal â”€â”€
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 },
);

// â”€â”€ AI Service Request Integration â”€â”€
function showServiceRequestCard(intentData) {
  const card = document.createElement("div");
  card.className = "msg-animate";
  const category =
    intentData?.filters?.category ||
    intentData?.action_params?.category ||
    "";
  const address =
    intentData?.filters?.street ||
    intentData?.action_params?.address ||
    "";
  const description = intentData?.summary || "";
  card.innerHTML = `
  <div class="sr-create-card border rounded-2xl p-4 shadow-sm cursor-pointer" style="background:linear-gradient(135deg,#e6f5f3,#ccebe8);border-color:#b2dfdb" onclick="openPrefilled('${escapeHtml(category)}','${escapeHtml(address)}','${escapeHtml(description)}')">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(0,106,97,0.15)">
        ${CivicIcons.plus("w-5 h-5")} 
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold font-display" style="color:var(--md-secondary)">Create Service Request</p>
        <p class="text-xs truncate" style="color:var(--md-on-surface-variant)">Tap to open the form pre-filled with your issue details</p>
      </div>
      <span class="material-symbols-outlined" style="font-size:20px;color:var(--md-outline)">chevron_right</span>
    </div>
  </div>`;
  messagesDiv.appendChild(card);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function openPrefilled(category, address, description) {
  window._srPrefill = { category, address, description };
  window.openServicePortal?.();
}

// Stage metadata
const STAGES = [
  {
    key: "intent",
    name: "Intent Classification",
    icon: '<svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    color: "teal",
    desc: "NLP classifies query type & extracts filters",
  },
  {
    key: "data",
    name: "Data Retrieval (MCP)",
    icon: '<svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    color: "blue",
    desc: "Fetches from 8 MCP tools via JSON-RPC 2.0",
  },
  {
    key: "synthesis",
    name: "AI Report Synthesis",
    icon: '<svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 3-2 5-4 6.5V18H9v-2.5C7 14 5 12 5 9a7 7 0 017-7z"/><path d="M9 22h6"/><path d="M9 18h6"/></svg>',
    color: "purple",
    desc: "GPT-4o-mini + RAG knowledge grounding",
  },
  {
    key: "feedback",
    name: "Quality Feedback",
    icon: '<svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
    color: "amber",
    desc: "Coverage check â€” retries if below 40%",
  },
  {
    key: "report",
    name: "Report Formatting",
    icon: '<svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    color: "green",
    desc: "Evidence-based coverage scoring & markdown",
  },
];

const stageState = {};
let pipelineStartTime = null;
let timerInterval = null;

function askSuggestion(btn) {
  if (!chatWidgetOpen) toggleChatWidget();
  input.value = btn.textContent.trim();
  form.dispatchEvent(new Event("submit"));
}

function addMessage(role, content) {
  messageCount++;
  const div = document.createElement("div");
  div.className = `msg-animate ${role === "user" ? "ml-auto max-w-[85%]" : "max-w-full"}`;
  if (role === "user") {
    div.innerHTML = `<div class="text-white rounded-2xl rounded-br-md px-4 py-2.5 inline-block text-sm shadow-sm" style="background:var(--md-primary)">${escapeHtml(content)}</div>`;
  } else {
    let processedContent = content;
    const collapseThreshold = window.innerWidth < 768 ? 400 : 800;
    if (content.length > collapseThreshold) {
      processedContent = makeCollapsibleSections(content);
    }
    div.innerHTML = `
    <div class="bg-white rounded-2xl rounded-bl-md p-4 shadow-sm border prose text-sm leading-relaxed" style="border-color:var(--md-outline-variant)">
      ${processedContent}
    </div>
    <div class="flex items-center gap-3 mt-1.5 ml-1">
      <button onclick="copyMessage(this)" class="text-[10px] flex items-center gap-1 transition" style="color:var(--md-outline)">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy
      </button>
    </div>`;
  }
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  maybeAutoExpand();
  if (!chatWidgetOpen) {
    document.getElementById("fab-unread")?.classList.remove("hidden");
  }
  return div;
}

function makeCollapsibleSections(html) {
  const parts = html.split(/(<h2[^>]*>.*?<\/h2>)/gi);
  if (parts.length <= 2) return html;
  const isMobile = window.innerWidth < 768;
  let result = "";
  let sectionIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.match(/<h2[^>]*>/i)) {
      const nextContent = parts[i + 1] || "";
      const autoCollapse = isMobile && sectionIdx > 0;
      result += `
      <div class="response-section">
        <div class="response-section-toggle flex items-center gap-1.5" onclick="toggleSection(this)">
          <svg class="w-3 h-3 transition-transform section-arrow" style="color:var(--md-secondary);${autoCollapse ? "transform:rotate(-90deg)" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          ${part}
        </div>
        <div class="response-section-body${autoCollapse ? " collapsed" : ""}" id="section-${sectionIdx++}">
          ${nextContent}
        </div>
      </div>`;
      i++;
    } else {
      result += part;
    }
  }
  return result;
}

function toggleSection(el) {
  const body = el.nextElementSibling;
  const arrow = el.querySelector(".section-arrow");
  body.classList.toggle("collapsed");
  arrow.style.transform = body.classList.contains("collapsed")
    ? "rotate(-90deg)"
    : "";
}
window.toggleSection = toggleSection;

function copyMessage(btn) {
  const prose = btn.closest(".msg-animate")?.querySelector(".prose");
  if (!prose) return;
  navigator.clipboard.writeText(prose.innerText).then(() => {
    btn.innerHTML =
      '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied';
    setTimeout(() => {
      btn.innerHTML =
        '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy';
    }, 2000);
  });
}
window.copyMessage = copyMessage;

function addThinking() {
  const div = document.createElement("div");
  div.id = "thinking";
  div.innerHTML = `
  <div class="bg-white rounded-xl px-3 py-2.5 shadow-sm border flex items-center gap-2 text-xs" style="border-color:var(--md-outline-variant);color:var(--md-outline)">
    <span class="thinking-dot w-2 h-2 rounded-full inline-block" style="background:var(--md-secondary)"></span>
    <span class="thinking-dot w-2 h-2 rounded-full inline-block" style="background:var(--md-secondary)"></span>
    <span class="thinking-dot w-2 h-2 rounded-full inline-block" style="background:var(--md-secondary)"></span>
    <span class="ml-1">Processing...</span>
  </div>`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function removeThinking() {
  const el = document.getElementById("thinking");
  if (el) el.remove();
}

// â”€â”€ Inline Pipeline Tracker â”€â”€
let inlinePipelineEl = null;
let inlineTimerInterval = null;
let inlinePipelineStart = null;

const IP_STAGE_LABELS = [
  "Intent",
  "Data",
  "Synthesis",
  "Feedback",
  "Report",
];
const IP_STAGE_ICONS = [
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 3-2 5-4 6.5V18H9v-2.5C7 14 5 12 5 9a7 7 0 017-7z"/><path d="M9 22h6"/><path d="M9 18h6"/></svg>',
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
];

function addInlinePipeline() {
  removeThinking();
  const existing = document.getElementById("inline-pipeline");
  if (existing) existing.remove();

  inlinePipelineStart = Date.now();
  const div = document.createElement("div");
  div.id = "inline-pipeline";
  div.className = "msg-animate max-w-full";
  div.innerHTML = `
  <div class="ip-container">
    <div class="ip-header">
      <span class="material-symbols-outlined" style="font-size:16px;color:var(--md-secondary)">bolt</span>
      <span style="font-size:12px;font-weight:700;color:var(--md-secondary)" class="font-display">Pipeline</span>
      <span style="font-size:10px;color:var(--md-outline)" id="ip-status">Starting...</span>
      <span class="ml-auto" style="font-size:12px;font-family:monospace;font-weight:700;color:var(--md-secondary)" id="ip-timer">0.0s</span>
    </div>
    <div class="ip-flow-row" id="ip-flow-row">
      ${STAGES.map(
        (s, i) => `
        <div class="ip-flow-dot waiting" id="ip-dot-${s.key}" title="${IP_STAGE_LABELS[i]}">
          <svg style="color:var(--md-outline)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${IP_STAGE_ICONS[i].match(/<svg[^>]*>(.*)<\/svg>/s)?.[1] || ""}</svg>
        </div>
        ${i < STAGES.length - 1 ? '<div class="ip-connector" id="ip-conn-' + i + '"></div>' : ""}
      `,
      ).join("")}
    </div>
    <div class="ip-stages" id="ip-stages">
      ${STAGES.map((s, i) => renderInlineStageRow(s, { status: "waiting", index: i })).join("")}
    </div>
  </div>`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  inlinePipelineEl = div;

  // Start inline timer
  clearInterval(inlineTimerInterval);
  inlineTimerInterval = setInterval(() => {
    const elapsed = ((Date.now() - inlinePipelineStart) / 1000).toFixed(
      1,
    );
    const t = document.getElementById("ip-timer");
    if (t) t.textContent = elapsed + "s";
  }, 100);
}

function renderInlineStageRow(stage, data) {
  const isRunning = data.status === "running";
  const isComplete = data.status === "completed";
  const statusClass = isRunning
    ? "running"
    : isComplete
      ? "completed"
      : "waiting";

  let statusIcon = "";
  if (isRunning)
    statusIcon = `<div style="width:12px;height:12px;border:2px solid var(--md-secondary);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>`;
  else if (isComplete)
    statusIcon = `<span style="color:#22c55e;font-size:13px" class="material-symbols-outlined">check_circle</span>`;
  else
    statusIcon = `<span style="color:var(--md-outline);font-size:13px;opacity:0.4" class="material-symbols-outlined">circle</span>`;

  const meta = STAGES.find((s) => s.key === stage.key) || stage;
  let detailText = "";
  if (isRunning) {
    detailText = `<div class="ip-detail-text">${meta.desc}</div>`;
  } else if (isComplete && data.detail) {
    detailText = `<div class="ip-detail-text">${renderInlineDetail(stage.key, data.detail)}</div>`;
  }

  let durationBadge = "";
  if (data.duration_ms != null) {
    const color =
      data.duration_ms < 500
        ? "#22c55e"
        : data.duration_ms < 2000
          ? "#eab308"
          : "#ef4444";
    durationBadge = `<span style="font-size:9px;color:${color};font-family:monospace;font-weight:600">${data.duration_ms}ms</span>`;
  }

  const idx = STAGES.findIndex((s) => s.key === stage.key);
  return `
  <div class="ip-stage-row ${statusClass}">
    <div class="ip-stage-icon">${IP_STAGE_ICONS[idx] || ""}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:11px;font-weight:700;color:var(--md-on-surface)" class="font-display">${meta.name}</span>
        ${durationBadge}
        <span style="margin-left:auto">${statusIcon}</span>
      </div>
      ${detailText}
    </div>
  </div>`;
}

function renderInlineDetail(key, detail) {
  switch (key) {
    case "intent": {
      const intent = detail.intent?.replace(/_/g, " ") || "";
      const summary = detail.summary
        ? ` â€” "${detail.summary.slice(0, 60)}"`
        : "";
      let filters = "";
      if (
        detail.filters &&
        Object.keys(detail.filters).some((k) => detail.filters[k])
      ) {
        filters =
          " " +
          Object.entries(detail.filters)
            .filter(([, v]) => v)
            .map(
              ([k, v]) =>
                `<span class="ip-tag" style="background:#e6f5f3;color:var(--md-secondary)">${k}: ${v}</span>`,
            )
            .join("");
      }
      return `<span class="ip-tag" style="background:#e6f5f3;color:var(--md-secondary)">${intent}</span>${summary}${filters}`;
    }
    case "data": {
      // Deduplicate tools and show counts for repeated calls
      const toolCounts = {};
      (detail.tools_called || []).forEach((t) => {
        toolCounts[t] = (toolCounts[t] || 0) + 1;
      });
      const tools = Object.entries(toolCounts)
        .map(([t, c]) => {
          const label = t.replace(/_/g, " ");
          return `<span class="ip-tag" style="background:#dbeafe;color:#2563eb">${label}${c > 1 ? " Ã—" + c : ""}</span>`;
        })
        .join("");
      const records = detail.records_fetched || 0;
      const errors = detail.errors?.length
        ? ` <span class="ip-tag" style="background:#fef2f2;color:#dc2626">${detail.errors.length} error(s)</span>`
        : "";
      return `${tools} <span style="font-size:10px;color:var(--md-outline)">${records} records</span>${errors}`;
    }
    case "synthesis": {
      const rag = detail.rag_sources?.length
        ? `<span class="ip-tag" style="background:#f3e8ff;color:#7c3aed">${detail.rag_sources.length} RAG docs</span>`
        : "";
      return `<span class="ip-tag" style="background:#f3e8ff;color:#7c3aed">gpt-4o-mini</span> ${detail.findings || 0} findings, ${detail.recommendations || 0} recommendations ${rag}`;
    }
    case "feedback": {
      if (detail.skipped)
        return `<span class="ip-tag" style="background:#fef3c7;color:#92400e">Coverage ${detail.coverage_pct}% â€” OK, no retry needed</span>`;
      if (detail.reason)
        return `<span class="ip-tag" style="background:#fef3c7;color:#92400e">${detail.reason}</span>`;
      if (detail.new_records != null)
        return `<span class="ip-tag" style="background:#fef3c7;color:#92400e">Retry fetched ${detail.new_records} new records</span>`;
      return "Quality check";
    }
    case "report": {
      const cov = detail.data_coverage;
      if (!cov) return "Formatted";
      const pct = cov.score || 0;
      const color =
        pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
      return `Coverage: <span style="font-weight:700;color:${color}">${pct}%</span> <span style="font-size:10px;color:var(--md-outline)">(${cov.sources_consulted}/${cov.total_sources} sources, ${cov.records_analyzed} records)</span>`;
    }
    default:
      return "";
  }
}

function updateInlinePipeline(stageKey, data) {
  // Update flow dots
  const dot = document.getElementById("ip-dot-" + stageKey);
  if (dot) {
    dot.className = "ip-flow-dot " + data.status;
  }
  const idx = STAGES.findIndex((s) => s.key === stageKey);
  if (data.status === "completed" && idx > 0) {
    const conn = document.getElementById("ip-conn-" + (idx - 1));
    if (conn) conn.classList.add("done");
  }

  // Update status text
  const statusEl = document.getElementById("ip-status");
  if (statusEl) {
    const stageName = STAGES[idx]?.name || stageKey;
    statusEl.textContent =
      data.status === "running"
        ? `Running: ${stageName}...`
        : `${stageName} completed`;
  }

  // Re-render stage rows
  const stagesEl = document.getElementById("ip-stages");
  if (stagesEl) {
    stagesEl.innerHTML = STAGES.map((s, i) => {
      const state = stageState[s.key] || { status: "waiting", index: i };
      return renderInlineStageRow(s, state);
    }).join("");
  }

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function collapseInlinePipeline(finalData) {
  clearInterval(inlineTimerInterval);
  if (!inlinePipelineEl) return;

  const totalMs =
    finalData?.pipeline?.total_duration_ms ||
    Date.now() - (inlinePipelineStart || Date.now());
  const totalTime = (totalMs / 1000).toFixed(1);
  const stageCount = finalData?.pipeline?.stages?.length || STAGES.length;

  // Compact waterfall
  let waterfallHtml = "";
  if (finalData?.pipeline?.stages?.length) {
    const colors = [
      "#006a61",
      "#3b82f6",
      "#8b5cf6",
      "#f59e0b",
      "#22c55e",
    ];
    const stageNames = {
      intent: "Intent",
      data: "MCP",
      synthesis: "LLM",
      feedback: "QA",
      report: "Fmt",
    };
    waterfallHtml =
      `<div style="padding:6px 8px">` +
      finalData.pipeline.stages
        .map((s, i) => {
          const pct = Math.max((s.duration_ms / totalMs) * 100, 6);
          return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px"><span style="width:32px;text-align:right;font-size:9px;color:var(--md-outline)">${stageNames[s.name] || s.name}</span><div style="flex:1;height:14px;border-radius:3px;background:var(--md-surface-container);overflow:hidden;position:relative"><div style="width:${pct}%;height:100%;background:${colors[i]};border-radius:0 3px 3px 0;display:flex;align-items:center;padding:0 4px"><span style="font-size:8px;color:white;font-family:monospace;font-weight:600">${s.duration_ms}ms</span></div></div></div>`;
        })
        .join("") +
      `</div>`;
  }

  // Compact collapsed bar
  const stageDots = STAGES.map(
    () => '<div class="ip-mini-dot"></div>',
  ).join("");

  inlinePipelineEl.innerHTML = `
  <div>
    <div class="ip-collapsed-bar" onclick="toggleInlinePipeline(this)">
      <span class="material-symbols-outlined" style="font-size:14px;color:var(--md-secondary)">bolt</span>
      <div class="ip-mini-dots">${stageDots}</div>
      <span style="font-size:11px;font-weight:700;color:var(--md-on-surface)" class="font-display">Pipeline</span>
      <span style="font-size:10px;color:var(--md-outline)">${stageCount} stages Â· ${totalTime}s</span>
      <span class="material-symbols-outlined ip-collapsed-chevron" style="font-size:16px;color:var(--md-outline)">expand_more</span>
    </div>
    <div class="ip-expanded-body" id="ip-expanded-body">
      <div class="ip-container" style="margin-top:6px;">
        <div class="ip-stages">${STAGES.map((s, i) => renderInlineStageRow(s, stageState[s.key] || { status: "completed", index: i })).join("")}</div>
        ${waterfallHtml}
      </div>
    </div>
  </div>`;
}

function toggleInlinePipeline(bar) {
  const body = bar.nextElementSibling;
  const chevron = bar.querySelector(".ip-collapsed-chevron");
  body.classList.toggle("open");
  chevron.classList.toggle("open");
}
window.toggleInlinePipeline = toggleInlinePipeline;

function escapeHtml(text) {
  return window.CivicUtils.escapeHtml(text);
}

// â”€â”€ Pipeline Timer â”€â”€
function startTimer() {
  pipelineStartTime = Date.now();
  const timerEl = document.getElementById("pipeline-timer");
  const timerVal = document.getElementById("timer-value");
  timerEl.classList.remove("hidden");
  timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - pipelineStartTime) / 1000).toFixed(1);
    timerVal.textContent = elapsed + "s";
  }, 100);
}

function stopTimer(totalMs) {
  clearInterval(timerInterval);
  document.getElementById("timer-value").textContent =
    (totalMs / 1000).toFixed(1) + "s";
}

// â”€â”€ Flow Dot Updates â”€â”€
function updateFlowDots(stageKey, status) {
  const dots = document.querySelectorAll(".flow-dot");
  const connectors = document.querySelectorAll(".flow-connector");
  const idx = STAGES.findIndex((s) => s.key === stageKey);
  if (idx < 0) return;

  const dot = dots[idx];
  if (status === "running") {
    dot.classList.add("pulse-active");
    dot.style.borderColor = "var(--md-secondary)";
    dot.style.background = "#e6f5f3";
  } else if (status === "completed") {
    dot.classList.remove("pulse-active");
    dot.style.borderColor = "#22c55e";
    dot.style.background = "#dcfce7";
    if (idx > 0) {
      connectors[idx - 1].style.background = "#22c55e";
      connectors[idx - 1].style.height = "3px";
    }
  }
}

function resetFlowDots() {
  document.querySelectorAll(".flow-dot").forEach((d) => {
    d.classList.remove("pulse-active");
    d.style.borderColor = "var(--md-outline-variant)";
    d.style.background = "white";
  });
  document.querySelectorAll(".flow-connector").forEach((c) => {
    c.style.background = "var(--md-outline-variant)";
    c.style.height = "2px";
  });
}

// â”€â”€ Stage Card Rendering â”€â”€
function renderStageCard(stage, data) {
  const meta = STAGES.find((s) => s.key === stage.key) || STAGES[0];
  const isRunning = data.status === "running";
  const isComplete = data.status === "completed";
  const statusClass = isRunning
    ? "running"
    : isComplete
      ? "completed"
      : "waiting";

  let statusIcon = "";
  if (isRunning)
    statusIcon = `<div class="w-4 h-4 border-2 border-t-transparent rounded-full spinner" style="border-color:var(--md-secondary);border-top-color:transparent"></div>`;
  else if (isComplete)
    statusIcon = `<span class="text-green-500 text-sm font-bold">&#10003;</span>`;
  else
    statusIcon = `<span class="text-sm" style="color:var(--md-outline)">&#9675;</span>`;

  let detailHtml = "";
  if (data.detail && isComplete) {
    detailHtml = renderStageDetail(stage.key, data.detail);
  }

  let durationBadge = "";
  if (data.duration_ms != null) {
    const color =
      data.duration_ms < 500
        ? "green"
        : data.duration_ms < 2000
          ? "yellow"
          : "red";
    durationBadge = `<span class="text-xs px-1.5 py-0.5 rounded bg-${color}-100 text-${color}-700 font-mono">${data.duration_ms}ms</span>`;
  }

  return `
  <div class="stage-card stage-animate border p-3 cursor-pointer ${statusClass}" 
       onclick="this.querySelector('.detail-expand')?.classList.toggle('open')" 
       style="animation-delay: ${data.index * 0.08}s;border-color:var(--md-outline-variant)">
    <div class="flex items-center gap-2">
      <span class="text-lg">${meta.icon}</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold font-display" style="color:var(--md-on-surface)">${meta.name}</div>
        <div class="text-xs" style="color:var(--md-outline)">${isRunning ? meta.desc : data.detail ? summarizeDetail(stage.key, data.detail) : meta.desc}</div>
      </div>
      <div class="flex items-center gap-1.5">
        ${durationBadge}
        ${statusIcon}
      </div>
    </div>
    ${detailHtml ? `<div class="detail-expand mt-2 border-t pt-2" style="border-color:var(--md-outline-variant)">${detailHtml}</div>` : ""}
  </div>`;
}

function summarizeDetail(key, detail) {
  switch (key) {
    case "intent":
      return `\u2192 ${detail.intent?.replace(/_/g, " ")} \u2014 "${(detail.summary || "").slice(0, 50)}"`;
    case "data": {
      const tools = detail.tools_called?.length || 0;
      const errs = detail.errors?.length || 0;
      return `${tools} tools \u00b7 ${detail.records_fetched || 0} records${errs ? ` \u00b7 ${CivicIcons.alertTriangle("w-3 h-3 inline")} ${errs} errors` : ""}`;
    }
    case "synthesis":
      return `${detail.findings || 0} findings \u00b7 ${detail.sections || 0} sections \u00b7 ${detail.recommendations || 0} actions`;
    case "report":
      return `Coverage: ${detail.data_coverage?.score || "?"}% \u00b7 ${detail.markdown_length || 0} chars`;
    default:
      return "";
  }
}

function renderStageDetail(key, detail) {
  let html = '<div class="space-y-1.5">';
  switch (key) {
    case "intent":
      html += detailRow(
        "Intent",
        `<span class="px-1.5 py-0.5 rounded text-xs font-medium" style="background:#e6f5f3;color:var(--md-secondary)">${detail.intent?.replace(/_/g, " ")}</span>`,
      );
      html += detailRow("Summary", detail.summary || "\u2014");
      if (
        detail.filters &&
        Object.keys(detail.filters).some((k) => detail.filters[k])
      ) {
        const filters = Object.entries(detail.filters)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        html += detailRow("Filters", filters);
      }
      break;
    case "data":
      if (detail.tools_called?.length) {
        html += detailRow(
          "Tools",
          detail.tools_called
            .map(
              (t) =>
                `<span class="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs mb-0.5">${t.replace(/_/g, " ")}</span>`,
            )
            .join(" "),
        );
      }
      html += detailRow(
        "Records",
        `<span class="font-bold">${detail.records_fetched}</span> fetched`,
      );
      if (detail.errors?.length > 0) {
        html += `<div class="bg-red-50 border border-red-200 rounded p-2 mt-1">
        <div class="text-xs font-bold text-red-700">${CivicIcons.alertTriangle("w-3 h-3 inline")} ${detail.errors.length} Tool Error(s):</div>
        ${detail.errors.map((e) => `<div class="text-xs text-red-600">\u2022 ${escapeHtml(e.tool)}: ${escapeHtml(e.message)}</div>`).join("")}
      </div>`;
      }
      if (detail.fallback_used) {
        html += `<div class="text-xs text-amber-600 mt-1">${CivicIcons.wrench("w-3 h-3 inline")} Fallback recovery activated</div>`;
      }
      break;
    case "synthesis":
      html += detailRow(
        "Model",
        '<span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-mono">gpt-4o-mini</span>',
      );
      html += detailRow("Findings", detail.findings);
      html += detailRow("Sections", detail.sections);
      html += detailRow("Recommendations", detail.recommendations);
      if (detail.rag_sources?.length > 0) {
        html += detailRow(
          "RAG Docs",
          `${detail.rag_sources.length} retrieved`,
        );
      }
      break;
    case "feedback":
      if (detail.skipped) {
        html += detailRow(
          "Status",
          `<span class="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">Coverage ${detail.coverage_pct}% â€” no retry needed</span>`,
        );
      } else {
        if (detail.reason) html += detailRow("Reason", detail.reason);
        if (detail.new_records != null)
          html += detailRow(
            "Retry Result",
            `${detail.new_records} new records fetched`,
          );
      }
      break;
    case "report":
      if (detail.data_coverage) {
        const c = detail.data_coverage;
        const pct = c.score;
        const color = pct >= 75 ? "green" : pct >= 50 ? "yellow" : "red";
        html += `<div class="mb-1">
        <div class="flex items-center gap-2">
          <span class="text-xs" style="color:var(--md-outline)">Coverage</span>
          <div class="flex-1 h-2 rounded-full" style="background:var(--md-surface-container)"><div class="bg-${color}-500 h-full rounded-full bar-animate" style="width:${pct}%"></div></div>
          <span class="text-xs font-bold text-${color}-700">${pct}%</span>
        </div>
        <div class="text-xs mt-0.5" style="color:var(--md-outline)">${c.sources_consulted}/${c.total_sources} sources \u00b7 ${c.records_analyzed} records</div>
      </div>`;
        if (c.tools_used?.length) {
          html += `<div class="flex flex-wrap gap-1 mt-1">${c.tools_used
            .map(
              (t) =>
                `<span class="inline-block px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">${escapeHtml(t)}</span>`,
            )
            .join("")}</div>`;
        }
      }
      if (detail.actions_taken > 0) {
        html += detailRow(
          "Actions",
          `<span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">${CivicIcons.shield("w-3 h-3 inline")} ${detail.actions_taken} pending confirmation</span>`,
        );
      }
      break;
  }
  html += "</div>";
  return html;
}

function detailRow(label, value) {
  return `<div class="flex items-start gap-2 text-xs"><span class="whitespace-nowrap min-w-[60px]" style="color:var(--md-outline)">${label}</span><span style="color:var(--md-on-surface)">${value}</span></div>`;
}

// â”€â”€ Performance Waterfall â”€â”€
function renderWaterfall(pipeline) {
  const section = document.getElementById("waterfall-section");
  const chart = document.getElementById("waterfall-chart");
  const total = document.getElementById("waterfall-total");
  if (!pipeline?.stages?.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  const maxDuration = Math.max(
    ...pipeline.stages.map((s) => s.duration_ms),
  );
  const colors = ["#006a61", "#3b82f6", "#8b5cf6", "#22c55e"];
  const stageNames = {
    intent: "Intent",
    data: "MCP Data",
    synthesis: "LLM + RAG",
    report: "Format",
  };

  let offset = 0;
  chart.innerHTML = pipeline.stages
    .map((s, i) => {
      const pct = Math.max(
        (s.duration_ms / pipeline.total_duration_ms) * 100,
        4,
      );
      const left = (offset / pipeline.total_duration_ms) * 100;
      offset += s.duration_ms;
      return `
    <div class="flex items-center gap-2">
      <span class="text-xs w-16 text-right" style="color:var(--md-outline)">${stageNames[s.name] || s.name}</span>
      <div class="flex-1 h-5 rounded relative overflow-hidden" style="background:var(--md-surface-container)">
        <div class="waterfall-bar absolute h-full flex items-center px-1.5" style="left:${left}%;width:${pct}%;background:${colors[i]}">
          <span class="text-xs text-white font-mono whitespace-nowrap">${s.duration_ms}ms</span>
        </div>
      </div>
    </div>`;
    })
    .join("");

  total.textContent = `Total: ${pipeline.total_duration_ms}ms`;
}

// â”€â”€ RAG Sources Section â”€â”€
function renderRagSources(sources) {
  const section = document.getElementById("rag-section");
  const content = document.getElementById("rag-content");
  if (!sources?.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  content.innerHTML = sources
    .map((s) => {
      const pct = (s.score * 100).toFixed(0);
      const color = pct >= 80 ? "green" : pct >= 50 ? "yellow" : "gray";
      return `
    <div class="border rounded-lg p-2.5 stage-animate" style="background:#e6f5f3;border-color:#b2dfdb">
      <div class="flex items-start gap-2">
        <span class="text-xs">${CivicIcons.book("w-3 h-3")}</span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-semibold leading-tight" style="color:var(--md-secondary)">${escapeHtml(s.title)}</div>
          ${s.category ? `<span class="inline-block text-xs px-1 py-0.5 rounded mt-0.5" style="background:rgba(0,106,97,0.1);color:var(--md-secondary)">${s.category}</span>` : ""}
        </div>
        <div class="flex items-center gap-1">
          <div class="w-8 h-1.5 rounded-full overflow-hidden" style="background:var(--md-surface-container)"><div class="h-full bg-${color}-500 rounded-full" style="width:${pct}%"></div></div>
          <span class="text-xs font-mono" style="color:var(--md-secondary)">${pct}%</span>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

// â”€â”€ Coverage Gauge â”€â”€
function renderCoverageGauge(coverage) {
  const section = document.getElementById("coverage-section");
  const gauge = document.getElementById("coverage-gauge");
  if (!coverage?.score) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  const pct = coverage.score;
  const color = pct >= 75 ? "green" : pct >= 50 ? "yellow" : "red";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;
  const colorMap = {
    green: "#22c55e",
    yellow: "#eab308",
    red: "#ef4444",
  };

  gauge.innerHTML = `
  <div class="flex items-center gap-4">
    <div class="relative w-20 h-20 flex-shrink-0">
      <svg class="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" stroke="var(--md-surface-container)" stroke-width="6" fill="none"/>
        <circle cx="40" cy="40" r="36" stroke="${colorMap[color]}" stroke-width="6" fill="none"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
          style="transition: stroke-dashoffset 1s ease"/>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-lg font-bold text-${color}-600">${pct}%</span>
      </div>
    </div>
    <div class="text-xs space-y-1" style="color:var(--md-outline)">
      <div>${coverage.sources_consulted}/${coverage.total_sources} data sources queried</div>
      <div>${coverage.records_analyzed} records analyzed</div>
      ${
        coverage.tools_used
          ? `<div class="flex flex-wrap gap-1 mt-1">${coverage.tools_used
              .map(
                (t) =>
                  `<span class="px-1 py-0.5 rounded" style="background:var(--md-surface-container);color:var(--md-on-surface-variant)">${escapeHtml(t)}</span>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>
  </div>`;
}

// â”€â”€ How It Works Modal â”€â”€
window.showHowItWorks = function () {
  const existing = document.getElementById("how-it-works-overlay");
  if (existing) {
    existing.remove();
    return;
  }
  const overlay = document.createElement("div");
  overlay.id = "how-it-works-overlay";
  overlay.className =
    "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.innerHTML = `
  <div class="bg-white shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto p-6" style="border-radius:var(--md-radius-xl)">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold font-display" style="color:var(--md-on-surface)">How CivicLens Works</h2>
      <button onclick="document.getElementById('how-it-works-overlay').remove()" class="text-xl leading-none" style="color:var(--md-outline)">&times;</button>
    </div>
    <div class="space-y-4 text-sm" style="color:var(--md-on-surface-variant)">
      <div class="rounded-xl p-4" style="background:#e6f5f3">
        <h3 class="font-bold mb-1" style="color:var(--md-secondary)">${CivicIcons.target("w-4 h-4 inline")} Stage 1 â€” Intent Classification</h3>
        <p>Your message is analyzed by GPT-4o-mini to determine intent (report issue, check status, safety analysis, etc.) and extract filters like zone, severity, and street names.</p>
      </div>
      <div class="bg-blue-50 rounded-xl p-4">
        <h3 class="font-bold text-blue-800 mb-1">${CivicIcons.chart("w-4 h-4 inline")} Stage 2 â€” ReAct Data Agent (MCP)</h3>
        <p>A ReAct-style agent reasons step-by-step, selecting from <strong>14 MCP tools</strong> (potholes, sidewalks, schools, work orders, forecasting, cost-of-inaction, what-if budget). The agent loops up to 5 iterations, calling tools and reflecting on results until the query is fully answered.</p>
      </div>
      <div class="bg-purple-50 rounded-xl p-4">
        <h3 class="font-bold text-purple-800 mb-1">${CivicIcons.brain("w-4 h-4 inline")} Stage 3 â€” RAG Synthesis</h3>
        <p>GPT-4o-mini generates a narrative grounded in a <strong>11-document knowledge base</strong> using dual retrieval (dense embeddings + TF-IDF fallback). Inline citations [1], [2] reference specific policy documents.</p>
      </div>
      <div class="bg-green-50 rounded-xl p-4">
        <h3 class="font-bold text-green-800 mb-1">${CivicIcons.fileText("w-4 h-4 inline")} Stage 4 â€” Report Formatting &amp; RAI</h3>
        <p>The report is formatted with evidence-based coverage scoring. <strong>Responsible AI</strong> checks enforce fairness (no neighborhood-based bias), transparency (full data pipeline trace), and privacy (no PII in outputs).</p>
      </div>
      <div class="bg-amber-50 rounded-xl p-4">
        <h3 class="font-bold text-amber-800 mb-1">${CivicIcons.trendUp("w-4 h-4 inline")} Weibull Survival Model</h3>
        <p>Infrastructure priority scores use a <strong>Weibull survival analysis</strong> model â€” the same math used in industrial reliability engineering â€” to predict deterioration rates, expected failure dates, and cost-of-inaction estimates.</p>
      </div>
      <div class="rounded-xl p-4" style="background:var(--md-surface-container)">
        <h3 class="font-bold mb-1" style="color:var(--md-on-surface)">${CivicIcons.shield("w-4 h-4 inline")} Security &amp; Guardrails</h3>
        <p>Rate limiting (60 req/min), input sanitization, RBAC (public vs supervisor roles), human-in-the-loop action confirmation, and comprehensive security headers protect the platform.</p>
      </div>
    </div>
    <div class="mt-4 pt-4 text-xs text-center" style="border-top:1px solid var(--md-outline-variant);color:var(--md-outline)">
      Built with Node.js &middot; GitHub Models (GPT-4o-mini) &middot; MCP Protocol &middot; LangChain &middot; FAISS
    </div>
  </div>`;
  document.body.appendChild(overlay);
};

// â”€â”€ Report Inaccuracy â”€â”€
function addReportInaccuracyBtn(msgDiv) {
  const reportBtn = document.createElement("button");
  reportBtn.className = "mt-2 text-xs flex items-center gap-1 transition";
  reportBtn.style.color = "var(--md-outline)";
  reportBtn.innerHTML =
    CivicIcons.alertTriangle("w-3 h-3") + " Report inaccuracy";
  reportBtn.onmouseenter = () => {
    reportBtn.style.color = "#ef4444";
  };
  reportBtn.onmouseleave = () => {
    reportBtn.style.color = "var(--md-outline)";
  };
  reportBtn.onclick = () => {
    const note = prompt("Describe the inaccuracy (optional):");
    if (note === null) return;
    reportBtn.innerHTML =
      CivicIcons.checkCircle("w-3 h-3") +
      " Feedback recorded â€” thank you";
    reportBtn.disabled = true;
    reportBtn.style.color = "#22c55e";
    reportBtn.onmouseenter = null;
    reportBtn.onmouseleave = null;
    console.log("[CivicLens] Inaccuracy reported:", note);
  };
  const contentDiv = msgDiv.querySelector(".prose");
  if (contentDiv) contentDiv.appendChild(reportBtn);
}

// â”€â”€ Action Confirmation Modal â”€â”€
function showActionConfirmation(actions, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
  overlay.id = "action-confirm-overlay";
  const actionList = actions
    .map(
      (a) =>
        `<div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
    <span class="text-xl">${CivicIcons.alertTriangle("w-5 h-5")}</span>
    <div>
      <div class="font-semibold text-sm text-amber-900">${escapeHtml(a.label)}</div>
      <div class="text-xs text-amber-700 font-mono">${escapeHtml(JSON.stringify(a.args))}</div>
    </div>
  </div>`,
    )
    .join("");
  overlay.innerHTML = `
  <div class="bg-white shadow-2xl max-w-md w-full mx-4 p-6" style="border-radius:var(--md-radius-xl)">
    <h3 class="text-lg font-bold mb-2 font-display" style="color:var(--md-on-surface)">${CivicIcons.shield("w-5 h-5 inline")} Action Confirmation Required</h3>
    <p class="text-sm mb-4" style="color:var(--md-on-surface-variant)">The AI agent wants to perform the following actions. Please review before proceeding.</p>
    <div class="space-y-2 mb-4">${actionList}</div>
    <div class="flex gap-3 justify-end">
      <button id="action-cancel" class="px-4 py-2 text-sm border rounded-full" style="color:var(--md-on-surface-variant);border-color:var(--md-outline-variant)">Cancel</button>
      <button id="action-confirm" class="px-4 py-2 text-sm text-white font-medium rounded-full" style="background:var(--md-secondary)">Confirm & Execute</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById("action-cancel").onclick = () =>
    overlay.remove();
  document.getElementById("action-confirm").onclick = () => {
    overlay.remove();
    onConfirm();
  };
}

// â”€â”€ Visual Response Renderer â”€â”€
let vrChartCounter = 0;
function renderVisualResponse(finalData) {
  let html = "";

  // 1. Stat cards
  const stats = finalData.summary_stats || [];
  if (stats.length > 0) {
    html += '<div class="vr-stats">';
    stats.forEach((s) => {
      html += `<div class="vr-stat">
      <div class="vr-stat-icon" style="background:${s.color}">
        <span class="material-symbols-outlined" style="font-size:18px">${s.icon}</span>
      </div>
      <div><div class="vr-stat-val">${s.value}</div><div class="vr-stat-label">${s.label}</div></div>
    </div>`;
    });
    html += "</div>";
  }

  // 2. Inline chart
  const chart = finalData.chart_data;
  if (chart && chart.labels?.length) {
    const canvasId = "vr-chart-" + ++vrChartCounter;
    html += `<div class="vr-chart-wrap">
    <div class="vr-chart-title">${escapeHtml(chart.title || "Overview")}</div>
    <canvas id="${canvasId}"></canvas>
  </div>`;
    // Render chart after DOM insert
    requestAnimationFrame(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const isDark = document.body.classList.contains("dark-mode");
      const textColor = isDark ? "#c4c7c5" : "#444746";
      const gridColor = isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)";
      const chartType = chart.type === "pie" ? "doughnut" : "bar";
      const colors = chart.colors || [
        "#006a61",
        "#f59e0b",
        "#ef4444",
        "#3b82f6",
        "#8b5cf6",
        "#22c55e",
        "#ec4899",
        "#14b8a6",
      ];
      new Chart(canvas, {
        type: chartType,
        data: {
          labels: chart.labels,
          datasets: [
            {
              data: chart.values,
              backgroundColor: colors.slice(0, chart.labels.length),
              borderWidth: chartType === "doughnut" ? 2 : 0,
              borderColor: isDark ? "#1c1b1f" : "#fff",
              borderRadius: chartType === "bar" ? 6 : 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: chartType === "doughnut",
              position: "right",
              labels: {
                color: textColor,
                font: { size: 11 },
                padding: 8,
                usePointStyle: true,
                pointStyleWidth: 8,
              },
            },
          },
          scales:
            chartType === "bar"
              ? {
                  x: {
                    ticks: { color: textColor, font: { size: 10 } },
                    grid: { display: false },
                  },
                  y: {
                    ticks: { color: textColor, font: { size: 10 } },
                    grid: { color: gridColor },
                  },
                }
              : {},
        },
      });
    });
  }

  // 3. Markdown body (key findings + sections)
  const md = finalData.markdown || "";
  html += '<div class="vr-findings">' + DOMPurify.sanitize(marked.parse(md)) + "</div>";

  // 4. Tip card from recommended actions
  const actions = finalData.recommended_actions || [];
  if (actions.length > 0) {
    const tipList = actions
      .map((a) => `<div>• ${escapeHtml(a)}</div>`)
      .join("");
    html += `<div class="vr-tip">
    <span class="material-symbols-outlined vr-tip-icon">lightbulb</span>
    <div><strong style="font-size:12px">What You Can Do</strong>${tipList}</div>
  </div>`;
  }

  // 5. Data source footer
  const cov = finalData.report_meta?.data_coverage;
  if (cov) {
    html += `<div class="vr-meta">${cov.sources_consulted}/${cov.total_sources} sources Â· ${cov.records_analyzed} records Â· ${new Date().toLocaleDateString()}</div>`;
  }

  return html;
}

// â”€â”€ Coverage Bar (inline with messages) â”€â”€
function renderCoverageBar(coverage) {
  if (!coverage?.score) return "";
  const pct = coverage.score;
  const color =
    pct >= 75
      ? "bg-green-500"
      : pct >= 50
        ? "bg-yellow-500"
        : "bg-red-500";
  return `<div class="mt-3 flex items-center gap-2">
  <span class="text-xs whitespace-nowrap" style="color:var(--md-outline)">Data Coverage</span>
  <div class="flex-1 h-2 rounded-full overflow-hidden" style="background:var(--md-surface-container)">
    <div class="${color} h-full rounded-full transition-all" style="width: ${pct}%"></div>
  </div>
  <span class="text-xs font-medium" style="color:var(--md-on-surface)">${pct}%</span>
</div>
<div class="text-xs mt-1" style="color:var(--md-outline)">${coverage.sources_consulted}/${coverage.total_sources} sources \u00b7 ${coverage.records_analyzed} records</div>`;
}

// â”€â”€ Pipeline Reset â”€â”€
function resetPipeline() {
  Object.keys(stageState).forEach((k) => delete stageState[k]);
  resetFlowDots();
  document.getElementById("pipeline-subtitle").textContent =
    "Running pipeline...";
  document.getElementById("waterfall-section").classList.add("hidden");
  document.getElementById("rag-section").classList.add("hidden");
  document.getElementById("coverage-section").classList.add("hidden");

  traceContent.innerHTML = STAGES.map((s, i) =>
    renderStageCard(s, { status: "waiting", index: i }),
  ).join("");
}

// â”€â”€ SSE Stage Update â”€â”€
function handleStageEvent(data) {
  stageState[data.stage] = data;
  updateFlowDots(data.stage, data.status);

  // Update side trace panel
  traceContent.innerHTML = STAGES.map((s, i) => {
    const state = stageState[s.key] || { status: "waiting", index: i };
    return renderStageCard(s, state);
  }).join("");

  // Update inline pipeline in chat
  updateInlinePipeline(data.stage, data);
}

// â”€â”€ SSE Complete Handler â”€â”€
function handleComplete(data) {
  stopTimer(data.pipeline?.total_duration_ms || 0);
  document.getElementById("pipeline-subtitle").textContent =
    `Completed in ${((data.pipeline?.total_duration_ms || 0) / 1000).toFixed(1)}s`;

  renderWaterfall(data.pipeline);
  renderRagSources(data.rag_sources);
  renderCoverageGauge(data.report_meta?.data_coverage);
}

// â”€â”€ Main Form Submit â”€â”€
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  sendBtn.disabled = true;
  input.disabled = true;

  addMessage("user", message);
  addInlinePipeline();
  resetPipeline();
  startTimer();

  // Activate mobile pipeline button pulse
  const mpBtn = document.getElementById("mobile-pipeline-btn");
  if (mpBtn) {
    mpBtn.classList.add("pipeline-active");
    document.getElementById("mobile-pipeline-label").textContent =
      "Pipeline Running...";
  }

  try {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, role: chatRole }),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || "Request failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = null;
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ") && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === "stage") {
              handleStageEvent(data);
            } else if (currentEvent === "complete") {
              finalData = data;
              handleComplete(data);
            } else if (currentEvent === "error") {
              throw new Error(data.message);
            }
          } catch (parseErr) {
            if (parseErr.message !== "Unexpected end of JSON input")
              throw parseErr;
          }
          currentEvent = null;
        }
      }
    }

    // Collapse inline pipeline into summary bar
    collapseInlinePipeline(finalData);

    // Deactivate mobile pipeline button pulse
    const mpBtnDone = document.getElementById("mobile-pipeline-btn");
    if (mpBtnDone) {
      mpBtnDone.classList.remove("pipeline-active");
      updateMobilePipelineBtn();
    }

    if (finalData) {
      const html = renderVisualResponse(finalData);
      const msgDiv = addMessage("assistant", html);
      addReportInaccuracyBtn(msgDiv);

      if (finalData.actions_taken?.length > 0) {
        showActionConfirmation(finalData.actions_taken, () => {
          addMessage(
            "assistant",
            '<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">' +
              CivicIcons.checkCircle("w-4 h-4 inline") +
              " Actions confirmed and logged to audit trail.</div>",
          );
        });
      }

      const intentStage = stageState["intent"];
      const detectedIntent = intentStage?.detail?.intent || "";
      if (detectedIntent === "service_request_submit") {
        showServiceRequestCard(intentStage?.detail || {});
      }
    } else {
      addMessage(
        "assistant",
        '<p class="text-red-600">Pipeline completed but no report was generated.</p>',
      );
    }
  } catch (err) {
    collapseInlinePipeline(null);
    clearInterval(timerInterval);
    addMessage(
      "assistant",
      `<p class="text-red-600">Error: ${escapeHtml(err.message)}</p>`,
    );
    document.getElementById("pipeline-subtitle").textContent =
      "Pipeline failed";

    // Deactivate mobile pipeline button on error
    const mpBtnErr = document.getElementById("mobile-pipeline-btn");
    if (mpBtnErr) {
      mpBtnErr.classList.remove("pipeline-active");
      updateMobilePipelineBtn();
    }
  }

  sendBtn.disabled = false;
  input.disabled = false;
  input.focus();
});

// â”€â”€ Dashboard Home â”€â”€
async function loadDashboard() {
  const loading = document.getElementById("dash-loading");
  const content = document.getElementById("dash-content");
  try {
    const res = await fetch("/api/community");
    const data = await res.json();
    const s = data.stats || {};
    const zones = data.neighborhood_scores || {};
    const zoneKeys = Object.keys(zones);
    const gradeColor = (g) =>
      g === "A"
        ? "emerald"
        : g === "B"
          ? "blue"
          : g === "C"
            ? "yellow"
            : g === "D"
              ? "orange"
              : "red";

    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
    const completionRate = s.total_requests
      ? Math.round(((s.completed || 0) / s.total_requests) * 100)
      : 0;
    const circumference = 2 * Math.PI * 28;
    const dashOffset =
      circumference - (completionRate / 100) * circumference;

    content.innerHTML = `
    <!-- Hero with greeting and embedded AI search -->
    <div class="dash-reveal relative overflow-hidden rounded-3xl p-6 md:p-10 text-white shadow-xl" style="background:linear-gradient(135deg, var(--md-secondary), #004d47, var(--md-primary));">
      <div class="hero-blob" style="width:280px;height:280px;top:-100px;right:-60px"></div>
      <div class="hero-blob" style="width:200px;height:200px;bottom:-80px;left:-40px"></div>
      <div class="relative z-10">
        <p class="text-white/70 text-sm font-medium mb-1">${greeting}, neighbor</p>
        <h2 class="text-2xl md:text-3xl font-extrabold mb-2 leading-tight font-display">How can we help<br class="hidden sm:block"/>your neighborhood?</h2>
        <p class="text-white/60 text-sm mb-6 max-w-md">Report issues, track repairs, and stay informed about Lake Forest infrastructure â€” powered by AI.</p>
        <div class="max-w-lg">
          <button onclick="toggleChatWidget()" class="w-full flex items-center gap-3 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-left transition-all group">
            <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition">
              <span class="material-symbols-outlined text-white" style="font-size:22px">chat_bubble</span>
            </div>
            <div class="flex-1">
              <span class="text-white/90 text-sm">Ask our AI assistant anything...</span>
              <span class="block text-white/40 text-xs mt-0.5">e.g. "Are there potholes near Oak Avenue?"</span>
            </div>
            <span class="material-symbols-outlined text-white/40 group-hover:text-white/70 transition" style="font-size:20px">chevron_right</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3 Primary Actions -->
    <div class="dash-reveal grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button onclick="window.openServicePortal?.()" class="action-hero-card group bg-white p-6 border shadow-sm hover:shadow-lg transition-all text-left" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-xl)">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform" style="background:linear-gradient(135deg, var(--md-secondary), #004d47);">
          <span class="material-symbols-outlined text-white" style="font-size:28px">add_circle</span>
        </div>
        <h3 class="text-lg font-bold mb-1 font-display" style="color:var(--md-on-surface)">Report an Issue</h3>
        <p class="text-sm leading-relaxed" style="color:var(--md-on-surface-variant)">Pothole, broken sidewalk, streetlight out? Let us know and we'll get it fixed.</p>
      </button>
      <button onclick="window.openServicePortal?.()" class="action-hero-card group bg-white p-6 border shadow-sm hover:shadow-lg transition-all text-left" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-xl)">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform" style="background:linear-gradient(135deg, var(--md-tertiary), #1d4ed8);">
          <span class="material-symbols-outlined text-white" style="font-size:28px">search</span>
        </div>
        <h3 class="text-lg font-bold mb-1 font-display" style="color:var(--md-on-surface)">Track a Request</h3>
        <p class="text-sm leading-relaxed" style="color:var(--md-on-surface-variant)">Already submitted something? Check the status and see when it will be resolved.</p>
      </button>
      <button onclick="window.openCivicMap?.()" class="action-hero-card group bg-white p-6 border shadow-sm hover:shadow-lg transition-all text-left" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-xl)">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform" style="background:linear-gradient(135deg, #f59e0b, #d97706);">
          <span class="material-symbols-outlined text-white" style="font-size:28px">map</span>
        </div>
        <h3 class="text-lg font-bold mb-1 font-display" style="color:var(--md-on-surface)">Explore the Map</h3>
        <p class="text-sm leading-relaxed" style="color:var(--md-on-surface-variant)">See reported issues, active repairs, and infrastructure across every neighborhood.</p>
      </button>
    </div>

    <!-- Community Pulse -->
    <div class="dash-reveal bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">monitoring</span>
          Community Pulse
        </h3>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#e6f5f3;color:var(--md-secondary)">Live</span>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div class="text-center">
            <div class="relative w-16 h-16 mx-auto mb-2">
              <svg class="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" stroke="var(--md-surface-container)" stroke-width="5" fill="none"/>
                <circle cx="32" cy="32" r="28" stroke="#22c55e" stroke-width="5" fill="none"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round"
                  style="transition: stroke-dashoffset 1s ease"/>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-sm font-bold text-green-600">${completionRate}%</span>
              </div>
            </div>
            <div class="text-xs font-medium" style="color:var(--md-on-surface-variant)">Resolved</div>
          </div>
          <div class="text-center pulse-stat">
            <div class="text-3xl font-extrabold mb-1 font-display" style="color:var(--md-on-surface)">${s.completed || 0}</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">Issues Fixed</div>
            <div class="text-[10px] text-green-500 font-medium mt-0.5">${s.recent_fixes_30d || 0} this month</div>
          </div>
          <div class="text-center pulse-stat">
            <div class="text-3xl font-extrabold text-amber-500 mb-1 font-display">${s.in_progress || 0}</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">Being Repaired</div>
            <div class="text-[10px] font-medium mt-0.5" style="color:var(--md-outline)">crews active</div>
          </div>
          <div class="text-center pulse-stat">
            <div class="text-3xl font-extrabold mb-1 font-display" style="color:var(--md-tertiary)">${s.open || 0}</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">Awaiting Review</div>
            <div class="text-[10px] font-medium mt-0.5" style="color:var(--md-outline)">${s.avg_resolution_days || "?"}d avg wait</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Resolution Pipeline (Outcome Tracking) -->
    ${(() => {
      const total = s.total_requests || 1;
      const openPct = Math.round(((s.open || 0) / total) * 100);
      const ipPct = Math.round(((s.in_progress || 0) / total) * 100);
      const donePct = Math.round(((s.completed || 0) / total) * 100);
      return `
    <div class="dash-reveal bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">conversion_path</span>
          Resolution Pipeline
        </h3>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#dbeafe;color:var(--md-tertiary)">Outcomes</span>
      </div>
      <div class="p-6">
        <div class="flex items-center gap-3 mb-5">
          <div class="flex-1 text-center">
            <div class="text-2xl font-extrabold font-display" style="color:var(--md-tertiary)">${s.open || 0}</div>
            <div class="text-[11px] font-semibold mt-1" style="color:var(--md-on-surface-variant)">Submitted</div>
          </div>
          <span class="material-symbols-outlined text-lg" style="color:var(--md-outline)">arrow_forward</span>
          <div class="flex-1 text-center">
            <div class="text-2xl font-extrabold text-amber-500 font-display">${s.in_progress || 0}</div>
            <div class="text-[11px] font-semibold mt-1" style="color:var(--md-on-surface-variant)">In Progress</div>
          </div>
          <span class="material-symbols-outlined text-lg" style="color:var(--md-outline)">arrow_forward</span>
          <div class="flex-1 text-center">
            <div class="text-2xl font-extrabold text-green-600 font-display">${s.completed || 0}</div>
            <div class="text-[11px] font-semibold mt-1" style="color:var(--md-on-surface-variant)">Resolved</div>
          </div>
        </div>
        <div class="flex h-3 rounded-full overflow-hidden mb-4" style="background:var(--md-surface-container)">
          <div class="transition-all" style="width:${openPct}%;background:var(--md-tertiary)"></div>
          <div class="transition-all" style="width:${ipPct}%;background:#f59e0b"></div>
          <div class="transition-all" style="width:${donePct}%;background:#22c55e"></div>
        </div>
        <div class="flex items-center justify-between text-xs" style="color:var(--md-on-surface-variant)">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:var(--md-tertiary)"></span> Open ${openPct}%</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:#f59e0b"></span> Active ${ipPct}%</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:#22c55e"></span> Resolved ${donePct}%</span>
        </div>
        ${
          s.avg_resolution_days
            ? `<div class="mt-4 pt-4 border-t flex items-center justify-center gap-6" style="border-color:var(--md-surface-container)">
          <div class="text-center"><span class="text-lg font-bold font-display" style="color:var(--md-secondary)">${s.avg_resolution_days}d</span><div class="text-[10px]" style="color:var(--md-outline)">Avg Resolution</div></div>
          <div class="text-center"><span class="text-lg font-bold font-display text-green-600">${s.recent_fixes_30d || 0}</span><div class="text-[10px]" style="color:var(--md-outline)">Fixed This Month</div></div>
          <div class="text-center"><span class="text-lg font-bold font-display" style="color:var(--md-tertiary)">${s.recent_requests_30d || 0}</span><div class="text-[10px]" style="color:var(--md-outline)">New This Month</div></div>
        </div>`
            : ""
        }
      </div>
    </div>`;
    })()}

    <!-- Cost Savings (Before/After Cost Comparison) -->
    ${(() => {
      const cs = data.cost_savings || {};
      const savFmt = (n) =>
        n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + (n || 0);
      return cs.completed_repairs > 0
        ? `
    <div class="dash-reveal bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:#22c55e">savings</span>
          Cost Impact
        </h3>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#dcfce7;color:#16a34a">AI Powered</span>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div class="p-4 rounded-2xl" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-green-700" style="font-size:20px">trending_down</span>
              <span class="text-xs font-semibold text-green-800">Saved by Acting Early</span>
            </div>
            <div class="text-2xl font-extrabold text-green-700 font-display">${savFmt(cs.total_savings)}</div>
            <div class="text-[11px] text-green-600 mt-1">${cs.completed_repairs} repairs completed at ${savFmt(cs.total_repair_cost)} vs ${savFmt(cs.total_repair_cost + cs.total_savings)} if delayed</div>
          </div>
          <div class="p-4 rounded-2xl" style="background:linear-gradient(135deg,#fef3c7,#fde68a)">
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-amber-700" style="font-size:20px">warning</span>
              <span class="text-xs font-semibold text-amber-800">At Risk if Delayed</span>
            </div>
            <div class="text-2xl font-extrabold text-amber-700 font-display">${savFmt(cs.projected_cost_if_delayed)}</div>
            <div class="text-[11px] text-amber-600 mt-1">${cs.unresolved_count} open issues â€” projected 90-day cost including liability</div>
          </div>
        </div>
        <div class="text-[10px] text-center" style="color:var(--md-outline)">Powered by Weibull survival analysis + municipal liability models</div>
      </div>
    </div>`
        : "";
    })()}

    <!-- How We Compare (Chicago 311 Benchmarks) -->
    ${(() => {
      const b = data.benchmarks || {};
      const lf = b.lake_forest || {};
      const chi = b.chicago_311 || {};
      if (!chi.avg_resolution_days) return "";
      const resFaster =
        chi.avg_resolution_days && lf.avg_resolution_days
          ? Math.round(chi.avg_resolution_days - lf.avg_resolution_days)
          : null;
      const resCompWord =
        resFaster > 0
          ? resFaster + "d faster"
          : resFaster < 0
            ? Math.abs(resFaster) + "d slower"
            : "same speed";
      const resCompColor =
        resFaster > 0
          ? "text-green-600"
          : resFaster < 0
            ? "text-red-500"
            : "";
      return `
    <div class="dash-reveal bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-tertiary)">compare_arrows</span>
          How We Compare
        </h3>
        <span class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full" style="background:#ede9fe;color:#7c3aed">Benchmark</span>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-3 gap-4 text-center mb-4">
          <div></div>
          <div class="text-[11px] font-bold uppercase tracking-wider" style="color:var(--md-secondary)">Lake Forest</div>
          <div class="text-[11px] font-bold uppercase tracking-wider" style="color:var(--md-outline)">Chicago 311</div>
        </div>
        <div class="space-y-3">
          <div class="grid grid-cols-3 gap-4 items-center p-3 rounded-xl" style="background:var(--md-surface-container-low)">
            <div class="text-xs font-semibold" style="color:var(--md-on-surface-variant)">Avg Resolution</div>
            <div class="text-center text-lg font-extrabold font-display" style="color:var(--md-secondary)">${lf.avg_resolution_days || "â€”"}d</div>
            <div class="text-center text-lg font-extrabold font-display" style="color:var(--md-outline)">${chi.avg_resolution_days || "â€”"}d</div>
          </div>
          <div class="grid grid-cols-3 gap-4 items-center p-3 rounded-xl" style="background:var(--md-surface-container-low)">
            <div class="text-xs font-semibold" style="color:var(--md-on-surface-variant)">Completion Rate</div>
            <div class="text-center text-lg font-extrabold font-display" style="color:var(--md-secondary)">${lf.completion_rate || 0}%</div>
            <div class="text-center text-lg font-extrabold font-display" style="color:var(--md-outline)">${chi.completion_rate || 0}%</div>
          </div>
        </div>
        ${
          resFaster !== null
            ? `<div class="mt-4 pt-3 border-t text-center" style="border-color:var(--md-surface-container)">
          <span class="text-sm font-bold ${resCompColor} font-display">${resCompWord}</span>
          <span class="text-xs ml-1" style="color:var(--md-outline)">than Chicago 311 average</span>
        </div>`
            : ""
        }
        <div class="text-[10px] text-center mt-2" style="color:var(--md-outline)">Source: ${chi.source || "Chicago 311 Open Data Portal"}</div>
      </div>
    </div>`;
    })()}

    <!-- Neighborhood Grades -->
    ${
      zoneKeys.length > 0
        ? `
    <div class="dash-reveal bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">location_city</span>
          Neighborhood Grades
        </h3>
        <button onclick="window.openInsights?.()" class="text-xs font-medium px-3 py-1 rounded-full transition" style="color:var(--md-secondary);background:#e6f5f3">View All</button>
      </div>
      <div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${zoneKeys
          .map((z) => {
            const zd = zones[z];
            const gc = gradeColor(zd.grade);
            return `
          <div class="neighborhood-card border p-4 cursor-pointer" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-lg)" onclick="window.openInsights?.()">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-xl bg-${gc}-100 flex items-center justify-center">
                <span class="text-lg font-extrabold text-${gc}-600 font-display">${zd.grade}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold truncate font-display" style="color:var(--md-on-surface)">${z}</div>
                <div class="text-[10px]" style="color:var(--md-outline)">${zd.total_issues || 0} issues \u00b7 ${zd.resolved || 0} resolved</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:var(--md-surface-container)">
                <div class="bg-${gc}-500 h-full rounded-full bar-animate" style="width:${zd.health_score || 0}%"></div>
              </div>
              <span class="text-xs font-bold text-${gc}-600">${zd.health_score || 0}%</span>
            </div>
          </div>`;
          })
          .join("")}
      </div>
    </div>`
        : ""
    }

    <!-- Quick AI Insights -->
    <div class="dash-reveal bg-white border shadow-sm overflow-hidden" style="border-radius:var(--md-radius-xl);border-color:var(--md-outline-variant)">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color:var(--md-surface-container)">
        <h3 class="text-base font-bold flex items-center gap-2 font-display" style="color:var(--md-on-surface)">
          <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">auto_awesome</span>
          Quick AI Insights
        </h3>
      </div>
      <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onclick="toggleChatWidget(); setTimeout(()=>{input.value='What areas need the most attention right now?';form.dispatchEvent(new Event('submit'))},300)" class="ai-chip flex items-center gap-3 bg-white border p-4 text-left transition-all hover:shadow-md group" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-lg)">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:#e6f5f3">
            <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-secondary)">priority_high</span>
          </div>
          <div>
            <div class="text-sm font-semibold font-display" style="color:var(--md-on-surface)">Priority Areas</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">Which neighborhoods need attention?</div>
          </div>
        </button>
        <button onclick="toggleChatWidget(); setTimeout(()=>{input.value='Give me a safety analysis across all zones';form.dispatchEvent(new Event('submit'))},300)" class="ai-chip flex items-center gap-3 bg-white border p-4 text-left transition-all hover:shadow-md group" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-lg)">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:#ede9fe">
            <span class="material-symbols-outlined" style="font-size:22px;color:#7c3aed">shield</span>
          </div>
          <div>
            <div class="text-sm font-semibold font-display" style="color:var(--md-on-surface)">Safety Analysis</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">AI-powered safety assessment</div>
          </div>
        </button>
        <button onclick="toggleChatWidget(); setTimeout(()=>{input.value='Show me infrastructure trends and forecasts';form.dispatchEvent(new Event('submit'))},300)" class="ai-chip flex items-center gap-3 bg-white border p-4 text-left transition-all hover:shadow-md group" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-lg)">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:#dbeafe">
            <span class="material-symbols-outlined" style="font-size:22px;color:var(--md-tertiary)">trending_up</span>
          </div>
          <div>
            <div class="text-sm font-semibold font-display" style="color:var(--md-on-surface)">Trend Forecast</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">Predictive infrastructure analysis</div>
          </div>
        </button>
        <button onclick="toggleChatWidget(); setTimeout(()=>{input.value='What is the cost of inaction for unresolved issues?';form.dispatchEvent(new Event('submit'))},300)" class="ai-chip flex items-center gap-3 bg-white border p-4 text-left transition-all hover:shadow-md group" style="border-color:var(--md-outline-variant);border-radius:var(--md-radius-lg)">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:#fef3c7">
            <span class="material-symbols-outlined" style="font-size:22px;color:#d97706">payments</span>
          </div>
          <div>
            <div class="text-sm font-semibold font-display" style="color:var(--md-on-surface)">Cost of Inaction</div>
            <div class="text-xs" style="color:var(--md-on-surface-variant)">Weibull model financial projections</div>
          </div>
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="dash-reveal text-center py-4">
      <p class="text-xs" style="color:var(--md-outline)">Powered by AI â€” GPT-4o-mini + MCP + RAG</p>
      <button onclick="window.showHowItWorks?.()" class="text-xs mt-1 transition font-medium" style="color:var(--md-secondary)">Learn how CivicLens works &rarr;</button>
    </div>
  `;
    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    loading.innerHTML = `<p class="text-red-500 text-sm">Failed to load dashboard: ${escapeHtml(err.message)}</p>`;
  }
}

// Load dashboard on page load
loadDashboard();