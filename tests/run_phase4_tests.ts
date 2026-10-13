import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/database/prisma.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runPhase4Tests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII PHASE 4 BACKEND & SECURITY INTEGRATION TESTS');
  console.log('🧪 ========================================================\n');

  // 1. Bootstrap NestJS Testing Application
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.use(cookieParser('test_cookie_secret_key_waanofii_2026'));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  const server = app.getHttpServer();
  const prisma = app.get(PrismaService);

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate Test Actors
    // -------------------------------------------------------------
    // Platform Super Admin
    const adminLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'admin@waanofii.com',
        password: 'Password123!',
      });
    assert(adminLoginRes.status === 200, 'Platform Super Admin login succeeds (HTTP 200)');
    const platformAdminToken = adminLoginRes.body.data.tokens.accessToken;

    // Tenant A Member & Tenant B Member (Abebe Bikila)
    const abebeLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'abebe.member@example.com',
        password: 'Password123!',
      });
    assert(abebeLoginRes.status === 200, 'Multi-tenant member Abebe login succeeds (HTTP 200)');
    const abebeToken = abebeLoginRes.body.data.tokens.accessToken;

    // Tenant A Admin only (Kebede Tadesse - 4B only)
    const kebedeLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'kebede.admin@4bassociation.org',
        password: 'Password123!',
      });
    assert(kebedeLoginRes.status === 200, '4B Admin Kebede login succeeds (HTTP 200)');
    const kebedeToken = kebedeLoginRes.body.data.tokens.accessToken;

    // Resolve 4B (Tenant A) and Ethio-Med (Tenant B) IDs
    const org4BRes = await request(server).get('/api/v1/organizations/4b');
    const orgMedRes = await request(server).get('/api/v1/organizations/ethio-med');
    assert(org4BRes.status === 200, '4B organization resolved');
    assert(orgMedRes.status === 200, 'Ethio-Med organization resolved');

    const org4BId = org4BRes.body.data.id;
    const orgMedId = orgMedRes.body.data.id;

    // -------------------------------------------------------------
    // SUITE 1: Organization Onboarding Foundation & Slug Rules
    // -------------------------------------------------------------
    console.log('\n--- 1. Organization Onboarding Foundation & Slug Rules ---');
    const timestamp = Date.now();
    const newOrgSlug = `new-org-${timestamp}`;

    // 1.1 Non-platform admin attempt to onboard rejected with HTTP 403
    const nonAdminOnboardRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${abebeToken}`)
      .send({
        name: 'Unauthorized Org',
        slug: `unauth-${timestamp}`,
        contactEmail: `unauth_${timestamp}@example.com`,
      });
    assert(
      nonAdminOnboardRes.status === 403,
      'Non-platform admin attempting organization onboarding rejected with HTTP 403 Forbidden',
    );

    // 1.1b Tenant Admin attempt to onboard rejected with HTTP 403
    const tenantAdminOnboardRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .send({
        name: 'Tenant Admin Malicious Org',
        slug: `tenant-admin-${timestamp}`,
        contactEmail: `kebede_${timestamp}@example.com`,
      });
    assert(
      tenantAdminOnboardRes.status === 403,
      'Tenant Admin attempting organization onboarding rejected with HTTP 403 Forbidden',
    );

    // 1.2 Unauthenticated attempt to onboard rejected with HTTP 401
    const unauthOnboardRes = await request(server)
      .post('/api/v1/organizations')
      .send({
        name: 'Anonymous Org',
        slug: `anon-${timestamp}`,
        contactEmail: `anon_${timestamp}@example.com`,
      });
    assert(
      unauthOnboardRes.status === 401,
      'Unauthenticated onboarding attempt rejected with HTTP 401 Unauthorized',
    );

    // 1.3 Reserved slug rejection
    const reservedSlugRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Reserved Admin Org',
        slug: 'admin',
        contactEmail: 'admin@reserved.example.com',
      });
    assert(
      reservedSlugRes.status === 400,
      'Reserved platform slug "admin" rejected with HTTP 400 Bad Request',
    );

    const reservedAppRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Reserved App Org',
        slug: 'app',
        contactEmail: 'app@reserved.example.com',
      });
    assert(
      reservedAppRes.status === 400,
      'Reserved platform slug "app" rejected with HTTP 400 Bad Request',
    );

    // 1.4 Invalid slug format (uppercase, spaces) rejection
    const invalidSlugRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Invalid Slug Org',
        slug: 'INVALID SLUG',
        contactEmail: 'invalid@example.com',
      });
    assert(
      invalidSlugRes.status === 400,
      'Malformed slug with spaces/uppercase rejected with HTTP 400 Bad Request',
    );

    // 1.5 Legitimate platform admin organization onboarding
    const validOnboardRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: `Test Association ${timestamp}`,
        slug: newOrgSlug,
        contactEmail: `contact_${timestamp}@example.com`,
        contactPhone: '+251911009988',
        address: 'Bole Road, Addis Ababa',
        currency: 'ETB',
        defaultLanguage: 'en',
        profile: {
          mission: 'Empowering community through digital governance',
          vision: 'A connected and verified community',
          purpose: 'Non-profit community welfare',
        },
      });
    assert(
      validOnboardRes.status === 201,
      'Platform Admin successfully creates new organization with HTTP 201 Created',
    );
    assert(
      validOnboardRes.body.data.slug === newOrgSlug,
      'Created organization has correct validated slug',
    );
    assert(
      validOnboardRes.body.data.profile !== undefined,
      'Created organization includes initialized organization profile',
    );
    const createdOrgId = validOnboardRes.body.data.id;

    // 1.6 Duplicate slug rejection (HTTP 409 Conflict)
    const duplicateSlugRes = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Duplicate Slug Org',
        slug: newOrgSlug,
        contactEmail: `another_${timestamp}@example.com`,
      });
    assert(
      duplicateSlugRes.status === 409,
      'Duplicate organization slug rejected with HTTP 409 Conflict',
    );

    // 1.7 Audit log verified for organization creation
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        organizationId: createdOrgId,
        action: 'ORGANIZATION_CREATE',
      },
    });
    assert(auditRecord !== null, 'Immutable audit log recorded for organization onboarding');
    assert(
      auditRecord?.entityType === 'Organization',
      'Audit log entityType is Organization',
    );

    // -------------------------------------------------------------
    // SUITE 2: Enriched Public Organization Experience & Isolation
    // -------------------------------------------------------------
    console.log('\n--- 2. Enriched Public Organization Details ---');
    const publicOrgRes = await request(server).get(`/api/v1/organizations/${newOrgSlug}`);
    assert(publicOrgRes.status === 200, 'Public organization lookup by slug returns HTTP 200');
    assert(
      publicOrgRes.body.data.name === `Test Association ${timestamp}`,
      'Public details contain organization name',
    );
    assert(
      Array.isArray(publicOrgRes.body.data.programs),
      'Public details include programs array',
    );
    assert(
      Array.isArray(publicOrgRes.body.data.benefits),
      'Public details include benefits array',
    );
    assert(
      Array.isArray(publicOrgRes.body.data.membershipPlans),
      'Public details include membership plans array',
    );
    assert(
      !('passwordHash' in publicOrgRes.body.data) &&
        !('auditLogs' in publicOrgRes.body.data),
      'Public response strictly excludes private credentials and audit logs',
    );

    // Non-existent organization lookup
    const notFoundOrgRes = await request(server).get('/api/v1/organizations/nonexistent-org-slug');
    assert(notFoundOrgRes.status === 404, 'Unknown organization slug returns HTTP 404 Not Found');

    // -------------------------------------------------------------
    // SUITE 3: User Organizations & Switcher API (/me & /me/organizations)
    // -------------------------------------------------------------
    console.log('\n--- 3. User Organizations & Switcher API ---');
    const myOrgsUnauthRes = await request(server).get('/api/v1/me/organizations');
    assert(myOrgsUnauthRes.status === 401, 'Unauthenticated GET /me/organizations rejected with HTTP 401');

    const abebeOrgsRes = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${abebeToken}`);
    assert(abebeOrgsRes.status === 200, 'GET /me/organizations returns HTTP 200 for authenticated user');
    assert(
      Array.isArray(abebeOrgsRes.body.data),
      'Returns array of affiliated organizations',
    );
    assert(
      abebeOrgsRes.body.data.length === 2,
      'Multi-tenant user Abebe Bikila has exactly 2 affiliated organizations (4B and Ethio-Med)',
    );

    const kebedeOrgsRes = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${kebedeToken}`);
    assert(
      kebedeOrgsRes.body.data.length === 1 && kebedeOrgsRes.body.data[0].slug === '4b',
      'Kebede correctly shows affiliation strictly with 4B Association',
    );

    // -------------------------------------------------------------
    // SUITE 4: Member Profile Management Under RLS (/members/me)
    // -------------------------------------------------------------
    console.log('\n--- 4. Member Profile Management Under RLS ---');
    // 4.1 Abebe reads his 4B member profile
    const abebe4BProfileRes = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4BId);
    assert(abebe4BProfileRes.status === 200, 'Member can retrieve profile in affiliated tenant (4B)');
    assert(
      abebe4BProfileRes.body.data.organizationId === org4BId,
      'Retrieved profile belongs strictly to active tenant (4B)',
    );

    // 4.2 Abebe updates allowed profile fields in 4B
    const updateProfileRes = await request(server)
      .patch('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        city: 'Hawassa',
        address: 'Piazza Street',
      });
    assert(updateProfileRes.status === 200, 'PATCH /members/me updates allowed fields with HTTP 200');
    assert(updateProfileRes.body.data.city === 'Hawassa', 'City successfully updated');

    // 4.3 Attempting to modify protected server-controlled fields (organizationId, status, memberNumber)
    const hackStatusRes = await request(server)
      .patch('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        status: 'ACTIVE', // Protected field
      });
    assert(
      hackStatusRes.status === 400,
      'Attempt to mutate protected member field "status" rejected with HTTP 400 Bad Request',
    );

    const hackOrgIdRes = await request(server)
      .patch('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        organizationId: orgMedId, // Attempt to move profile to another tenant
      });
    assert(
      hackOrgIdRes.status === 400,
      'Attempt to mutate protected member field "organizationId" rejected with HTTP 400 Bad Request',
    );

    const hackMemberNumRes = await request(server)
      .patch('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        memberNumber: 'HACKED-001', // Protected field
      });
    assert(
      hackMemberNumRes.status === 400,
      'Attempt to mutate protected member field "memberNumber" rejected with HTTP 400 Bad Request',
    );

    const hackRoleRes = await request(server)
      .patch('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        staffRole: 'ADMIN',
        permissions: ['all'],
        isPlatformAdmin: true,
      });
    assert(
      hackRoleRes.status === 400,
      'Attempt to inject privileged role/permissions into member profile rejected with HTTP 400',
    );

    // -------------------------------------------------------------
    // SUITE 5: Membership Plan Discovery & Application Workflow
    // -------------------------------------------------------------
    console.log('\n--- 5. Membership Plan Discovery & Application Workflow ---');
    // 5.1 Plan discovery for 4B tenant
    const plans4BRes = await request(server)
      .get('/api/v1/memberships/plans')
      .set('x-tenant-id', org4BId);
    assert(plans4BRes.status === 200, 'GET /memberships/plans returns HTTP 200 for resolved tenant');
    assert(Array.isArray(plans4BRes.body.data), 'Returns array of membership plans');
    assert(plans4BRes.body.data.length > 0, '4B has active membership plans');
    const testPlan4B = plans4BRes.body.data[0];

    // 5.2 Plan discovery for Ethio-Med tenant
    const plansMedRes = await request(server)
      .get('/api/v1/memberships/plans')
      .set('x-tenant-id', orgMedId);
    assert(plansMedRes.status === 200, 'GET /memberships/plans returns HTTP 200 for Ethio-Med');
    const testPlanMed = plansMedRes.body.data[0];

    // Verify plans are strictly tenant-isolated
    assert(
      plans4BRes.body.data.every((p: any) => p.organizationId === org4BId),
      'All 4B plans strictly belong to 4B organization',
    );
    assert(
      plansMedRes.body.data.every((p: any) => p.organizationId === orgMedId),
      'All Ethio-Med plans strictly belong to Ethio-Med organization',
    );

    // 5.3 Prospective Member Application: New user applies to join 4B Association
    const newApplicantEmail = `applicant_${timestamp}@example.com`;
    const newApplicantRegRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: newApplicantEmail,
        phoneNumber: `+25192200${timestamp.toString().slice(-4)}`,
        firstName: 'Almaz',
        lastName: 'Ayana',
        password: 'Password123!',
      });
    const applicantToken = newApplicantRegRes.body.data.tokens.accessToken;
    const applicantUserId = newApplicantRegRes.body.data.user.id;

    // 5.3a Malicious applicant attempts to force ACTIVE status or bypass payment
    const hackApplyRes = await request(server)
      .post('/api/v1/memberships/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        planId: testPlan4B.id,
        status: 'ACTIVE',
        isPaid: true,
      });
    assert(
      hackApplyRes.status === 400,
      'Attempt to inject status or isPaid into membership application rejected with HTTP 400 Bad Request',
    );

    // 5.3b Applicant applies to 4B using legitimate payload under @AllowProspectiveMember()
    const applyRes = await request(server)
      .post('/api/v1/memberships/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        planId: testPlan4B.id,
      });

    assert(
      applyRes.status === 201,
      'Prospective applicant submits membership application with HTTP 201 Created',
    );
    assert(
      applyRes.body.data.membership.status === 'REGISTERED',
      'Created membership has authoritative status REGISTERED',
    );
    assert(
      applyRes.body.data.nextStep === 'COMPLETE_PAYMENT',
      'Response explicitly indicates nextStep: COMPLETE_PAYMENT',
    );
    assert(
      applyRes.body.data.paymentRequired.planFee !== undefined,
      'Response provides transparent fee breakdown',
    );

    // 5.4 Duplicate application prevention (Conflict 409)
    const dupApplyRes = await request(server)
      .post('/api/v1/memberships/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        planId: testPlan4B.id,
      });
    assert(
      dupApplyRes.status === 409,
      'Duplicate membership application for same plan rejected with HTTP 409 Conflict',
    );

    // 5.5 View user's memberships in active tenant (/memberships/me)
    const myMembershipsRes = await request(server)
      .get('/api/v1/memberships/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId);
    assert(myMembershipsRes.status === 200, 'GET /memberships/me returns HTTP 200');
    assert(
      myMembershipsRes.body.data.length === 1,
      'Applicant has exactly 1 membership in 4B organization',
    );
    assert(
      myMembershipsRes.body.data[0].status === 'REGISTERED',
      'Membership status is confirmed REGISTERED from database',
    );

    // -------------------------------------------------------------
    // SUITE 6: ADVERSARIAL CROSS-TENANT ATTACK TESTS (MANDATORY)
    // -------------------------------------------------------------
    console.log('\n--- 6. Adversarial Cross-Tenant Attack Tests ---');

    // Attack 6.1: Kebede (4B Admin only) attempts GET /members/me on Ethio-Med
    const crossProfileRead = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', orgMedId);
    assert(
      crossProfileRead.status === 403,
      'ATTACK BLOCKED: 4B user attempting GET /members/me on Ethio-Med rejected with HTTP 403 Forbidden',
    );

    // Attack 6.2: Kebede attempts PATCH /members/me on Ethio-Med
    const crossProfilePatch = await request(server)
      .patch('/api/v1/members/me')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', orgMedId)
      .send({ city: 'Malicious Update' });
    assert(
      crossProfilePatch.status === 403,
      'ATTACK BLOCKED: 4B user attempting PATCH /members/me on Ethio-Med rejected with HTTP 403 Forbidden',
    );

    // Attack 6.3: Kebede attempts GET /memberships/me on Ethio-Med
    const crossMembershipRead = await request(server)
      .get('/api/v1/memberships/me')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', orgMedId);
    assert(
      crossMembershipRead.status === 403,
      'ATTACK BLOCKED: 4B user attempting GET /memberships/me on Ethio-Med rejected with HTTP 403 Forbidden',
    );

    // Attack 6.4: Cross-Tenant Plan Selection Attack
    // User provides tenant header for 4B, but sends a planId belonging to Ethio-Med!
    const crossPlanAttackRes = await request(server)
      .post('/api/v1/memberships/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId) // 4B context
      .send({
        planId: testPlanMed.id, // Malicious: Plan belongs to Ethio-Med!
      });
    assert(
      crossPlanAttackRes.status === 404,
      'ATTACK BLOCKED: Submitting cross-tenant planId under mismatched tenant header rejected with HTTP 404',
    );

    // Attack 6.5: Missing / Malformed Tenant Context on Protected Tenant Routes
    const missingTenantProfileRes = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${abebeToken}`); // No tenant header or subdomain
    assert(
      missingTenantProfileRes.status === 404,
      'Protected tenant route with missing tenant context fails closed with HTTP 404',
    );

    // Attack 6.6: Prospective Member Decorator Cannot Bypass Affiliation on Regular Routes
    // Applicant is NOT a member of Ethio-Med. Verify applicant CANNOT access /members/me on Ethio-Med.
    const applicantEthioMedRes = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', orgMedId);
    assert(
      applicantEthioMedRes.status === 403,
      'Prospective Member status in Tenant A provides zero bypass to Tenant B (HTTP 403 Forbidden)',
    );

    console.log('\n========================================================');
    console.log('ALL PHASE 4 BACKEND & SECURITY TESTS PASSED!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 Test execution error:', err);
  process.exit(1);
});
