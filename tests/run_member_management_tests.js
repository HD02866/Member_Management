/**
 * Integration Test Suite: 4Baye Member Management Lifecycle
 * Uses built-in fetch API in Node.js 18+
 */

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

async function runTests() {
  console.log('========================================================');
  console.log('4BAYE PHASE 3: MEMBER MANAGEMENT INTEGRATION TEST SUITE');
  console.log('========================================================\n');

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
    // 1. Authenticate as Admin
    console.log('[Step 1] Authenticating as Admin (kebede.admin@4bassociation.org)...');
    const ownerLoginRes = await req('POST', '/auth/login', {
      identifier: 'kebede.admin@4bassociation.org',
      password: 'Password123!',
    });
    const ownerToken = extractToken(ownerLoginRes.data);
    const orgId = 'ef221df4-bfb8-49b8-8a50-e7b96bef8677';
    assert(ownerToken, 'Admin authenticated and access token acquired');

    const ownerHeaders = {
      Authorization: `Bearer ${ownerToken}`,
      'x-tenant-id': orgId,
    };

    // 2. Fetch Member Roster as Admin
    console.log('\n[Step 2] Fetching organization member roster...');
    const rosterRes = await req('GET', '/members/admin/list', null, ownerHeaders);
    const rawRoster = extractPayload(rosterRes.data);
    const roster = Array.isArray(rawRoster) ? rawRoster : (rawRoster?.data || []);
    assert(Array.isArray(roster), `Member roster retrieved (${roster?.length} members found)`);

    // 3. Register a new test user to go through lifecycle
    console.log('\n[Step 3] Registering new test member for lifecycle verification...');
    const timestamp = Date.now();
    const testEmail = `lifecycle.test.${timestamp}@4baye.local`;
    const testPassword = 'LifecycleTest@2026!';
    const regRes = await req('POST', '/auth/register', {
      email: testEmail,
      password: testPassword,
      firstName: 'Lifecycle',
      lastName: `Candidate${timestamp.toString().slice(-4)}`,
      organizationSlug: '4b',
    });
    const memberToken = extractToken(regRes.data);
    const memberUserId = regRes.data?.data?.user?.id || regRes.data?.user?.id;
    assert(memberToken && memberUserId, 'New test candidate registered successfully');

    // Fetch the candidate's member profile ID
    const candidateRosterRes = await req('GET', '/members/admin/list?search=' + testEmail, null, ownerHeaders);
    const rawUpdatedRoster = extractPayload(candidateRosterRes.data);
    const updatedRoster = Array.isArray(rawUpdatedRoster) ? rawUpdatedRoster : (rawUpdatedRoster?.data || []);
    const candidate = updatedRoster.find((m) => m.email === testEmail || m.user?.email === testEmail) || updatedRoster[0];
    assert(candidate && candidate.id, `Candidate found in organization roster with ID ${candidate?.id}`);
    const memberId = candidate.id;

    // 4. Admin Review: Approval
    console.log('\n[Step 4] Approving candidate via POST /members/admin/:memberId/review...');
    const approveRes = await req(
      'POST',
      `/members/admin/${memberId}/review`,
      { decision: 'APPROVED' },
      ownerHeaders
    );
    const approvedProfile = extractPayload(approveRes.data);
    assert(approvedProfile.status === 'ACTIVE', 'Member status updated to ACTIVE upon approval');

    // 5. Admin Detail Inspection
    console.log('\n[Step 5] Inspecting detailed member dossier...');
    const detailsRes = await req('GET', `/members/admin/${memberId}`, null, ownerHeaders);
    const details = extractPayload(detailsRes.data);
    assert(details.id === memberId, 'Member dossier retrieved');
    assert(details.user && details.user.email === testEmail, 'User relation populated correctly');
    assert(!details.user.passwordHash, 'Security check: passwordHash is not exposed in details');

    // 6. Admin Update Member Profile
    console.log('\n[Step 6] Admin updating member profile details...');
    const updateRes = await req(
      'PATCH',
      `/members/admin/${memberId}`,
      {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        phoneNumber: '+251911999888',
        city: 'Finfinnee / Addis Ababa',
        address: 'Bole Subcity, Woreda 03',
      },
      ownerHeaders
    );
    const updatedProfile = extractPayload(updateRes.data);
    assert(
      updatedProfile.firstName === 'UpdatedFirst' && updatedProfile.city === 'Finfinnee / Addis Ababa',
      'Member details updated and persisted'
    );

    // 7. Admin Update Internal Notes
    console.log('\n[Step 7] Updating internal administrative notes...');
    const notesRes = await req(
      'PATCH',
      `/members/admin/${memberId}/notes`,
      { adminNotes: 'Verified ID document in person on Oct 12, 2026.' },
      ownerHeaders
    );
    const notesProfile = extractPayload(notesRes.data);
    assert(
      notesProfile.adminNotes === 'Verified ID document in person on Oct 12, 2026.',
      'Internal administrative notes updated'
    );

    // 8. Admin Suspend Member Account
    console.log('\n[Step 8] Suspending member account with reason...');
    const suspendRes = await req(
      'POST',
      `/members/admin/${memberId}/suspend`,
      { reason: 'Administrative audit review pending' },
      ownerHeaders
    );
    const suspendedProfile = extractPayload(suspendRes.data);
    assert(
      suspendedProfile.status === 'SUSPENDED' &&
        suspendedProfile.suspensionReason === 'Administrative audit review pending',
      'Member profile status updated to SUSPENDED'
    );

    // 9. Verify Suspended Account Enforcement
    console.log('\n[Step 9] Verifying that suspended member session is blocked by JwtAuthGuard...');
    const suspendedCheck = await req('GET', '/members/me', null, {
      Authorization: `Bearer ${memberToken}`,
      'x-tenant-id': orgId,
    });
    assert(
      suspendedCheck.status === 401 || suspendedCheck.status === 403,
      `Suspended member token blocked with status ${suspendedCheck.status} Unauthorized/Forbidden`
    );

    // 10. Admin Reinstate Member Account
    console.log('\n[Step 10] Reinstating suspended member to ACTIVE...');
    const reinstateRes = await req('POST', `/members/admin/${memberId}/reinstate`, {}, ownerHeaders);
    const reinstatedProfile = extractPayload(reinstateRes.data);
    assert(
      reinstatedProfile.status === 'ACTIVE' && reinstatedProfile.suspendedAt === null,
      'Member profile reinstated to ACTIVE'
    );

    // 11. Admin Password Reset
    console.log('\n[Step 11] Performing administrative password reset...');
    const resetRes = await req(
      'POST',
      `/members/admin/${memberId}/reset-password`,
      {},
      ownerHeaders
    );
    const resetData = extractPayload(resetRes.data);
    assert(resetData.success && resetData.temporaryPassword, 'Secure temporary password generated');
    const newTempPassword = resetData.temporaryPassword;

    // 12. Authenticate with New Temporary Password
    console.log('\n[Step 12] Logging in with new generated temporary password...');
    const newLoginRes = await req('POST', '/auth/login', {
      identifier: testEmail,
      password: newTempPassword,
    });
    const newMemberToken = extractToken(newLoginRes.data);
    assert(newMemberToken, 'Member successfully logged in with temporary reset password');

    // 13. Access Control Barrier: Ordinary Member cannot access admin endpoints
    console.log('\n[Step 13] Verifying RBAC permission barriers for regular member...');
    const unauthorizedAction = await req(
      'POST',
      `/members/admin/${memberId}/suspend`,
      { reason: 'Unauthorized action' },
      {
        Authorization: `Bearer ${newMemberToken}`,
        'x-tenant-id': orgId,
      }
    );
    assert(
      unauthorizedAction.status === 403,
      `Regular member access to admin endpoints forbidden (status ${unauthorizedAction.status} Forbidden)`
    );

    // 14. Admin Soft Deletion / Access Revocation
    console.log('\n[Step 14] Admin revoking member profile (soft delete)...');
    const deleteRes = await req('DELETE', `/members/admin/${memberId}`, {
      reason: 'Test complete: removing candidate profile',
    }, ownerHeaders);
    const deleteData = extractPayload(deleteRes.data);
    assert(deleteData.success, 'Member profile deleted and archived');

    // Verify member is excluded from active roster
    const postDeleteRosterRes = await req('GET', '/organizations/4b/members', null, ownerHeaders);
    const postRoster = extractPayload(postDeleteRosterRes.data);
    const deletedCandidate = postRoster.find((m) => m.id === memberId);
    assert(!deletedCandidate, 'Archived member excluded from active member roster');


  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
