// Quick test of the chat API endpoints
const url = process.argv[2] || 'https://civiclens-app.azurewebsites.net';
const msg = process.argv[3] || 'What potholes are near schools?';
const mode = process.argv[4] || 'both'; // 'json', 'stream', or 'both'

async function testJSON() {
  console.log(`\n=== Testing ${url}/api/chat (JSON) ===`);
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg }),
  });
  console.log(`Status: ${res.status}`);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log(`Pipeline duration: ${json.pipeline?.total_duration_ms}ms`);
    console.log(`Stages: ${json.pipeline?.stages?.map(s => `${s.name}(${s.duration_ms}ms)`).join(' → ')}`);
    console.log(`Data tools: ${json.pipeline?.stages?.find(s => s.name === 'data')?.detail?.tools_called?.join(', ')}`);
    console.log(`Records: ${json.pipeline?.stages?.find(s => s.name === 'data')?.detail?.records_fetched}`);
    console.log(`Errors: ${JSON.stringify(json.pipeline?.stages?.find(s => s.name === 'data')?.detail?.errors || [])}`);
    console.log(`Markdown preview: ${json.markdown?.slice(0, 300)}`);
  } catch {
    console.log(text.slice(0, 2000));
  }
}

async function testStream() {
  console.log(`\n=== Testing ${url}/api/chat/stream (SSE) ===`);
  const res = await fetch(`${url}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg }),
  });
  console.log(`Status: ${res.status}`);
  const text = await res.text();
  // Parse SSE events
  const events = text.split('\n\n').filter(Boolean);
  for (const evt of events) {
    const lines = evt.split('\n');
    const eventName = lines.find(l => l.startsWith('event:'))?.slice(6)?.trim();
    const data = lines.find(l => l.startsWith('data:'))?.slice(5)?.trim();
    if (eventName && data) {
      try {
        const parsed = JSON.parse(data);
        if (eventName === 'stage') {
          console.log(`  [${eventName}] ${parsed.stage} → ${parsed.status} (${parsed.duration_ms || 0}ms)`);
          if (parsed.detail?.errors?.length) console.log(`    ERRORS: ${JSON.stringify(parsed.detail.errors)}`);
          if (parsed.detail?.tools_called) console.log(`    Tools: ${parsed.detail.tools_called.join(', ')}`);
        } else if (eventName === 'complete') {
          console.log(`  [complete] Pipeline ${parsed.pipeline?.total_duration_ms}ms, markdown=${parsed.markdown?.length} chars`);
        } else if (eventName === 'error') {
          console.log(`  [ERROR] ${parsed.message}`);
        }
      } catch {
        console.log(`  [${eventName}] ${data.slice(0, 200)}`);
      }
    }
  }
}

try {
  if (mode === 'json' || mode === 'both') await testJSON();
  if (mode === 'stream' || mode === 'both') await testStream();
} catch (err) {
  console.error('Error:', err.message);
}
