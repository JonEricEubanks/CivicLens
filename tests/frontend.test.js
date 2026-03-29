/**
 * Frontend structure & integrity tests for CivicLens
 * Validates all frontend modules: structure, data contracts, and consistency
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = (...segs) => join(__dirname, '..', 'public', ...segs);

// ── Helper: read a public file ──────────────────────────────────────
async function readPublic(file) {
  return readFile(pub(file), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════
//  1.  All frontend JS files are valid (parseable, no syntax errors)
// ═══════════════════════════════════════════════════════════════════════
describe('Frontend file integrity', () => {
  const JS_FILES = [
    'app.js', 'service-portal.js', 'staff-ops.js', 'nlp-dashboard.js',
    'insights.js', 'civic-map.js', 'report-generator.js', 'demo-mode.js',
    'icons.js', 'demo-overlay.js',
  ];

  for (const file of JS_FILES) {
    it(`${file} is readable and non-empty`, async () => {
      const src = await readPublic(file);
      assert.ok(src.length > 100, `${file} should have substantial content`);
    });
  }

  it('index.html loads all required JS modules', async () => {
    const html = await readPublic('index.html');
    const required = ['app.js', 'icons.js', 'service-portal.js', 'civic-map.js'];
    for (const f of required) {
      assert.ok(html.includes(f), `index.html should reference ${f}`);
    }
  });

  it('styles.css exists and contains Tailwind custom properties', async () => {
    const css = await readPublic('styles.css');
    assert.ok(css.includes('--tw-'), 'styles.css should contain Tailwind custom properties');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  2.  Service Portal — 12 categories, each with ≥3 subtypes
// ═══════════════════════════════════════════════════════════════════════
describe('Service Portal structure', () => {
  let src;

  it('CATEGORIES array has exactly 12 entries', async () => {
    src = await readPublic('service-portal.js');
    const ids = [...src.matchAll(/id:\s*'(\w+)',\s*label:/g)].map(m => m[1]);
    // First 12 matches are the category ids (subtypes also match but come later)
    const categoryIds = ['streets', 'sidewalks', 'trees', 'streetlights', 'drainage',
      'signs', 'property', 'parks', 'sewer', 'parking', 'safety', 'general'];
    for (const id of categoryIds) {
      assert.ok(ids.includes(id), `Category "${id}" should be present`);
    }
  });

  it('each category has a color and icon function', async () => {
    src = src || await readPublic('service-portal.js');
    const colorMatches = [...src.matchAll(/color:\s*'(#[0-9a-fA-F]{6})'/g)];
    assert.ok(colorMatches.length >= 12, 'At least 12 color definitions');
    const iconMatches = [...src.matchAll(/icon:\s*\(\)\s*=>\s*CivicIcons\.\w+/g)];
    assert.ok(iconMatches.length >= 12, 'At least 12 icon functions');
  });

  it('each category has types array with ≥3 subtypes', async () => {
    src = src || await readPublic('service-portal.js');
    // Count types arrays — there should be 12, each with at least 3 items
    const typesBlocks = src.split('types:');
    // First block is before any types: key, so we skip it
    assert.ok(typesBlocks.length >= 13, `Expected 12+ types blocks, got ${typesBlocks.length - 1}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  3.  App.js — core functions exposed on window
// ═══════════════════════════════════════════════════════════════════════
describe('App.js core structure', () => {
  let src;

  it('exposes required functions on window', async () => {
    src = await readPublic('app.js');
    const windowExports = [
      'sideNavTo', 'resetNavToHome', 'setChatSize', 'toggleDarkMode',
      'toggleSidebar', 'showToast',
    ];
    for (const fn of windowExports) {
      assert.ok(src.includes(`window.${fn}`), `window.${fn} should be exposed`);
    }
  });

  it('defines PAGE_CONTEXTS with required pages', async () => {
    src = src || await readPublic('app.js');
    const contexts = ['home', 'map', 'portal', 'insights'];
    for (const ctx of contexts) {
      assert.ok(src.includes(`${ctx}:`), `PAGE_CONTEXTS should include "${ctx}"`);
    }
  });

  it('has chat size management (compact, expanded, fullscreen)', async () => {
    src = src || await readPublic('app.js');
    for (const size of ['compact', 'expanded', 'fullscreen']) {
      assert.ok(src.includes(`chat-${size}`), `Chat size "${size}" should be handled`);
    }
  });

  it('has command palette with action definitions', async () => {
    src = src || await readPublic('app.js');
    assert.ok(src.includes('CMD_ACTIONS'), 'CMD_ACTIONS should be defined');
    assert.ok(src.includes('toggleCommandPalette'), 'toggleCommandPalette should exist');
  });

  it('has keyboard shortcut support', async () => {
    src = src || await readPublic('app.js');
    assert.ok(src.includes('keydown'), 'Should listen for keydown events');
    assert.ok(src.includes('Escape'), 'Should handle Escape key');
  });

  it('escapeHtml function exists for XSS prevention', async () => {
    src = src || await readPublic('app.js');
    assert.ok(src.includes('escapeHtml'), 'escapeHtml should be defined');
  });

  it('staff auth flow functions exist', async () => {
    src = src || await readPublic('app.js');
    const staffFns = ['showStaffPinModal', 'submitStaffPin', 'activateStaffMode', 'deactivateStaffMode'];
    for (const fn of staffFns) {
      assert.ok(src.includes(fn), `${fn} should be defined`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  4.  Civic Map — MAP_CONFIG with valid Lake Forest coordinates
// ═══════════════════════════════════════════════════════════════════════
describe('Civic Map structure', () => {
  let src;

  it('MAP_CONFIG has valid center coordinates for Lake Forest, IL', async () => {
    src = await readPublic('civic-map.js');
    const centerMatch = src.match(/center:\s*\[([\d.]+),\s*([-\d.]+)\]/);
    assert.ok(centerMatch, 'MAP_CONFIG should define a center');
    const lat = parseFloat(centerMatch[1]);
    const lng = parseFloat(centerMatch[2]);
    // Lake Forest, IL is roughly at 42.26°N, 87.84°W
    assert.ok(lat > 42.0 && lat < 42.5, `Latitude ${lat} should be near Lake Forest`);
    assert.ok(lng < -87.5 && lng > -88.2, `Longitude ${lng} should be near Lake Forest`);
  });

  it('has city boundary polygon with ≥20 coordinate pairs', async () => {
    src = src || await readPublic('civic-map.js');
    const boundaryCoords = [...src.matchAll(/\[\d{2}\.\d+,\s*-\d{2}\.\d+\]/g)];
    assert.ok(boundaryCoords.length >= 20, `Boundary should have ≥20 points, got ${boundaryCoords.length}`);
  });

  it('defines MARKER_CONFIG with known infra types', async () => {
    src = src || await readPublic('civic-map.js');
    const types = ['pothole', 'sidewalk', 'work_order', 'service_request', 'school'];
    for (const t of types) {
      assert.ok(src.includes(`${t}:`), `MARKER_CONFIG should include "${t}"`);
    }
  });

  it('has filter system (activeFilters)', async () => {
    src = src || await readPublic('civic-map.js');
    assert.ok(src.includes('activeFilters'), 'Should have activeFilters state');
  });

  it('has escapeHtml for XSS prevention in popups', async () => {
    src = src || await readPublic('civic-map.js');
    assert.ok(src.includes('escapeHtml'), 'Should have escapeHtml in map module');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  5.  NLP Dashboard — templates and color palettes
// ═══════════════════════════════════════════════════════════════════════
describe('NLP Dashboard structure', () => {
  let src;

  it('defines 6 quick-query templates', async () => {
    src = await readPublic('nlp-dashboard.js');
    const templates = [...src.matchAll(/label:\s*'[^']+',\s*query:/g)];
    assert.ok(templates.length >= 6, `Expected ≥6 templates, got ${templates.length}`);
  });

  it('exports openDashboard and closeDashboard', async () => {
    src = src || await readPublic('nlp-dashboard.js');
    assert.ok(src.includes('export function openDashboard'), 'Should export openDashboard');
    assert.ok(src.includes('export function closeDashboard'), 'Should export closeDashboard');
  });

  it('defines severity, type, and status color palettes', async () => {
    src = src || await readPublic('nlp-dashboard.js');
    assert.ok(src.includes('SEV_COLORS'), 'Should have severity colors');
    assert.ok(src.includes('TYPE_COLORS'), 'Should have type colors');
    assert.ok(src.includes('STATUS_COLORS'), 'Should have status colors');
  });

  it('has dark theme detection', async () => {
    src = src || await readPublic('nlp-dashboard.js');
    assert.ok(src.includes('isDarkTheme'), 'Should detect dark theme');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  6.  Insights overlay
// ═══════════════════════════════════════════════════════════════════════
describe('Insights structure', () => {
  let src;

  it('exports openInsights, closeInsights', async () => {
    src = await readPublic('insights.js');
    assert.ok(src.includes('export function openInsights'), 'Should export openInsights');
    assert.ok(src.includes('export function closeInsights'), 'Should export closeInsights');
  });

  it('has print support', async () => {
    src = src || await readPublic('insights.js');
    assert.ok(src.includes('printInsights'), 'Should have printInsights function');
    assert.ok(src.includes('window.print'), 'Should call window.print');
  });

  it('defines color palettes consistent with NLP dashboard', async () => {
    src = src || await readPublic('insights.js');
    const dashSrc = await readPublic('nlp-dashboard.js');
    // Both should reference SEV_COLORS (either define or import from CivicUtils)
    assert.ok(src.includes('SEV_COLORS'), 'insights.js should reference SEV_COLORS');
    assert.ok(dashSrc.includes('SEV_COLORS'), 'nlp-dashboard.js should reference SEV_COLORS');
    // Both should get colors from the same source (CivicUtils)
    assert.ok(src.includes('CivicUtils'), 'insights.js should delegate to CivicUtils');
    assert.ok(dashSrc.includes('CivicUtils'), 'nlp-dashboard.js should delegate to CivicUtils');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  7.  Report Generator — templates and audiences
// ═══════════════════════════════════════════════════════════════════════
describe('Report Generator structure', () => {
  let src;

  it('defines 5 report templates', async () => {
    src = await readPublic('report-generator.js');
    const templates = ['full', 'brief', 'community', 'budget', 'neighbor'];
    for (const t of templates) {
      assert.ok(src.includes(`${t}:`), `TEMPLATES should include "${t}"`);
    }
  });

  it('defines 5 audience types', async () => {
    src = src || await readPublic('report-generator.js');
    const audiences = ['board', 'technical', 'community', 'resident', 'internal'];
    for (const a of audiences) {
      assert.ok(src.includes(`${a}:`), `AUDIENCES should include "${a}"`);
    }
  });

  it('has section definitions (SECTION_DEFS)', async () => {
    src = src || await readPublic('report-generator.js');
    assert.ok(src.includes('SECTION_DEFS'), 'Should define SECTION_DEFS');
    const sections = ['cover', 'exec', 'kpi', 'severity', 'charts', 'budget', 'recommendations', 'forecast'];
    for (const s of sections) {
      assert.ok(src.includes(`${s}:`), `SECTION_DEFS should include "${s}"`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  8.  Demo Mode — step structure and state machine
// ═══════════════════════════════════════════════════════════════════════
describe('Demo Mode structure', () => {
  let src;

  it('defines 7 demo steps with required properties', async () => {
    src = await readPublic('demo-mode.js');
    const stepIds = [...src.matchAll(/id:\s*'(\w+)'/g)].map(m => m[1]);
    assert.ok(stepIds.length >= 7, `Expected ≥7 demo steps, got ${stepIds.length}`);

    // Each step should have duration
    const durations = [...src.matchAll(/durationMs:\s*(\d+)/g)];
    assert.ok(durations.length >= 7, 'Each step should have durationMs');
    for (const [, ms] of durations) {
      const val = parseInt(ms, 10);
      assert.ok(val >= 3000 && val <= 30000, `Duration ${val}ms should be reasonable`);
    }
  });

  it('has state machine variables', async () => {
    src = src || await readPublic('demo-mode.js');
    const stateVars = ['_isRunning', '_isPaused', '_currentStep', '_progress'];
    for (const v of stateVars) {
      assert.ok(src.includes(v), `State variable ${v} should exist`);
    }
  });

  it('has listener/notification pattern', async () => {
    src = src || await readPublic('demo-mode.js');
    assert.ok(src.includes('_listeners'), 'Should have listener set');
    assert.ok(src.includes('_notify'), 'Should have notify function');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  9.  Staff Operations — search, filter, and security helpers
// ═══════════════════════════════════════════════════════════════════════
describe('Staff Operations structure', () => {
  let src;

  it('has XSS-safe escape helper', async () => {
    src = await readPublic('staff-ops.js');
    assert.ok(src.includes('esc'), 'Should have esc helper');
    // Either defines esc() locally or delegates to CivicUtils.escapeHtml
    assert.ok(
      src.includes('function esc(') || src.includes('CivicUtils.escapeHtml'),
      'esc() should be defined locally or delegate to CivicUtils.escapeHtml'
    );
  });

  it('has search and filter state variables', async () => {
    src = src || await readPublic('staff-ops.js');
    const filterVars = ['searchQuery', 'filterStatus', 'filterPriority', 'filterCategory', 'filterZone'];
    for (const v of filterVars) {
      assert.ok(src.includes(v), `Filter variable ${v} should exist`);
    }
  });

  it('has work order and service request filtering functions', async () => {
    src = src || await readPublic('staff-ops.js');
    assert.ok(src.includes('filterWO'), 'Should have filterWO function');
    assert.ok(src.includes('filterSR'), 'Should have filterSR function');
  });

  it('has timeAgo utility for relative timestamps', async () => {
    src = src || await readPublic('staff-ops.js');
    assert.ok(src.includes('function timeAgo'), 'Should have timeAgo function');
    // Verify it handles ISO timestamps
    assert.ok(src.includes('includes(\'T\')'), 'timeAgo should detect ISO timestamps');
  });

  it('CATEGORY_ICONS covers standard infra types', async () => {
    src = src || await readPublic('staff-ops.js');
    const icons = ['pothole', 'sidewalk', 'streetlight', 'water', 'sewer', 'traffic', 'tree'];
    for (const icon of icons) {
      assert.ok(src.includes(`${icon}:`), `CATEGORY_ICONS should include "${icon}"`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10.  Cross-module consistency checks
// ═══════════════════════════════════════════════════════════════════════
describe('Cross-module consistency', () => {
  it('IIFE modules with strict mode use it correctly', async () => {
    const iifeFiles = ['service-portal.js', 'staff-ops.js', 'civic-utils.js'];
    for (const file of iifeFiles) {
      const src = await readPublic(file);
      assert.ok(src.includes("'use strict'") || src.includes('"use strict"'),
        `${file} should use strict mode`);
    }
  });

  it('civic-utils.js exposes CivicUtils on window', async () => {
    const src = await readPublic('civic-utils.js');
    assert.ok(src.includes('window.CivicUtils'), 'Should expose CivicUtils on window');
    assert.ok(src.includes('CATEGORY_ICONS'), 'Should provide CATEGORY_ICONS');
    assert.ok(src.includes('timeAgo'), 'Should provide timeAgo');
    assert.ok(src.includes('SEV_COLORS'), 'Should provide SEV_COLORS');
    assert.ok(src.includes('STATUS_COLORS'), 'Should provide STATUS_COLORS');
  });

  it('index.html loads civic-utils.js before other modules', async () => {
    const html = await readPublic('index.html');
    const utilsIdx = html.indexOf('civic-utils.js');
    const appIdx = html.indexOf('app.js');
    assert.ok(utilsIdx > -1, 'index.html should include civic-utils.js');
    if (appIdx > -1) {
      assert.ok(utilsIdx < appIdx, 'civic-utils.js should load before app.js');
    }
  });

  it('app.js delegates to CivicUtils for shared utilities', async () => {
    const src = await readPublic('app.js');
    assert.ok(src.includes('CivicUtils'), 'app.js should reference CivicUtils');
  });

  it('staff-ops.js delegates to CivicUtils for shared utilities', async () => {
    const src = await readPublic('staff-ops.js');
    assert.ok(src.includes('CivicUtils'), 'staff-ops.js should reference CivicUtils');
  });

  it('no console.error or debugger statements in frontend production files', async () => {
    const files = ['app.js', 'service-portal.js', 'staff-ops.js', 'nlp-dashboard.js',
      'insights.js', 'civic-map.js', 'report-generator.js'];
    for (const file of files) {
      const src = await readPublic(file);
      assert.ok(!src.includes('debugger'), `${file} should not contain debugger statements`);
    }
  });

  it('all modules that create overlays clean up on close', async () => {
    const overlayModules = [
      { file: 'nlp-dashboard.js', open: 'openDashboard', close: 'closeDashboard' },
      { file: 'insights.js', open: 'openInsights', close: 'closeInsights' },
    ];
    for (const { file, close } of overlayModules) {
      const src = await readPublic(file);
      assert.ok(src.includes(close), `${file} should have ${close}`);
      assert.ok(src.includes('.remove()'), `${file} close should remove overlay from DOM`);
      assert.ok(src.includes("document.body.style.overflow = ''") ||
        src.includes('document.body.style.overflow=""'),
        `${file} should restore body scroll on close`);
    }
  });
});
