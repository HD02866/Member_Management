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

async function runThreeExperiencesTest() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII THREE DISTINCT USER EXPERIENCES VERIFICATION');
  console.log('🧪 ========================================================\n');

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
    const org4b = await prisma.organization.findUnique({ where: { slug: '4b' } });
    const orgMed = await prisma.organization.findUnique({ where: { slug: 'ethio-med' } });
    assert(!!org4b, 'Tenant 1 (4B Association) resolved');
    assert(!!orgMed, 'Tenant 2 (Ethio-Med) resolved');

    // =========================================================================
    // EXPERIENCE 1: PLATFORM / ALL-ORGANIZATION ADMIN
    // =========================================================================
    console.log('\n--- Experience 1: Platform / All-Organization Admin ---');
    const platformLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin@test.waanofii.local',
        password: 'WaanOfii.Platform.Admin.2026!',
      });
    assert(platformLogin.status === 200, 'Platform Admin login succeeds (HTTP 200)');
    const platformToken = platformLogin.body.data.tokens.accessToken;
    assert(!!platformToken, 'Platform Admin received JWT access token');

    // /auth/me returns isPlatformAdmin: true
    const platformMe = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(platformMe.status === 200, 'Platform Admin /auth/me returns HTTP 200');
    assert(platformMe.body.data.isPlatformAdmin === true, 'Platform Admin has isPlatformAdmin === true');

    // Access Platform Admin Control Center: /organizations/admin/all
    const adminOrgs = await request(server)
      .get('/api/v1/organizations/admin/all')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(adminOrgs.status === 200, 'Platform Admin can list all platform organizations (HTTP 200)');
    assert(Array.isArray(adminOrgs.body.data), 'Returns list of all platform tenants');
    assert(adminOrgs.body.data.some((o: any) => o.slug === '4b'), 'Platform Admin sees 4B in platform list');
    assert(adminOrgs.body.data.some((o: any) => o.slug === 'ethio-med'), 'Platform Admin sees Ethio-Med in platform list');

    // Access SaaS plans management: /subscriptions/admin/plans
    const adminPlans = await request(server)
      .get('/api/v1/subscriptions/admin/plans')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(adminPlans.status === 200, 'Platform Admin can view all SaaS subscription plans (HTTP 200)');

    // SuperAdmin bypass: Platform Admin can oversee any tenant
    const bypass4BMembers = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(bypass4BMembers.status === 200, 'Platform Admin can oversee 4B Association member roster (HTTP 200)');

    // =========================================================================
    // EXPERIENCE 2: SINGLE-ORGANIZATION ADMIN (4B Association)
    // =========================================================================
    console.log('\n--- Experience 2: Single-Organization Admin (4B Association) ---');
    const orgAdminLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'org.admin.4b@test.waanofii.local',
        password: 'WaanOfii.Org.Admin.2026!',
      });
    assert(orgAdminLogin.status === 200, 'Org Admin login succeeds (HTTP 200)');
    const orgAdminToken = orgAdminLogin.body.data.tokens.accessToken;
    assert(!!orgAdminToken, 'Org Admin received JWT access token');

    // /auth/me returns isPlatformAdmin: false
    const orgAdminMe = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    assert(orgAdminMe.status === 200, 'Org Admin /auth/me returns HTTP 200');
    assert(orgAdminMe.body.data.isPlatformAdmin === false, 'Org Admin is NOT platform admin (isPlatformAdmin === false)');

    // /me/organizations returns 4B with isStaff: true and staffRole: ADMIN
    const orgAdminAffils = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    assert(orgAdminAffils.status === 200, 'Org Admin /me/organizations returns HTTP 200');
    const orgAdmin4b = orgAdminAffils.body.data.find((o: any) => o.slug === '4b');
    assert(!!orgAdmin4b, 'Org Admin is affiliated with 4B Association');
    assert(orgAdmin4b.isStaff === true, 'Org Admin has isStaff === true in 4B');
    assert(orgAdmin4b.staffRoleCode === 'ADMIN', 'Org Admin has staffRoleCode === "ADMIN"');
    assert(!!orgAdmin4b.staffRole, 'Org Admin has human-readable staffRole display name');

    // Org Admin can access 4B staff and member roster
    const orgAdminStaff = await request(server)
      .get('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(orgAdminStaff.status === 200, 'Org Admin can manage 4B staff roster (HTTP 200)');

    const orgAdminMembers = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(orgAdminMembers.status === 200, 'Org Admin can manage 4B member roster (HTTP 200)');

    // BLOCKED: Org Admin cannot access Platform Admin endpoints
    const orgAdminBlockedPlatform = await request(server)
      .get('/api/v1/organizations/admin/all')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    assert(
      orgAdminBlockedPlatform.status === 403,
      'SECURITY BOUNDARY: Org Admin blocked from Platform Admin control center (HTTP 403 Forbidden)',
    );

    // BLOCKED: Org Admin cannot access other tenant (Ethio-Med)
    const orgAdminBlockedCrossTenant = await request(server)
      .get('/api/v1/organizations/ethio-med/members')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .set('x-tenant-id', orgMed!.id);
    assert(
      orgAdminBlockedCrossTenant.status === 403,
      'CROSS-TENANT ISOLATION: 4B Org Admin blocked from Ethio-Med members (HTTP 403 Forbidden)',
    );

    // =========================================================================
    // EXPERIENCE 3: ORGANIZATION MEMBER (4B Association)
    // =========================================================================
    console.log('\n--- Experience 3: Organization Member (4B Association) ---');
    const memberLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'member.4b@test.waanofii.local',
        password: 'WaanOfii.Member.2026!',
      });
    assert(memberLogin.status === 200, 'Member login succeeds (HTTP 200)');
    const memberToken = memberLogin.body.data.tokens.accessToken;
    assert(!!memberToken, 'Member received JWT access token');

    // /auth/me returns isPlatformAdmin: false
    const memberMe = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${memberToken}`);
    assert(memberMe.status === 200, 'Member /auth/me returns HTTP 200');
    assert(memberMe.body.data.isPlatformAdmin === false, 'Member is NOT platform admin (isPlatformAdmin === false)');

    // /me/organizations returns 4B with isMember: true and isStaff: false
    const memberAffils = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${memberToken}`);
    assert(memberAffils.status === 200, 'Member /me/organizations returns HTTP 200');
    const member4b = memberAffils.body.data.find((o: any) => o.slug === '4b');
    assert(!!member4b, 'Member is affiliated with 4B Association');
    assert(member4b.isMember === true, 'isMember is true');
    assert(member4b.isStaff === false, 'isStaff is strictly FALSE');

    // Member can access their own member profile
    const memberSelfProfile = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(memberSelfProfile.status === 200, 'Member can retrieve own profile in 4B (HTTP 200)');
    assert(memberSelfProfile.body.data.email === 'member.4b@test.waanofii.local', 'Profile matches member account');

    // BLOCKED: Member cannot access staff roster
    const memberBlockedStaff = await request(server)
      .get('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(
      memberBlockedStaff.status === 403,
      'ROLE BOUNDARY: Member blocked from accessing staff roster (HTTP 403 Forbidden)',
    );

    // BLOCKED: Member cannot access members roster
    const memberBlockedMembersRoster = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(
      memberBlockedMembersRoster.status === 403,
      'ROLE BOUNDARY: Member blocked from accessing member directory/roster (HTTP 403 Forbidden)',
    );

    // BLOCKED: Member cannot access Platform Admin control center
    const memberBlockedPlatform = await request(server)
      .get('/api/v1/organizations/admin/all')
      .set('Authorization', `Bearer ${memberToken}`);
    assert(
      memberBlockedPlatform.status === 403,
      'SECURITY BOUNDARY: Member blocked from Platform Admin control center (HTTP 403 Forbidden)',
    );

    // BLOCKED: Member cannot access another organization (Ethio-Med)
    const memberBlockedCrossTenant = await request(server)
      .get('/api/v1/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', orgMed!.id);
    assert(
      memberBlockedCrossTenant.status === 403,
      'CROSS-TENANT ISOLATION: 4B Member blocked from accessing Ethio-Med (HTTP 403 Forbidden)',
    );

    console.log('\n========================================================');
    console.log('🎉 ALL THREE DISTINCT USER EXPERIENCES VERIFIED 100%!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runThreeExperiencesTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
