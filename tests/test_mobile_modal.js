const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3001';
const OWNER_EMAIL = 'owner.test@4baye.local';
const OWNER_PASS = 'OwnerTest@4Baye2026!';

const tmpProfile = path.join(os.tmpdir(), `chrome_audit_mob_${Date.now()}`);
const chromeProcess = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  '--no-sandbox',
  `--user-data-dir=${tmpProfile}`,
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 0;
    const send = (method, params = {}) => {
      return new Promise((resolve) => {
        const msgId = ++id;
        const handler = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r?.result?.value;
    };

    ws.onopen = async () => {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Network.enable');

      // Set mobile viewport 390x844
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

      // Navigate to login
      await send('Page.navigate', { url: `${APP_URL}/login` });
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.method === 'Page.loadEventFired') {
        const url = await evaluate('window.location.href');
        if (url.includes('/login')) {
          console.log('Login page loaded on mobile.');
          setTimeout(async () => {
            await evaluate(`(() => {
              const inputs = document.querySelectorAll('input');
              const setVal = (el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              };
              setVal(inputs[0], '${OWNER_EMAIL}');
              setVal(inputs[1], '${OWNER_PASS}');
              document.querySelector('button[type="submit"]').click();
            })()`);
          }, 1000);
        } else if (url.includes('/app/dashboard')) {
          console.log('Logged in on mobile! Navigating to /app/members...');
          await send('Page.navigate', { url: `${APP_URL}/app/members` });
        } else if (url.includes('/app/members')) {
          console.log('Members page loaded on mobile! Clicking Details...');
          setTimeout(async () => {
            const result = await evaluate(`(() => {
              const rows = document.querySelectorAll('table tbody tr');
              if (rows.length === 0) return { error: 'No rows' };
              const detailsBtn = Array.from(rows[0].querySelectorAll('button')).find(b => b.textContent.includes('Details'));
              detailsBtn.click();
              
              const dialog = document.querySelector('div[role="dialog"]');
              const card = dialog.querySelector('.bg-white, [class*="bg-surface-900"]');
              const dRect = dialog.getBoundingClientRect();
              const cRect = card.getBoundingClientRect();

              return {
                windowInner: { w: window.innerWidth, h: window.innerHeight },
                scroll: { x: window.scrollX, y: window.scrollY },
                dialogRect: { top: dRect.top, bottom: dRect.bottom, width: dRect.width, height: dRect.height },
                cardRect: { top: cRect.top, bottom: cRect.bottom, width: cRect.width, height: cRect.height },
                cardComputedWidth: getComputedStyle(card).width,
                cardComputedMaxWidth: getComputedStyle(card).maxWidth,
                dialogComputedPosition: getComputedStyle(dialog).position,
                dialogParent: dialog.parentElement.tagName
              };
            })()`);
            console.log('Mobile Modal Inspection Result:', result);
            chromeProcess.kill();
            process.exit(0);
          }, 3000);
        }
      }
    };
  } catch (e) {
    console.error(e);
    chromeProcess.kill();
    process.exit(1);
  }
}, 1500);
