/**
 * CivicLens — Shared Utilities (deduplicates helpers across modules)
 *
 * Exposed as window.CivicUtils so IIFEs and non-module scripts can access.
 */
(function () {
  'use strict';

  /** Map category/type strings to Material Symbol icon names */
  const CATEGORY_ICONS = {
    pothole: 'crisis_alert', streets: 'crisis_alert', sidewalk: 'directions_walk',
    streetlight: 'lightbulb', water: 'water_drop', sewer: 'plumbing',
    traffic: 'traffic', tree: 'park', noise: 'volume_up', graffiti: 'format_paint',
    parking: 'local_parking', general: 'help', default: 'report',
  };

  /**
   * Human-friendly relative timestamp.
   * Handles both ISO datetime ("2024-01-15T10:30:00Z") and date-only ("2024-01-15").
   */
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    // Full ISO timestamp — compute precise diff
    if (dateStr.includes('T')) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      return Math.floor(hrs / 24) + 'd ago';
    }
    // Date-only string — compare calendar dates in local timezone
    const now = new Date();
    const then = new Date(dateStr + 'T00:00:00'); // local midnight
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
    const days = Math.round((nowDay - thenDay) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + 'd ago';
    return Math.floor(days / 7) + 'w ago';
  }

  /** Severity color palette (shared across NLP dashboard, insights, etc.) */
  const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

  /** Status color palette */
  const STATUS_COLORS = { open: '#f97316', in_progress: '#3b82f6', completed: '#22c55e' };

  /** Infrastructure type colors */
  const TYPE_COLORS = { pothole_repair: '#6366f1', sidewalk_replacement: '#8b5cf6', concrete_repair: '#a78bfa' };

  /** Neighborhood grade colors */
  const GRADE_COLORS = { A: '#22c55e', B: '#3b82f6', C: '#eab308', D: '#f97316', F: '#ef4444' };

  /** Map-specific status colors (amber for open, includes reported/active) */
  const MAP_STATUS_COLORS = { open: '#f59e0b', in_progress: '#3b82f6', completed: '#22c55e', reported: '#f59e0b', active: '#22c55e' };

  /** Staff dashboard priority colors */
  const STAFF_PRIORITY_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#6b7280' };

  /** Staff work-order status colors */
  const STAFF_WO_STATUS_COLORS = { open: '#ef4444', in_progress: '#3b82f6', completed: '#10b981' };

  /** Staff service-request status colors */
  const STAFF_SR_STATUS_COLORS = { open: '#ef4444', received: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981' };

  /** HTML-escape a string to prevent XSS */
  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  /** Convert snake_case to Title Case */
  function prettyLabel(s) {
    return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Build Chart.js pie/doughnut dataset from { key: value } object */
  function pieData(obj, colorMap) {
    const labels = Object.keys(obj);
    const values = Object.values(obj);
    const fallback = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];
    const colors = labels.map((l, i) => (colorMap && colorMap[l]) || fallback[i % fallback.length]);
    return { labels: labels.map(prettyLabel), datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] };
  }

  /** Build Chart.js bar dataset from { key: value } object */
  function barData(obj, colorMap, defaultColor) {
    const labels = Object.keys(obj);
    const values = Object.values(obj);
    const fallback = defaultColor || '#6366f1';
    const colors = labels.map(l => (colorMap && colorMap[l]) || fallback);
    return { labels: labels.map(prettyLabel), datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] };
  }

  window.CivicUtils = {
    CATEGORY_ICONS, timeAgo, SEV_COLORS, STATUS_COLORS,
    TYPE_COLORS, GRADE_COLORS, MAP_STATUS_COLORS,
    STAFF_PRIORITY_COLORS, STAFF_WO_STATUS_COLORS, STAFF_SR_STATUS_COLORS,
    escapeHtml, prettyLabel, pieData, barData,
  };
})();
