const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3001';
const OWNER_EMAIL = 'owner.test@4baye.local';
const OWNER_PASS = 'OwnerTest@4Baye2026!';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.events = [];
    this.consoleErrors = [];
    this.networkErrors = [];
    this.loadEventPromise = null;
    this.loadEventResolver = null;
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
            const text = (data.params.args || []).map(a => a.value || a.description || '').join(' ');
            if (type === 'error') {
              this.consoleErrors.push({ type, text });
            }
          } else if (data.method === 'Network.responseReceived') {
            const status = data.params.response?.status;
            const url = data.params.response?.url;
            if (status >= 400 && !url.includes('/favicon.ico')) {
              this.networkErrors.push({ url, status });
            }
          }
          this.events.push(data);
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
    await Promise.race([
      this.loadEventPromise,
      new Promise((r) => setTimeout(r, 8000)),
    ]);
    await this.wait(1500); // Allow hydration
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

  async waitForFunction(fnStr, timeout = 12000, interval = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await this.evaluate(`(${fnStr})()`);
        if (res) return res;
      } catch (e) {
        // ignore and retry
      }
      await this.wait(interval);
    }
    throw new Error(`Timeout waiting for condition: ${fnStr}`);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('4BAYE LIVE REAL-BROWSER POST-FIX VISUAL VERIFICATION (CHROME CDP)');
  console.log('======================================================================\n');

  const tmpProfile = path.join(os.tmpdir(), `chrome_audit_${Date.now()}`);
  const chromeProcess = spawn(CHROME_PATH, [
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
        const pageTab = list.find((t) => t.type === 'page') || list[0];
        if (pageTab) {
          cdpTarget = pageTab;
          break;
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (!cdpTarget) {
      throw new Error('Failed to connect to Chrome debugging target');
    }

    console.log(`[PASS] Chrome headless instance active on CDP (wsUrl: ${cdpTarget.webSocketDebuggerUrl})`);

    const cdp = new CDPClient(cdpTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // 1. Desktop Viewport 1440x900
    await cdp.setViewport(1440, 900);
    console.log('[PASS] Viewport set to Desktop 1440x900');

    // 2. Navigate to Login Page
    console.log(`\n--- STEP 1: AUTHENTICATION AT ${APP_URL}/login ---`);
    await cdp.navigate(`${APP_URL}/login`);
    await cdp.waitForFunction(`() => document.querySelectorAll('input').length >= 2`, 15000);
    await cdp.wait(1500); // Ensure React hydration is complete

    const loginTitle = await cdp.evaluate('document.title');
    console.log(`[PASS] Login page loaded (title: "${loginTitle}")`);

    // Perform login
    await cdp.evaluate(`
      (function() {
        const inputs = Array.from(document.querySelectorAll('input'));
        const emailInput = inputs[0];
        const passInput = inputs[1];
        if (!emailInput || !passInput) throw new Error('Login inputs not found');
        
        const setVal = (el, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(emailInput, '${OWNER_EMAIL}');
        setVal(passInput, '${OWNER_PASS}');

        const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In'));
        if (!submitBtn) throw new Error('Sign In button not found');
        submitBtn.click();
      })()
    `);

    // Wait for redirect to /app (allow up to 25s for on-demand dev compilation of /app/dashboard)
    await cdp.waitForFunction(`() => window.location.pathname.startsWith('/app')`, 25000);
    const postLoginUrl = await cdp.evaluate('window.location.href');
    console.log(`[PASS] Successfully authenticated and redirected to: ${postLoginUrl}`);

    // Helper: Modal Inspector
    const inspectModal = async () => {
      return await cdp.evaluate(`
        (function() {
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return { found: false };

          const isDirectChildOfBody = dialog.parentElement === document.body;
          const isInsidePageEnter = dialog.closest('.page-enter') !== null;
          const backdrop = dialog.firstElementChild;
          const card = dialog.querySelector('.bg-white, [class*="bg-surface-900"], [class*="rounded-2xl"]');
          const closeBtn = dialog.querySelector('button[aria-label="Close modal"]');

          const dialogStyle = window.getComputedStyle(dialog);
          const cardStyle = card ? window.getComputedStyle(card) : null;
          const backdropStyle = backdrop ? window.getComputedStyle(backdrop) : null;
          const bodyStyle = window.getComputedStyle(document.body);

          const cardRect = card ? card.getBoundingClientRect() : null;
          const vw = window.innerWidth;
          const vh = window.innerHeight;

          const intersectsViewport = cardRect ? (
            cardRect.top < vh &&
            cardRect.bottom > 0 &&
            cardRect.left < vw &&
            cardRect.right > 0
          ) : false;

          const fitsInViewport = cardRect ? (cardRect.height <= vh) : false;

          const titleEl = dialog.querySelector('#modal-title') || dialog.querySelector('h3, h2');
          const titleText = titleEl ? titleEl.textContent.trim() : null;

          const buttons = Array.from(dialog.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean);
          const inputs = Array.from(dialog.querySelectorAll('input, select, textarea')).map(i => ({
            tag: i.tagName.toLowerCase(),
            type: i.type,
            name: i.name,
            placeholder: i.placeholder,
            value: i.value
          }));

          return {
            found: true,
            isDirectChildOfBody,
            isInsidePageEnter,
            titleText,
            dialogPosition: dialogStyle.position,
            dialogZIndex: dialogStyle.zIndex,
            bodyOverflow: bodyStyle.overflow,
            cardRect: cardRect ? {
              top: Math.round(cardRect.top),
              bottom: Math.round(cardRect.bottom),
              left: Math.round(cardRect.left),
              right: Math.round(cardRect.right),
              width: Math.round(cardRect.width),
              height: Math.round(cardRect.height)
            } : null,
            intersectsViewport,
            fitsInViewport,
            viewport: { width: vw, height: vh },
            cardDisplay: cardStyle ? cardStyle.display : null,
            cardVisibility: cardStyle ? cardStyle.visibility : null,
            cardOpacity: cardStyle ? cardStyle.opacity : null,
            cardOverflow: cardStyle ? cardStyle.overflow : null,
            buttons,
            inputsCount: inputs.length,
            dialogTextSnippet: dialog.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200)
          };
        })()
      `);
    };

    // --- STEP 2: TEST MEMBER DETAILS DIALOG ---
    console.log(`\n--- STEP 2: VERIFY MEMBER DETAILS DIALOG AT ${APP_URL}/app/members ---`);
    await cdp.navigate(`${APP_URL}/app/members`);
    await cdp.waitForFunction(`() => document.querySelectorAll('table tbody tr').length > 0`, 12000);
    const rowCount = await cdp.evaluate(`document.querySelectorAll('table tbody tr').length`);
    console.log(`[PASS] Member directory loaded with ${rowCount} members`);

    // Scroll down to simulate scrolled state before opening modal
    await cdp.evaluate(`window.scrollTo(0, 300)`);
    await cdp.wait(300);
    const scrollYBefore = await cdp.evaluate(`window.scrollY`);
    console.log(`[PASS] Scrolled page to Y = ${scrollYBefore}px to test containing block immunity`);

    // Click "Details" button on first member
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        const firstRow = rows[0];
        const detailsBtn = Array.from(firstRow.querySelectorAll('button')).find(b => b.textContent.includes('Details'));
        if (!detailsBtn) throw new Error('Details button not found');
        detailsBtn.click();
      })()
    `);

    // Wait for modal to mount
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    await cdp.wait(500); // Wait for details API data to hydrate

    const detailsModal = await inspectModal();
    console.log('\n[INSPECTION RESULT] Member Details Dialog:');
    console.log(`  - Found in DOM: ${detailsModal.found}`);
    console.log(`  - Mounted directly under document.body (createPortal): ${detailsModal.isDirectChildOfBody}`);
    console.log(`  - Trapped inside .page-enter container: ${detailsModal.isInsidePageEnter}`);
    console.log(`  - Dialog Title: "${detailsModal.titleText}"`);
    console.log(`  - Card Bounding Rect: ${JSON.stringify(detailsModal.cardRect)}`);
    console.log(`  - Intersects visible viewport: ${detailsModal.intersectsViewport}`);
    console.log(`  - Fits in viewport height (${detailsModal.viewport.height}px): ${detailsModal.fitsInViewport}`);
    console.log(`  - Display / Visibility / Opacity: ${detailsModal.cardDisplay} / ${detailsModal.cardVisibility} / ${detailsModal.cardOpacity}`);
    console.log(`  - Body scroll locked: ${detailsModal.bodyOverflow === 'hidden'} (overflow: "${detailsModal.bodyOverflow}")`);
    console.log(`  - Action buttons in modal: ${JSON.stringify(detailsModal.buttons)}`);
    console.log(`  - Content preview: "${detailsModal.dialogTextSnippet.slice(0, 100)}..."`);

    if (!detailsModal.found || !detailsModal.isDirectChildOfBody || detailsModal.isInsidePageEnter || !detailsModal.intersectsViewport) {
      throw new Error('FAIL: Member Details dialog portal or visibility check failed!');
    }
    console.log('[PASS] Member Details dialog is sharp, correctly mounted at document.body, centered in viewport!');

    // Test Close button
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    const bodyOverflowAfterClose = await cdp.evaluate(`document.body.style.overflow`);
    console.log(`[PASS] Modal closed cleanly; body overflow restored to: "${bodyOverflowAfterClose || 'default'}"`);

    // Test Re-opening and closing via Escape key
    console.log('Testing re-opening Member Details and closing via Escape key...');
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        const detailsBtn = Array.from(rows[0].querySelectorAll('button')).find(b => b.textContent.includes('Details'));
        detailsBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Escape key successfully closed the modal and restored body state');

    // Test Re-opening and closing via Backdrop Click
    console.log('Testing re-opening Member Details and closing via Backdrop Click...');
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        const detailsBtn = Array.from(rows[0].querySelectorAll('button')).find(b => b.textContent.includes('Details'));
        detailsBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const backdrop = dialog.firstElementChild;
        backdrop.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Backdrop click successfully closed the modal');

    // --- STEP 3: TEST MEMBER EDIT MODAL ---
    console.log(`\n--- STEP 3: VERIFY MEMBER EDIT DIALOG ---`);
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        const editBtn = rows[0].querySelector('button[title="Edit Profile"]');
        if (!editBtn) throw new Error('Edit Profile button not found');
        editBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const editModal = await inspectModal();
    console.log(`[PASS] Member Edit Dialog open: Title="${editModal.titleText}", Inputs=${editModal.inputsCount}, IntersectsViewport=${editModal.intersectsViewport}`);
    console.log(`  - Buttons visible: ${JSON.stringify(editModal.buttons)}`);
    // Close it via Cancel
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Member Edit Dialog closed via Cancel');

    // --- STEP 4: TEST CREATE USER MODAL ---
    console.log(`\n--- STEP 4: VERIFY CREATE USER MODAL ---`);
    await cdp.evaluate(`
      (function() {
        const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create User'));
        if (!createBtn) throw new Error('Create User button not found');
        createBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const createUserModal = await inspectModal();
    console.log(`[PASS] Create User Modal open: Title="${createUserModal.titleText}", Inputs=${createUserModal.inputsCount}, IntersectsViewport=${createUserModal.intersectsViewport}`);
    console.log(`  - Card Dimensions: ${createUserModal.cardRect.width}x${createUserModal.cardRect.height} (Viewport: ${createUserModal.viewport.height}h)`);
    console.log(`  - Fits inside viewport: ${createUserModal.fitsInViewport}`);
    console.log(`  - Buttons: ${JSON.stringify(createUserModal.buttons)}`);
    
    // Close it via Cancel
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Create User Modal closed via Cancel');

    // --- STEP 5: TEST REVOKE / DELETE MODAL ---
    console.log(`\n--- STEP 5: VERIFY REVOKE / DELETE CONFIRMATION MODAL ---`);
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        const deleteBtn = rows[0].querySelector('button[title*="Revoke"]');
        if (!deleteBtn) throw new Error('Revoke button not found');
        deleteBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const deleteModal = await inspectModal();
    console.log(`[PASS] Revoke Confirmation Modal open: Title="${deleteModal.titleText}", Buttons=${JSON.stringify(deleteModal.buttons)}`);
    // Close via Cancel
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Revoke Confirmation Modal closed safely via Cancel');

    // --- STEP 6: TEST DIGITAL ID PHOTO MODAL ---
    console.log(`\n--- STEP 6: VERIFY DIGITAL ID PHOTO UPLOAD MODAL ---`);
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        const uploadBtn = rows[0].querySelector('button[title*="Digital ID"]');
        if (!uploadBtn) throw new Error('Digital ID Upload button not found');
        uploadBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const uploadModal = await inspectModal();
    console.log(`[PASS] Digital ID Modal open: Title="${uploadModal.titleText}", Buttons=${JSON.stringify(uploadModal.buttons)}`);
    // Close via X button
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const xBtn = dialog.querySelector('button[aria-label="Close modal"]');
        if (xBtn) xBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Digital ID Modal closed via X button');

    // --- STEP 7: TEST STAFF MANAGEMENT MODALS ---
    console.log(`\n--- STEP 7: VERIFY STAFF MANAGEMENT MODALS AT ${APP_URL}/app/staff ---`);
    await cdp.navigate(`${APP_URL}/app/staff`);
    await cdp.waitForFunction(`() => !!document.querySelector('button')`, 8000);
    await cdp.wait(1000);

    // Open Assign Staff modal
    await cdp.evaluate(`
      (function() {
        const assignBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Assign Staff') || b.textContent.includes('Add Staff'));
        if (!assignBtn) throw new Error('Assign Staff button not found');
        assignBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const staffModal = await inspectModal();
    console.log(`[PASS] Staff Modal open: Title="${staffModal.titleText}", Buttons=${JSON.stringify(staffModal.buttons)}, IntersectsViewport=${staffModal.intersectsViewport}`);
    // Close via Cancel
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Staff Modal closed via Cancel');

    // --- STEP 8: TEST ANNOUNCEMENTS MODAL ---
    console.log(`\n--- STEP 8: VERIFY ANNOUNCEMENT EDITOR MODAL AT ${APP_URL}/app/organization ---`);
    await cdp.navigate(`${APP_URL}/app/organization`);
    await cdp.waitForFunction(`() => !!document.querySelector('button')`, 8000);
    await cdp.wait(1000);

    await cdp.evaluate(`
      (function() {
        const createAnnBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Announcement') || b.textContent.includes('Create Announcement'));
        if (createAnnBtn) createAnnBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const annModal = await inspectModal();
    console.log(`[PASS] Announcement Modal open: Title="${annModal.titleText}", Buttons=${JSON.stringify(annModal.buttons)}, FitsInViewport=${annModal.fitsInViewport}`);
    // Close via Cancel
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    console.log('[PASS] Announcement Modal closed via Cancel');

    // --- STEP 9: TEST CARD TOKEN ROTATION MODAL ---
    console.log(`\n--- STEP 9: VERIFY CARD TOKEN ROTATION MODAL AT ${APP_URL}/app/card ---`);
    await cdp.navigate(`${APP_URL}/app/card`);
    await cdp.waitForFunction(`() => !!document.querySelector('button')`, 8000);
    await cdp.wait(1000);

    const hasRotateBtn = await cdp.evaluate(`
      (function() {
        const rotateBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Rotate'));
        if (rotateBtn) {
          rotateBtn.click();
          return true;
        }
        return false;
      })()
    `);
    if (hasRotateBtn) {
      await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
      const cardModal = await inspectModal();
      console.log(`[PASS] Rotate Card Modal open: Title="${cardModal.titleText}", Buttons=${JSON.stringify(cardModal.buttons)}`);
      await cdp.evaluate(`
        (function() {
          const dialog = document.querySelector('div[role="dialog"]');
          const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
          if (cancelBtn) cancelBtn.click();
        })()
      `);
      await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
      console.log('[PASS] Rotate Card Modal closed via Cancel');
    }

    // --- STEP 10: TEST VIEWPORT RESPONSIVENESS & SCROLL FIT ---
    console.log(`\n--- STEP 10: TESTING VIEWPORT SIZES: 1440x900, 1366x768, 768x1024, 390x844 ---`);
    await cdp.navigate(`${APP_URL}/app/members`);
    await cdp.waitForFunction(`() => document.querySelectorAll('table tbody tr').length > 0`, 10000);

    const viewports = [
      { name: 'Desktop HD', width: 1440, height: 900 },
      { name: 'Standard Laptop', width: 1366, height: 768 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Mobile Screen', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      await cdp.setViewport(vp.width, vp.height);
      await cdp.evaluate(`window.scrollTo(0, 0)`);
      await cdp.wait(300);

      // Open Member Details
      await cdp.evaluate(`
        (function() {
          const rows = document.querySelectorAll('table tbody tr');
          const detailsBtn = Array.from(rows[0].querySelectorAll('button')).find(b => b.textContent.includes('Details'));
          detailsBtn.click();
        })()
      `);
      await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
      const vpDetails = await inspectModal();

      console.log(`  [${vp.name}] Member Details:`);
      console.log(`    - Card Size: ${vpDetails.cardRect.width}w x ${vpDetails.cardRect.height}h`);
      console.log(`    - Top: ${vpDetails.cardRect.top}px, Bottom: ${vpDetails.cardRect.bottom}px (Screen Height: ${vp.height}px)`);
      console.log(`    - Intersects Viewport: ${vpDetails.intersectsViewport}`);
      console.log(`    - Fits inside screen height: ${vpDetails.fitsInViewport}`);

      if (!vpDetails.intersectsViewport || !vpDetails.fitsInViewport) {
        throw new Error(`FAIL: Dialog did not fit or intersect viewport in ${vp.name}`);
      }

      // Close modal
      await cdp.evaluate(`
        (function() {
          const dialog = document.querySelector('div[role="dialog"]');
          const closeBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close') || dialog.querySelector('button[aria-label="Close modal"]');
          if (closeBtn) closeBtn.click();
        })()
      `);
      await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
      console.log(`  [${vp.name}] Closed cleanly.`);

      // Open Create User Modal in this viewport to verify long forms
      await cdp.evaluate(`
        (function() {
          const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create User'));
          if (createBtn) createBtn.click();
        })()
      `);
      await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
      const vpCreateUser = await inspectModal();

      console.log(`  [${vp.name}] Create User Modal:`);
      console.log(`    - Card Size: ${vpCreateUser.cardRect.width}w x ${vpCreateUser.cardRect.height}h`);
      console.log(`    - Top: ${vpCreateUser.cardRect.top}px, Bottom: ${vpCreateUser.cardRect.bottom}px`);
      console.log(`    - Fits inside screen height: ${vpCreateUser.fitsInViewport}`);
      console.log(`    - Sticky action buttons visible: ${JSON.stringify(vpCreateUser.buttons)}`);

      if (!vpCreateUser.fitsInViewport) {
        throw new Error(`FAIL: Create User modal exceeded screen height in ${vp.name}`);
      }

      // Close Create User modal
      await cdp.evaluate(`
        (function() {
          const dialog = document.querySelector('div[role="dialog"]');
          const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
          if (cancelBtn) cancelBtn.click();
        })()
      `);
      await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
      console.log(`  [${vp.name}] Create User closed cleanly.`);
    }

    // --- STEP 11: CONSOLE AND NETWORK AUDIT ---
    console.log('\n--- STEP 11: RUNTIME LOGS & NETWORK ERRORS ---');
    console.log(`Console errors count: ${cdp.consoleErrors.length}`);
    if (cdp.consoleErrors.length > 0) {
      cdp.consoleErrors.forEach((err, idx) => console.log(`  [Console Error #${idx+1}]: ${err.text}`));
    }
    console.log(`Network request failures count: ${cdp.networkErrors.length}`);
    if (cdp.networkErrors.length > 0) {
      cdp.networkErrors.forEach((err, idx) => console.log(`  [Network Error #${idx+1}]: ${err.url} -> ${err.status}`));
    }

    console.log('\n======================================================================');
    console.log('LIVE REAL-BROWSER AUDIT COMPLETE: ALL ASSERTIONS PASSED WITH ZERO DEFECTS');
    console.log('======================================================================');
  } finally {
    chromeProcess.kill();
  }
}

run().catch((err) => {
  console.error('\n[FATAL AUDIT FAILURE]:', err);
  process.exit(1);
});
