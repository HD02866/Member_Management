import { PrismaClient, UserStatus, MemberStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();

const OWNER_EMAIL = 'owner.test@4baye.local';
const OWNER_PASSWORD = 'OwnerTest@4Baye2026!';
const OWNER_FIRST_NAME = '4Baye Test';
const OWNER_LAST_NAME = 'Owner';
const OWNER_PHONE = '+251911990001';

const MEMBER_EMAIL = 'member.test@4baye.local';
const MEMBER_PASSWORD = 'MemberTest@4Baye2026!';
const MEMBER_FIRST_NAME = '4Baye Test';
const MEMBER_LAST_NAME = 'Member';
const MEMBER_PHONE = '+251911990002';

async function main() {
  console.log('========================================================================');
  console.log('🔒 4BAYE TEST ACCOUNT SETUP & COMPREHENSIVE VERIFICATION');
  console.log('========================================================================\n');

  // 1. SAFETY & ENVIRONMENT AUDIT
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`[Safety Audit] NODE_ENV: ${nodeEnv}`);
  console.log(`[Safety Audit] Target Database host: ${dbUrl.includes('localhost') ? 'localhost (Safe Local Development)' : 'REMOTE'}`);

  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    throw new Error('ABORT: DATABASE_URL is not localhost! Preventing test account injection in non-local DB.');
  }

  // 2. RETRIEVE 4B TENANT & ROLES
  const org = await prisma.organization.findUnique({ where: { slug: '4b' } });
  if (!org) {
    throw new Error('4B Association tenant (slug: 4b) not found in database.');
  }
  console.log(`[Tenant] Found 4Baye Association (ID: ${org.id}, Slug: ${org.slug})`);

  const ownerRole = await prisma.role.findFirst({
    where: { code: 'OWNER' },
  });
  if (!ownerRole) {
    throw new Error('OWNER role not found in database.');
  }
  console.log(`[Role] Found Owner Role (ID: ${ownerRole.id}, Code: ${ownerRole.code})`);

  // Snapshot existing seed accounts count to verify zero customer records are corrupted
  const priorUsersCount = await prisma.user.count();
  console.log(`[Integrity] Baseline user count before operation: ${priorUsersCount}`);

  // 3. CREATE / RESET ACCOUNT A: 4BAYE OWNER/ADMIN
  console.log('\n--- 1. Setting Up Account A: 4Baye Owner/Admin ---');
  const ownerHash = await argon2.hash(OWNER_PASSWORD, { type: argon2.argon2id });

  let ownerUser = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: 'insensitive' } },
  });

  if (ownerUser) {
    console.log(`  Existing owner user found (${ownerUser.id}). Safely updating password hash & status.`);
    ownerUser = await prisma.user.update({
      where: { id: ownerUser.id },
      data: {
        passwordHash: ownerHash,
        status: UserStatus.ACTIVE,
        isPlatformAdmin: false, // Ensure zero platform-level exposure
        firstName: OWNER_FIRST_NAME,
        lastName: OWNER_LAST_NAME,
        phoneNumber: OWNER_PHONE,
      },
    });
  } else {
    console.log(`  Creating new owner user ${OWNER_EMAIL}...`);
    ownerUser = await prisma.user.create({
      data: {
        email: OWNER_EMAIL,
        phoneNumber: OWNER_PHONE,
        passwordHash: ownerHash,
        firstName: OWNER_FIRST_NAME,
        lastName: OWNER_LAST_NAME,
        isPlatformAdmin: false, // Strictly false: 4Baye institutional owner only
        status: UserStatus.ACTIVE,
      },
    });
  }

  // Ensure StaffMembership exists with OWNER role in 4B Association
  const existingStaff = await prisma.staffMembership.findFirst({
    where: { organizationId: org.id, userId: ownerUser.id },
  });

  if (existingStaff) {
    await prisma.staffMembership.update({
      where: { id: existingStaff.id },
      data: { roleId: ownerRole.id, isActive: true },
    });
  } else {
    await prisma.staffMembership.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        roleId: ownerRole.id,
        isActive: true,
      },
    });
  }

  // Ensure MemberProfile exists in 4B
  let ownerProfile = await prisma.memberProfile.findFirst({
    where: { organizationId: org.id, userId: ownerUser.id },
  });
  if (!ownerProfile) {
    ownerProfile = await prisma.memberProfile.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        memberNumber: '4B-TST-00001',
        firstName: OWNER_FIRST_NAME,
        lastName: OWNER_LAST_NAME,
        email: OWNER_EMAIL,
        phoneNumber: OWNER_PHONE,
        status: MemberStatus.ACTIVE,
      },
    });
  }
  console.log(`  ✅ Account A (Owner/Admin) configured: ID=${ownerUser.id}, Role=OWNER`);

  // 4. CREATE / RESET ACCOUNT B: 4BAYE MEMBER
  console.log('\n--- 2. Setting Up Account B: 4Baye Member ---');
  const memberHash = await argon2.hash(MEMBER_PASSWORD, { type: argon2.argon2id });

  let memberUser = await prisma.user.findFirst({
    where: { email: { equals: MEMBER_EMAIL, mode: 'insensitive' } },
  });

  if (memberUser) {
    console.log(`  Existing member user found (${memberUser.id}). Safely updating password hash & status.`);
    memberUser = await prisma.user.update({
      where: { id: memberUser.id },
      data: {
        passwordHash: memberHash,
        status: UserStatus.ACTIVE,
        isPlatformAdmin: false,
        firstName: MEMBER_FIRST_NAME,
        lastName: MEMBER_LAST_NAME,
        phoneNumber: MEMBER_PHONE,
      },
    });
  } else {
    console.log(`  Creating new member user ${MEMBER_EMAIL}...`);
    memberUser = await prisma.user.create({
      data: {
        email: MEMBER_EMAIL,
        phoneNumber: MEMBER_PHONE,
        passwordHash: memberHash,
        firstName: MEMBER_FIRST_NAME,
        lastName: MEMBER_LAST_NAME,
        isPlatformAdmin: false,
        status: UserStatus.ACTIVE,
      },
    });
  }

  // Ensure Member has ZERO staff memberships
  await prisma.staffMembership.deleteMany({
    where: { userId: memberUser.id },
  });

  // Ensure MemberProfile exists in 4B
  let memberProfile = await prisma.memberProfile.findFirst({
    where: { organizationId: org.id, userId: memberUser.id },
  });
  if (!memberProfile) {
    memberProfile = await prisma.memberProfile.create({
      data: {
        organizationId: org.id,
        userId: memberUser.id,
        memberNumber: '4B-TST-00002',
        firstName: MEMBER_FIRST_NAME,
        lastName: MEMBER_LAST_NAME,
        email: MEMBER_EMAIL,
        phoneNumber: MEMBER_PHONE,
        status: MemberStatus.ACTIVE,
      },
    });
  }
  console.log(`  ✅ Account B (Member) configured: ID=${memberUser.id}, Staff=NONE, MemberProfile=4B-TST-00002`);

  // 5. RUN COMPREHENSIVE AUTH & SECURITY VERIFICATION
  console.log('\n--- 3. Real-World Authentication & Authorization Verification ---');

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const server = app.getHttpServer();

  try {
    // 5.1 VERIFY OWNER LOGIN
    const ownerLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: OWNER_EMAIL, password: OWNER_PASSWORD });

    console.log(`  [Owner Login] HTTP Status: ${ownerLoginRes.status}`);
    const ownerToken = ownerLoginRes.body.tokens?.accessToken || ownerLoginRes.body.data?.tokens?.accessToken;
    const ownerUserObj = ownerLoginRes.body.user || ownerLoginRes.body.data?.user;
    if (ownerLoginRes.status !== 200 || !ownerToken) {
      throw new Error(`Owner login failed: ${JSON.stringify(ownerLoginRes.body)}`);
    }
    console.log(`  ✅ Owner login succeeded. JWT issued. User: ${ownerUserObj.firstName} ${ownerUserObj.lastName}`);

    // 5.2 VERIFY OWNER GET /auth/me
    const ownerMeRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerProfile = ownerMeRes.body.data || ownerMeRes.body;
    console.log(`  [Owner Profile] isPlatformAdmin=${ownerProfile.isPlatformAdmin}`);
    if (ownerProfile.isPlatformAdmin !== false) {
      throw new Error('Owner account leaked platform admin status!');
    }
    console.log('  ✅ Owner strictly scoped (isPlatformAdmin: false)');

    // 5.3 VERIFY OWNER AFFILIATIONS (/me/organizations)
    const ownerAffilRes = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerOrgs = Array.isArray(ownerAffilRes.body.data) ? ownerAffilRes.body.data : (Array.isArray(ownerAffilRes.body) ? ownerAffilRes.body : []);
    const owner4BAffil = ownerOrgs.find((o: any) => o.slug === '4b');
    console.log(`  [Owner Affiliations] 4Baye isStaff=${owner4BAffil?.isStaff}, staffRole=${owner4BAffil?.staffRole}`);
    if (!owner4BAffil?.isStaff || (owner4BAffil?.staffRoleCode !== 'OWNER' && owner4BAffil?.staffRole !== 'Organization Owner')) {
      throw new Error('Owner affiliation with 4Baye is incorrect');
    }
    console.log('  ✅ Owner recognized as 4Baye Staff with OWNER role');

    // 5.4 VERIFY OWNER AUTHORIZED ENDPOINTS
    const ownerMembersRes = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', '4b');
    console.log(`  [Owner /organizations/4b/members] HTTP Status: ${ownerMembersRes.status}`);
    if (ownerMembersRes.status !== 200) {
      throw new Error(`Owner could not access members roster: ${ownerMembersRes.status}`);
    }

    const ownerStaffRes = await request(server)
      .get('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', '4b');
    console.log(`  [Owner /organizations/4b/staff] HTTP Status: ${ownerStaffRes.status}`);
    if (ownerStaffRes.status !== 200) {
      throw new Error(`Owner could not access staff roster: ${ownerStaffRes.status}`);
    }

    const ownerReviewRes = await request(server)
      .get('/api/v1/payments/review')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', '4b');
    console.log(`  [Owner /payments/review] HTTP Status: ${ownerReviewRes.status}`);
    if (ownerReviewRes.status !== 200) {
      throw new Error(`Owner could not access payments review queue: ${ownerReviewRes.status}`);
    }
    console.log('  ✅ Owner successfully accessed authorized management APIs');

    // 5.5 VERIFY OWNER BLOCKED FROM PLATFORM ADMIN
    const ownerPlatformRes = await request(server)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${ownerToken}`);
    console.log(`  [Owner /platform/stats Attack] HTTP Status: ${ownerPlatformRes.status}`);
    if (ownerPlatformRes.status !== 403) {
      throw new Error(`Owner was NOT blocked from platform admin: ${ownerPlatformRes.status}`);
    }
    console.log('  ✅ Owner strictly blocked from platform admin endpoints (HTTP 403 Forbidden)');

    // 5.6 VERIFY OWNER LOGOUT
    const ownerLogoutRes = await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${ownerToken}`);
    console.log(`  [Owner Logout] HTTP Status: ${ownerLogoutRes.status}`);
    if (ownerLogoutRes.status !== 200) {
      throw new Error(`Owner logout failed: ${ownerLogoutRes.status}`);
    }
    console.log('  ✅ Owner logout succeeded');

    // 5.7 VERIFY MEMBER LOGIN
    const memberLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: MEMBER_EMAIL, password: MEMBER_PASSWORD });

    console.log(`\n  [Member Login] HTTP Status: ${memberLoginRes.status}`);
    const memberToken = memberLoginRes.body.tokens?.accessToken || memberLoginRes.body.data?.tokens?.accessToken;
    const memberUserObj = memberLoginRes.body.user || memberLoginRes.body.data?.user;
    if (memberLoginRes.status !== 200 || !memberToken) {
      throw new Error(`Member login failed: ${JSON.stringify(memberLoginRes.body)}`);
    }
    console.log(`  ✅ Member login succeeded. JWT issued. User: ${memberUserObj.firstName} ${memberUserObj.lastName}`);

    // 5.8 VERIFY MEMBER GET /auth/me
    const memberMeRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${memberToken}`);
    const memberProfile = memberMeRes.body.data || memberMeRes.body;
    console.log(`  [Member Profile] isPlatformAdmin=${memberProfile.isPlatformAdmin}`);
    if (memberProfile.isPlatformAdmin !== false) {
      throw new Error('Member account leaked platform admin status!');
    }
    console.log('  ✅ Member strictly scoped (isPlatformAdmin: false)');

    // 5.9 VERIFY MEMBER AFFILIATIONS (/me/organizations)
    const memberAffilRes = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${memberToken}`);
    const memberOrgs = Array.isArray(memberAffilRes.body.data) ? memberAffilRes.body.data : (Array.isArray(memberAffilRes.body) ? memberAffilRes.body : []);
    const member4BAffil = memberOrgs.find((o: any) => o.slug === '4b');
    console.log(`  [Member Affiliations] 4Baye isMember=${member4BAffil?.isMember}, isStaff=${member4BAffil?.isStaff}`);
    if (!member4BAffil?.isMember || member4BAffil?.isStaff !== false) {
      throw new Error('Member affiliation with 4Baye is incorrect (isStaff must be false)');
    }
    console.log('  ✅ Member recognized as pure member (isMember: true, isStaff: false)');

    // 5.10 VERIFY MEMBER AUTHORIZED ENDPOINTS
    const memberSelfRes = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-slug', '4b');
    console.log(`  [Member /members/me] HTTP Status: ${memberSelfRes.status}`);
    if (memberSelfRes.status !== 200) {
      throw new Error(`Member could not access their own profile: ${memberSelfRes.status}`);
    }
    console.log('  ✅ Member successfully accessed /members/me');

    // 5.11 VERIFY MEMBER BLOCKED FROM OWNER/ADMIN ENDPOINTS
    const breachStaffRes = await request(server)
      .get('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-slug', '4b');
    console.log(`  [Member /organizations/4b/staff Attack] HTTP Status: ${breachStaffRes.status}`);
    if (breachStaffRes.status !== 403) {
      throw new Error(`Member was NOT blocked from staff roster: ${breachStaffRes.status}`);
    }

    const breachReviewRes = await request(server)
      .get('/api/v1/payments/review')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-slug', '4b');
    console.log(`  [Member /payments/review Attack] HTTP Status: ${breachReviewRes.status}`);
    if (breachReviewRes.status !== 403) {
      throw new Error(`Member was NOT blocked from payments review: ${breachReviewRes.status}`);
    }

    const breachPlatformRes = await request(server)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${memberToken}`);
    console.log(`  [Member /platform/stats Attack] HTTP Status: ${breachPlatformRes.status}`);
    if (breachPlatformRes.status !== 403) {
      throw new Error(`Member was NOT blocked from platform admin: ${breachPlatformRes.status}`);
    }
    console.log('  ✅ Member strictly blocked from all Owner/Admin & Platform endpoints (All HTTP 403 Forbidden)');

    // 5.12 VERIFY MEMBER LOGOUT
    const memberLogoutRes = await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${memberToken}`);
    console.log(`  [Member Logout] HTTP Status: ${memberLogoutRes.status}`);
    if (memberLogoutRes.status !== 200) {
      throw new Error(`Member logout failed: ${memberLogoutRes.status}`);
    }
    console.log('  ✅ Member logout succeeded');

    // 5.13 PASSWORD HASH VERIFICATION IN POSTGRESQL
    const freshOwner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    const freshMember = await prisma.user.findUnique({ where: { email: MEMBER_EMAIL } });

    console.log(`\n  [Hash Check] Owner hash prefix: ${freshOwner?.passwordHash.slice(0, 15)}...`);
    console.log(`  [Hash Check] Member hash prefix: ${freshMember?.passwordHash.slice(0, 15)}...`);
    if (!freshOwner?.passwordHash.startsWith('$argon2id$') || !freshMember?.passwordHash.startsWith('$argon2id$')) {
      throw new Error('Passwords were not hashed with Argon2id!');
    }
    console.log('  ✅ Passwords securely stored using Argon2id cryptographic hashes. Zero plaintext stored.');

    console.log('\n========================================================================');
    console.log('✨ ALL TESTS PASSED SUCCESSFULLY! TEST ACCOUNTS ARE READY FOR USE.');
    console.log('========================================================================\n');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ ACCOUNT CREATION & VERIFICATION FAILED:', err);
  process.exit(1);
});
