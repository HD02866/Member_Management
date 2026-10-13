/**
 * Automated End-to-End Verification of Admin-Uploaded Digital ID Lifecycle:
 * 1. Admin login & token acquisition
 * 2. Find/Verify member without ID photo (Member B)
 * 3. Admin upload of Digital ID photo with purpose MEMBER_PHOTO
 * 4. Admin associate photo via PATCH /members/admin/:id/digital-id-photo
 * 5. Verify database records: MemberProfile.photoUrl & DigitalMembershipCard (auto-provisioned/updated)
 * 6. Member login as Member B
 * 7. Member fetch GET /api/v1/cards/me -> verify photoUrl, cardNumber, qrToken, and member details
 * 8. Member fetch GET /uploads/:filename -> verify HTTP 200 with authorization
 * 9. Unauthorized access test: Another member or unauthenticated user trying to access the private MEMBER_PHOTO -> verify HTTP 403 Forbidden
 * 10. Generate PDF binary using generateDigitalIdPdf -> verify %PDF-1.4 header, xref, trailer, and %%EOF
 */

import { generateDigitalIdPdf } from '../apps/web/src/lib/pdf';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:3000/api/v1';
const UPLOADS_BASE = 'http://localhost:3000/api/v1/uploads';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('4BAYE DIGITAL ID END-TO-END VERIFICATION SUITE');
  console.log('======================================================\n');

  // Step 1: Admin Login
  console.log('[Step 1] Authenticating Owner/Admin (kebede.admin@4bassociation.org)...');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'kebede.admin@4bassociation.org',
      password: 'Password123!',
    }),
  });
  assert(adminLoginRes.status === 200, 'Admin login returned HTTP 200');
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.data.tokens.accessToken;
  const adminOrgId = adminData.data.user.organizationId || 'ef221df4-bfb8-49b8-8a50-e7b96bef8677';
  console.log(`  Admin token acquired. Tenant ID: ${adminOrgId}`);

  // Step 2: Member Login (Member B - member.test@4baye.local)
  console.log('\n[Step 2] Authenticating Test Member (member.test@4baye.local)...');
  const memberLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'member.test@4baye.local',
      password: 'MemberTest@4Baye2026!',
    }),
  });
  assert(memberLoginRes.status === 200, 'Member login returned HTTP 200');
  const memberData = await memberLoginRes.json();
  const memberToken = memberData.data.tokens.accessToken;
  const memberUserId = memberData.data.user.id;
  console.log(`  Member user ID: ${memberUserId}`);

  // Step 3: Fetch Member Profile
  console.log('\n[Step 3] Fetching Member Profile via GET /members/me...');
  const memberProfileRes = await fetch(`${API_BASE}/members/me`, {
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'x-tenant-id': adminOrgId,
    },
  });
  assert(memberProfileRes.status === 200, 'Member profile returned HTTP 200');
  const profileJson = await memberProfileRes.json();
  const memberProfileId = profileJson.data.id;
  console.log(`  Member Profile ID: ${memberProfileId}, Member #: ${profileJson.data.memberNumber}`);

  // Step 4: Admin creates a safe test JPEG and uploads to /uploads with purpose MEMBER_PHOTO
  console.log('\n[Step 4] Admin uploading official Digital ID image with purpose MEMBER_PHOTO...');
  // 1x1 base64 transparent JPEG or minimal valid JPEG
  const sampleJpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const sampleJpegBuffer = Buffer.from(sampleJpegBase64, 'base64');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let formBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nMEMBER_PHOTO\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="4baye_digital_id_official.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    ),
    sampleJpegBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'x-tenant-id': adminOrgId,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: formBody,
  });
  assert(uploadRes.status === 201 || uploadRes.status === 200, `Upload returned HTTP ${uploadRes.status}`);
  const uploadJson = await uploadRes.json();
  const photoUrl = uploadJson.data.url;
  const uploadedFilename = path.basename(photoUrl);
  console.log(`  Uploaded File URL: ${photoUrl} (filename: ${uploadedFilename})`);

  // Step 5: Admin associates photo with MemberProfile via PATCH /members/admin/:id/digital-id-photo
  console.log(`\n[Step 5] Associating photoUrl with member ${memberProfileId}...`);
  const associateRes = await fetch(`${API_BASE}/members/admin/${memberProfileId}/digital-id-photo`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'x-tenant-id': adminOrgId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ photoUrl }),
  });
  assert(associateRes.status === 200, 'Photo association returned HTTP 200');
  const associateJson = await associateRes.json();
  assert(associateJson.data.photoUrl === photoUrl, 'Associated photoUrl matches uploaded photoUrl');
  console.log(`  Associated successfully: ${associateJson.data.photoUrl}`);

  // Step 6: Member fetches their Digital Membership Card via GET /cards/me
  console.log('\n[Step 6] Authenticated Member fetching card via GET /cards/me...');
  const cardRes = await fetch(`${API_BASE}/cards/me`, {
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'x-tenant-id': adminOrgId,
    },
  });
  assert(cardRes.status === 200, 'Member card returned HTTP 200');
  const cardJson = await cardRes.json();
  const card = cardJson.data;
  console.log(`  Card Number: ${card.cardNumber}, Status: ${card.status}, Card Version: ${card.cardVersion}`);
  console.log(`  Card Member Photo URL: ${card.memberProfile?.photoUrl}`);
  assert(card.memberProfile?.photoUrl === photoUrl, 'Card memberProfile.photoUrl matches admin-uploaded image');
  assert(!!card.qrToken, 'Card has active QR verification token');
  assert(card.status === 'ACTIVE', 'Card status is ACTIVE');

  // Step 7: Member fetches the uploaded image with Authorization / Cookie
  console.log(`\n[Step 7] Member requesting image at ${UPLOADS_BASE}/${uploadedFilename}...`);
  const memberFetchImageRes = await fetch(`${UPLOADS_BASE}/${uploadedFilename}`, {
    headers: {
      Authorization: `Bearer ${memberToken}`,
    },
  });
  assert(memberFetchImageRes.status === 200, `Member image fetch succeeded (HTTP ${memberFetchImageRes.status})`);
  assert(
    memberFetchImageRes.headers.get('content-type') === 'image/jpeg',
    `Content-Type is image/jpeg`
  );

  // Step 8: Security Check: Another member (Abebe) attempting to access Member B's private digital ID photo
  console.log('\n[Step 8] Security check: Another member attempting unauthorized access...');
  const abebeLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'abebe.member@example.com',
      password: 'Password123!',
    }),
  });
  assert(abebeLoginRes.status === 200, 'Abebe login succeeded');
  const abebeToken = (await abebeLoginRes.json()).data.tokens.accessToken;

  const unauthorizedFetchRes = await fetch(`${UPLOADS_BASE}/${uploadedFilename}`, {
    headers: {
      Authorization: `Bearer ${abebeToken}`,
    },
  });
  assert(
    unauthorizedFetchRes.status === 403,
    `Unauthorized member access blocked with HTTP 403 Forbidden (Actual: ${unauthorizedFetchRes.status})`
  );

  // Step 9: Unauthenticated request to private MEMBER_PHOTO blocked
  console.log('\n[Step 9] Security check: Anonymous/unauthenticated access to private ID photo...');
  const anonymousFetchRes = await fetch(`${UPLOADS_BASE}/${uploadedFilename}`);
  assert(
    anonymousFetchRes.status === 403,
    `Anonymous access blocked with HTTP 403 Forbidden (Actual: ${anonymousFetchRes.status})`
  );

  // Step 10: Pure PDF Binary Generator Verification
  console.log('\n[Step 10] Testing Pure Binary PDF 1.4 Generation...');
  const pdfBytes = await generateDigitalIdPdf({
    memberName: `${card.memberProfile.firstName} ${card.memberProfile.lastName}`,
    memberNumber: card.memberProfile.memberNumber,
    status: card.status,
    organizationName: card.organization?.name || '4Baye Association',
    planName: card.membership?.planName || 'Standard Membership',
    cardNumber: card.cardNumber,
    expirationDate: new Date(card.expirationDate).toISOString().split('T')[0],
  });

  assert(pdfBytes instanceof Uint8Array, 'PDF output is a valid Uint8Array');
  const pdfHeader = Buffer.from(pdfBytes.subarray(0, 8)).toString('utf-8');
  assert(pdfHeader.startsWith('%PDF-1.4'), `PDF header starts with %PDF-1.4 (Header: ${pdfHeader})`);

  const pdfTail = Buffer.from(pdfBytes.subarray(pdfBytes.length - 30)).toString('utf-8');
  assert(pdfTail.includes('%%EOF'), `PDF ends with standard EOF marker (Tail: ${pdfTail.trim()})`);
  assert(pdfTail.includes('startxref'), 'PDF contains startxref table pointer');

  console.log(`  Generated PDF size: ${pdfBytes.length} bytes`);

  console.log('\n🎉 ALL 10 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
