const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const checks = [
  ['staff-ops nav button', html.includes('data-nav="staff-ops"')],
  ['staff-ops-page div', html.includes('id="staff-ops-page"')],
  ['staff-ops.js script', html.includes('src="/staff-ops.js"')],
  ['staff-action-pill CSS', html.includes('.staff-action-pill')],
  ['dispatch direct API', html.includes("/api/staff/dispatch")],
  ['inspect direct API', html.includes("/api/staff/inspect")],
  ['sideNavTo staff-ops', html.includes("page === 'staff-ops'")],
];
checks.forEach(([name, pass]) => console.log(pass ? 'PASS' : 'FAIL', name));

// Check staffChatCommand is NOT called in executeStaffAction dispatch/inspect
const execFn = html.match(/async function executeStaffAction\(\)([\s\S]*?)window\.executeStaffAction/);
if (execFn) {
  const body = execFn[1];
  console.log(body.includes('staffChatCommand') ? 'FAIL no-chat-in-exec' : 'PASS no-chat-in-exec');
} else {
  console.log('FAIL could not find executeStaffAction');
}

fs.unlinkSync('verify.js');
