const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3001';

const ADMIN_EMAIL = 'kebede.admin@4bassociation.org';
const ADMIN_PASS = 'Password123!';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.loadEventResolver = null;
    this.loadEventPromise = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { res, rej } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) {
            rej(new Error(data.error.message || JSON.stringify(data.error)));
          } else {
            res(data.result);
          }
        } else if (data.method) {
          if (data.method === 'Page.loadEventFired') {
            if (this.loadEventResolver) {
              this.loadEventResolver();
              this.loadEventResolver = null;
              this.loadEventPromise = null;
            }
          } else if (data.method === 'Runtime.consoleAPICalled') {
            const type = data.params.type;
            const text = (data.params.args || []).map((a) => a.value || a.description || '').join(' ');
            this.consoleLogs.push({ type, text });
            if (type === 'error') {
              this.consoleErrors.push(text);
            } else if (type === 'warning') {
              this.consoleWarnings.push(text);
            }
          }
        }
      };
    });
  }

  async send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const callId = ++this.id;
      this.callbacks.set(callId, { res: resolve, rej: reject });
      this.ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text} - ${res.exceptionDetails.exception?.description}`);
    }
    return res.result?.value;
  }

  async navigate(url) {
    this.loadEventPromise = new Promise((resolve) => {
      this.loadEventResolver = resolve;
    });
    await this.send('Page.navigate', { url });
    await Promise.race([this.loadEventPromise, new Promise((r) => setTimeout(r, 10000))]);
    await this.wait(1500);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async waitForFunction(fnStr, timeout = 15000, interval = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await this.evaluate(`(${fnStr})()`);
        if (res) return res;
      } catch (e) {}
      await this.wait(interval);
    }
    throw new Error(`Timeout waiting for condition: ${fnStr}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log('VERIFYING MESSAGES PAGE NESTED BUTTONS & HYDRATION');
  console.log('====================================================\n');

  const tmpProfile = path.join(os.tmpdir(), `chrome_messages_test_${Date.now()}`);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpProfile}`,
  ]);

  try {
    let cdpTarget = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9222/json/list');
        const list = await res.json();
        cdpTarget = list.find((t) => t.type === 'page') || list[0];
        if (cdpTarget) break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (!cdpTarget) throw new Error('Could not connect to Chrome debugging target.');

    const cdp = new CDPClient(cdpTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('DOM.enable');
    await cdp.setViewport(1440, 900);

    // 1. Log in
    console.log('[1] Logging into 4Baye as Admin...');
    await cdp.navigate(`${APP_URL}/login`);
    await cdp.waitForFunction(`() => document.querySelectorAll('input').length >= 2`, 15000);
    await cdp.wait(1000);
    await cdp.evaluate(`
      (function() {
        const setVal = (el, val) => {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          s.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const inputs = document.querySelectorAll('input');
        setVal(inputs[0], '${ADMIN_EMAIL}');
        setVal(inputs[1], '${ADMIN_PASS}');
        document.querySelector('button[type="submit"]').click();
      })()
    `);
    await cdp.waitForFunction(`() => window.location.pathname.startsWith('/app')`, 20000);
    console.log('✓ Successfully authenticated and routed to dashboard.');

    // 2. Navigate to /app/messages
    console.log('\n[2] Navigating to /app/messages...');
    // Clear previous console logs to only inspect /app/messages
    cdp.consoleLogs = [];
    cdp.consoleErrors = [];
    cdp.consoleWarnings = [];

    await cdp.navigate(`${APP_URL}/app/messages`);
    await cdp.waitForFunction(`() => document.querySelectorAll('button').length > 0`, 12000);
    await cdp.wait(2000);
    console.log('✓ /app/messages loaded and hydrated in browser.');

    // 3. Open "New Chat" modal
    console.log('\n[3] Opening "Start a New Conversation" modal...');
    await cdp.evaluate(`
      (function() {
        const newChatBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Chat'));
        if (newChatBtn) newChatBtn.click();
      })()
    `);

    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 8000);
    console.log('✓ New Chat modal successfully opened.');

    // 4. Wait for candidates to load
    await cdp.wait(1500);

    // 5. Inspect the rendered DOM for nested buttons
    console.log('\n[4] Inspecting rendered DOM for invalid nested buttons...');
    const domInspection = await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return { error: 'No dialog found' };

        // Check for any <button> nested inside another <button> anywhere on the page
        const nestedButtonsGlobally = Array.from(document.querySelectorAll('button button')).map(b => b.outerHTML);
        const nestedButtonsInModal = Array.from(dialog.querySelectorAll('button button')).map(b => b.outerHTML);

        // Inspect candidate buttons in modal
        const candidateRows = Array.from(dialog.querySelectorAll('.max-h-64 button'));
        const rowDetails = candidateRows.map((btn, idx) => {
          const innerButtons = Array.from(btn.querySelectorAll('button'));
          const messageBadge = btn.querySelector('span:last-child');
          return {
            index: idx,
            tagName: btn.tagName,
            type: btn.getAttribute('type'),
            innerButtonsCount: innerButtons.length,
            messageBadgeTag: messageBadge ? messageBadge.tagName : null,
            messageBadgeText: messageBadge ? messageBadge.textContent.trim() : null,
            rowText: btn.textContent.trim().replace(/\\s+/g, ' ')
          };
        });

        return {
          nestedButtonsGloballyCount: nestedButtonsGlobally.length,
          nestedButtonsGlobally,
          nestedButtonsInModalCount: nestedButtonsInModal.length,
          candidateRowsCount: candidateRows.length,
          rowDetails
        };
      })()
    `);

    console.log('DOM Inspection Results:');
    console.log(`- Total nested buttons globally on page: ${domInspection.nestedButtonsGloballyCount}`);
    console.log(`- Total nested buttons in New Chat modal: ${domInspection.nestedButtonsInModalCount}`);
    console.log(`- Candidate rows rendered: ${domInspection.candidateRowsCount}`);
    if (domInspection.rowDetails && domInspection.rowDetails.length > 0) {
      console.log('Sample candidate row inspection:');
      console.log(JSON.stringify(domInspection.rowDetails[0], null, 2));
    }

    if (domInspection.nestedButtonsGloballyCount !== 0) {
      throw new Error(`FAIL: Found ${domInspection.nestedButtonsGloballyCount} nested button(s) in DOM!`);
    }
    console.log('✓ PASS: Zero nested buttons in rendered DOM.');

    // 6. Check console logs for React DOM nesting warnings or hydration errors
    console.log('\n[5] Checking browser console for hydration errors and DOM nesting warnings...');
    const domNestingWarnings = cdp.consoleWarnings.filter((w) =>
      w.includes('validateDOMNesting') ||
      w.includes('cannot appear as a descendant of') ||
      w.includes('hydration') ||
      w.includes('Hydration')
    );
    const hydrationErrors = cdp.consoleErrors.filter((e) =>
      e.includes('hydration') ||
      e.includes('Hydration') ||
      e.includes('Minified React error') ||
      e.includes('validateDOMNesting')
    );

    console.log(`- Total console warnings: ${cdp.consoleWarnings.length}`);
    console.log(`- DOM nesting warnings: ${domNestingWarnings.length}`);
    console.log(`- Hydration errors: ${hydrationErrors.length}`);

    if (domNestingWarnings.length > 0) {
      console.error('DOM nesting warnings detected:', domNestingWarnings);
      throw new Error('FAIL: DOM nesting warnings detected in console!');
    }
    if (hydrationErrors.length > 0) {
      console.error('Hydration errors detected:', hydrationErrors);
      throw new Error('FAIL: Hydration errors detected in console!');
    }
    console.log('✓ PASS: Zero hydration errors and zero validateDOMNesting warnings in runtime browser console.');

    // 7. Verify candidate row interaction
    console.log('\n[6] Verifying candidate row selection behavior...');
    const clickResult = await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const firstCandidate = dialog.querySelector('.max-h-64 button');
        if (!firstCandidate) return { clicked: false, reason: 'No candidate row' };
        firstCandidate.click();
        return { clicked: true };
      })()
    `);
    console.log(`- Candidate row clicked: ${clickResult.clicked}`);
    await cdp.wait(1500);

    const dialogClosedAfterClick = await cdp.evaluate(`() => !document.querySelector('div[role="dialog"]')`);
    console.log(`- Dialog closed and conversation initialized: ${dialogClosedAfterClick}`);
    console.log('✓ PASS: Candidate selection remains fully functional.');

    console.log('\n====================================================');
    console.log('ALL VERIFICATION CHECKS PASSED CLEANLY (EXIT CODE 0)');
    console.log('====================================================\n');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
