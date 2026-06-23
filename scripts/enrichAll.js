// enrichAll.js
// Usage: node scripts/enrichAll.js
// This script logs into the local admin API and repeatedly calls the enrich-bulk
// endpoint until all places have real images.

let fetchFn = global.fetch;
if (!fetchFn) {
  try { fetchFn = require('node-fetch'); } catch (_) { /* will error later if missing */ }
}
const fetch = fetchFn;
const ADMIN_ID = process.env.ADMIN_ID || 'admin@travelguru.in';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin@TG2025#Secure';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

(async () => {
  try {
    console.log('Logging in as admin...');
    const loginRes = await fetch(BASE + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: ADMIN_ID, password: ADMIN_PASS })
    });
    const login = await loginRes.json();
    if (!login.token) throw new Error('Admin login failed: ' + JSON.stringify(login));
    const token = login.token;
    console.log('Logged in. Starting bulk enrichment (this may take time).');
    let done = false; let round = 0;
    while (!done) {
      round++;
      console.log('Batch', round);
      const res = await fetch(BASE + '/api/admin/places/enrich-bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ batchSize: 50 })
      });
      const data = await res.json();
      console.log('Processed:', data.processed, 'Remaining:', data.remaining, 'Done:', data.done);
      done = data.done;
      if (!done) await new Promise(r => setTimeout(r, 1000));
    }
    console.log('Enrichment finished.');
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
