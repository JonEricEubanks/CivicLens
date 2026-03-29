const fs = require('fs');
let t = fs.readFileSync('public/app.js', 'utf8');
const marker = 'if (deskBtn) deskBtn.classList.add("active");\n}';
const idx = t.indexOf(marker);
if (idx < 0) { console.log('ERROR: marker not found'); process.exit(1); }
const insertAt = idx + marker.length;
const insertion = [
  '',
  '',
  '// Reset bottom nav to Home (called when overlays close)',
  'function resetNavToHome() {',
  '  const homeBtn = document.querySelector(\'.bottom-nav-item[data-nav="home"]\');',
  '  if (homeBtn) setActiveNav(homeBtn);',
  '}',
  'window.resetNavToHome = resetNavToHome;',
  ''
].join('\n');
t = t.substring(0, insertAt) + insertion + t.substring(insertAt);
fs.writeFileSync('public/app.js', t, 'utf8');
console.log('SUCCESS: Inserted resetNavToHome function at position', insertAt);
