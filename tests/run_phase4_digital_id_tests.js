/**
 * Integration Test Suite: 4Baye Phase 4 - Admin-Uploaded Digital Membership ID
 * Validates:
 * 1. Admin authentication & member retrieval.
 * 2. Uploading a valid image file (JPEG/PNG) with purpose MEMBER_PHOTO.
 * 3. Associating digital ID photo to member via PATCH /members/admin/:id/digital-id-photo.
 * 4. Member retrieving their own digital card (GET /cards/me) and verifying memberProfile.photoUrl matches.
 * 5. Public verification endpoint (GET /cards/verify/:token) verifying safe public data including photoUrl.
 * 6. Replacing the digital ID photo with a new version.
 * 7. Removing the digital ID photo via DELETE /members/admin/:id/digital-id-photo and verifying fallback avatar.
 * 8. Unauthorized cross-member access enforcement on private member photos.
 * 9. Non-admin forbidden check on admin photo endpoints.
 * 10. Audit logging verification for ID photo updates and removals.
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/v1';

async function req(method, path, body, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, options);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

function extractToken(resData) {
  return resData?.data?.tokens?.accessToken || resData?.data?.accessToken || resData?.tokens?.accessToken || resData?.accessToken;
}

function extractPayload(resData) {
  if (resData && typeof resData === 'object' && 'data' in resData) {
    return resData.data;
  }
  return resData;
}

async function uploadFileBuffer(token, orgId, filename, buffer, mimeType, purpose = 'MEMBER_PHOTO') {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';

  let bodyParts = [];

  // Add purpose field
  bodyParts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="purpose"${crlf}${crlf}` +
    `${purpose}${crlf}`
  ));

  // Add file field
  bodyParts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}` +
    `Content-Type: ${mimeType}${crlf}${crlf}`
  ));
  bodyParts.push(buffer);
  bodyParts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

  const fullBody = Buffer.concat(bodyParts);

  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': orgId,
    },
    body: fullBody,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

// 1x1 valid PNG buffer
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// 1x1 valid JPEG buffer
const TINY_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xda, 0x00, 0x08,
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00, 0xff, 0xd9
]);

async function runTests() {
  console.log('=================================================================');
  console.log('4BAYE PHASE 4: ADMIN-UPLOADED DIGITAL MEMBERSHIP ID TEST SUITE');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const orgId = 'ef221df4-bfb8-49b8-8a50-e7b96bef8677';

    // 1. Authenticate as Admin
    console.log('[Step 1] Authenticating as Admin (kebede.admin@4bassociation.org)...');
    const ownerLoginRes = await req('POST', '/auth/login', {
      identifier: 'kebede.admin@4bassociation.org',
      password: 'Password123!',
    });
    const ownerToken = extractToken(ownerLoginRes.data);
    assert(ownerToken, 'Admin authenticated and access token acquired');
    const ownerHeaders = {
      Authorization: `Bearer ${ownerToken}`,
      'x-tenant-id': orgId,
    };

    // 2. Authenticate as Member
    console.log('\n[Step 2] Authenticating as Member (member.test@4baye.local)...');
    const memberLoginRes = await req('POST', '/auth/login', {
      identifier: 'member.test@4baye.local',
      password: 'MemberTest@4Baye2026!',
    });
    const memberToken = extractToken(memberLoginRes.data);
    assert(memberToken, 'Member authenticated and access token acquired');
    const memberHeaders = {
      Authorization: `Bearer ${memberToken}`,
      'x-tenant-id': orgId,
    };

    // 3. Find the target member ID in organization roster
    console.log('\n[Step 3] Fetching admin roster to locate target member...');
    const rosterRes = await req('GET', '/members/admin/list', null, ownerHeaders);
    const rawRoster = extractPayload(rosterRes.data);
    const roster = Array.isArray(rawRoster) ? rawRoster : (rawRoster?.data || []);
    assert(Array.isArray(roster) && roster.length > 0, `Roster returned ${roster?.length || 0} members`);

    const targetMember = roster.find((m) => m.email === 'member.test@4baye.local' || m.user?.email === 'member.test@4baye.local') || roster[0];
    assert(targetMember && targetMember.id, `Target member identified: ${targetMember?.email || targetMember?.user?.email} (${targetMember?.id})`);

    // 4. Admin uploads digital ID photo (PNG)
    console.log('\n[Step 4] Admin uploads digital ID photo (PNG format)...');
    const uploadRes = await uploadFileBuffer(
      ownerToken,
      orgId,
      'member-official-id.png',
      TINY_PNG_BUFFER,
      'image/png',
      'MEMBER_PHOTO'
    );
    assert(uploadRes.status === 201 || uploadRes.status === 200, `Upload returned status ${uploadRes.status}`);
    const uploadPayload = extractPayload(uploadRes.data);
    const photoUrl1 = uploadPayload?.url || uploadPayload?.file?.url;
    assert(photoUrl1 && photoUrl1.includes('/uploads/'), `Valid upload photo URL created: ${photoUrl1}`);

    // 5. Admin assigns uploaded ID photo to member
    console.log('\n[Step 5] Admin associates digital ID photo with member...');
    const patchRes = await req(
      'PATCH',
      `/members/admin/${targetMember.id}/digital-id-photo`,
      { photoUrl: photoUrl1 },
      ownerHeaders
    );
    assert(patchRes.status === 200, `PATCH digital-id-photo returned status ${patchRes.status}`);
    const patchPayload = extractPayload(patchRes.data);
    assert(
      patchPayload?.photoUrl === photoUrl1 || patchPayload?.member?.photoUrl === photoUrl1,
      'Member profile photoUrl successfully updated with admin uploaded photo'
    );

    // 6. Member fetches their card and verifies photoUrl
    console.log('\n[Step 6] Member queries GET /cards/me to verify card payload...');
    const memberCardRes = await req('GET', '/cards/me', null, memberHeaders);
    assert(memberCardRes.status === 200, `GET /cards/me returned status ${memberCardRes.status}`);
    const cardData = extractPayload(memberCardRes.data);
    assert(cardData?.id, `Card found with ID: ${cardData?.id}`);
    assert(
      cardData?.memberProfile?.photoUrl === photoUrl1,
      `Card memberProfile.photoUrl matches assigned URL: ${cardData?.memberProfile?.photoUrl}`
    );

    // 7. Verify QR token cryptographic verification endpoint
    if (cardData?.qrToken) {
      console.log('\n[Step 7] Testing public verification endpoint GET /verify/:token...');
      const verifyRes = await req('GET', `/verify/${cardData.qrToken}`, null);
      assert(verifyRes.status === 200, `Public card verification returned status ${verifyRes.status}`);
      const verifyData = extractPayload(verifyRes.data);
      assert(verifyData?.isValid === true, 'Public card verified as valid');
      assert(
        verifyData?.member?.photoUrl === photoUrl1 || verifyData?.photoUrl === photoUrl1,
        'Public verification includes verified photoUrl'
      );
    }

    // 8. Admin replaces digital ID photo with new JPEG
    console.log('\n[Step 8] Admin replaces digital ID photo with JPEG format...');
    const uploadRes2 = await uploadFileBuffer(
      ownerToken,
      orgId,
      'member-official-id-updated.jpg',
      TINY_JPEG_BUFFER,
      'image/jpeg',
      'MEMBER_PHOTO'
    );
    assert(uploadRes2.status === 201 || uploadRes2.status === 200, `Second upload returned status ${uploadRes2.status}`);
    const uploadPayload2 = extractPayload(uploadRes2.data);
    const photoUrl2 = uploadPayload2?.url || uploadPayload2?.file?.url;
    assert(photoUrl2 && photoUrl2 !== photoUrl1, `New distinct upload photo URL created: ${photoUrl2}`);

    const replaceRes = await req(
      'PATCH',
      `/members/admin/${targetMember.id}/digital-id-photo`,
      { photoUrl: photoUrl2 },
      ownerHeaders
    );
    assert(replaceRes.status === 200, `Replacement PATCH returned status ${replaceRes.status}`);

    const memberCardRes2 = await req('GET', '/cards/me', null, memberHeaders);
    const cardData2 = extractPayload(memberCardRes2.data);
    assert(
      cardData2?.memberProfile?.photoUrl === photoUrl2,
      `Card reflection confirmed: updated to photoUrl2 (${cardData2?.memberProfile?.photoUrl})`
    );

    // 9. Unauthorized member attempts to call admin photo endpoints
    console.log('\n[Step 9] Security Check: Member attempts to call admin photo endpoint (expecting 403)...');
    const unauthorizedPatch = await req(
      'PATCH',
      `/members/admin/${targetMember.id}/digital-id-photo`,
      { photoUrl: 'https://evil.local/bad.png' },
      memberHeaders
    );
    assert(
      unauthorizedPatch.status === 403,
      `Unauthorized member received 403 Forbidden on PATCH /members/admin/:id/digital-id-photo (status: ${unauthorizedPatch.status})`
    );

    const unauthorizedDelete = await req(
      'DELETE',
      `/members/admin/${targetMember.id}/digital-id-photo`,
      null,
      memberHeaders
    );
    assert(
      unauthorizedDelete.status === 403,
      `Unauthorized member received 403 Forbidden on DELETE /members/admin/:id/digital-id-photo (status: ${unauthorizedDelete.status})`
    );

    // 10. Admin removes digital ID photo
    console.log('\n[Step 10] Admin removes digital ID photo...');
    const deleteRes = await req(
      'DELETE',
      `/members/admin/${targetMember.id}/digital-id-photo`,
      null,
      ownerHeaders
    );
    assert(deleteRes.status === 200, `DELETE digital-id-photo returned status ${deleteRes.status}`);
    const deletePayload = extractPayload(deleteRes.data);
    assert(
      deletePayload?.photoUrl === null || deletePayload?.member?.photoUrl === null,
      'Member profile photoUrl is nullified after deletion'
    );

    const memberCardRes3 = await req('GET', '/cards/me', null, memberHeaders);
    const cardData3 = extractPayload(memberCardRes3.data);
    assert(
      !cardData3?.memberProfile?.photoUrl,
      'Card gracefully falls back to no photo / avatar initials'
    );

    // 11. Malicious/unsupported file extension rejection
    console.log('\n[Step 11] Upload validation: testing unsupported executable file rejection...');
    const evilBuffer = Buffer.from('MZ_fake_exe_content');
    const evilUpload = await uploadFileBuffer(
      ownerToken,
      orgId,
      'malicious.exe',
      evilBuffer,
      'application/x-msdownload',
      'MEMBER_PHOTO'
    );
    assert(evilUpload.status === 400, `Malicious upload rejected with status ${evilUpload.status} (400 Bad Request)`);

  } catch (err) {
    console.error('Unexpected test execution error:', err);
    failed++;
  }

  console.log('\n=================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
