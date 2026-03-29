// Diagnose chat issues — tests all layers
const BASE = process.argv[2] || 'https://civiclens-app.azurewebsites.net';

async function run() {
  console.log('CivicLens Chat Diagnostic');
  console.log('========================');
  console.log('Target:', BASE);
  console.log('Time:', new Date().toISOString());
  console.log('');

  // 1. Health check
  console.log('--- Health Check ---');
  try {
    const r = await fetch(BASE + '/health');
    const d = await r.json();
    console.log('Status:', d.status);
    console.log('Version:', d._v);
    console.log('Rate Limited:', d.rate_limited ?? 'field not present');
    console.log('Tools:', d.tools);
    console.log('Data:', JSON.stringify(d.data));
  } catch (e) {
    console.log('FAIL:', e.message);
  }

  // 2. Static assets
  console.log('\n--- Static Assets ---');
  try {
    const html = await (await fetch(BASE + '/')).text();
    console.log('Index HTML:', html.length, 'bytes');
    // check key scripts
    for (const f of ['app.js', 'styles.css', 'icons.js', 'demo-mode.js']) {
      const r = await fetch(BASE + '/' + f);
      console.log(`  ${f}: ${r.status} (${r.headers.get('content-length') || '?'} bytes)`);
    }
    // check vendor libs
    for (const f of ['vendor/chart.min.js', 'vendor/marked.min.js', 'vendor/dompurify.min.js']) {
      const r = await fetch(BASE + '/' + f);
      console.log(`  ${f}: ${r.status}`);
    }
  } catch (e) {
    console.log('FAIL:', e.message);
  }

  // 3. Rate limit endpoint
  console.log('\n--- Rate Limit Status ---');
  try {
    const r = await fetch(BASE + '/api/rate-limit');
    if (r.status === 404) {
      console.log('Endpoint not deployed yet (404)');
    } else {
      const d = await r.json();
      console.log('Rate limited:', d.rate_limited);
    }
  } catch (e) {
    console.log('Check failed:', e.message);
  }

  // 4. Chat JSON endpoint
  console.log('\n--- Chat API (JSON) ---');
  try {
    const start = Date.now();
    const r = await fetch(BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What areas need attention?' }),
    });
    const elapsed = Date.now() - start;
    console.log('Status:', r.status, '(' + elapsed + 'ms)');
    if (r.ok) {
      const d = await r.json();
      console.log('Has markdown:', !!d.markdown);
      console.log('Markdown length:', d.markdown?.length || 0);
      console.log('Pipeline duration:', d.pipeline?.total_duration_ms + 'ms');
      const stages = d.pipeline?.stages || [];
      for (const s of stages) {
        const fb = s.detail?.fallback_used ? ' [FALLBACK]' : '';
        const model = s.detail?.model ? ` (${s.detail.model})` : '';
        console.log(`  ${s.name}: ${s.duration_ms}ms${model}${fb}`);
      }
    } else {
      const text = await r.text();
      console.log('Error response:', text.slice(0, 500));
    }
  } catch (e) {
    console.log('FAIL:', e.message);
  }

  // 5. Chat Stream endpoint
  console.log('\n--- Chat API (Stream/SSE) ---');
  try {
    const start = Date.now();
    const r = await fetch(BASE + '/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Show me open issues' }),
    });
    const elapsed = Date.now() - start;
    console.log('Status:', r.status, '(' + elapsed + 'ms)');
    console.log('Content-Type:', r.headers.get('content-type'));
    
    const text = await r.text();
    const events = text.split('\n\n').filter(Boolean);
    let hasComplete = false;
    let hasError = false;
    for (const evt of events) {
      const lines = evt.split('\n');
      const eventName = lines.find(l => l.startsWith('event:'))?.slice(6)?.trim();
      const data = lines.find(l => l.startsWith('data:'))?.slice(5)?.trim();
      if (eventName === 'error') {
        hasError = true;
        console.log('ERROR EVENT:', data);
      }
      if (eventName === 'complete') {
        hasComplete = true;
        try {
          const parsed = JSON.parse(data);
          console.log('Complete event received');
          console.log('  Markdown:', parsed.markdown?.length || 0, 'chars');
          console.log('  Pipeline:', parsed.pipeline?.total_duration_ms + 'ms');
          console.log('  Stages:', parsed.pipeline?.stages?.map(s => s.name + '(' + s.duration_ms + 'ms)').join(' → '));
        } catch {}
      }
      if (eventName === 'stage') {
        try {
          const parsed = JSON.parse(data);
          console.log(`  [SSE] ${parsed.stage}: ${parsed.status} (${parsed.duration_ms || 0}ms)`);
        } catch {}
      }
    }
    console.log('Has complete event:', hasComplete);
    console.log('Has error event:', hasError);
    console.log('Total SSE events:', events.length);
  } catch (e) {
    console.log('FAIL:', e.message);
  }

  console.log('\n========================');
  console.log('Diagnostic complete');
}

run().catch(e => console.error('Diagnostic failed:', e));
