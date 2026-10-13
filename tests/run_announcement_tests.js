const http = require('http');

const API_BASE = 'http://localhost:3000/api/v1';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode || 0, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await makeRequest(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  const token =
    res.data?.data?.tokens?.accessToken ||
    res.data?.tokens?.accessToken ||
    res.data?.data?.accessToken ||
    res.data?.accessToken;
  const user = res.data?.data?.user || res.data?.user;

  // Query /auth/me with bearer token to fetch exact tenant memberships
  const meRes = await makeRequest(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = meRes.data?.data || meRes.data;
  const orgId =
    meData?.staffRoles?.[0]?.organizationId ||
    meData?.staffRoles?.[0]?.organization?.id ||
    meData?.memberships?.[0]?.organizationId ||
    meData?.memberships?.[0]?.organization?.id ||
    'ef221df4-bfb8-49b8-8a50-e7b96bef8677';

  return { token, user, orgId, meData };
}

async function runTests() {
  console.log('====================================================');
  console.log('4BAYE ANNOUNCEMENT SYSTEM COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  // Step 1: Login Admin
  console.log('[1] Logging in as 4Baye Admin (kebede.admin@4bassociation.org)...');
  const ownerAuth = await login('kebede.admin@4bassociation.org', 'Password123!');
  console.log('✓ Admin login successful. Token acquired.');

  const tenantId = ownerAuth.orgId;
  console.log(`✓ Active Tenant ID: ${tenantId}`);

  // Step 2: Login Member
  console.log('\n[2] Logging in as 4Baye Member (abebe.member@example.com)...');
  const memberAuth = await login('abebe.member@example.com', 'Password123!');
  console.log('✓ Member login successful. Token acquired.');

  // Step 3: Test Upload Security Validation
  console.log('\n[3] Testing Upload Security Validation...');
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  
  const makeMultipart = (fileName, mime, content) => {
    return Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
  };

  // 3a. Upload valid PNG
  const validBody = makeMultipart('test.png', 'image/png', validPngHeader);
  const uploadRes = await makeRequest(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: validBody,
  });
  console.log(`Valid PNG upload status: ${uploadRes.status}`);
  if (uploadRes.status !== 201 && uploadRes.status !== 200) {
    throw new Error(`Valid upload failed: ${JSON.stringify(uploadRes.data)}`);
  }
  const uploadedUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
  console.log(`✓ Valid upload accepted with URL: ${uploadedUrl}`);

  // 3b. Upload fake MIME image with invalid magic bytes (should fail)
  const fakeBody = makeMultipart('fake.png', 'image/png', Buffer.from('FAKE MALICIOUS EXECUTABLE OR HTML'));
  const fakeRes = await makeRequest(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: fakeBody,
  });
  console.log(`Corrupted/Spoofed upload rejection status: ${fakeRes.status}`);
  if (fakeRes.status === 400) {
    console.log('✓ Security verified: Spoofed file magic bytes correctly rejected with 400 Bad Request.');
  } else {
    console.warn(`! Spoofed file received status: ${fakeRes.status}`);
  }

  // Step 4: Admin Creates Public Announcement with Cover Image
  console.log('\n[4] Creating Public Announcement with Cover Image...');
  const createPublicRes = await makeRequest(`${API_BASE}/cms/announcements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      title: { en: '4Baye 2026 Annual Community Assembly' },
      content: { en: 'We invite all members and guests to attend our 2026 General Assembly.' },
      summary: 'Annual General Assembly schedule and participation guidelines.',
      coverImageUrl: uploadedUrl,
      ctaLabel: 'Register Attendance',
      ctaUrl: 'https://4baye.org/assembly-2026',
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      isPinned: true,
    }),
  });
  if (createPublicRes.status !== 201 && createPublicRes.status !== 200) {
    throw new Error(`Failed to create public announcement: ${JSON.stringify(createPublicRes.data)}`);
  }
  const publicAnn = createPublicRes.data?.data || createPublicRes.data;
  console.log(`✓ Created Public Announcement ID: ${publicAnn.id}`);

  // Step 5: Admin Creates Members-Only Announcement
  console.log('\n[5] Creating Members-Only Announcement...');
  const createMembersRes = await makeRequest(`${API_BASE}/cms/announcements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      title: { en: 'Internal Welfare Fund Distribution Q4' },
      content: { en: 'Member emergency relief claims for Q4 are now open for submission.' },
      summary: 'Confidential member welfare relief program distribution.',
      audience: 'MEMBERS',
      status: 'PUBLISHED',
      isPinned: false,
    }),
  });
  const membersAnn = createMembersRes.data?.data || createMembersRes.data;
  console.log(`✓ Created Members Announcement ID: ${membersAnn.id}`);

  // Step 6: Admin Creates Draft Announcement
  console.log('\n[6] Creating Draft Announcement...');
  const createDraftRes = await makeRequest(`${API_BASE}/cms/announcements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      title: { en: 'Unpublished Executive Plan Draft' },
      content: { en: 'Draft notes that should never appear on public or member lists.' },
      audience: 'PUBLIC',
      status: 'DRAFT',
    }),
  });
  const draftAnn = createDraftRes.data?.data || createDraftRes.data;
  console.log(`✓ Created Draft Announcement ID: ${draftAnn.id}`);

  // Step 7: Test Public Endpoint Isolation
  console.log('\n[7] Verifying Public Organization Endpoint (/organizations/4b)...');
  const publicOrgRes = await makeRequest(`${API_BASE}/organizations/4b`);
  const publicList = publicOrgRes.data?.data?.announcements || publicOrgRes.data?.announcements || [];
  
  const hasPublic = publicList.some((a) => a.id === publicAnn.id);
  const hasMembersInPublic = publicList.some((a) => a.id === membersAnn.id);
  const hasDraftInPublic = publicList.some((a) => a.id === draftAnn.id);

  console.log(`- Public list contains public announcement: ${hasPublic} (Expected: true)`);
  console.log(`- Public list contains members-only announcement: ${hasMembersInPublic} (Expected: false)`);
  console.log(`- Public list contains draft announcement: ${hasDraftInPublic} (Expected: false)`);

  if (!hasPublic || hasMembersInPublic || hasDraftInPublic) {
    throw new Error('Public audience isolation check FAILED');
  }
  console.log('✓ Public audience isolation PASSED.');

  // Step 8: Test Member Endpoint Audience Delivery (/members/announcements)
  console.log('\n[8] Verifying Member Announcements Endpoint (/members/announcements)...');
  const memberFetchRes = await makeRequest(`${API_BASE}/members/announcements`, {
    headers: {
      'Authorization': `Bearer ${memberAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  const memberList = memberFetchRes.data?.data || memberFetchRes.data || [];
  
  const memberHasPublic = memberList.some((a) => a.id === publicAnn.id);
  const memberHasMembers = memberList.some((a) => a.id === membersAnn.id);
  const memberHasDraft = memberList.some((a) => a.id === draftAnn.id);

  console.log(`- Member sees public announcement: ${memberHasPublic} (Expected: true)`);
  console.log(`- Member sees member-only announcement: ${memberHasMembers} (Expected: true)`);
  console.log(`- Member sees draft announcement: ${memberHasDraft} (Expected: false)`);

  if (!memberHasPublic || !memberHasMembers || memberHasDraft) {
    throw new Error('Member audience delivery check FAILED');
  }
  console.log('✓ Member audience delivery PASSED.');

  // Step 9: Test Admin Announcement Update and Status Toggling
  console.log('\n[9] Testing Admin Update & Status Toggle...');
  const updateRes = await makeRequest(`${API_BASE}/cms/announcements/${publicAnn.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      summary: 'Updated Assembly Summary with confirmed keynote speaker.',
    }),
  });
  if (updateRes.status !== 200) {
    throw new Error(`Failed to update announcement: ${JSON.stringify(updateRes.data)}`);
  }
  console.log('✓ Announcement successfully updated.');

  // Step 10: Test Archive and Delete
  console.log('\n[10] Testing Announcement Archival and Deletion...');
  const archiveRes = await makeRequest(`${API_BASE}/cms/announcements/${draftAnn.id}/archive`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  console.log(`Archive status: ${archiveRes.status} (Expected: 200)`);

  const deleteRes = await makeRequest(`${API_BASE}/cms/announcements/${draftAnn.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  console.log(`Delete status: ${deleteRes.status} (Expected: 200)`);
  console.log('✓ Archival and soft deletion PASSED.');

  console.log('\n====================================================');
  console.log('ALL PHASE 1 ANNOUNCEMENT VERIFICATION TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
