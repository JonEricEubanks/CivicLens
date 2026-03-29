/**
 * CivicLens Staff Operations — Full-Page Dashboard
 *
 * Replaces the cramped chat-sidebar staff view with a proper
 * full-page operations center. Actions (dispatch, status update,
 * inspection) call direct REST APIs instead of going through the
 * AI chat pipeline.
 */

(function () {
  'use strict';

  // ── State ──
  let staffToken = null;
  let dashboardData = null;
  let activeTab = 'overview';
  let selectedWO = null;
  let selectedSR = null;
  let refreshTimer = null;

  // ── Search & Filter State ──
  let searchQuery = '';
  let filterStatus = 'all';
  let filterPriority = 'all';
  let filterCategory = 'all';
  let filterZone = 'all';
  let filterCrew = 'all';

  // Use shared CATEGORY_ICONS from civic-utils.js, with local fallback
  const CATEGORY_ICONS = (window.CivicUtils && window.CivicUtils.CATEGORY_ICONS) || {
    pothole: 'crisis_alert', streets: 'crisis_alert', sidewalk: 'directions_walk',
    streetlight: 'lightbulb', water: 'water_drop', sewer: 'plumbing',
    traffic: 'traffic', tree: 'park', noise: 'volume_up', graffiti: 'format_paint',
    parking: 'local_parking', general: 'help', default: 'report',
  };

  // Use shared escapeHtml from civic-utils.js
  const esc = window.CivicUtils.escapeHtml;

  // Use shared timeAgo from civic-utils.js, with local fallback
  const timeAgo = (window.CivicUtils && window.CivicUtils.timeAgo) || function timeAgo(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      return Math.floor(hrs / 24) + 'd ago';
    }
    const now = new Date();
    const then = new Date(dateStr + 'T00:00:00');
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
    const days = Math.round((nowDay - thenDay) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + 'd ago';
    return Math.floor(days / 7) + 'w ago';
  };

  // ── Search & Filter Helpers ──
  function matchesSearch(item) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const fields = [
      item.id, item.description, item.type,
      item.location?.address, item.address,
      item.location?.zone, item.category,
      item.crew_assigned, item.assigned_crew,
      item.resident_name, item.priority, item.status,
    ];
    return fields.some(f => f && String(f).toLowerCase().includes(q));
  }

  function filterWO(wo) {
    if (!matchesSearch(wo)) return false;
    if (filterStatus !== 'all' && wo.status !== filterStatus) return false;
    if (filterPriority !== 'all' && wo.priority !== filterPriority) return false;
    if (filterZone !== 'all' && wo.location?.zone !== filterZone) return false;
    if (filterCategory !== 'all' && wo.type !== filterCategory) return false;
    return true;
  }

  function filterSR(sr) {
    if (!matchesSearch(sr)) return false;
    if (filterStatus !== 'all' && sr.status !== filterStatus) return false;
    if (filterZone !== 'all' && sr.location?.zone !== filterZone) return false;
    if (filterCategory !== 'all' && sr.category !== filterCategory) return false;
    return true;
  }

  function getUniqueZones() {
    if (!dashboardData) return [];
    const zones = new Set();
    dashboardData.work_orders?.forEach(wo => { if (wo.location?.zone) zones.add(wo.location.zone); });
    dashboardData.service_requests?.forEach(sr => { if (sr.location?.zone) zones.add(sr.location.zone); });
    return [...zones].sort().map(z => ({ value: z, label: z }));
  }

  function getUniqueCategories() {
    if (!dashboardData) return [];
    const cats = new Set();
    dashboardData.work_orders?.forEach(wo => { if (wo.type) cats.add(wo.type); });
    dashboardData.service_requests?.forEach(sr => { if (sr.category) cats.add(sr.category); });
    return [...cats].sort().map(c => ({ value: c, label: c.replace(/_/g, ' ') }));
  }

  function hasActiveFilters() {
    return searchQuery || filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all' || filterZone !== 'all';
  }

  function filterSelect(id, label, current, options, fnName) {
    return '<select id="' + id + '" onchange="window._staffOps.' + fnName + '(this.value)" style="padding:8px 10px;border:1.5px solid ' + (current !== 'all' ? '#006a61' : '#e2e8f0') + ';border-radius:10px;font-size:12px;font-weight:500;background:' + (current !== 'all' ? '#e6f5f3' : '#fff') + ';color:#334155;outline:none;cursor:pointer;">' + options.map(function(o) { return '<option value="' + o.value + '"' + (o.value === current ? ' selected' : '') + '>' + o.label + '</option>'; }).join('') + '</select>';
  }

  let searchDebounce = null;
  function setSearch(val) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = val;
      render();
      // Restore focus and cursor position
      setTimeout(() => {
        const el = document.getElementById('staff-ops-search');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 10);
    }, 250);
  }

  function setFilterStatus(val) { filterStatus = val; render(); }
  function setFilterPriority(val) { filterPriority = val; render(); }
  function setFilterCategory(val) { filterCategory = val; render(); }
  function setFilterZone(val) { filterZone = val; render(); }
  function clearFilters() {
    searchQuery = ''; filterStatus = 'all'; filterPriority = 'all'; filterCategory = 'all'; filterZone = 'all';
    render();
  }

  function filteredResultsBadge(shown, total, label) {
    if (!hasActiveFilters()) return '';
    return '<div style="padding:8px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:12px;color:#1d4ed8;font-weight:600;display:flex;align-items:center;gap:6px;margin-bottom:10px;"><span class="material-symbols-outlined" style="font-size:14px">filter_list</span> Showing ' + shown + ' of ' + total + ' ' + label + '</div>';
  }

  function toast(msg, type) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.15);animation:staffFadeIn 0.3s ease;max-width:400px;';
    t.style.background = type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#10b981';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
  }

  // ── Auth ──
  function getToken() {
    return staffToken || window.staffAuthToken || null;
  }

  async function authFetch(url, opts = {}) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    opts.headers = { ...opts.headers, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
    const res = await fetch(url, opts);
    if (res.status === 401) {
      toast('Session expired — please re-authenticate', 'error');
      showPinOverlay();
      throw new Error('Unauthorized');
    }
    return res;
  }

  function showPinOverlay() {
    const existing = document.getElementById('staff-ops-pin-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'staff-ops-pin-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center;">
        <span class="material-symbols-outlined" style="font-size:48px;color:var(--md-secondary,#006a61)">shield_person</span>
        <h2 style="margin:12px 0 4px;font-size:18px;font-weight:700;color:#1e293b">Staff Operations</h2>
        <p style="font-size:13px;color:#64748b;margin-bottom:20px">Enter your staff PIN to continue</p>
        <div style="background:#f0fdfa;border:1px dashed #99f6e4;border-radius:10px;padding:10px 14px;margin-bottom:16px;text-align:center;">
          <p style="font-size:11px;color:#0d9488;margin:0 0 2px;font-weight:600;">🎯 Demo Mode</p>
          <p style="font-size:12px;color:#64748b;margin:0;">PIN: <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-weight:700;letter-spacing:2px;color:#1e293b">1234</code></p>
          <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;">In production this uses secure staff authentication</p>
        </div>
        <input id="staff-ops-pin" type="password" inputmode="numeric" maxlength="8" placeholder="Enter PIN"
          style="width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;outline:none;transition:border 0.2s;"
          onfocus="this.style.borderColor='#006a61'" onblur="this.style.borderColor='#e2e8f0'">
        <div id="staff-ops-pin-error" style="color:#ef4444;font-size:12px;margin-top:8px;display:none"></div>
        <button id="staff-ops-pin-btn" onclick="window._staffOps.submitPin()"
          style="margin-top:16px;width:100%;padding:12px;border:none;border-radius:12px;background:linear-gradient(135deg,#006a61,#004d47);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">
          <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px">lock_open</span> Unlock
        </button>
        <button onclick="window._staffOps.closePage()"
          style="margin-top:8px;background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('staff-ops-pin')?.focus(), 100);
    document.getElementById('staff-ops-pin')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window._staffOps.submitPin();
    });
  }

  async function submitPin() {
    const input = document.getElementById('staff-ops-pin');
    const error = document.getElementById('staff-ops-pin-error');
    const btn = document.getElementById('staff-ops-pin-btn');
    const pin = input?.value?.trim();
    if (!pin) { input?.focus(); return; }

    btn.disabled = true;
    btn.textContent = 'Verifying...';
    try {
      const res = await fetch('/api/staff/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        staffToken = data.token;
        window.staffAuthToken = data.token;
        document.getElementById('staff-ops-pin-overlay')?.remove();
        loadDashboard();
      } else {
        error.textContent = data.error || 'Incorrect PIN';
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    } catch {
      error.textContent = 'Connection error';
      error.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Unlock';
    }
  }

  // ── Data Loading ──
  async function loadDashboard() {
    try {
      const res = await authFetch('/api/staff/dashboard?role=supervisor');
      if (!res.ok) throw new Error('Failed to load');
      dashboardData = await res.json();
      render();
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        toast('Failed to load dashboard data', 'error');
      }
    }
  }

  // ── Rendering ──
  function render() {
    const container = document.getElementById('staff-ops-page');
    if (!container || !dashboardData) return;

    const { kpis, work_orders, service_requests } = dashboardData;
    const openWO = work_orders.filter(w => w.status === 'open');
    const inProgressWO = work_orders.filter(w => w.status === 'in_progress');
    const completedWO = work_orders.filter(w => w.status === 'completed');
    const criticalWO = work_orders.filter(w => w.priority === 'critical' || w.priority === 'high');
    const totalCost = work_orders.reduce((s, w) => s + (w.estimated_cost || 0), 0);
    const unassigned = work_orders.filter(w => !w.crew_assigned && w.status !== 'completed');

    container.innerHTML = `
      <style>
        .staff-bb { display: none; }
        @media (max-width: 767px) {
          .staff-header-back, .staff-header-refresh, .staff-header-citizen { display: none !important; }
          .staff-bb { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; z-index: 10000 !important; }
          #staff-ops-tab-content { padding-bottom: 64px !important; }
        }
      </style>
      <!-- Header Bar -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#006a61);padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button class="staff-header-back" onclick="window._staffOps.goBack()" style="background:rgba(255,255,255,0.15);border:none;border-radius:10px;padding:8px;color:#fff;cursor:pointer;display:flex;align-items:center;" title="Back to Home">
          <span class="material-symbols-outlined" style="font-size:20px">arrow_back</span>
        </button>
        <span class="material-symbols-outlined" style="font-size:28px;color:#fff">admin_panel_settings</span>
        <div style="flex:1">
          <h1 style="font-size:18px;font-weight:800;color:#fff;margin:0;">Staff Operations Center</h1>
          <p style="font-size:11px;color:rgba(255,255,255,0.7);margin:2px 0 0;" class="cc-subtitle">Lake Forest Municipal Infrastructure</p>
        </div>
        <button class="staff-header-refresh" onclick="window._staffOps.refresh()" style="background:rgba(255,255,255,0.15);border:none;border-radius:10px;padding:8px 14px;color:#fff;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px">refresh</span> Refresh
        </button>
        <button class="staff-header-citizen" onclick="window._staffOps.goBack()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:8px 14px;color:#fff;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.25)'" onmouseleave="this.style.background='rgba(255,255,255,0.15)'">
          <span class="material-symbols-outlined" style="font-size:16px">person</span> Citizen View
        </button>
        <span style="font-size:11px;color:rgba(255,255,255,0.5);">Updated ${new Date().toLocaleTimeString()}</span>
      </div>

      <!-- Search & Filter Bar -->
      <div style="display:flex;gap:8px;padding:12px 20px;background:#fff;border-bottom:1px solid #e2e8f0;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;position:relative;">
          <span class="material-symbols-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:18px;color:#94a3b8;">search</span>
          <input id="staff-ops-search" type="text" placeholder="Search by ID, address, description, crew..." value="${esc(searchQuery)}"
            oninput="window._staffOps.setSearch(this.value)"
            style="width:100%;padding:8px 12px 8px 34px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;transition:border 0.2s;"
            onfocus="this.style.borderColor='#006a61'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        ${filterSelect('staff-ops-filter-status', 'Status', filterStatus, [
          { value: 'all', label: 'All Statuses' },
          { value: 'open', label: 'Open' },
          { value: 'received', label: 'Received' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
        ], 'setFilterStatus')}
        ${filterSelect('staff-ops-filter-priority', 'Priority', filterPriority, [
          { value: 'all', label: 'All Priorities' },
          { value: 'critical', label: 'Critical' },
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ], 'setFilterPriority')}
        ${filterSelect('staff-ops-filter-zone', 'Zone', filterZone, [
          { value: 'all', label: 'All Zones' },
          ...getUniqueZones(),
        ], 'setFilterZone')}
        ${filterSelect('staff-ops-filter-category', 'Category', filterCategory, [
          { value: 'all', label: 'All Types' },
          ...getUniqueCategories(),
        ], 'setFilterCategory')}
        ${hasActiveFilters() ? '<button onclick="window._staffOps.clearFilters()" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:600;color:#dc2626;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;"><span class="material-symbols-outlined" style="font-size:14px">filter_alt_off</span>Clear</button>' : ''}
      </div>

      <!-- KPI Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:16px 20px 8px;">
        ${kpiCard('Open SRs', kpis.sr_open, '#ef4444', 'inbox')}
        ${kpiCard('In Progress', kpis.sr_in_progress, '#3b82f6', 'engineering')}
        ${kpiCard('Completed', kpis.sr_completed, '#10b981', 'check_circle')}
        ${kpiCard('Critical WOs', kpis.wo_critical, '#f59e0b', 'warning')}
        ${kpiCard('Unassigned', unassigned.length, '#8b5cf6', 'person_off')}
        ${kpiCard('Est. Cost', '$' + (totalCost / 1000).toFixed(1) + 'K', '#0ea5e9', 'payments')}
      </div>

      <!-- Action Bar -->
      <div style="display:flex;gap:8px;padding:8px 20px 12px;flex-wrap:wrap;">
        <button onclick="window._staffOps.openDispatchModal()" class="staff-action-pill" style="background:#eff6ff;border:1.5px solid #93c5fd;color:#1d4ed8;">
          <span class="material-symbols-outlined" style="font-size:16px">local_shipping</span> Dispatch Crew
        </button>
        <button onclick="window._staffOps.openStatusModal()" class="staff-action-pill" style="background:#f0fdf4;border:1.5px solid #86efac;color:#166534;">
          <span class="material-symbols-outlined" style="font-size:16px">check_circle</span> Update Status
        </button>
        <button onclick="window._staffOps.openInspectModal()" class="staff-action-pill" style="background:#fefce8;border:1.5px solid #fcd34d;color:#92400e;">
          <span class="material-symbols-outlined" style="font-size:16px">search</span> Schedule Inspection
        </button>
      </div>

      <!-- Tab Nav -->
      <div style="display:flex;gap:2px;padding:0 16px;border-bottom:1px solid #e2e8f0;overflow-x:auto;-webkit-overflow-scrolling:touch;">
        ${tabBtn('overview', 'Overview', 'dashboard')}
        ${tabBtn('workorders', 'Work Orders (' + work_orders.length + ')', 'construction')}
        ${tabBtn('requests', 'Service Requests (' + service_requests.length + ')', 'inbox')}
        ${tabBtn('unassigned', 'Unassigned (' + unassigned.length + ')', 'person_off')}
      </div>

      <!-- Tab Content -->
      <div id="staff-ops-tab-content" style="flex:1;overflow-y:auto;padding:16px 20px;">
        ${activeTab === 'overview' ? renderOverview(work_orders, service_requests, kpis) : ''}
        ${activeTab === 'workorders' ? renderWorkOrders(work_orders) : ''}
        ${activeTab === 'requests' ? renderRequests(service_requests) : ''}
        ${activeTab === 'unassigned' ? renderUnassigned(unassigned) : ''}
      </div>

      <!-- Bottom action bar (mobile only) -->
      <div class="staff-bb" style="bottom:0;left:0;right:0;background:rgba(255,255,255,0.97);border-top:1px solid #e5e7eb;padding:10px 16px;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 -2px 16px rgba(0,0,0,0.08);backdrop-filter:blur(12px)">
        <button class="staff-bb-back" onclick="window._staffOps.goBack()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Back
        </button>
        <button class="staff-bb-refresh" onclick="window._staffOps.refresh()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
          <span class="material-symbols-outlined" style="font-size:16px">refresh</span> Refresh
        </button>
        <button class="staff-bb-citizen" onclick="window._staffOps.goBack()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:none;background:linear-gradient(135deg,#1e6091,#00796b);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;transition:all .2s;box-shadow:0 4px 12px rgba(0,121,107,0.3)">
          <span class="material-symbols-outlined" style="font-size:16px">person</span> Citizen
        </button>
      </div>
    `;
  }

  function kpiCard(label, value, color, icon) {
    return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;display:flex;align-items:center;gap:12px;transition:box-shadow 0.2s;" onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseleave="this.style.boxShadow='none'">
      <div style="width:40px;height:40px;border-radius:10px;background:${color}12;display:flex;align-items:center;justify-content:center;">
        <span class="material-symbols-outlined" style="font-size:20px;color:${color}">${icon}</span>
      </div>
      <div>
        <div style="font-size:22px;font-weight:800;color:#1e293b;">${value}</div>
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
      </div>
    </div>`;
  }

  function tabBtn(id, label, icon) {
    const isActive = activeTab === id;
    return `<button onclick="window._staffOps.switchTab('${id}')" style="display:flex;align-items:center;gap:6px;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:${isActive ? '700' : '500'};color:${isActive ? '#006a61' : '#64748b'};border-bottom:2px solid ${isActive ? '#006a61' : 'transparent'};transition:all 0.2s;white-space:nowrap;flex-shrink:0;">
      <span class="material-symbols-outlined" style="font-size:16px">${icon}</span>${label}
    </button>`;
  }

  // ── Overview Tab ──
  function renderOverview(workOrders, serviceRequests, kpis) {
    const byZone = {};
    workOrders.forEach(wo => {
      const z = wo.location?.zone || 'Unknown';
      if (!byZone[z]) byZone[z] = { open: 0, in_progress: 0, completed: 0, cost: 0 };
      byZone[z][wo.status]++;
      byZone[z].cost += wo.estimated_cost || 0;
    });

    const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
    workOrders.forEach(wo => byPriority[wo.priority] = (byPriority[wo.priority] || 0) + 1);

    const recentActivity = [...serviceRequests]
      .filter(sr => sr.updates?.length)
      .flatMap(sr => sr.updates.map(u => ({ ...u, sr_id: sr.id, category: sr.category })))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
        <!-- Zone Breakdown -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;">
          <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-outlined" style="font-size:16px;color:#006a61">map</span> Zone Breakdown
          </h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="border-bottom:1px solid #f1f5f9;">
              <th style="text-align:left;padding:6px 8px;font-weight:600;color:#64748b">Zone</th>
              <th style="text-align:center;padding:6px 8px;font-weight:600;color:#ef4444">Open</th>
              <th style="text-align:center;padding:6px 8px;font-weight:600;color:#3b82f6">In Prog</th>
              <th style="text-align:center;padding:6px 8px;font-weight:600;color:#10b981">Done</th>
              <th style="text-align:right;padding:6px 8px;font-weight:600;color:#64748b">Est. Cost</th>
            </tr></thead>
            <tbody>${Object.entries(byZone).map(([z, d]) => `
              <tr style="border-bottom:1px solid #f8fafc;">
                <td style="padding:8px;font-weight:600;color:#1e293b">${z}</td>
                <td style="text-align:center;padding:8px;color:#ef4444;font-weight:600">${d.open}</td>
                <td style="text-align:center;padding:8px;color:#3b82f6;font-weight:600">${d.in_progress}</td>
                <td style="text-align:center;padding:8px;color:#10b981;font-weight:600">${d.completed}</td>
                <td style="text-align:right;padding:8px;color:#64748b">$${(d.cost / 1000).toFixed(1)}K</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- Priority Distribution -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;">
          <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-outlined" style="font-size:16px;color:#f59e0b">flag</span> Priority Distribution
          </h3>
          ${priorityBar('Critical', byPriority.critical, workOrders.length, '#ef4444')}
          ${priorityBar('High', byPriority.high, workOrders.length, '#f59e0b')}
          ${priorityBar('Medium', byPriority.medium, workOrders.length, '#3b82f6')}
          ${priorityBar('Low', byPriority.low, workOrders.length, '#6b7280')}
        </div>
      </div>

      <!-- Recent Activity -->
      <div style="margin-top:16px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;">
        <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px;color:#3b82f6">history</span> Recent Activity
        </h3>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${recentActivity.length ? recentActivity.map(a => `
            <div style="display:flex;align-items:start;gap:10px;padding:8px 0;border-bottom:1px solid #f8fafc;">
              <div style="width:6px;height:6px;border-radius:50%;background:#cbd5e1;margin-top:6px;flex-shrink:0;"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;color:#94a3b8">${esc(a.date)} · ${esc(a.by || 'System')} · ${esc(a.sr_id)}</div>
                <div style="font-size:12px;color:#334155;">${esc(a.note)}</div>
              </div>
            </div>`).join('') : '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">No recent activity</div>'}
        </div>
      </div>`;
  }

  function priorityBar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
        <span style="font-weight:600;color:#334155">${label}</span>
        <span style="color:#64748b">${count} (${pct}%)</span>
      </div>
      <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.5s ease;"></div>
      </div>
    </div>`;
  }

  // ── Work Orders Tab ──
  function renderWorkOrders(workOrders) {
    const filtered = workOrders.filter(filterWO);
    const sorted = [...filtered].sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sOrder = { open: 0, in_progress: 1, completed: 2 };
      const sd = (sOrder[a.status] ?? 3) - (sOrder[b.status] ?? 3);
      return sd !== 0 ? sd : (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
    });

    if (!sorted.length) {
      return filteredResultsBadge(0, workOrders.length, 'work orders')
        + '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px">search_off</span>No work orders match your filters</div>';
    }

    return filteredResultsBadge(sorted.length, workOrders.length, 'work orders')
      + `<div style="display:grid;gap:10px;">${sorted.map(wo => woCard(wo)).join('')}</div>`;
  }

  function woCard(wo) {
    const priorityColors = CivicUtils.STAFF_PRIORITY_COLORS;
    const statusColors = CivicUtils.STAFF_WO_STATUS_COLORS;
    const isActionable = wo.status !== 'completed';

    return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;transition:all 0.2s;cursor:pointer;" onmouseenter="this.style.borderColor='#006a61';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseleave="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'" onclick="window._staffOps.openWOSidebar('${esc(wo.id)}')">
      <div style="display:flex;align-items:start;gap:12px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${priorityColors[wo.priority] || '#6b7280'};margin-top:4px;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:#1e293b">${esc(wo.id)}</span>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:10px;background:${statusColors[wo.status]}15;color:${statusColors[wo.status]}">${wo.status.replace('_', ' ')}</span>
            <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#f1f5f9;color:${priorityColors[wo.priority] || '#6b7280'}">${wo.priority}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:auto;">${timeAgo(wo.reported_date)}</span>
          </div>
          <div style="font-size:12px;color:#475569;margin-bottom:4px;">${esc(wo.type?.replace(/_/g, ' '))} — ${esc(wo.location?.address)}</div>
          <div style="display:flex;gap:12px;font-size:11px;color:#94a3b8;">
            ${wo.crew_assigned ? `<span style="display:flex;align-items:center;gap:3px"><span class="material-symbols-outlined" style="font-size:13px">group</span>${esc(wo.crew_assigned)}</span>` : '<span style="color:#f59e0b;font-weight:600">⚠ Unassigned</span>'}
            ${wo.estimated_cost ? `<span>$${wo.estimated_cost.toLocaleString()}</span>` : ''}
            <span>${esc(wo.location?.zone)}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;" onclick="event.stopPropagation()">
          <button onclick="window._staffOps.openWOSidebar('${esc(wo.id)}')" style="background:#e0f2f1;border:1px solid #80cbc4;color:#006a61;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;white-space:nowrap;">
            <span class="material-symbols-outlined" style="font-size:13px">open_in_new</span> View
          </button>
          ${isActionable ? `<button onclick="window._staffOps.openDispatchModal('${wo.id}')" style="background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;white-space:nowrap;">
            <span class="material-symbols-outlined" style="font-size:13px">local_shipping</span> Dispatch
          </button>
          ${wo.id.startsWith('WO-INS-') ? `<button onclick="window._staffOps.openInspectionResultsModal('${wo.id}')" style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;white-space:nowrap;">
            <span class="material-symbols-outlined" style="font-size:13px">assignment_turned_in</span> Results
          </button>` : ''}` : ''}
        </div>
      </div>
    </div>`;
  }

  // ── Service Requests Tab ──
  function renderRequests(requests) {
    const filtered = requests.filter(filterSR);
    const sorted = [...filtered].sort((a, b) => {
      const order = { open: 0, received: 1, in_progress: 2, completed: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

    if (!sorted.length) {
      return filteredResultsBadge(0, requests.length, 'service requests')
        + '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px">search_off</span>No service requests match your filters</div>';
    }

    return filteredResultsBadge(sorted.length, requests.length, 'service requests')
      + `<div style="display:grid;gap:10px;">${sorted.map(sr => srCard(sr)).join('')}</div>`;
  }

  function srCard(sr) {
    const statusColors = CivicUtils.STAFF_SR_STATUS_COLORS;
    const icon = CATEGORY_ICONS[sr.category] || CATEGORY_ICONS.default;
    const isActionable = sr.status !== 'completed';

    return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;transition:all 0.2s;cursor:pointer;" onmouseenter="this.style.borderColor='#006a61';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseleave="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'" onclick="window._staffOps.openSRSidebar('${esc(sr.id)}')">
      <div style="display:flex;align-items:start;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:#e0f2f1;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span class="material-symbols-outlined" style="font-size:18px;color:#006a61">${icon}</span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:#1e293b">${esc(sr.id)}</span>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:10px;background:${statusColors[sr.status] || '#6b7280'}15;color:${statusColors[sr.status] || '#6b7280'}">${sr.status.replace('_', ' ')}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:auto;">${timeAgo(sr.submitted_date || sr.updated_date)}</span>
          </div>
          <div style="font-size:12px;color:#475569;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc((sr.description || '').slice(0, 120))}</div>
          <div style="display:flex;gap:12px;font-size:11px;color:#94a3b8;">
            <span style="display:flex;align-items:center;gap:3px"><span class="material-symbols-outlined" style="font-size:13px">location_on</span>${esc((sr.location?.address || sr.address || 'No location').slice(0, 40))}</span>
            ${sr.assigned_crew ? `<span style="display:flex;align-items:center;gap:3px"><span class="material-symbols-outlined" style="font-size:13px">group</span>${esc(sr.assigned_crew)}</span>` : ''}
            ${sr.resident_name ? `<span>${esc(sr.resident_name)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;" onclick="event.stopPropagation()">
          <button onclick="window._staffOps.openSRSidebar('${esc(sr.id)}')" style="background:#e0f2f1;border:1px solid #80cbc4;color:#006a61;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;white-space:nowrap;">
            <span class="material-symbols-outlined" style="font-size:13px">open_in_new</span> View
          </button>
          ${isActionable ? `<button onclick="window._staffOps.openInspectModal('${sr.location?.address || ''}', '${sr.category}', '${sr.location?.zone || ''}', '${sr.id}')" style="background:#fefce8;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;">
            <span class="material-symbols-outlined" style="font-size:13px">search</span> Inspect
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }

  // ── Unassigned Tab ──
  function renderUnassigned(unassigned) {
    const filtered = unassigned.filter(filterWO);
    if (!filtered.length && !unassigned.length) {
      return '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px;color:#10b981">check_circle</span>All work orders are assigned!</div>';
    }
    if (!filtered.length) {
      return filteredResultsBadge(0, unassigned.length, 'unassigned work orders')
        + '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px">search_off</span>No unassigned work orders match your filters</div>';
    }
    return filteredResultsBadge(filtered.length, unassigned.length, 'unassigned')
      + `<div style="display:grid;gap:10px;">${filtered.map(wo => woCard(wo)).join('')}</div>`;
  }

  // ══════════════════════════════════════════
  // ── Action Modals (direct API calls) ──
  // ══════════════════════════════════════════
  function createModal(title, icon, iconColor, bodyHTML, onConfirm) {
    const existing = document.getElementById('staff-ops-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'staff-ops-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);backdrop-filter:blur(2px);';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:18px;width:420px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.15);overflow:hidden;">
        <div style="padding:18px 22px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;">
          <span class="material-symbols-outlined" style="font-size:22px;color:${iconColor}">${icon}</span>
          <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin:0;flex:1;">${title}</h3>
          <button onclick="document.getElementById('staff-ops-modal')?.remove()" style="background:none;border:none;cursor:pointer;padding:4px;">
            <span class="material-symbols-outlined" style="font-size:20px;color:#94a3b8">close</span>
          </button>
        </div>
        <div style="padding:20px 22px;" id="staff-ops-modal-body">${bodyHTML}</div>
        <div style="padding:14px 22px;border-top:1px solid #e2e8f0;background:#f9fafb;display:flex;justify-content:flex-end;gap:8px;">
          <button onclick="document.getElementById('staff-ops-modal')?.remove()" style="padding:8px 18px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#64748b;">Cancel</button>
          <button id="staff-ops-modal-confirm" style="padding:8px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#006a61,#004d47);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('staff-ops-modal-confirm').addEventListener('click', async () => {
      const btn = document.getElementById('staff-ops-modal-confirm');
      btn.disabled = true;
      btn.textContent = 'Processing...';
      try {
        await onConfirm();
        overlay.remove();
        loadDashboard();
      } catch (err) {
        toast(err.message || 'Action failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Confirm';
      }
    });
  }

  function fieldHTML(id, label, type, value, opts) {
    if (type === 'select') {
      return `<div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;">${label}</label>
        <select id="${id}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;">
          ${opts.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>`;
    }
    if (type === 'textarea') {
      return `<div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;">${label}</label>
        <textarea id="${id}" rows="2" placeholder="${opts?.placeholder || ''}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;resize:none;">${value || ''}</textarea>
      </div>`;
    }
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;">${label}</label>
      <input id="${id}" type="${type}" value="${value || ''}" placeholder="${opts?.placeholder || ''}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;">
    </div>`;
  }

  // ── Dispatch Crew Modal ──
  function openDispatchModal(woId) {
    const today = new Date().toISOString().split('T')[0];
    const body = fieldHTML('sops-dispatch-wo', 'Work Order ID', 'text', woId || '', { placeholder: 'e.g. WO-2024-003' })
      + fieldHTML('sops-dispatch-crew', 'Crew', 'select', 'Crew-A', [
        { value: 'Crew-A', label: 'Crew-A (Pothole Repair)' },
        { value: 'Crew-B', label: 'Crew-B (Sidewalk Team)' },
        { value: 'Crew-C', label: 'Crew-C (Concrete Repair)' },
        { value: 'Crew-D', label: 'Crew-D (Emergency Response)' },
      ])
      + fieldHTML('sops-dispatch-date', 'Scheduled Date', 'date', today);

    createModal('Dispatch Crew', 'local_shipping', '#1d4ed8', body, async () => {
      const work_order_id = document.getElementById('sops-dispatch-wo').value.trim();
      const crew_id = document.getElementById('sops-dispatch-crew').value;
      const scheduled_date = document.getElementById('sops-dispatch-date').value;
      if (!work_order_id) throw new Error('Work order ID is required');

      const res = await authFetch('/api/staff/dispatch', {
        method: 'POST',
        body: JSON.stringify({ work_order_id, crew_id, scheduled_date }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Dispatch failed');
      toast(`${crew_id} dispatched to ${work_order_id}`, 'success');
    });
  }

  // ── Work Order Status Modal ──
  function openWOStatusModal(woId, currentStatus) {
    const body = fieldHTML('sops-wo-id', 'Work Order ID', 'text', woId || '', { placeholder: 'e.g. WO-2024-003' })
      + fieldHTML('sops-wo-status', 'New Status', 'select', currentStatus === 'open' ? 'in_progress' : 'completed', [
        { value: 'open', label: 'Open' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ])
      + fieldHTML('sops-wo-notes', 'Notes', 'textarea', '', { placeholder: 'Optional notes...' });

    createModal('Update Work Order Status', 'check_circle', '#166534', body, async () => {
      const id = document.getElementById('sops-wo-id').value.trim();
      const status = document.getElementById('sops-wo-status').value;
      const notes = document.getElementById('sops-wo-notes').value.trim();
      if (!id) throw new Error('Work order ID is required');

      const res = await authFetch(`/api/staff/work-order/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');
      toast(`${id} → ${status.replace('_', ' ')}`, 'success');
    });
  }

  // ── Service Request Status Modal ──
  function openSRStatusModal(srId, currentStatus) {
    const body = fieldHTML('sops-sr-id', 'Request ID', 'text', srId || '', { placeholder: 'e.g. SR-2026-001' })
      + fieldHTML('sops-sr-status', 'New Status', 'select', currentStatus === 'open' ? 'received' : currentStatus === 'received' ? 'in_progress' : 'completed', [
        { value: 'received', label: 'Received' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ])
      + fieldHTML('sops-sr-note', 'Note', 'textarea', '', { placeholder: 'Update note...' });

    createModal('Update Service Request', 'check_circle', '#166534', body, async () => {
      const id = document.getElementById('sops-sr-id').value.trim();
      const status = document.getElementById('sops-sr-status').value;
      const note = document.getElementById('sops-sr-note').value.trim();
      if (!id) throw new Error('Request ID is required');

      const res = await authFetch(`/api/service-request/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: note || `Status changed to ${status}`, by: 'Staff' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');
      toast(`${id} → ${status.replace('_', ' ')}`, 'success');
    });
  }

  // Convenience wrappers
  function openStatusModal() {
    openSRStatusModal('', 'open');
  }

  // ── Schedule Inspection Modal ──
  function openInspectModal(address, category, zone, srId) {
    const typeMap = { pothole: 'pothole', sidewalk: 'sidewalk', concrete: 'concrete', streetlight: 'streetlight', drainage: 'drainage', tree_damage: 'tree_damage', sign_damage: 'sign_damage', crosswalk: 'crosswalk' };
    const body = fieldHTML('sops-insp-type', 'Issue Type', 'select', typeMap[category] || 'pothole', [
      { value: 'pothole', label: 'Pothole' },
      { value: 'sidewalk', label: 'Sidewalk' },
      { value: 'concrete', label: 'Concrete' },
      { value: 'streetlight', label: 'Streetlight' },
      { value: 'drainage', label: 'Drainage' },
      { value: 'tree_damage', label: 'Tree Damage' },
      { value: 'sign_damage', label: 'Sign Damage' },
      { value: 'crosswalk', label: 'Crosswalk' },
      { value: 'other', label: 'Other' },
    ])
      + fieldHTML('sops-insp-loc', 'Location', 'text', address || '', { placeholder: 'Street address' })
      + fieldHTML('sops-insp-zone', 'Zone', 'select', zone || 'NE-1', [
        { value: 'NE-1', label: 'NE-1' },
        { value: 'NW-3', label: 'NW-3' },
        { value: 'SE-2', label: 'SE-2' },
        { value: 'SW-1', label: 'SW-1' },
      ])
      + fieldHTML('sops-insp-date', 'Date', 'date', new Date().toISOString().split('T')[0])
      + fieldHTML('sops-insp-reason', 'Reason', 'text', srId ? `Resident report ${srId}` : '', { placeholder: 'Inspection reason' });

    createModal('Schedule Inspection', 'search', '#92400e', body, async () => {
      const issue_type = document.getElementById('sops-insp-type').value;
      const location = document.getElementById('sops-insp-loc').value.trim();
      const zone_val = document.getElementById('sops-insp-zone').value;
      const scheduled_date = document.getElementById('sops-insp-date').value;
      const reason = document.getElementById('sops-insp-reason').value.trim();
      if (!location) throw new Error('Location is required');

      const res = await authFetch('/api/staff/inspect', {
        method: 'POST',
        body: JSON.stringify({ issue_type, location, zone: zone_val, scheduled_date, reason, sr_id: srId || null }),
      });
      const data = await res.json();
      if (!data.success && data.error) throw new Error(data.error);
      toast(`Inspection scheduled at ${location}`, 'success');
    });
  }

  // ── Inspection Results Modal ──
  function openInspectionResultsModal(woId) {
    // Try to find linked SR from the WO's notes/reason
    const wo = dashboardData?.work_orders?.find(w => w.id === woId);
    const srMatch = wo?.notes?.match(/SR-\d{4}-\d{3}/) || wo?.reason?.match(/SR-\d{4}-\d{3}/);
    const linkedSrId = srMatch ? srMatch[0] : '';

    const body = `
      <input type="hidden" id="sops-insp-res-woid" value="${esc(woId)}" />
      <input type="hidden" id="sops-insp-res-srid" value="${esc(linkedSrId)}" />
      <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
        <strong>Work Order:</strong> ${esc(woId)}${linkedSrId ? ` &nbsp;·&nbsp; <strong>Service Request:</strong> ${esc(linkedSrId)}` : ''}
      </div>`
      + fieldHTML('sops-insp-res-finding', 'Finding', 'select', 'needs_repair', [
        { value: 'resolved', label: 'Resolved on-site' },
        { value: 'needs_repair', label: 'Needs repair crew' },
        { value: 'needs_further_review', label: 'Needs further review' },
        { value: 'no_issue_found', label: 'No issue found' },
      ])
      + fieldHTML('sops-insp-res-notes', 'Inspector Notes', 'textarea', '', { placeholder: 'Describe findings, severity, condition...' })
      + fieldHTML('sops-insp-res-action', 'Recommended Next Action', 'text', '', { placeholder: 'e.g. Schedule pothole fill, Monitor drainage...' })
      + `<div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:4px;">Photo Evidence</label>
        <div id="sops-insp-photo-area" style="border:2px dashed #cbd5e1;border-radius:10px;padding:16px;text-align:center;cursor:pointer;transition:all 0.2s;" onclick="document.getElementById('sops-insp-photo-input').click()" onmouseenter="this.style.borderColor='#006a61';this.style.background='#f0fdf4'" onmouseleave="this.style.borderColor='#cbd5e1';this.style.background='transparent'">
          <span class="material-symbols-outlined" style="font-size:28px;color:#94a3b8;display:block;margin-bottom:4px">photo_camera</span>
          <span style="font-size:12px;color:#94a3b8;">Click to upload photo (max 5 MB)</span>
          <div id="sops-insp-photo-preview" style="margin-top:8px;display:none;"></div>
        </div>
        <input type="file" id="sops-insp-photo-input" accept="image/*" style="display:none;" />
      </div>`;

    createModal('Complete Inspection', 'assignment_turned_in', '#92400e', body, async () => {
      const finding = document.getElementById('sops-insp-res-finding').value;
      const notes = document.getElementById('sops-insp-res-notes').value.trim();
      const next_action = document.getElementById('sops-insp-res-action').value.trim();
      const srId = document.getElementById('sops-insp-res-srid').value;

      // Get photo as base64 if uploaded
      let photo = null;
      const fileInput = document.getElementById('sops-insp-photo-input');
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be under 5 MB');
        photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Failed to read photo'));
          reader.readAsDataURL(file);
        });
      }

      const res = await authFetch('/api/staff/inspect/complete', {
        method: 'POST',
        body: JSON.stringify({ wo_id: woId, sr_id: srId || null, finding, notes, next_action, photo }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to complete inspection');

      const findingLabels = { resolved: 'Resolved', needs_repair: 'Needs repair', needs_further_review: 'Further review', no_issue_found: 'No issue' };
      toast(`Inspection complete: ${findingLabels[finding]}`, 'success');
    });

    // Wire up photo preview after modal renders
    setTimeout(() => {
      const fileInput = document.getElementById('sops-insp-photo-input');
      if (fileInput) {
        fileInput.addEventListener('change', () => {
          const file = fileInput.files[0];
          const preview = document.getElementById('sops-insp-photo-preview');
          if (file && preview) {
            const url = URL.createObjectURL(file);
            preview.innerHTML = `<img src="${url}" style="max-height:120px;border-radius:8px;margin-top:4px;" /><div style="font-size:11px;color:#64748b;margin-top:4px;">${esc(file.name)} (${(file.size / 1024).toFixed(0)} KB)</div>`;
            preview.style.display = 'block';
            document.getElementById('sops-insp-photo-area').querySelector('span:first-child').textContent = 'check_circle';
            document.getElementById('sops-insp-photo-area').querySelector('span:first-child').style.color = '#10b981';
          }
        });
      }
    }, 100);
  }

  // ── Page Lifecycle ──
  function openPage() {
    // Show the staff ops page, hide the main dashboard
    const mainContent = document.querySelector('main.main-with-sidenav');
    const staffPage = document.getElementById('staff-ops-page');

    if (!staffPage) {
      // Create the page container
      const page = document.createElement('div');
      page.id = 'staff-ops-page';
      page.style.cssText = 'display:none;flex-direction:column;height:100%;background:#f8fafc;overflow:hidden;';
      mainContent.parentElement.insertBefore(page, mainContent.nextSibling);
    }

    mainContent.style.display = 'none';
    document.getElementById('staff-ops-page').style.display = 'flex';

    if (getToken()) {
      loadDashboard();
    } else {
      showPinOverlay();
    }

    // Auto-refresh every 30s
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (getToken() && document.getElementById('staff-ops-page')?.style.display !== 'none') {
        loadDashboard();
      }
    }, 30000);
  }

  function closePage() {
    const staffPage = document.getElementById('staff-ops-page');
    if (staffPage) staffPage.style.display = 'none';
    document.getElementById('staff-ops-pin-overlay')?.remove();
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    // Note: main content restore and nav sync are handled by sideNavTo()
  }

  function goBack() {
    closePage();
    const mainContent = document.querySelector('main.main-with-sidenav');
    if (mainContent) mainContent.style.display = '';
    const homeBtn = document.querySelector('.side-nav-item[data-nav="home"]');
    if (homeBtn) {
      document.querySelectorAll('.side-nav-item').forEach(b => b.classList.remove('active'));
      homeBtn.classList.add('active');
    }
    // Reset mobile bottom nav back to Home
    if (window.resetNavToHome) window.resetNavToHome();
  }

  function switchTab(tab) {
    activeTab = tab;
    render();
  }

  function refresh() {
    loadDashboard();
  }

  // ══════════════════════════════════════════
  // ── Detail Sidebar Panel ──
  // ══════════════════════════════════════════
  let sidebarOpen = false;

  function closeSidebar() {
    const el = document.getElementById('staff-ops-sidebar');
    if (el) {
      el.style.transform = 'translateX(100%)';
      setTimeout(() => el.remove(), 300);
    }
    const backdrop = document.getElementById('staff-ops-sidebar-backdrop');
    if (backdrop) {
      backdrop.style.opacity = '0';
      setTimeout(() => backdrop.remove(), 300);
    }
    sidebarOpen = false;
  }

  function openSidebarShell() {
    closeSidebar();
    sidebarOpen = true;

    const backdrop = document.createElement('div');
    backdrop.id = 'staff-ops-sidebar-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);backdrop-filter:blur(2px);opacity:0;transition:opacity 0.3s;';
    backdrop.onclick = closeSidebar;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.style.opacity = '1');

    const panel = document.createElement('div');
    panel.id = 'staff-ops-sidebar';
    panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;z-index:9999;width:480px;max-width:95vw;background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,0.12);transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;overflow:hidden;';
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.style.transform = 'translateX(0)');
    return panel;
  }

  /* ── Work Order Sidebar ── */
  function openWOSidebar(woId) {
    const wo = dashboardData?.work_orders?.find(w => w.id === woId);
    if (!wo) { toast('Work order not found', 'error'); return; }

    const panel = openSidebarShell();
    const priorityColors = CivicUtils.STAFF_PRIORITY_COLORS;
    const statusColors = CivicUtils.STAFF_WO_STATUS_COLORS;
    const pColor = priorityColors[wo.priority] || '#6b7280';
    const sColor = statusColors[wo.status] || '#6b7280';

    panel.innerHTML = `
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#006a61);padding:18px 22px;display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <span class="material-symbols-outlined" style="font-size:24px;color:#fff">construction</span>
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:800;color:#fff;">${esc(wo.id)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);">Work Order Details</div>
        </div>
        <button onclick="window._staffOps.closeSidebar()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px;cursor:pointer;color:#fff;display:flex;">
          <span class="material-symbols-outlined" style="font-size:20px">close</span>
        </button>
      </div>

      <!-- Scrollable Content -->
      <div style="flex:1;overflow-y:auto;padding:20px 22px;" id="wo-sidebar-body">
        <!-- Status & Priority Badges -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;padding:4px 12px;border-radius:20px;background:${sColor}15;color:${sColor};border:1px solid ${sColor}30;">${esc(wo.status.replace('_', ' '))}</span>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;padding:4px 12px;border-radius:20px;background:${pColor}15;color:${pColor};border:1px solid ${pColor}30;">${esc(wo.priority)}</span>
          ${wo.type ? `<span style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:#f1f5f9;color:#475569;">${esc(wo.type.replace(/_/g, ' '))}</span>` : ''}
        </div>

        <!-- Editable Fields -->
        <div id="wo-sidebar-fields">
          ${sidebarField('wo-edit-status', 'Status', 'select', wo.status, [
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
          ])}
          ${sidebarField('wo-edit-priority', 'Priority', 'select', wo.priority, [
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ])}
          ${sidebarField('wo-edit-crew', 'Assigned Crew', 'select', wo.crew_assigned || '', [
            { value: '', label: 'Unassigned' },
            { value: 'Crew-A', label: 'Crew-A (Pothole Repair)' },
            { value: 'Crew-B', label: 'Crew-B (Sidewalk Team)' },
            { value: 'Crew-C', label: 'Crew-C (Concrete Repair)' },
            { value: 'Crew-D', label: 'Crew-D (Emergency Response)' },
          ])}
          ${sidebarField('wo-edit-notes', 'Notes', 'textarea', wo.notes || '', null, 'Add notes...')}
        </div>

        <!-- Read-Only Details -->
        <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Details</div>
          ${sidebarDetailRow('Type', wo.type?.replace(/_/g, ' ') || '—')}
          ${sidebarDetailRow('Location', wo.location?.address || '—')}
          ${sidebarDetailRow('Zone', wo.location?.zone || '—')}
          ${sidebarDetailRow('Reported', wo.reported_date || '—')}
          ${sidebarDetailRow('Est. Cost', wo.estimated_cost ? '$' + wo.estimated_cost.toLocaleString() : '—')}
          ${wo.scheduled_date ? sidebarDetailRow('Scheduled', wo.scheduled_date) : ''}
          ${wo.completed_date ? sidebarDetailRow('Completed', wo.completed_date.includes('T') ? new Date(wo.completed_date).toLocaleString() : wo.completed_date) : ''}
          ${wo.inspection_finding ? sidebarDetailRow('Inspection', wo.inspection_finding.replace(/_/g, ' ')) : ''}
        </div>

        ${wo.inspection_photo ? `
        <div style="margin-top:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Inspection Photo</div>
          <img src="${esc(wo.inspection_photo)}" style="width:100%;border-radius:10px;border:1px solid #e2e8f0;" />
        </div>` : ''}

        ${wo.location?.lat ? `
        <div style="margin-top:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Coordinates</div>
          <div style="font-size:12px;color:#475569;font-family:'Courier New',monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">${wo.location.lat}, ${wo.location.lng}</div>
        </div>` : ''}
      </div>

      <!-- Action Footer -->
      <div style="padding:14px 22px;border-top:1px solid #e2e8f0;background:#f9fafb;display:flex;gap:8px;flex-shrink:0;" id="wo-sidebar-footer">
        <button onclick="window._staffOps.closeSidebar()" style="flex:1;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#64748b;">Cancel</button>
        <button onclick="window._staffOps.saveWOFromSidebar('${esc(wo.id)}')" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#006a61,#004d47);color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px">save</span> Save Changes
        </button>
      </div>
    `;
  }

  /* ── Service Request Sidebar ── */
  function openSRSidebar(srId) {
    const sr = dashboardData?.service_requests?.find(s => s.id === srId);
    if (!sr) { toast('Service request not found', 'error'); return; }

    const panel = openSidebarShell();
    const statusColors = CivicUtils.STAFF_SR_STATUS_COLORS;
    const sColor = statusColors[sr.status] || '#6b7280';
    const icon = CATEGORY_ICONS[sr.category] || CATEGORY_ICONS.default;

    const updates = (sr.updates || []).slice().reverse();

    panel.innerHTML = `
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#006a61);padding:18px 22px;display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <span class="material-symbols-outlined" style="font-size:24px;color:#fff">${icon}</span>
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:800;color:#fff;">${esc(sr.id)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);">Service Request Details</div>
        </div>
        <button onclick="window._staffOps.closeSidebar()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px;cursor:pointer;color:#fff;display:flex;">
          <span class="material-symbols-outlined" style="font-size:20px">close</span>
        </button>
      </div>

      <!-- Scrollable Content -->
      <div style="flex:1;overflow-y:auto;padding:20px 22px;" id="sr-sidebar-body">
        <!-- Status & Category Badges -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;padding:4px 12px;border-radius:20px;background:${sColor}15;color:${sColor};border:1px solid ${sColor}30;">${esc(sr.status.replace('_', ' '))}</span>
          ${sr.category ? `<span style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:#e0f2f1;color:#006a61;">${esc(sr.category.replace(/_/g, ' '))}</span>` : ''}
        </div>

        <!-- Description -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Description</div>
          <div style="font-size:13px;color:#334155;line-height:1.5;">${esc(sr.description || 'No description')}</div>
        </div>

        <!-- Editable Fields -->
        <div id="sr-sidebar-fields">
          ${sidebarField('sr-edit-status', 'Status', 'select', sr.status, [
            { value: 'open', label: 'Open' },
            { value: 'received', label: 'Received' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
          ])}
          ${sidebarField('sr-edit-crew', 'Assigned Crew', 'select', sr.assigned_crew || '', [
            { value: '', label: 'Unassigned' },
            { value: 'Crew-A', label: 'Crew-A (Pothole Repair)' },
            { value: 'Crew-B', label: 'Crew-B (Sidewalk Team)' },
            { value: 'Crew-C', label: 'Crew-C (Concrete Repair)' },
            { value: 'Crew-D', label: 'Crew-D (Emergency Response)' },
          ])}
          ${sidebarField('sr-edit-note', 'Add Note', 'textarea', '', null, 'Add a status update note...')}
        </div>

        <!-- Read-Only Details -->
        <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Details</div>
          ${sidebarDetailRow('Resident', sr.resident_name || 'Anonymous')}
          ${sr.contact_email ? sidebarDetailRow('Email', sr.contact_email) : ''}
          ${sr.contact_phone ? sidebarDetailRow('Phone', sr.contact_phone) : ''}
          ${sidebarDetailRow('Location', sr.location?.address || sr.address || '—')}
          ${sidebarDetailRow('Zone', sr.location?.zone || '—')}
          ${sidebarDetailRow('Submitted', sr.submitted_date || '—')}
          ${sr.updated_date ? sidebarDetailRow('Updated', sr.updated_date.includes('T') ? new Date(sr.updated_date).toLocaleString() : sr.updated_date) : ''}
          ${sr.completed_date ? sidebarDetailRow('Completed', sr.completed_date.includes('T') ? new Date(sr.completed_date).toLocaleString() : sr.completed_date) : ''}
          ${sr.resolution_eta ? sidebarDetailRow('ETA', sr.resolution_eta) : ''}
        </div>

        ${sr.photo ? `
        <div style="margin-top:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Photo</div>
          <img src="${esc(sr.photo)}" style="width:100%;border-radius:10px;border:1px solid #e2e8f0;" />
        </div>` : ''}

        <!-- Activity Log -->
        ${updates.length ? `
        <div style="margin-top:20px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Activity Log</div>
          <div style="display:flex;flex-direction:column;gap:0;border-left:2px solid #e2e8f0;margin-left:6px;padding-left:16px;">
            ${updates.map(u => `
              <div style="position:relative;padding:8px 0;">
                <div style="position:absolute;left:-22px;top:12px;width:10px;height:10px;border-radius:50%;background:#3b82f6;border:2px solid #fff;"></div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">${esc(u.date)} &middot; ${esc(u.by || 'System')}</div>
                <div style="font-size:12px;color:#334155;">${esc(u.note)}</div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        ${sr.location?.lat ? `
        <div style="margin-top:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Coordinates</div>
          <div style="font-size:12px;color:#475569;font-family:'Courier New',monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">${sr.location.lat}, ${sr.location.lng}</div>
        </div>` : ''}
      </div>

      <!-- Action Footer -->
      <div style="padding:14px 22px;border-top:1px solid #e2e8f0;background:#f9fafb;display:flex;gap:8px;flex-shrink:0;" id="sr-sidebar-footer">
        <button onclick="window._staffOps.closeSidebar()" style="flex:1;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#64748b;">Cancel</button>
        <button onclick="window._staffOps.saveSRFromSidebar('${esc(sr.id)}')" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#006a61,#004d47);color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px">save</span> Save Changes
        </button>
      </div>
    `;
  }

  /* ── Sidebar field helpers ── */
  function sidebarField(id, label, type, value, options, placeholder) {
    if (type === 'select') {
      return `<div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">${label}</label>
        <select id="${id}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;background:#fff;transition:border 0.2s;" onfocus="this.style.borderColor='#006a61'" onblur="this.style.borderColor='#e2e8f0'">
          ${options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>`;
    }
    if (type === 'textarea') {
      return `<div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">${label}</label>
        <textarea id="${id}" rows="3" placeholder="${placeholder || ''}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;transition:border 0.2s;" onfocus="this.style.borderColor='#006a61'" onblur="this.style.borderColor='#e2e8f0'">${esc(value || '')}</textarea>
      </div>`;
    }
    return `<div style="margin-bottom:14px;">
      <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">${label}</label>
      <input id="${id}" type="text" value="${esc(value || '')}" placeholder="${placeholder || ''}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;transition:border 0.2s;" onfocus="this.style.borderColor='#006a61'" onblur="this.style.borderColor='#e2e8f0'">
    </div>`;
  }

  function sidebarDetailRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:12px;color:#64748b;font-weight:600;min-width:90px;">${label}</span>
      <span style="font-size:12px;color:#1e293b;font-weight:500;text-align:right;word-break:break-word;max-width:60%;">${esc(String(value))}</span>
    </div>`;
  }

  /* ── Save handlers ── */
  async function saveWOFromSidebar(woId) {
    const btn = document.querySelector('#wo-sidebar-footer button:last-child');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;animation:spin 1s linear infinite">progress_activity</span> Saving...'; }
    try {
      const newStatus = document.getElementById('wo-edit-status')?.value;
      const notes = document.getElementById('wo-edit-notes')?.value?.trim();
      const crew = document.getElementById('wo-edit-crew')?.value;

      // Update status via API
      const res = await authFetch(`/api/staff/work-order/${encodeURIComponent(woId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, notes: notes || '' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');

      // If crew changed, dispatch
      if (crew) {
        await authFetch('/api/staff/dispatch', {
          method: 'POST',
          body: JSON.stringify({ work_order_id: woId, crew_id: crew, scheduled_date: new Date().toISOString().split('T')[0] }),
        }).catch(() => {}); // non-critical
      }

      toast(`${woId} updated successfully`, 'success');
      closeSidebar();
      loadDashboard();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">save</span> Save Changes'; }
    }
  }

  async function saveSRFromSidebar(srId) {
    const btn = document.querySelector('#sr-sidebar-footer button:last-child');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;animation:spin 1s linear infinite">progress_activity</span> Saving...'; }
    try {
      const newStatus = document.getElementById('sr-edit-status')?.value;
      const note = document.getElementById('sr-edit-note')?.value?.trim();
      const crew = document.getElementById('sr-edit-crew')?.value;

      const res = await authFetch(`/api/service-request/${encodeURIComponent(srId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          note: note || `Status updated to ${newStatus}`,
          by: 'Staff',
          assigned_crew: crew || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');

      toast(`${srId} updated successfully`, 'success');
      closeSidebar();
      loadDashboard();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">save</span> Save Changes'; }
    }
  }

  // ── Public API ──
  window._staffOps = {
    openPage,
    closePage,
    goBack,
    submitPin,
    refresh,
    switchTab,
    openDispatchModal,
    openWOStatusModal,
    openSRStatusModal,
    openStatusModal,
    openInspectModal,
    openInspectionResultsModal,
    loadDashboard,
    setSearch,
    setFilterStatus,
    setFilterPriority,
    setFilterCategory,
    setFilterZone,
    clearFilters,
    openWOSidebar,
    openSRSidebar,
    closeSidebar,
    saveWOFromSidebar,
    saveSRFromSidebar,
  };

  // Also expose for the old chat-sidebar staff actions to use direct API
  window.openStaffOps = openPage;
})();
