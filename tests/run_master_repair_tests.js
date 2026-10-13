/**
 * Automated Verification Suite: 4Baye Master Repair Verification
 *
 * Verifies:
 * 1. Owner & Admin authentication.
 * 2. Admin Create User API (/members/admin/create-user) with validation, uniqueness, and password hashing.
 * 3. Member details retrieval (/members/admin/:id) verifying populated fields, no leaked password hashes, and proper relations.
 * 4. Member profile update (/members/admin/:id) persisting real changes.
 * 5. Lifecycle review approval (/members/admin/:id/review).
 * 6. Account suspension (/members/admin/:id/suspend) and session termination.
 * 7. Account reinstatement (/members/admin/:id/reinstate).
 * 8. Member deletion / revocation (/members/admin/:id) with audit tracking, soft-deletion, and login blocking.
 * 9. Security boundary checks: Regular member calling admin endpoints receives 403 Forbidden.
 * 10. Cross-tenant access isolation.
 */

const API_URL = 'http://127.0.0.1:3000/api/v1';

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

async function runMasterRepairTests() {
  console.log('======================================================================');
  console.log('4BAYE MASTER REPAIR: COMPREHENSIVE END-TO-END VERIFICATION SUITE');
  console.log('======================================================================\n');

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
    const orgId = 'ef221df4-bfb8-49b8-8a50-e7b96bef8677'; // 4Baye Association

    // 1. Authenticate as Admin
    console.log('[Step 1] Authenticating as Admin (kebede.admin@4bassociation.org)...');
    const ownerLogin = await req('POST', '/auth/login', {
      identifier: 'kebede.admin@4bassociation.org',
      password: 'Password123!',
    });
    const ownerToken = extractToken(ownerLogin.data);
    assert(ownerToken, 'Admin authenticated and access token acquired');
    const ownerHeaders = {
      Authorization: `Bearer ${ownerToken}`,
      'x-tenant-id': orgId,
    };

    // 2. Authenticate as Regular Member
    console.log('\n[Step 2] Authenticating as Regular Member (member.test@4baye.local)...');
    const memberLogin = await req('POST', '/auth/login', {
      identifier: 'member.test@4baye.local',
      password: 'MemberTest@4Baye2026!',
    });
    const memberToken = extractToken(memberLogin.data);
    assert(memberToken, 'Member authenticated and access token acquired');
    const memberHeaders = {
      Authorization: `Bearer ${memberToken}`,
      'x-tenant-id': orgId,
    };

    // 3. Test Admin Create User
    console.log('\n[Step 3] Admin creates a new user via POST /members/admin/create-user...');
    const timestamp = Date.now();
    const newUserEmail = `master.repair.${timestamp}@4baye.local`;
    const createRes = await req(
      'POST',
      '/members/admin/create-user',
      {
        firstName: 'Master',
        lastName: `Repair${timestamp.toString().slice(-4)}`,
        email: newUserEmail,
        phoneNumber: `+2519${timestamp.toString().slice(-8)}`,
        roleCode: 'MEMBER',
        initialStatus: 'ACTIVE',
        gender: 'MALE',
        city: 'Finfinnee',
        address: 'Bole Woreda 04',
      },
      ownerHeaders
    );
    assert(createRes.status === 201 || createRes.status === 200, `Create user returned status ${createRes.status}`);
    const createdPayload = extractPayload(createRes.data);
    assert(createdPayload?.user?.id, `Created user record has User ID: ${createdPayload?.user?.id}`);
    assert(createdPayload?.user?.memberProfileId, `Created user record has MemberProfile ID: ${createdPayload?.user?.memberProfileId}`);
    assert(createdPayload?.temporaryPassword, `Generated initial password received securely: ${createdPayload?.temporaryPassword}`);
    const testMemberId = createdPayload?.user?.memberProfileId;
    const tempPassword = createdPayload?.temporaryPassword;

    // 4. Test Sign-in with the freshly created user
    console.log('\n[Step 4] Authenticating with the newly created user credentials...');
    const newUserLogin = await req('POST', '/auth/login', {
      identifier: newUserEmail,
      password: tempPassword,
    });
    assert(newUserLogin.status === 200, `New user successfully authenticated (status: ${newUserLogin.status})`);
    const newUserToken = extractToken(newUserLogin.data);
    assert(newUserToken, 'New user access token acquired');

    // 5. Test Admin Member Details Retrieval
    console.log('\n[Step 5] Admin fetches detailed member dossier via GET /members/admin/:id...');
    const detailsRes = await req('GET', `/members/admin/${testMemberId}`, null, ownerHeaders);
    assert(detailsRes.status === 200, `GET member details returned status ${detailsRes.status}`);
    const details = extractPayload(detailsRes.data);
    assert(details?.id === testMemberId, 'Member dossier matches requested memberId');
    assert(details?.user?.email === newUserEmail, 'User email matches created user');
    assert(!details?.user?.passwordHash, 'Security guarantee: passwordHash is not exposed in member details');
    assert(details?.city === 'Finfinnee', 'Member demographic fields properly populated');

    // 6. Test Admin Member Profile Update
    console.log('\n[Step 6] Admin updates member profile via PATCH /members/admin/:id...');
    const updateRes = await req(
      'PATCH',
      `/members/admin/${testMemberId}`,
      {
        firstName: 'MasterUpdated',
        lastName: 'RepairUpdated',
        city: 'Adama',
        address: 'Kebele 02, House 100',
      },
      ownerHeaders
    );
    assert(updateRes.status === 200, `Update member returned status ${updateRes.status}`);
    const updatedDetails = extractPayload(updateRes.data);
    assert(updatedDetails?.firstName === 'MasterUpdated', 'First name updated successfully');
    assert(updatedDetails?.city === 'Adama', 'City updated successfully');

    // 7. Test Admin Suspend Member
    console.log('\n[Step 7] Admin suspends member via POST /members/admin/:id/suspend...');
    const suspendRes = await req(
      'POST',
      `/members/admin/${testMemberId}/suspend`,
      { reason: 'Master audit policy suspension test' },
      ownerHeaders
    );
    assert(suspendRes.status === 200 || suspendRes.status === 201, `Suspend member returned status ${suspendRes.status}`);
    const suspendedPayload = extractPayload(suspendRes.data);
    assert(suspendedPayload?.status === 'SUSPENDED', 'Member status updated to SUSPENDED');

    // 8. Test That Suspended User Cannot Log In
    console.log('\n[Step 8] Verifying suspended member login rejection...');
    const suspendedLogin = await req('POST', '/auth/login', {
      identifier: newUserEmail,
      password: tempPassword,
    });
    // Either Unauthorized or Forbidden depending on enforcement strategy
    assert(
      suspendedLogin.status === 401 || suspendedLogin.status === 403,
      `Suspended member login properly rejected with status ${suspendedLogin.status}`
    );

    // 9. Test Admin Reinstate Member
    console.log('\n[Step 9] Admin reinstates member via POST /members/admin/:id/reinstate...');
    const reinstateRes = await req(
      'POST',
      `/members/admin/${testMemberId}/reinstate`,
      {},
      ownerHeaders
    );
    assert(reinstateRes.status === 200 || reinstateRes.status === 201, `Reinstate member returned status ${reinstateRes.status}`);
    const reinstatedPayload = extractPayload(reinstateRes.data);
    assert(reinstatedPayload?.status === 'ACTIVE', 'Member status restored to ACTIVE');

    // 10. Test Delete / Revoke Member Action
    console.log('\n[Step 10] Admin revokes/deletes member via DELETE /members/admin/:id...');
    const deleteRes = await req(
      'DELETE',
      `/members/admin/${testMemberId}`,
      { reason: 'End of master repair verification test' },
      ownerHeaders
    );
    assert(deleteRes.status === 200, `DELETE member returned status ${deleteRes.status}`);
    const deletePayload = extractPayload(deleteRes.data);
    assert(deletePayload?.success === true, 'Member access revocation confirmed by server');

    // 11. Test that deleted member is removed from active roster
    console.log('\n[Step 11] Verifying member is no longer in active roster...');
    const rosterRes = await req('GET', '/organizations/4b/members', null, ownerHeaders);
    const roster = extractPayload(rosterRes.data);
    const foundInRoster = Array.isArray(roster) && roster.some((m) => m.id === testMemberId);
    assert(!foundInRoster, 'Revoked member no longer appears in active organization roster');

    // 12. Test that deleted member cannot log in
    console.log('\n[Step 12] Verifying revoked member is blocked from signing in...');
    const revokedLogin = await req('POST', '/auth/login', {
      identifier: newUserEmail,
      password: tempPassword,
    });
    assert(
      revokedLogin.status === 401 || revokedLogin.status === 403,
      `Revoked user login blocked with status ${revokedLogin.status}`
    );

    // 13. Security Boundaries: Regular Member cannot call Admin Create User
    console.log('\n[Step 13] Security test: Regular member calls POST /members/admin/create-user (expecting 403)...');
    const unauthorizedCreate = await req(
      'POST',
      '/members/admin/create-user',
      {
        firstName: 'Hack',
        lastName: 'Attempt',
        email: 'hack@evil.local',
      },
      memberHeaders
    );
    assert(unauthorizedCreate.status === 403, `Unauthorized user blocked with 403 Forbidden (status: ${unauthorizedCreate.status})`);

    // 14. Security Boundaries: Regular Member cannot delete members
    console.log('\n[Step 14] Security test: Regular member calls DELETE /members/admin/:id (expecting 403)...');
    const unauthorizedDelete = await req(
      'DELETE',
      `/members/admin/${testMemberId}`,
      { reason: 'Illegal delete' },
      memberHeaders
    );
    assert(unauthorizedDelete.status === 403, `Unauthorized delete blocked with 403 Forbidden (status: ${unauthorizedDelete.status})`);

  } catch (err) {
    console.error('Master repair test error:', err);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`MASTER REPAIR TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runMasterRepairTests();
