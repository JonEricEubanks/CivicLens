const auth = Buffer.from(process.env.KUDU_USER + ':' + process.env.KUDU_PASS).toString('base64');

async function run() {
  // Get deployment logs
  const resp = await fetch('https://civiclens-app.scm.azurewebsites.net/api/deployments/52835367-0064-4461-8b2b-c3492f1c963e/log', {
    headers: { Authorization: 'Basic ' + auth }
  });
  const logs = await resp.json();
  for (const entry of logs) {
    console.log(`[${entry.log_time}] ${entry.message}`);
    if (entry.details_url) {
      const detResp = await fetch(entry.details_url, { headers: { Authorization: 'Basic ' + auth } });
      const details = await detResp.json();
      for (const d of details.slice(-10)) {
        console.log(`  >> ${d.message}`);
      }
    }
  }
}

run().catch(e => console.error(e));
