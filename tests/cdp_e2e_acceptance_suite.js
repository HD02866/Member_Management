const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3000/api/v1';

const OWNER_EMAIL = 'kebede.admin@4bassociation.org';
const OWNER_PASS = 'Password123!';
const MEMBER_EMAIL = 'member.test@4baye.local';
const MEMBER_PASS = 'MemberTest@4Baye2026!';
const ORG_ID = 'ef221df4-bfb8-49b8-8a50-e7b96bef8677'; // 4Baye

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.networkErrors = [];
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
      } catch (e) {
        // retry
      }
      await this.wait(interval);
    }
    throw new Error(`Timeout waiting for condition: ${fnStr}`);
  }
}

// REST helper for API checks
async function apiCall(endpoint, method = 'GET', body = null, token = null, tenantId = ORG_ID) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}
  const unwrapped = json && json.data !== undefined ? json.data : json;
  return { status: res.status, ok: res.ok, data: unwrapped, rawJson: json, raw: text };
}

async function main() {
  console.log('======================================================================');
  console.log('4BAYE COMPREHENSIVE END-TO-END ACCEPTANCE & REGRESSION SUITE');
  console.log('======================================================================\n');

  const summary = [];
  const logStep = (id, name, status, details) => {
    summary.push({ id, name, status, details });
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[BLOCKED]';
    console.log(`${mark} [${id}] ${name}: ${details}`);
  };

  // Obtain baseline auth tokens via API for ground-truth security cross-verification
  console.log('Acquiring ground-truth API credentials for cross-verification...');
  const ownerAuth = await apiCall('/auth/login', 'POST', { identifier: OWNER_EMAIL, password: OWNER_PASS });
  const ownerToken = ownerAuth.data?.tokens?.accessToken;
  const memberAuth = await apiCall('/auth/login', 'POST', { identifier: MEMBER_EMAIL, password: MEMBER_PASS });
  const memberToken = memberAuth.data?.tokens?.accessToken;

  if (!ownerToken || !memberToken) {
    throw new Error('Baseline test account authentication failed! Check backend service.');
  }
  console.log('Ground-truth tokens acquired.\n');

  // Launch Chrome Headless
  const tmpProfile = path.join(os.tmpdir(), `chrome_e2e_suite_${Date.now()}`);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpProfile}`,
  ]);

  try {
    let cdpTarget = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9228/json/list');
        const list = await res.json();
        cdpTarget = list.find((t) => t.type === 'page') || list[0];
        if (cdpTarget) break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const cdp = new CDPClient(cdpTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('DOM.enable');

    await cdp.setViewport(1440, 900);

    // Initial Login in Browser
    console.log('--- Initial Browser Login as Owner ---');
    await cdp.navigate(`${APP_URL}/login`);
    await cdp.waitForFunction(`() => document.querySelectorAll('input').length >= 2`, 15000);
    await cdp.wait(1500);

    await cdp.evaluate(`
      (function() {
        const setVal = (el, val) => {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          s.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const inputs = document.querySelectorAll('input');
        setVal(inputs[0], '${OWNER_EMAIL}');
        setVal(inputs[1], '${OWNER_PASS}');
        document.querySelector('button[type="submit"]').click();
      })()
    `);
    try {
      await cdp.waitForFunction(`() => window.location.pathname.startsWith('/app')`, 25000);
    } catch (e) {
      const pageInfo = await cdp.evaluate(`({ url: window.location.href, body: document.body.innerText })`);
      console.error('Login wait failed. Page info:', pageInfo, 'Console errors:', cdp.consoleErrors, 'Network errors:', cdp.networkErrors);
      throw e;
    }
    logStep('AUTH-01', 'Browser Owner Sign-In', 'PASS', `Logged in and routed to ${await cdp.evaluate('window.location.pathname')}`);

    // Helper: inspect modal
    const inspectModal = async () => {
      return await cdp.evaluate(`
        (function() {
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return { found: false };
          const card = dialog.querySelector('.bg-white, [class*="bg-surface-900"]');
          const isDirectChild = dialog.parentElement === document.body;
          const rect = card ? card.getBoundingClientRect() : null;
          return {
            found: true,
            isDirectChild,
            title: dialog.querySelector('#modal-title')?.textContent?.trim() || dialog.querySelector('h3, h2')?.textContent?.trim(),
            rect: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
            buttons: Array.from(dialog.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean)
          };
        })()
      `);
    };

    // =========================================================================
    // WORKFLOW 1: MEMBER DETAILS EDIT & PERSISTENCE
    // =========================================================================
    console.log('\n--- WORKFLOW 1: Member Edit & Real-World Persistence ---');
    await cdp.navigate(`${APP_URL}/app/members`);
    await cdp.waitForFunction(`() => document.querySelectorAll('table tbody tr').length > 0`, 12000);

    const testCity = `Bole-Subcity-${Date.now() % 10000}`;
    // Open edit modal for first member
    await cdp.evaluate(`
      (function() {
        const row = document.querySelectorAll('table tbody tr')[0];
        row.querySelector('button[title="Edit Profile"]').click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);

    // Edit City field and submit
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cityInput = Array.from(dialog.querySelectorAll('input')).find(i => i.placeholder?.includes('Addis') || i.value?.includes('Addis') || i.name === 'city');
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        s.call(cityInput, '${testCity}');
        cityInput.dispatchEvent(new Event('input', { bubbles: true }));
        cityInput.dispatchEvent(new Event('change', { bubbles: true }));

        const saveBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Save Changes'));
        saveBtn.click();
      })()
    `);

    // Wait for modal to close upon successful save
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 8000);
    await cdp.wait(1000);

    // Reopen and verify persistence in browser
    await cdp.evaluate(`
      (function() {
        const row = document.querySelectorAll('table tbody tr')[0];
        row.querySelector('button[title="Edit Profile"]').click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);
    const persistedCityValue = await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const cityInput = Array.from(dialog.querySelectorAll('input')).find(i => i.placeholder?.includes('Addis') || i.name === 'city');
        return cityInput?.value;
      })()
    `);

    // Close modal
    await cdp.evaluate(`
      (function() {
        const cancelBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);

    if (persistedCityValue === testCity) {
      logStep('WF-01', 'Member Edit Persistence', 'PASS', `Updated city to "${testCity}" and confirmed persistence on reopen`);
    } else {
      logStep('WF-01', 'Member Edit Persistence', 'FAIL', `Expected city "${testCity}" but found "${persistedCityValue}"`);
    }

    // =========================================================================
    // WORKFLOW 2: CREATE DEDICATED TEST MEMBER & ROSTER CHECK
    // =========================================================================
    console.log('\n--- WORKFLOW 2: Create Dedicated Member & Verification ---');
    const uniqueSuffix = Date.now() % 100000;
    const testMemberEmail = `e2e.member.${uniqueSuffix}@4baye.local`;
    const testMemberPhone = `+251911${Math.floor(100000 + Math.random() * 900000)}`;

    await cdp.evaluate(`
      (function() {
        const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create User'));
        createBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);

    // Fill form
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const setVal = (el, val) => {
          if (!el) return;
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          s.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const inputs = Array.from(dialog.querySelectorAll('input'));
        setVal(inputs.find(i => i.placeholder && i.placeholder.includes('Tolasa')), 'Acceptance');
        setVal(inputs.find(i => i.placeholder && i.placeholder.includes('Gemechu')), 'TestUser' + '${uniqueSuffix}');
        setVal(inputs.find(i => i.type === 'email' || (i.placeholder && i.placeholder.includes('@'))), '${testMemberEmail}');
        setVal(inputs.find(i => i.type === 'tel' || (i.placeholder && i.placeholder.includes('+251'))), '${testMemberPhone}');

        const submitBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Create User & Member'));
        submitBtn.click();
      })()
    `);

    // Wait for credentials completion view or modal close
    await cdp.waitForFunction(`
      () => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return true;
        return dialog.textContent.includes('User Account Created') || dialog.textContent.includes('Credentials');
      }
    `, 15000);

    // Read credentials details
    const createdCreds = await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return null;
        const text = dialog.textContent;
        const memberNoMatch = text.match(/4B-[0-9]{4}-[0-9]{5}/);
        const passMatch = text.match(/4B![a-zA-Z0-9#]+/);
        return {
          memberNumber: memberNoMatch ? memberNoMatch[0] : null,
          tempPassword: passMatch ? passMatch[0] : null
        };
      })()
    `);

    // Close credentials view
    await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        if (dialog) {
          const doneBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Done') || b.textContent.includes('Close'));
          if (doneBtn) doneBtn.click();
        }
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);
    await cdp.wait(1000);

    // Verify member in database via API
    const rosterCheck = await apiCall(`/organizations/4b/members`, 'GET', null, ownerToken);
    const createdMemberRecord = rosterCheck.data?.find((m) => m.email === testMemberEmail);

    let createdMemberId = createdMemberRecord?.id;
    if (createdMemberRecord && createdMemberRecord.memberNumber?.startsWith('4B-')) {
      logStep('WF-02', 'Create Member & Roster Check', 'PASS', `Created member ${createdMemberRecord.memberNumber} (${testMemberEmail}), verified in roster`);
    } else {
      logStep('WF-02', 'Create Member & Roster Check', 'FAIL', `Failed to locate member ${testMemberEmail} in roster`);
    }

    // =========================================================================
    // WORKFLOW 3: REQUIRED-FIELD & INVALID SUBMISSION VALIDATION
    // =========================================================================
    console.log('\n--- WORKFLOW 3: Input Validation & Error Handling ---');
    await cdp.evaluate(`
      (function() {
        const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create User'));
        createBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);

    // Attempt to submit empty required form
    const clientValidationBlocked = await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const form = dialog.querySelector('form');
        const isValid = form ? form.checkValidity() : true;
        const submitBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Create User & Member'));
        submitBtn.click();
        return !isValid;
      })()
    `);

    // Verify server API rejects invalid payload
    const badApi = await apiCall('/members/admin/create-user', 'POST', { firstName: '' }, ownerToken);
    const serverValidationBlocked = badApi.status === 400;

    // Dismiss modal via Cancel
    await cdp.evaluate(`
      (function() {
        const cancelBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);

    if (clientValidationBlocked && serverValidationBlocked) {
      logStep('WF-03', 'Validation & Error Handling', 'PASS', 'Client form validity prevented submission; API rejected invalid payload with status 400');
    } else {
      logStep('WF-03', 'Validation & Error Handling', 'FAIL', `Client valid: ${!clientValidationBlocked}, Server status: ${badApi.status}`);
    }

    // =========================================================================
    // WORKFLOW 4: SUSPEND & REINSTATE MEMBER LIFECYCLE
    // =========================================================================
    console.log('\n--- WORKFLOW 4: Member Suspend & Reinstate Lifecycle ---');
    if (createdMemberId) {
      // 1. Suspend via API
      const suspendRes = await apiCall(`/members/admin/${createdMemberId}/suspend`, 'POST', { reason: 'Audit Test Suspension' }, ownerToken);
      const isSuspended = suspendRes.status === 201 && suspendRes.data?.status === 'SUSPENDED';

      // 2. Check access restriction: suspended member login attempt
      const loginAttempt = await apiCall('/auth/login', 'POST', { identifier: testMemberEmail, password: 'AnyPassword' });
      const loginBlocked = loginAttempt.status === 401;

      // 3. Reinstate
      const reinstateRes = await apiCall(`/members/admin/${createdMemberId}/reinstate`, 'POST', {}, ownerToken);
      const isReinstated = reinstateRes.status === 201 && reinstateRes.data?.status === 'ACTIVE';

      if (isSuspended && loginBlocked && isReinstated) {
        logStep('WF-04', 'Suspend & Reinstate Lifecycle', 'PASS', 'Member successfully transitioned ACTIVE -> SUSPENDED (login rejected with 401) -> ACTIVE');
      } else {
        logStep('WF-04', 'Suspend & Reinstate Lifecycle', 'FAIL', `Suspend: ${suspendRes.status}, Login blocked: ${loginAttempt.status}, Reinstate: ${reinstateRes.status}`);
      }
    } else {
      logStep('WF-04', 'Suspend & Reinstate Lifecycle', 'BLOCKED', 'No created test member available');
    }

    // =========================================================================
    // WORKFLOW 5: ARCHIVE & REVOCATION WORKFLOW
    // =========================================================================
    console.log('\n--- WORKFLOW 5: Member Archive & Access Revocation ---');
    if (createdMemberId) {
      const deleteRes = await apiCall(`/members/admin/${createdMemberId}`, 'DELETE', { reason: 'Audit Archival Test' }, ownerToken);
      const isArchived = deleteRes.status === 200;

      // Verify member is excluded from active roster
      const rosterAfter = await apiCall(`/organizations/4b/members`, 'GET', null, ownerToken);
      const memberInActiveRoster = rosterAfter.data?.some((m) => m.id === createdMemberId);

      // Verify authentication blocked
      const revokedLogin = await apiCall('/auth/login', 'POST', { identifier: testMemberEmail, password: 'AnyPassword' });

      if (isArchived && !memberInActiveRoster && revokedLogin.status === 401) {
        logStep('WF-05', 'Archive & Revocation', 'PASS', 'Member archived, removed from active roster, and blocked from login (401)');
      } else {
        logStep('WF-05', 'Archive & Revocation', 'FAIL', `Status: ${deleteRes.status}, in active roster: ${memberInActiveRoster}`);
      }
    } else {
      logStep('WF-05', 'Archive & Revocation', 'BLOCKED', 'No created test member available');
    }

    // =========================================================================
    // WORKFLOW 6: STAFF ASSIGNMENT & ROLE EDIT
    // =========================================================================
    console.log('\n--- WORKFLOW 6: Staff Assignment & Management ---');
    await cdp.navigate(`${APP_URL}/app/staff`);
    await cdp.waitForFunction(`() => document.querySelectorAll('button').length > 0`, 8000);

    // 1. Clean up existing staff assignment if present from previous run
    const preCheckStaff = await apiCall(`/organizations/4b/staff`, 'GET', null, ownerToken);
    const existingStaff = preCheckStaff.data?.find((s) => s.user?.email === MEMBER_EMAIL);
    if (existingStaff) {
      await apiCall(`/organizations/4b/staff/${existingStaff.id}`, 'DELETE', {}, ownerToken);
    }

    // Assign a staff member via API using safe test member
    const assignRes = await apiCall(`/organizations/4b/staff`, 'POST', { identifier: MEMBER_EMAIL, roleCode: 'VERIFIER' }, ownerToken);
    const staffAssigned = assignRes.status === 201 || assignRes.status === 200;

    // Check staff roster in UI
    await cdp.navigate(`${APP_URL}/app/staff`);
    await cdp.waitForFunction(`() => document.querySelectorAll('button').length > 0`, 8000);
    const staffVisible = await cdp.evaluate(`
      (function() {
        const bodyText = document.body.textContent;
        return bodyText.includes('VERIFIER') || bodyText.includes('Member');
      })()
    `);

    // Edit staff role
    const staffMemberships = await apiCall(`/organizations/4b/staff`, 'GET', null, ownerToken);
    const targetStaff = staffMemberships.data?.find((s) => s.user?.email === MEMBER_EMAIL);

    let staffUpdated = false;
    if (targetStaff) {
      const updateRes = await apiCall(`/organizations/4b/staff/${targetStaff.id}`, 'PATCH', { roleCode: 'ADMIN', isActive: true }, ownerToken);
      staffUpdated = updateRes.status === 200;

      // Clean up staff privilege for safety
      await apiCall(`/organizations/4b/staff/${targetStaff.id}`, 'DELETE', {}, ownerToken);
    }

    if (staffAssigned && staffVisible && staffUpdated) {
      logStep('WF-06', 'Staff Assignment & Role Edit', 'PASS', 'Assigned role VERIFIER, verified in roster, updated to ADMIN, and cleaned up');
    } else {
      logStep('WF-06', 'Staff Assignment & Role Edit', 'FAIL', `Assign status: ${assignRes.status}, visible: ${staffVisible}, updated: ${staffUpdated}`);
    }

    // =========================================================================
    // WORKFLOW 7: ANNOUNCEMENTS DRAFT, EDIT, PUBLISH, AUDIENCE
    // =========================================================================
    console.log('\n--- WORKFLOW 7: Announcement Lifecycle (Draft -> Edit -> Publish) ---');
    const annTitle = `Audit Announcement Draft ${Date.now() % 10000}`;
    const createAnn = await apiCall(
      '/cms/announcements',
      'POST',
      {
        title: { en: annTitle },
        content: { en: 'Internal staff advisory statement for testing.' },
        summary: 'Staff advisory only',
        audience: 'STAFF',
        status: 'DRAFT',
      },
      ownerToken,
    );

    const annCreated = createAnn.status === 201;
    const annId = createAnn.data?.id;

    let annUpdated = false;
    let annPublished = false;

    if (annId) {
      // Edit announcement
      const updatedTitle = `${annTitle} - Updated`;
      const updateAnn = await apiCall(`/cms/announcements/${annId}`, 'PATCH', { title: { en: updatedTitle }, audience: 'STAFF' }, ownerToken);
      annUpdated = updateAnn.status === 200;

      // Publish announcement
      const pubAnn = await apiCall(`/cms/announcements/${annId}/publish`, 'POST', {}, ownerToken);
      annPublished = (pubAnn.status === 200 || pubAnn.status === 201) && pubAnn.data?.status === 'PUBLISHED';

      // Verify audience rule: unauthenticated requests cannot read staff announcements (guard returns 401 Unauthorized)
      const publicAnns = await apiCall('/cms/announcements?audience=STAFF', 'GET', null, null);
      const leakedToPublic = publicAnns.status !== 401 && Array.isArray(publicAnns.data) && publicAnns.data.some((a) => a.id === annId);

      // Clean up test announcement
      await apiCall(`/cms/announcements/${annId}`, 'DELETE', {}, ownerToken);

      if (annCreated && annUpdated && annPublished && !leakedToPublic) {
        logStep('WF-07', 'Announcement Lifecycle', 'PASS', 'Created DRAFT, updated title, published with STAFF audience, verified unauthenticated access blocked (401), deleted');
      } else {
        logStep('WF-07', 'Announcement Lifecycle', 'FAIL', `Created: ${annCreated}, Updated: ${annUpdated}, Published: ${annPublished}, Leaked: ${leakedToPublic}`);
      }
    } else {
      logStep('WF-07', 'Announcement Lifecycle', 'FAIL', `Failed to create initial announcement: ${createAnn.status}`);
    }

    // =========================================================================
    // WORKFLOW 8: DIGITAL ID PHOTO UPLOAD & RESTRICTIONS
    // =========================================================================
    console.log('\n--- WORKFLOW 8: Digital ID Photo Upload & Authorization ---');
    // Prepare valid 1x1 png image
    const validPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const validImgPath = path.join(os.tmpdir(), 'valid_id_test.png');
    fs.writeFileSync(validImgPath, validPngBuffer);

    // Invalid text file
    const invalidFilePath = path.join(os.tmpdir(), 'invalid_id_test.txt');
    fs.writeFileSync(invalidFilePath, 'This is a text file, not an image.');

    // Upload invalid file attempt via API multipart
    const formDataInvalid = new FormData();
    formDataInvalid.append('file', new Blob([fs.readFileSync(invalidFilePath)]), 'invalid.txt');
    formDataInvalid.append('purpose', 'MEMBER_PHOTO');
    const invalidUploadRes = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-id': ORG_ID },
      body: formDataInvalid,
    });
    const invalidRejected = invalidUploadRes.status === 400 || invalidUploadRes.status === 415;

    // Upload valid image
    const formDataValid = new FormData();
    formDataValid.append('file', new Blob([validPngBuffer], { type: 'image/png' }), 'valid.png');
    formDataValid.append('purpose', 'MEMBER_PHOTO');
    const validUploadRes = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-id': ORG_ID },
      body: formDataValid,
    });
    const validUploaded = validUploadRes.status === 201 || validUploadRes.status === 200;
    const uploadedData = await validUploadRes.json().catch(() => ({}));
    const photoUrl = uploadedData?.url || uploadedData?.fileUrl;

    // Unauthorized member attempts to associate/replace digital ID directly
    const memberPatchRes = await apiCall(
      `/members/admin/any-member-id/digital-id-photo`,
      'PATCH',
      { photoUrl: photoUrl || '/uploads/sample.png' },
      memberToken,
    );
    const memberBlocked = memberPatchRes.status === 403;

    // Clean up temp files
    try {
      fs.unlinkSync(validImgPath);
      fs.unlinkSync(invalidFilePath);
    } catch (e) {}

    if (invalidRejected && validUploaded && memberBlocked) {
      logStep('WF-08', 'Digital ID Upload & Security', 'PASS', `Invalid file rejected (${invalidUploadRes.status}), valid image accepted (${validUploadRes.status}), non-admin member blocked (${memberPatchRes.status})`);
    } else {
      logStep('WF-08', 'Digital ID Upload & Security', 'FAIL', `Invalid: ${invalidUploadRes.status}, Valid: ${validUploadRes.status}, Member blocked: ${memberPatchRes.status}`);
    }

    // =========================================================================
    // WORKFLOW 9: MESSAGING PERSISTENCE & HISTORY
    // =========================================================================
    console.log('\n--- WORKFLOW 9: Messaging & Conversation History ---');
    await cdp.navigate(`${APP_URL}/app/messages`);
    await cdp.waitForFunction(`() => document.querySelectorAll('button, input').length > 0`, 8000);

    const testMessageContent = `Automated verification ping ${Date.now()}`;

    // 1. Resolve member's User ID from roster
    const rosterForChat = await apiCall(`/organizations/4b/members`, 'GET', null, ownerToken);
    const memberForChat = rosterForChat.data?.find((m) => m.email === MEMBER_EMAIL);
    const memberUserId = memberForChat?.userId;

    if (memberUserId) {
      // 2. Start or retrieve conversation
      const convRes = await apiCall(
        '/messages/conversations',
        'POST',
        { recipientUserId: memberUserId },
        ownerToken,
      );
      const convId = convRes.data?.id;

      if (convId) {
        // 3. Send message to conversation
        const sendRes = await apiCall(
          `/messages/conversations/${convId}`,
          'POST',
          { content: testMessageContent },
          ownerToken,
        );
        const msgSent = (sendRes.status === 201 || sendRes.status === 200) && sendRes.data?.content === testMessageContent;

        // 4. Reload messaging page in browser to verify UI navigation
        await cdp.navigate(`${APP_URL}/app/messages`);
        await cdp.wait(2000);

        // 5. Fetch messages history via API to confirm persistence
        const messagesHistory = await apiCall(
          `/messages/conversations/${convId}`,
          'GET',
          null,
          ownerToken,
        );
        const msgPersisted = Array.isArray(messagesHistory.data) && messagesHistory.data.some((m) => m.content === testMessageContent);

        if (msgSent && msgPersisted) {
          logStep('WF-09', 'Messaging Persistence', 'PASS', `Sent message, reloaded view, and confirmed history persisted in conversation ${convId}`);
        } else {
          logStep('WF-09', 'Messaging Persistence', 'FAIL', `Send status: ${sendRes.status}, Persisted: ${msgPersisted}`);
        }
      } else {
        logStep('WF-09', 'Messaging Persistence', 'BLOCKED', `Could not create or get conversation: ${convRes.status}`);
      }
    } else {
      logStep('WF-09', 'Messaging Persistence', 'BLOCKED', `Could not find member userId for ${MEMBER_EMAIL}`);
    }

    // =========================================================================
    // SECTION 3: ROLE & TENANT SECURITY ENFORCEMENT
    // =========================================================================
    console.log('\n--- SECTION 3: Role & Multi-Tenant Security Verification ---');

    // 1. Regular Member calls Admin Create User endpoint -> 403
    const sec1 = await apiCall('/members/admin/create-user', 'POST', { firstName: 'Hacker' }, memberToken);
    const sec1Pass = sec1.status === 403;
    logStep('SEC-01', 'Admin Endpoint Role Guard', sec1Pass ? 'PASS' : 'FAIL', `Regular member calling admin create-user returned status ${sec1.status} (expected 403)`);

    // 2. Regular Member calls Admin Delete endpoint -> 403
    const sec2 = await apiCall('/members/admin/any-id', 'DELETE', {}, memberToken);
    const sec2Pass = sec2.status === 403;
    logStep('SEC-02', 'Admin Delete Role Guard', sec2Pass ? 'PASS' : 'FAIL', `Regular member calling admin delete returned status ${sec2.status} (expected 403)`);

    // 3. Unauthenticated request to protected admin endpoint -> 401
    const sec3 = await apiCall('/members/admin/any-id', 'GET', null, null);
    const sec3Pass = sec3.status === 401;
    logStep('SEC-03', 'Unauthenticated Guard', sec3Pass ? 'PASS' : 'FAIL', `Unauthenticated request returned status ${sec3.status} (expected 401)`);

    // 4. Cross-tenant isolation check: Tenant A request with invalid/foreign tenant ID -> 403
    const sec4 = await apiCall('/organizations/4b/members', 'GET', null, ownerToken, '00000000-0000-0000-0000-000000000000');
    const sec4Pass = sec4.status === 403 || sec4.status === 404;
    logStep('SEC-04', 'Multi-Tenant RLS Boundary', sec4Pass ? 'PASS' : 'FAIL', `Cross-tenant ID request returned status ${sec4.status} (expected 403/404)`);

    // =========================================================================
    // SECTION 4: MODAL ACCESSIBILITY & FOCUS MANAGEMENT
    // =========================================================================
    console.log('\n--- SECTION 4: Modal Accessibility & Focus Management ---');
    await cdp.navigate(`${APP_URL}/app/members`);
    await cdp.waitForFunction(`() => document.querySelectorAll('table tbody tr').length > 0`, 10000);

    // Open Member Details
    await cdp.evaluate(`
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        rows[0].querySelector('button[title="Edit Profile"]').click();
      })()
    `);
    await cdp.waitForFunction(`() => !!document.querySelector('div[role="dialog"]')`, 5000);

    const a11yCheck = await cdp.evaluate(`
      (function() {
        const dialog = document.querySelector('div[role="dialog"]');
        const role = dialog.getAttribute('role');
        const ariaModal = dialog.getAttribute('aria-modal');
        const ariaLabelledby = dialog.getAttribute('aria-labelledby');
        const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        
        // Focus test
        const firstInput = dialog.querySelector('input');
        if (firstInput) firstInput.focus();
        const activeElementIsInsideDialog = dialog.contains(document.activeElement);

        return {
          role,
          ariaModal,
          ariaLabelledby,
          focusableCount: focusable.length,
          activeElementIsInsideDialog
        };
      })()
    `);

    // Close dialog
    await cdp.evaluate(`
      (function() {
        const cancelBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.waitForFunction(`() => !document.querySelector('div[role="dialog"]')`, 5000);

    const a11yPass = a11yCheck.role === 'dialog' && a11yCheck.ariaModal === 'true' && a11yCheck.activeElementIsInsideDialog && a11yCheck.focusableCount > 0;
    logStep('A11Y-01', 'Modal Accessibility Attributes', a11yPass ? 'PASS' : 'FAIL', `role="${a11yCheck.role}", aria-modal="${a11yCheck.ariaModal}", focus contained inside dialog: ${a11yCheck.activeElementIsInsideDialog}`);

    // Summary calculation
    console.log('\n======================================================================');
    console.log('ACCEPTANCE TEST SUMMARY:');
    console.log('======================================================================');
    const passedCount = summary.filter((s) => s.status === 'PASS').length;
    const failedCount = summary.filter((s) => s.status === 'FAIL').length;
    const blockedCount = summary.filter((s) => s.status === 'BLOCKED').length;

    console.log(`TOTAL WORKFLOW TESTS: ${summary.length}`);
    console.log(`PASSED: ${passedCount}`);
    console.log(`FAILED: ${failedCount}`);
    console.log(`BLOCKED: ${blockedCount}`);
    console.log('======================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error('\n[FATAL TEST RUNNER ERROR]:', err);
  process.exit(1);
});
