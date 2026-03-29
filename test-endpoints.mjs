// Test AI dashboard endpoint
const url = process.argv[2] || 'https://civiclens-app.azurewebsites.net';

const tests = [
  { endpoint: '/api/dashboard/ai', method: 'POST', body: { query: 'Which neighborhoods need attention?' }, label: 'AI Insights' },
  { endpoint: '/api/dashboard', method: 'POST', body: { query: 'status_report' }, label: 'Dashboard' },
  { endpoint: '/api/community', method: 'GET', body: null, label: 'Community' },
];

for (const t of tests) {
  console.log(`\n=== ${t.label}: ${t.method} ${t.endpoint} ===`);
  try {
    const opts = { method: t.method, headers: { 'Content-Type': 'application/json' } };
    if (t.body) opts.body = JSON.stringify(t.body);
    const res = await fetch(`${url}${t.endpoint}`, opts);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      // Summarize the response
      const keys = Object.keys(json);
      console.log(`Keys: ${keys.join(', ')}`);
      if (json.ai_insights) {
        console.log(`  ai_insights.markdown: ${json.ai_insights.markdown?.slice(0, 200) || 'null'}`);
        console.log(`  ai_insights.pipeline: ${json.ai_insights.pipeline?.total_duration_ms}ms`);
      }
      if (json.error) console.log(`  ERROR: ${json.error}`);
      if (json.service_requests) console.log(`  service_requests: ${json.service_requests.length}`);
    } catch {
      console.log(text.slice(0, 500));
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}
