// Quick verification of CivicUtils module
const window = {};
const document = { createElement: () => ({ set textContent(v) { this._t = v; }, get innerHTML() { return this._t; } }) };
const fn = new Function('window', 'document', require('fs').readFileSync('public/civic-utils.js', 'utf8'));
fn(window, document);

const U = window.CivicUtils;
const expected = ['CATEGORY_ICONS','timeAgo','SEV_COLORS','STATUS_COLORS','TYPE_COLORS','GRADE_COLORS','MAP_STATUS_COLORS','STAFF_PRIORITY_COLORS','STAFF_WO_STATUS_COLORS','STAFF_SR_STATUS_COLORS','escapeHtml','prettyLabel','pieData','barData'];
let pass = 0, fail = 0;

for (const k of expected) {
  const exists = U[k] !== undefined;
  console.log((exists ? 'OK  ' : 'FAIL') + ' CivicUtils.' + k + ' (' + typeof U[k] + ')');
  if (exists) pass++; else fail++;
}

// Test escapeHtml
const escaped = U.escapeHtml('<script>alert(1)</script>');
const escOk = escaped === '&lt;script&gt;alert(1)&lt;/script&gt;';
console.log((escOk ? 'OK  ' : 'FAIL') + ' escapeHtml XSS test: ' + escaped);
if (escOk) pass++; else fail++;

// Test prettyLabel
const lbl = U.prettyLabel('pothole_repair');
console.log((lbl === 'Pothole Repair' ? 'OK  ' : 'FAIL') + ' prettyLabel("pothole_repair") = "' + lbl + '"');
if (lbl === 'Pothole Repair') pass++; else fail++;

// Test timeAgo
const ta = U.timeAgo('');
console.log((ta === '' ? 'OK  ' : 'FAIL') + ' timeAgo("") = "' + ta + '"');
if (ta === '') pass++; else fail++;

// Test pieData
const pd = U.pieData({ a: 1, b: 2 });
const pdOk = pd.labels.length === 2 && pd.datasets[0].data.length === 2;
console.log((pdOk ? 'OK  ' : 'FAIL') + ' pieData returns valid structure');
if (pdOk) pass++; else fail++;

// Test barData
const bd = U.barData({ x: 10, y: 20 }, null, '#ff0000');
const bdOk = bd.labels.length === 2 && bd.datasets[0].backgroundColor[0] === '#ff0000';
console.log((bdOk ? 'OK  ' : 'FAIL') + ' barData returns valid structure');
if (bdOk) pass++; else fail++;

// Verify color values are correct
const checks = [
  ['SEV_COLORS.critical', U.SEV_COLORS.critical, '#ef4444'],
  ['GRADE_COLORS.A', U.GRADE_COLORS.A, '#22c55e'],
  ['MAP_STATUS_COLORS.open', U.MAP_STATUS_COLORS.open, '#f59e0b'],
  ['STAFF_PRIORITY_COLORS.high', U.STAFF_PRIORITY_COLORS.high, '#f59e0b'],
  ['STAFF_WO_STATUS_COLORS.open', U.STAFF_WO_STATUS_COLORS.open, '#ef4444'],
  ['STAFF_SR_STATUS_COLORS.received', U.STAFF_SR_STATUS_COLORS.received, '#f59e0b'],
];
for (const [name, actual, expected] of checks) {
  const ok = actual === expected;
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name + ' = ' + actual + (ok ? '' : ' (expected ' + expected + ')'));
  if (ok) pass++; else fail++;
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : ' - ALL GOOD'));
process.exit(fail > 0 ? 1 : 0);
