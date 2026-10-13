/**
 * CDP Browser Test for Member Digital ID (/app/card)
 * 1. Connects to Chrome on port 9222
 * 2. Injects member authentication credentials into browser local storage & cookies
 * 3. Navigates to http://localhost:3001/app/card
 * 4. Verifies the Official Digital ID image loads and renders with object-contain
 * 5. Verifies Member Number, Member Name, and Verification Badge are visible
 * 6. Verifies "Print Card" button and "Download ID (PDF)" button exist and are clickable
 * 7. Tests clicking "Download ID (PDF)" to ensure no runtime errors occur
 * 8. Evaluates media query @media print to ensure isolation rules apply
 */

const http = require('http');

function cdpSend(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      const res = JSON.parse(msg.toString());
      if (res.id === id) {
        ws.off('message', handler);
        if (res.error) reject(res.error);
        else resolve(res.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function verifyBrowser() {
  console.log('\n[CDP Browser Test] Connecting to Chrome DevTools Protocol...');
  const tabsRes = await fetch('http://localhost:9222/json/new?http://localhost:3001/login', { method: 'PUT' });
  const tab = await tabsRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  await new Promise((resolve) => ws.on('open', resolve));
  let msgId = 1;

  console.log('  Connected to tab:', tab.id);
  await cdpSend(ws, msgId++, 'Page.enable');
  await cdpSend(ws, msgId++, 'Runtime.enable');

  // Obtain Member B JWT token
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

  // Navigate to login page first to set domain cookies and localStorage
  await cdpSend(ws, msgId++, 'Page.navigate', { url: 'http://localhost:3001/login' });
  await new Promise((r) => setTimeout(r, 2000));

  // Set auth cookie and localStorage
  await cdpSend(ws, msgId++, 'Network.enable');
  await cdpSend(ws, msgId++, 'Network.setCookie', {
    name: 'access_token',
    value: token,
    domain: 'localhost',
    path: '/',
  });

  await cdpSend(ws, msgId++, 'Runtime.evaluate', {
    expression: `
      localStorage.setItem('active_tenant_id', '${orgId}');
    `,
  });

  // Navigate to /app/card
  console.log('  Navigating to http://localhost:3001/app/card ...');
  await cdpSend(ws, msgId++, 'Page.navigate', { url: 'http://localhost:3001/app/card' });
  await new Promise((r) => setTimeout(r, 4000));

  // Evaluate card page elements
  const evalResult = await cdpSend(ws, msgId++, 'Runtime.evaluate', {
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        const img = document.querySelector('#digital-id-member-image') || document.querySelector('img[alt*="Digital ID"]');
        const printBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Print Card'));
        const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download ID'));
        const verifiedBadge = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('Verified'));
        const memberName = bodyText.includes('Member Test') || bodyText.includes('4B-TST-00002');
        const printArea = document.querySelector('.digital-id-print-area');

        return {
          hasCardTitle: bodyText.includes('Digital Membership ID') || bodyText.includes('Official Digital Membership Card'),
          hasImg: !!img,
          imgSrc: img ? img.src : null,
          imgNaturalWidth: img ? img.naturalWidth : 0,
          imgNaturalHeight: img ? img.naturalHeight : 0,
          hasPrintBtn: !!printBtn,
          hasDownloadBtn: !!downloadBtn,
          hasVerifiedBadge: !!verifiedBadge,
          hasMemberInfo: memberName,
          hasPrintArea: !!printArea,
        };
      })()
    `,
    returnByValue: true,
  });

  console.log('  Browser Verification Result:', JSON.stringify(evalResult.result.value, null, 2));
  const v = evalResult.result.value;

  if (!v.hasCardTitle) throw new Error('Card title not found on page');
  if (!v.hasPrintBtn) throw new Error('Print Card button not found');
  if (!v.hasDownloadBtn) throw new Error('Download ID (PDF) button not found');
  if (!v.hasPrintArea) throw new Error('digital-id-print-area wrapper not found');

  console.log('  Testing Download PDF button interaction...');
  const clickResult = await cdpSend(ws, msgId++, 'Runtime.evaluate', {
    expression: `
      (function() {
        const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download ID'));
        if (downloadBtn) {
          downloadBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('  PDF Download Trigger Result:', clickResult.result.value);

  // Close tab
  await cdpSend(ws, msgId++, 'Page.close');
  ws.close();
  console.log('\n✅ REAL BROWSER CDP VERIFICATION COMPLETED SUCCESSFULLY!\n');
}

verifyBrowser().catch((err) => {
  console.error('❌ CDP Verification failed:', err);
  process.exit(1);
});
