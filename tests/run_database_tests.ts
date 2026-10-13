import { PrismaClient, Prisma, MemberStatus, PaymentStatus, MembershipStatus, CardStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function runTestSuite() {
  console.log('🧪 ========================================================');
  console.log('🧪 WAANOFII COMPREHENSIVE DATABASE & TENANT TEST SUITE');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, failureDetail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (failureDetail) console.error(`     Detail: ${failureDetail}`);
      failed++;
    }
  }

  try {
    // Enable platform admin context for setup/lookup
    await prisma.$executeRawUnsafe(`SET app.is_platform_admin = 'true';`);

    const org4b = await prisma.organization.findUnique({ where: { slug: '4b' } });
    const orgMed = await prisma.organization.findUnique({ where: { slug: 'ethio-med' } });

    if (!org4b || !orgMed) {
      throw new Error('Database is not seeded! Run `npx prisma db seed` before running tests.');
    }

    // -------------------------------------------------------------
    // TEST 1: Tenant Data Isolation & Filtering
    // -------------------------------------------------------------
    console.log('\n--- 1. Tenant Data Isolation ---');
    const members4B = await prisma.memberProfile.findMany({
      where: { organizationId: org4b.id },
    });
    const membersMed = await prisma.memberProfile.findMany({
      where: { organizationId: orgMed.id },
    });

    assert(members4B.length > 0, '4B Association has seeded members');
    assert(membersMed.length > 0, 'Ethio-Med has seeded members');
    assert(
      members4B.every((m) => m.organizationId === org4b.id),
      'All 4B member records strictly contain 4B organizationId'
    );
    assert(
      membersMed.every((m) => m.organizationId === orgMed.id),
      'All Ethio-Med member records strictly contain Ethio-Med organizationId'
    );

    // Cross-querying with wrong tenant ID returns empty
    const crossCheck = await prisma.memberProfile.findMany({
      where: {
        organizationId: orgMed.id,
        memberNumber: '4B-2026-00101', // 4B member number queried under Med tenant
      },
    });
    assert(crossCheck.length === 0, 'Querying 4B member number under Ethio-Med tenant returns 0 results');

    // -------------------------------------------------------------
    // TEST 2: Multi-Organization User Membership (Decoupled Identity)
    // -------------------------------------------------------------
    console.log('\n--- 2. Multi-Organization User Affiliation ---');
    const abebeUser = await prisma.user.findUnique({
      where: { email: 'abebe.member@example.com' },
      include: { memberProfiles: true },
    });

    assert(!!abebeUser, 'Abebe user exists globally');
    assert(
      abebeUser!.memberProfiles.length === 2,
      'Abebe Bikila belongs to exactly 2 distinct organizations',
      `Found ${abebeUser?.memberProfiles.length} profiles`
    );

    const orgIds = abebeUser!.memberProfiles.map((p) => p.organizationId);
    assert(
      orgIds.includes(org4b.id) && orgIds.includes(orgMed.id),
      'Abebe has separate MemberProfiles in both 4B Association and Ethiopian Medical Association'
    );

    const profile4B = abebeUser!.memberProfiles.find((p) => p.organizationId === org4b.id);
    const profileMed = abebeUser!.memberProfiles.find((p) => p.organizationId === orgMed.id);
    assert(
      profile4B?.memberNumber === '4B-2026-00101' && profileMed?.memberNumber === 'EMA-2026-8842',
      'Abebe has independent member numbers in each organization'
    );

    // -------------------------------------------------------------
    // TEST 3: Duplicate Transaction Reference Prevention (Anti-Fraud)
    // -------------------------------------------------------------
    console.log('\n--- 3. Payment Anti-Fraud & Reference Uniqueness ---');
    let duplicateRefFailed = false;
    try {
      // Attempt to insert duplicate reference code within 4B
      await prisma.payment.create({
        data: {
          organizationId: org4b.id,
          membershipId: (await prisma.membership.findFirst({ where: { organizationId: org4b.id } }))!.id,
          memberProfileId: profile4B!.id,
          amount: new Prisma.Decimal(500),
          currency: 'ETB',
          status: PaymentStatus.SUBMITTED,
          transactionReference: 'FT26274901CBE', // Duplicate of verified payment!
        },
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        duplicateRefFailed = true;
      }
    }
    assert(
      duplicateRefFailed,
      'Duplicate transactionReference within the same organization rejected by database constraint (P2002)'
    );

    // Verify same reference CAN be submitted in a different organization if required
    let crossOrgRefAllowed = false;
    let createdMedPaymentId: string | null = null;
    try {
      const medMembership = await prisma.membership.findFirst({ where: { organizationId: orgMed.id } });
      const testPayment = await prisma.payment.create({
        data: {
          organizationId: orgMed.id,
          membershipId: medMembership!.id,
          memberProfileId: profileMed!.id,
          amount: new Prisma.Decimal(2500),
          currency: 'ETB',
          status: PaymentStatus.SUBMITTED,
          transactionReference: 'FT26274901CBE', // Same reference code, DIFFERENT tenant
        },
      });
      crossOrgRefAllowed = true;
      createdMedPaymentId = testPayment.id;
    } catch (e) {
      crossOrgRefAllowed = false;
    }
    assert(
      crossOrgRefAllowed,
      'Composite unique constraint (organization_id, transaction_reference) allows independent tenant references'
    );

    if (createdMedPaymentId) {
      await prisma.payment.delete({ where: { id: createdMedPaymentId } });
    }

    // -------------------------------------------------------------
    // TEST 4: Organization-Scoped Member Number Uniqueness
    // -------------------------------------------------------------
    console.log('\n--- 4. Organization-Scoped Entity Uniqueness ---');
    let duplicateMemberNumberFailed = false;
    try {
      // Create random user to try to register with existing member number in 4B
      const tempUser = await prisma.user.create({
        data: {
          email: `temp_${Date.now()}@test.com`,
          passwordHash: 'mock',
          firstName: 'Temp',
          lastName: 'User',
        },
      });

      try {
        await prisma.memberProfile.create({
          data: {
            organizationId: org4b.id,
            userId: tempUser.id,
            memberNumber: '4B-2026-00101', // Already belongs to Abebe!
            firstName: 'Duplicate',
            lastName: 'Number',
          },
        });
      } finally {
        await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
      }
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        duplicateMemberNumberFailed = true;
      }
    }
    assert(
      duplicateMemberNumberFailed,
      'Duplicate member_number in same organization rejected by database constraint (P2002)'
    );

    // -------------------------------------------------------------
    // TEST 5: Foreign-Key Relational Integrity
    // -------------------------------------------------------------
    console.log('\n--- 5. Foreign Key Relational Integrity ---');
    let invalidOrgFkFailed = false;
    try {
      await prisma.memberProfile.create({
        data: {
          organizationId: '00000000-0000-0000-0000-000000000000', // Non-existent organization
          userId: abebeUser!.id,
          memberNumber: 'INVALID-FK-01',
          firstName: 'Test',
          lastName: 'Test',
        },
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        invalidOrgFkFailed = true;
      }
    }
    assert(
      invalidOrgFkFailed,
      'Creating record with non-existent organizationId rejected by FK constraint (P2003)'
    );

    // -------------------------------------------------------------
    // TEST 6: Digital ID Card & Verification Token Integrity
    // -------------------------------------------------------------
    console.log('\n--- 6. Digital Card & QR Verification ---');
    const validCard = await prisma.digitalMembershipCard.findFirst({
      where: {
        organizationId: org4b.id,
        status: CardStatus.ACTIVE,
        memberProfile: { firstName: 'Abebe' },
      },
      include: { verificationToken: true, memberProfile: true, membership: true },
    });

    assert(!!validCard, 'Active digital card found for 4B member');
    assert(!!validCard?.verificationToken, 'Verification token exists for active card');
    assert(
      validCard?.verificationToken?.isRevoked === false,
      'Active card verification token is not revoked'
    );

    // Server-side authoritative lookup simulation
    const scannedToken = validCard!.verificationToken!.token;
    const lookupResult = await prisma.verificationToken.findUnique({
      where: { token: scannedToken },
      include: {
        card: {
          include: {
            memberProfile: true,
            membership: true,
            organization: true,
          },
        },
      },
    });

    assert(!!lookupResult, 'Server lookup by QR token succeeds');
    assert(lookupResult?.card.status === CardStatus.ACTIVE, 'Server confirms card is ACTIVE');
    assert(lookupResult?.card.memberProfile.firstName === 'Abebe', 'Server confirms correct member identity');

    // Revoked card verification test
    const suspendedCard = await prisma.digitalMembershipCard.findFirst({
      where: { organizationId: org4b.id, status: CardStatus.REVOKED },
      include: { verificationToken: true },
    });
    assert(!!suspendedCard, 'Revoked digital card found for suspended member (Chala)');
    assert(suspendedCard?.verificationToken?.isRevoked === true, 'Revoked card token has isRevoked = true');

    // -------------------------------------------------------------
    // TEST 7: Staff Role Isolation
    // -------------------------------------------------------------
    console.log('\n--- 7. Staff Role Isolation ---');
    const kebedeStaff = await prisma.staffMembership.findFirst({
      where: { user: { email: 'kebede.admin@4bassociation.org' } },
      include: { organization: true, role: true },
    });

    assert(!!kebedeStaff, 'Kebede exists as staff member');
    assert(kebedeStaff?.organizationId === org4b.id, 'Kebede is staff in 4B Association');

    const kebedeInMed = await prisma.staffMembership.findFirst({
      where: {
        user: { email: 'kebede.admin@4bassociation.org' },
        organizationId: orgMed.id,
      },
    });
    assert(kebedeInMed === null, '4B Admin has NO staff membership in Ethiopian Medical Association');

    // -------------------------------------------------------------
    // TEST 8: Immutable Audit Logging
    // -------------------------------------------------------------
    console.log('\n--- 8. Audit Logging & Compliance ---');
    const auditEntry = await prisma.auditLog.create({
      data: {
        organizationId: org4b.id,
        actorUserId: kebedeStaff!.userId,
        action: 'TEST_MEMBERSHIP_REVIEW',
        entityType: 'Membership',
        entityId: validCard!.membershipId,
        beforeDiff: { status: 'PAYMENT_SUBMITTED' },
        afterDiff: { status: 'ACTIVE' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 TestSuite',
      },
    });

    assert(!!auditEntry.id, 'Audit log entry created successfully');
    assert(auditEntry.organizationId === org4b.id, 'Audit log correctly scoped to 4B organization');

    // -------------------------------------------------------------
    // TEST 9: PostgreSQL Row-Level Security (RLS) Kernel Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 9. PostgreSQL Row-Level Security (RLS) ---');

    // Case 9a: When context is set to 4B, raw SQL query ONLY returns 4B members
    const rls4BResults = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'false';`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${org4b.id}';`);
      return await tx.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int as count FROM member_profiles;`);
    });

    const count4B = rls4BResults[0].count;
    assert(count4B === members4B.length, `RLS filtered member_profiles to exactly 4B members (count: ${count4B})`);

    // Case 9b: When context is set to Ethio-Med, raw SQL query ONLY returns Ethio-Med members
    const rlsMedResults = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'false';`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${orgMed.id}';`);
      return await tx.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int as count FROM member_profiles;`);
    });

    const countMed = rlsMedResults[0].count;
    assert(countMed === membersMed.length, `RLS filtered member_profiles to exactly Ethio-Med members (count: ${countMed})`);

    // Case 9c: When NO tenant context is set, RLS yields 0 rows (zero leakage!)
    const rlsNoTenantResults = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'false';`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '';`);
      return await tx.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int as count FROM member_profiles;`);
    });

    const countNoTenant = rlsNoTenantResults[0].count;
    assert(countNoTenant === 0, `RLS with unauthenticated/empty context yields 0 rows (Zero Cross-Tenant Leakage)`);

    // Case 9d: Attempted GUC bypass attack: An ordinary app connection sets app.is_platform_admin = 'true'
    // Under hardened RLS, this GUC parameter is IGNORED because waanofii_app lacks waanofii_platform_admin role membership.
    const rlsBypassAttemptResults = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'true';`); // Malicious attempt to self-promote
      return await tx.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int as count FROM member_profiles;`);
    });
    assert(
      rlsBypassAttemptResults[0].count === 0,
      `VULNERABILITY MITIGATED: Malicious SET LOCAL app.is_platform_admin = 'true' is completely ignored (returned 0 rows)`
    );

    // Case 9e: Legitimate Platform Admin using trusted role boundary:
    const rlsSuperAdminResults = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_platform_admin;`);
      return await tx.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int as count FROM member_profiles;`);
    });

    const totalCount = rlsSuperAdminResults[0].count;
    assert(
      totalCount === members4B.length + membersMed.length,
      `Trusted Platform Admin role (waanofii_platform_admin) can query platform-wide aggregate (count: ${totalCount})`
    );

    // -------------------------------------------------------------
    // TEST 10: Cross-Tenant Mutation Prevention via RLS (INSERT, UPDATE, DELETE)
    // -------------------------------------------------------------
    console.log('\n--- 10. Cross-Tenant Mutation Prevention (RLS WITH CHECK) ---');
    
    // 10a: Cross-tenant INSERT prevention
    let crossInsertBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${org4b.id}';`);
        // Attempt to insert member profile belonging to Ethio-Med while in 4B context
        await tx.$executeRawUnsafe(`
          INSERT INTO member_profiles (id, organization_id, user_id, member_number, first_name, last_name, status, updated_at)
          VALUES (gen_random_uuid(), '${orgMed.id}', '${abebeUser!.id}', 'ILLEGAL-INSERT', 'Hacker', 'CrossTenant', 'PENDING_APPROVAL', now());
        `);
      });
    } catch (e: any) {
      crossInsertBlocked = true;
    }
    assert(crossInsertBlocked, 'Cross-tenant INSERT blocked by PostgreSQL RLS WITH CHECK policy');

    // 10b: Cross-tenant UPDATE prevention (updates 0 rows)
    const updateResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${org4b.id}';`);
      // Attempt to update Ethio-Med member while in 4B context
      const affected = await tx.$executeRawUnsafe(`
        UPDATE member_profiles SET first_name = 'Tampered' WHERE organization_id = '${orgMed.id}';
      `);
      return affected;
    });
    assert(updateResult === 0, 'Cross-tenant UPDATE affected 0 rows (isolated by RLS)');

    // 10c: Cross-tenant DELETE prevention (deletes 0 rows)
    const deleteResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE waanofii_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${org4b.id}';`);
      // Attempt to delete Ethio-Med member while in 4B context
      const affected = await tx.$executeRawUnsafe(`
        DELETE FROM member_profiles WHERE organization_id = '${orgMed.id}';
      `);
      return affected;
    });
    assert(deleteResult === 0, 'Cross-tenant DELETE affected 0 rows (isolated by RLS)');

    // -------------------------------------------------------------
    // TEST 11: User Authentication Identifier Check Constraint
    // -------------------------------------------------------------
    console.log('\n--- 11. User Authentication Identifier Integrity ---');
    let userWithoutIdentifierBlocked = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO users (id, email, phone_number, password_hash, first_name, last_name, updated_at)
        VALUES (gen_random_uuid(), NULL, NULL, 'hash', 'NoAuth', 'User', now());
      `);
    } catch (e: any) {
      userWithoutIdentifierBlocked = true;
    }
    assert(
      userWithoutIdentifierBlocked,
      'User with neither email nor phone number rejected by CHECK constraint (check_user_has_auth_identifier)'
    );

    // -------------------------------------------------------------
    // TEST 12: Case-Insensitive Email Uniqueness
    // -------------------------------------------------------------
    console.log('\n--- 12. Case-Insensitive Email Security ---');
    let duplicateCaseEmailBlocked = false;
    try {
      await prisma.user.create({
        data: {
          email: 'ABEBE.MEMBER@EXAMPLE.COM', // Uppercase variation of abebe.member@example.com
          passwordHash: 'mock',
          firstName: 'Duplicate',
          lastName: 'Casing',
        },
      });
    } catch (e: any) {
      duplicateCaseEmailBlocked = true;
    }
    assert(
      duplicateCaseEmailBlocked,
      'Mixed-case email duplicate rejected by case-insensitive unique index (users_email_lower_unique)'
    );

    // -------------------------------------------------------------
    // TEST 13: Positive Payment Amount Check Constraint
    // -------------------------------------------------------------
    console.log('\n--- 13. Financial Amount Validation ---');
    let negativePaymentBlocked = false;
    try {
      await prisma.payment.create({
        data: {
          organizationId: org4b.id,
          membershipId: (await prisma.membership.findFirst({ where: { organizationId: org4b.id } }))!.id,
          memberProfileId: profile4B!.id,
          amount: new Prisma.Decimal(-100), // Negative amount!
          currency: 'ETB',
          status: PaymentStatus.PENDING,
          transactionReference: `NEG_REF_${Date.now()}`,
        },
      });
    } catch (e: any) {
      negativePaymentBlocked = true;
    }
    assert(
      negativePaymentBlocked,
      'Payment with negative or zero amount rejected by CHECK constraint (check_payment_amount_positive)'
    );

    // -------------------------------------------------------------
    // TEST 14: Payment Proof File URL Reuse Prevention
    // -------------------------------------------------------------
    console.log('\n--- 14. Payment Proof Anti-Reuse Uniqueness ---');
    let duplicateProofBlocked = false;
    const existingProof = await prisma.paymentProof.findFirst({ where: { organizationId: org4b.id } });
    if (existingProof) {
      try {
        await prisma.paymentProof.create({
          data: {
            organizationId: org4b.id,
            paymentId: existingProof.paymentId,
            fileUrl: existingProof.fileUrl, // Reusing existing receipt image URL!
            fileType: 'image/jpeg',
            fileSize: 1000,
          },
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          duplicateProofBlocked = true;
        }
      }
    }
    assert(
      duplicateProofBlocked,
      'Reusing payment proof fileUrl in same organization rejected by unique constraint (P2002)'
    );

    // -------------------------------------------------------------
    // TEST 15: Duplicate Payment Gateway Provider Transaction ID Prevention
    // -------------------------------------------------------------
    console.log('\n--- 15. Gateway Provider TxID Idempotency ---');
    let duplicateProviderTxBlocked = false;
    const paymentRecord = await prisma.payment.findFirst({ where: { organizationId: org4b.id } });
    if (paymentRecord) {
      const tx1 = await prisma.paymentTransaction.create({
        data: {
          organizationId: org4b.id,
          paymentId: paymentRecord.id,
          provider: 'TELEBIRR',
          providerTxId: 'TB_GW_TX_998877',
          providerStatus: 'SUCCESS',
        },
      });

      try {
        await prisma.paymentTransaction.create({
          data: {
            organizationId: org4b.id,
            paymentId: paymentRecord.id,
            provider: 'TELEBIRR',
            providerTxId: 'TB_GW_TX_998877', // Same provider + providerTxId!
            providerStatus: 'DUPLICATE',
          },
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          duplicateProviderTxBlocked = true;
        }
      } finally {
        await prisma.paymentTransaction.delete({ where: { id: tx1.id } }).catch(() => {});
      }
    }
    assert(
      duplicateProviderTxBlocked,
      'Duplicate provider transaction ID for same provider rejected by unique constraint (P2002)'
    );

    console.log('\n========================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test suite crashed with unhandled exception:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite();
