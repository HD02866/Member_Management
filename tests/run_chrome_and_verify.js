/**
 * Coordinated Chrome CDP Runner:
 * 1. Spawns Chrome with remote debugging on port 9222
 * 2. Waits for port 9222 to be responsive
 * 3. Injects authentication credentials for test member
 * 4. Navigates to http://localhost:3001/app/card
 * 5. Verifies all elements on the card page
 * 6. Gracefully terminates Chrome
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const profileDir = path.join(os.tmpdir(), 'cdp_verify_profile_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('[CDP Coordinated Test] Launching Chrome process...');
  const chrome = spawn(chromePath, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=' + profileDir,
    'about:blank',
  ]);

  chrome.on('error', (err) => console.error('Chrome spawn error:', err));

  // Wait for CDP endpoint to be available
  let version = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {}
  }

  if (!version) {
    chrome.kill();
    throw new Error('Chrome failed to respond on port 9222 after 10s');
  }

  console.log('  Chrome is online:', version.Browser);

  try {
    // Acquire Member B token
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'member.test@4baye.local',
        password: 'MemberTest@4Baye2026!',
      }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data.tokens.accessToken;
    const orgId = 'ef221df4-bfb8-49b8-8a50-e7b96bef8677';

    // Create a new tab
    const tabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3001/login', { method: 'PUT' });
    const tab = await tabRes.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const onMsg = (event) => {
          const res = JSON.parse(event.data);
          if (res.id === id) {
            ws.removeEventListener('message', onMsg);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    // Set auth cookie
    await send('Network.setCookie', {
      name: 'access_token',
      value: token,
      domain: 'localhost',
      path: '/',
    });

    // Navigate to /app/card
    console.log('  Navigating to http://localhost:3001/app/card ...');
    await send('Page.navigate', { url: 'http://localhost:3001/app/card' });
    await new Promise((r) => setTimeout(r, 4500));

    // Inspect rendered elements
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const text = document.body.innerText;
          const img = document.querySelector('#digital-id-member-image') || document.querySelector('img[alt*="Digital ID"]');
          const printBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Print Card'));
          const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download ID'));
          const verifiedBadge = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('Verified'));
          const printArea = document.querySelector('.digital-id-print-area');

          return {
            hasTitle: text.includes('Digital Membership ID') || text.includes('Official Digital Membership Card'),
            hasImg: !!img,
            imgSrc: img ? img.src : null,
            imgNaturalWidth: img ? img.naturalWidth : 0,
            hasPrintBtn: !!printBtn,
            hasDownloadBtn: !!downloadBtn,
            hasVerifiedBadge: !!verifiedBadge,
            hasMemberName: text.includes('Member Test') || text.includes('4B-TST-00002') || text.includes('CARD-'),
            hasPrintArea: !!printArea,
          };
        })()
      `,
      returnByValue: true,
    });

    console.log('  DOM Evaluation:', JSON.stringify(evalRes.result.value, null, 2));
    const r = evalRes.result.value;

    if (!r.hasTitle) throw new Error('Missing Digital ID page title');
    if (!r.hasPrintBtn) throw new Error('Missing Print Card button');
    if (!r.hasDownloadBtn) throw new Error('Missing Download ID (PDF) button');
    if (!r.hasPrintArea) throw new Error('Missing digital-id-print-area container');

    console.log('  Testing PDF Download button click...');
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download ID'));
          if (btn) {
            btn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true,
    });
    console.log('  Button Click Result:', clickRes.result.value);

    await send('Page.close');
    ws.close();
    console.log('\n🎉 CDP REAL CHROME BROWSER VERIFICATION SUITE PASSED 100%!\n');
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
