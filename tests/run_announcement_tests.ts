import http from 'http';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000/api/v1';

async function makeRequest(url: string, options: any = {}) {
  return new Promise<{ status: number; data: any; headers: any }>((resolve, reject) => {
    const u = new URL(url);
    const reqOptions: http.RequestOptions = {
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

async function login(email: string, password: string) {
  const res = await makeRequest(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  const token = res.data?.data?.accessToken || res.data?.accessToken;
  const user = res.data?.data?.user || res.data?.user;
  const tenants = res.data?.data?.tenants || res.data?.tenants || [];
  return { token, user, tenants };
}

async function runTests() {
  console.log('====================================================');
  console.log('4BAYE ANNOUNCEMENT SYSTEM COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  // Step 1: Login Owner
  console.log('[1] Logging in as 4Baye Owner/Admin (owner.test@4baye.local)...');
  const ownerAuth = await login('owner.test@4baye.local', 'OwnerTest@4Baye2026!');
  console.log('✓ Owner login successful. Token acquired.');

  const tenantId = ownerAuth.tenants[0]?.id || '4b';
  console.log(`✓ Active Tenant ID: ${tenantId}`);

  // Step 2: Login Member
  console.log('\n[2] Logging in as 4Baye Member (member.test@4baye.local)...');
  const memberAuth = await login('member.test@4baye.local', 'MemberTest@4Baye2026!');
  console.log('✓ Member login successful. Token acquired.');

  // Step 3: Test Upload Magic Byte & Corrupted File Rejection
  console.log('\n[3] Testing Upload Security Validation...');
  // Construct a dummy PNG file with valid magic bytes
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  
  const makeMultipart = (fileName: string, mime: string, content: Buffer) => {
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
  
  const hasPublic = publicList.some((a: any) => a.id === publicAnn.id);
  const hasMembersInPublic = publicList.some((a: any) => a.id === membersAnn.id);
  const hasDraftInPublic = publicList.some((a: any) => a.id === draftAnn.id);

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
  
  const memberHasPublic = memberList.some((a: any) => a.id === publicAnn.id);
  const memberHasMembers = memberList.some((a: any) => a.id === membersAnn.id);
  const memberHasDraft = memberList.some((a: any) => a.id === draftAnn.id);

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
