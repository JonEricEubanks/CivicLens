const fs = require('fs');
let text = fs.readFileSync('public/app.js', 'utf8');

// Fix all em-dash mojibake: \u00e2\u20ac\u201d -> —
const emDashMoji = '\u00e2\u20ac\u201d';
text = text.replaceAll(emDashMoji, '\u2014');

// Verify
const remaining = (text.match(/\u00e2\u20ac/g)||[]).length;
console.log('Remaining mojibake after em-dash fix:', remaining);

// Stage 1: multi-model intent classification
text = text.replace(
  '<p>Your message is analyzed by GPT-4o-mini to determine intent (report issue, check status, safety analysis, etc.) and extract filters like zone, severity, and street names.</p>',
  '<p>Four models run in parallel \u2014 GPT-4o-mini (primary), Phi-3-mini (validator), a keyword baseline, and MobileBERT ONNX on-device \u2014 then vote on intent (report issue, check status, safety analysis, etc.). Consensus overrides any single model\u2019s mistake.</p>'
);

// Stage 2: 14 -> 16 MCP tools
text = text.replace(
  '<strong>14 MCP tools</strong> (potholes, sidewalks, schools, work orders, forecasting, cost-of-inaction, what-if budget)',
  '<strong>16 MCP tools</strong> (potholes, sidewalks, schools, work orders, service requests, forecasting, cost-of-inaction, what-if budget, 311 benchmarks, data provenance)'
);

// Stage 3: fix grammar 'a 11-document' -> 'an 11-document'
text = text.replace(
  'grounded in a <strong>11-document',
  'grounded in an <strong>11-document'
);

// Renumber old Stage 4 to Stage 5
text = text.replace(
  'Stage 4 \u2014 Report Formatting &amp; RAI',
  'Stage 5 \u2014 Report Formatting &amp; RAI'
);

// Update Stage 5 description text
text = text.replace(
  'The report is formatted with evidence-based coverage scoring.',
  'The final report is formatted with evidence-based scoring.'
);

// Insert new Stage 4 (Quality Feedback Loop) before the green Stage 5 block
const greenBlockMarker = '<div class="bg-green-50 rounded-xl p-4">';
const howItWorksIdx = text.indexOf('How CivicLens Works');
const greenIdx = text.indexOf(greenBlockMarker, howItWorksIdx);
if (greenIdx > 0) {
  const newStage4 = `<div class="bg-orange-50 rounded-xl p-4">
        <h3 class="font-bold text-orange-800 mb-1">\${CivicIcons.refresh("w-4 h-4 inline")} Stage 4 \u2014 Quality Feedback Loop</h3>
        <p>Coverage scoring evaluates how completely the response addresses the query. If coverage falls below 40%, the pipeline automatically retries with refined tool calls \u2014 no human intervention needed.</p>
      </div>
      `;
  text = text.substring(0, greenIdx) + newStage4 + text.substring(greenIdx);
  console.log('Inserted new Stage 4 block');
} else {
  console.log('ERROR: Could not find green block to insert Stage 4');
}

// Update footer
text = text.replace(
  'Built with Node.js &middot; GitHub Models (GPT-4o-mini) &middot; MCP Protocol &middot; LangChain &middot; FAISS',
  'Built with Node.js &middot; GitHub Models (GPT-4o-mini + Phi-3) &middot; MobileBERT ONNX &middot; MCP Protocol &middot; LangChain &middot; FAISS'
);

fs.writeFileSync('public/app.js', text, 'utf8');
console.log('File updated successfully');

// Verify
const verify = fs.readFileSync('public/app.js', 'utf8');
const emCount = (verify.match(/\u00e2\u20ac/g)||[]).length;
console.log('Remaining mojibake:', emCount);
console.log('Has Stage 4 Feedback:', verify.includes('Quality Feedback Loop'));
console.log('Has Stage 5 Report:', verify.includes('Stage 5'));
console.log('Has 16 MCP:', verify.includes('16 MCP tools'));
console.log('Has multi-model:', verify.includes('Four models run in parallel'));
console.log('Has updated footer:', verify.includes('MobileBERT ONNX'));
