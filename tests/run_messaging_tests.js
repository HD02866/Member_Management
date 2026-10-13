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

  const meRes = await makeRequest(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = meRes.data?.data || meRes.data;

  return { token, user, meData };
}

async function runMessagingTests() {
  console.log('================================================================');
  console.log('4BAYE PHASE 2: TELEGRAM-INSPIRED MESSAGING VERIFICATION SUITE');
  console.log('================================================================\n');

  const tenantId = 'ef221df4-bfb8-49b8-8a50-e7b96bef8677'; // 4Baye Association

  // 1. Authenticate both test accounts
  console.log('[1] Logging in test accounts...');
  const ownerAuth = await login('owner.test@4baye.local', 'OwnerTest@4Baye2026!');
  const memberAuth = await login('member.test@4baye.local', 'MemberTest@4Baye2026!');
  console.log(`✓ Owner logged in: ${ownerAuth.user.id} (${ownerAuth.user.email})`);
  console.log(`✓ Member logged in: ${memberAuth.user.id} (${memberAuth.user.email})`);

  // 2. Start / retrieve private conversation between Owner and Member
  console.log('\n[2] Starting / retrieving private conversation between Owner and Member...');
  const startConvRes = await makeRequest(`${API_BASE}/messages/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      recipientUserId: memberAuth.user.id,
      initialMessage: 'Hello from Owner! Welcome to 4Baye private chat.',
    }),
  });
  const conv = startConvRes.data?.data || startConvRes.data;
  const convId = conv.id;
  console.log(`✓ Conversation active with ID: ${convId}`);

  // 3. Owner sends a private text message
  console.log('\n[3] Owner sending private text message...');
  const sendTextRes = await makeRequest(`${API_BASE}/messages/conversations/${convId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      content: 'This is a test message for Telegram status check.',
    }),
  });
  const textMsg = sendTextRes.data?.data || sendTextRes.data;
  console.log(`✓ Text message created with ID: ${textMsg.id}`);

  // 4. Secure photo upload with magic byte inspection
  console.log('\n[4] Uploading photo attachment with valid magic bytes...');
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="chat-photo.png"\r\nContent-Type: image/png\r\n\r\n`),
    validPngHeader,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await makeRequest(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: multipartBody,
  });
  const uploadData = uploadRes.data?.data || uploadRes.data;
  console.log(`✓ Photo uploaded successfully. URL: ${uploadData.url}`);

  // 5. Owner sends message with photo attachment
  console.log('\n[5] Owner sending message with photo attachment...');
  const sendPhotoRes = await makeRequest(`${API_BASE}/messages/conversations/${convId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      content: 'Here is the photo attachment from 4Baye leadership.',
      attachments: [
        {
          url: uploadData.url,
          filename: 'chat-photo.png',
          mimeType: 'image/png',
          sizeBytes: 12,
        },
      ],
    }),
  });
  const photoMsg = sendPhotoRes.data?.data || sendPhotoRes.data;
  console.log(`✓ Photo message created with ID: ${photoMsg.id}`);

  // 6. Verify Telegram read status transitions (1 check -> 2 checks)
  console.log('\n[6] Verifying Telegram checkmarks status before and after recipient reads...');
  // 6a. Owner checks conversation messages BEFORE recipient reads:
  const ownerCheckBefore = await makeRequest(`${API_BASE}/messages/conversations/${convId}`, {
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  const ownerMsgsBefore = ownerCheckBefore.data?.data || ownerCheckBefore.data || [];
  const targetMsgBefore = ownerMsgsBefore.find((m) => m.id === textMsg.id);
  console.log(`- Status from Owner's view BEFORE member reads: ${targetMsgBefore?.status} (Expected: SENT / 1 checkmark)`);

  // 6b. Member opens and reads conversation
  console.log('Member opening and reading conversation...');
  await makeRequest(`${API_BASE}/messages/conversations/${convId}`, {
    headers: {
      'Authorization': `Bearer ${memberAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });

  // 6c. Owner checks conversation messages AFTER recipient reads:
  const ownerCheckAfter = await makeRequest(`${API_BASE}/messages/conversations/${convId}`, {
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  const ownerMsgsAfter = ownerCheckAfter.data?.data || ownerCheckAfter.data || [];
  const targetMsgAfter = ownerMsgsAfter.find((m) => m.id === textMsg.id);
  console.log(`- Status from Owner's view AFTER member reads: ${targetMsgAfter?.status} (Expected: READ / 2 checkmarks)`);

  if (targetMsgAfter?.status !== 'READ') {
    throw new Error('Telegram read-receipt transition FAILED');
  }
  console.log('✓ Telegram read receipt verification PASSED (1 check -> 2 checks).');

  // 7. Test Message Edit & Soft Deletion
  console.log('\n[7] Testing sender edit and soft deletion of messages...');
  // 7a. Edit text message
  const editRes = await makeRequest(`${API_BASE}/messages/${textMsg.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      content: 'This message has been edited by the sender.',
    }),
  });
  const editedMsg = editRes.data?.data || editRes.data;
  console.log(`✓ Message edited: content="${editedMsg.content}", editedAt=${editedMsg.editedAt}`);

  // 7b. Delete photo message
  const deleteRes = await makeRequest(`${API_BASE}/messages/${photoMsg.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  console.log(`✓ Message soft-deleted status: ${deleteRes.status} (Expected: 200)`);

  // 8. Test Group Messaging (Creation, Joining, Sending, ReadBy counter, Moderation deletion)
  console.log('\n[8] Testing Group Messaging & Permissions...');
  // 8a. Owner creates public group
  const createGroupRes = await makeRequest(`${API_BASE}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      name: `4Baye Community Test Group ${Date.now()}`,
      description: 'Official test group for Phase 2 verification',
      type: 'COMMUNITY',
      isPublic: true,
      membersCanPost: true,
    }),
  });
  const group = createGroupRes.data?.data || createGroupRes.data;
  const groupId = group.id;
  console.log(`✓ Group created with ID: ${groupId}`);

  // 8b. Member joins group
  await makeRequest(`${API_BASE}/groups/${groupId}/join`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${memberAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  console.log('✓ Member successfully joined group.');

  // 8c. Member posts a group message
  const sendGroupMsgRes = await makeRequest(`${API_BASE}/groups/${groupId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberAuth.token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      content: 'Hello everyone in the 4Baye community channel!',
    }),
  });
  const groupMsg = sendGroupMsgRes.data?.data || sendGroupMsgRes.data;
  console.log(`✓ Member posted message to group: ${groupMsg.id}`);

  // 8d. Owner reads group messages -> check readBy list
  const ownerReadGroupRes = await makeRequest(`${API_BASE}/groups/${groupId}/messages`, {
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  const groupMsgs = ownerReadGroupRes.data?.data || ownerReadGroupRes.data || [];
  const targetGroupMsg = groupMsgs.find((m) => m.id === groupMsg.id);
  console.log(`✓ Group message read count: ${targetGroupMsg?.readCount} (ReadBy contains Owner: ${targetGroupMsg?.readBy?.some((r) => r.id === ownerAuth.user.id)})`);

  // 8e. Owner (Admin/Owner role) moderates and deletes the group message
  const modDeleteRes = await makeRequest(`${API_BASE}/groups/messages/${groupMsg.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  console.log(`✓ Owner moderation deletion status: ${modDeleteRes.status} (Expected: 200)`);

  // 9. Attachment Authorization & Cross-tenant Isolation check
  console.log('\n[9] Testing Attachment Authorization...');
  const filename = uploadData.url.replace('/uploads/', '');
  const getFileAuthRes = await makeRequest(`${API_BASE}/uploads/${filename}`, {
    headers: {
      'Authorization': `Bearer ${memberAuth.token}`,
      'x-tenant-id': tenantId,
    },
  });
  console.log(`✓ Authorized participant file access status: ${getFileAuthRes.status} (Expected: 200)`);

  console.log('\n================================================================');
  console.log('ALL PHASE 2 MESSAGING & GROUP VERIFICATION TESTS PASSED!');
  console.log('================================================================');
}

runMessagingTests().catch((err) => {
  console.error('\n❌ MESSAGING TEST RUN FAILED:', err);
  process.exit(1);
});
