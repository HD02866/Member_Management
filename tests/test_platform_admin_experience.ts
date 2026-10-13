import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/database/prisma.service';
import { SubscriptionEntitlementService } from '../src/subscriptions/subscription-entitlement.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runPlatformAdminTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII PLATFORM ADMIN EXPERIENCE & SECURITY VERIFICATION');
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
    // -------------------------------------------------------------
    // 1. Authenticate Actors
    // -------------------------------------------------------------
    console.log('--- 1. Authenticate Actors ---');

    // Platform Admin
    const platformLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin@test.waanofii.local',
        password: 'WaanOfii.Platform.Admin.2026!',
      });
    assert(platformLogin.status === 200, 'Platform Admin login succeeds (HTTP 200)');
    const platformToken = platformLogin.body.data.tokens.accessToken;
    assert(!!platformToken, 'Platform Admin token received');

    // Single-Org Admin (4B)
    const orgAdminLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'org.admin.4b@test.waanofii.local',
        password: 'WaanOfii.Org.Admin.2026!',
      });
    assert(orgAdminLogin.status === 200, 'Org Admin login succeeds (HTTP 200)');
    const orgAdminToken = orgAdminLogin.body.data.tokens.accessToken;

    // Member (4B)
    const memberLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'member.4b@test.waanofii.local',
        password: 'WaanOfii.Member.2026!',
      });
    assert(memberLogin.status === 200, 'Member login succeeds (HTTP 200)');
    const memberToken = memberLogin.body.data.tokens.accessToken;

    // Resolve 4B Association
    const org4b = await prisma.organization.findUnique({ where: { slug: '4b' } });
    assert(!!org4b, '4B Association resolved in database');

    // -------------------------------------------------------------
    // 2. Strict Denial of Non-Platform Admins
    // -------------------------------------------------------------
    console.log('\n--- 2. Security Boundaries: Non-Platform Admins Blocked ---');

    const memberStatsBlock = await request(server)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${memberToken}`);
    assert(memberStatsBlock.status === 403, 'Member blocked from /platform/stats (HTTP 403 Forbidden)');

    const orgAdminStatsBlock = await request(server)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    assert(orgAdminStatsBlock.status === 403, 'Org Admin blocked from /platform/stats (HTTP 403 Forbidden)');

    const memberUsersBlock = await request(server)
      .get('/api/v1/platform/users')
      .set('Authorization', `Bearer ${memberToken}`);
    assert(memberUsersBlock.status === 403, 'Member blocked from /platform/users (HTTP 403 Forbidden)');

    const orgAdminUsersBlock = await request(server)
      .get('/api/v1/platform/users')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    assert(orgAdminUsersBlock.status === 403, 'Org Admin blocked from /platform/users (HTTP 403 Forbidden)');

    // -------------------------------------------------------------
    // 3. Platform Aggregated Operational Stats
    // -------------------------------------------------------------
    console.log('\n--- 3. Platform Operational Overview / Stats ---');
    const statsRes = await request(server)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(statsRes.status === 200, 'GET /platform/stats returns HTTP 200');
    assert(statsRes.body.data.organizations.total >= 1, 'Stats includes total organizations');
    assert(statsRes.body.data.users.total >= 3, 'Stats includes total users');
    assert(statsRes.body.data.saas.activeSubscriptions >= 1, 'Stats includes active subscriptions');
    assert(Array.isArray(statsRes.body.data.recentActivity), 'Stats includes recent audit activity');

    // -------------------------------------------------------------
    // 4. Platform User Management
    // -------------------------------------------------------------
    console.log('\n--- 4. Platform Global User Management ---');
    const usersRes = await request(server)
      .get('/api/v1/platform/users')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(usersRes.status === 200, 'GET /platform/users returns HTTP 200');
    assert(Array.isArray(usersRes.body.data.users), 'Returns array of users');
    
    // Check that sensitive hashes are NOT leaked
    const hasPasswordHash = usersRes.body.data.users.some((u: any) => 'passwordHash' in u || 'password' in u);
    assert(!hasPasswordHash, 'ZERO password hashes exposed in users listing');

    // Create a new platform user
    const newUserEmail = `new.platform.user.${Date.now()}@test.waanofii.local`;
    const createUserRes = await request(server)
      .post('/api/v1/platform/users')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        firstName: 'Operational',
        lastName: 'Specialist',
        email: newUserEmail,
        password: 'Password123!',
      });
    assert(createUserRes.status === 201, 'Platform Admin creates new global user (HTTP 201)');
    const createdUserId = createUserRes.body.data.id;
    assert(!('passwordHash' in createUserRes.body.data), 'Zero password hash returned upon user creation');

    // Duplicate user rejected with 409
    const dupUserRes = await request(server)
      .post('/api/v1/platform/users')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        firstName: 'Duplicate',
        lastName: 'Test',
        email: newUserEmail,
        password: 'Password123!',
      });
    assert(dupUserRes.status === 409, 'Duplicate user creation rejected with HTTP 409 Conflict');

    // -------------------------------------------------------------
    // 5. Organization Management & Deep Overview
    // -------------------------------------------------------------
    console.log('\n--- 5. Organization Deep Overview & Management ---');
    const orgsListRes = await request(server)
      .get('/api/v1/platform/organizations?search=4b')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(orgsListRes.status === 200, 'GET /platform/organizations returns HTTP 200');
    assert(orgsListRes.body.data.organizations.some((o: any) => o.slug === '4b'), 'Lists 4B Association');

    const orgDetailRes = await request(server)
      .get('/api/v1/platform/organizations/4b')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(orgDetailRes.status === 200, 'GET /platform/organizations/4b returns HTTP 200');
    assert(orgDetailRes.body.data.slug === '4b', 'Returns 4B organization detail');
    assert(!!orgDetailRes.body.data.subscription, 'Includes subscription & plan details');
    assert(Array.isArray(orgDetailRes.body.data.staffMemberships), 'Includes staff memberships list');

    // Update Organization Config
    const updateConfigRes = await request(server)
      .patch('/api/v1/platform/organizations/4b')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        contactPhone: '+251911999888',
        address: 'WaanOfii Platform Administrative Update, Addis Ababa',
      });
    assert(updateConfigRes.status === 200, 'PATCH /platform/organizations/4b updates configuration (HTTP 200)');
    assert(updateConfigRes.body.data.contactPhone === '+251911999888', 'Updated phone saved');

    // -------------------------------------------------------------
    // 6. Organization Branding & Card Template
    // -------------------------------------------------------------
    console.log('\n--- 6. Organization Branding & Card Template Customization ---');
    const updateBrandingRes = await request(server)
      .patch('/api/v1/platform/organizations/4b/branding')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        primaryColor: '#1E40AF',
        secondaryColor: '#3B82F6',
        navbarBrandingMode: 'CO_BRANDED',
        cardTemplate: {
          layout: 'MODERN',
          showPhone: true,
          showPhoto: true,
          accentColor: '#1E40AF',
          customTitle: 'Official Member Card',
        },
      });
    assert(updateBrandingRes.status === 200, 'PATCH /platform/organizations/4b/branding succeeds (HTTP 200)');
    assert(updateBrandingRes.body.data.brandingConfig.primaryColor === '#1E40AF', 'Primary color saved');
    assert(
      updateBrandingRes.body.data.brandingConfig.cardTemplate.customTitle === 'Official Member Card',
      'Card template customTitle saved',
    );

    // -------------------------------------------------------------
    // 7. Organization Feature Entitlement Overrides
    // -------------------------------------------------------------
    console.log('\n--- 7. Organization Feature Entitlement Overrides ---');
    const overrideFeaturesRes = await request(server)
      .patch('/api/v1/platform/organizations/4b/features')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        featureOverrides: {
          customDomain: true,
          advancedReports: true,
        },
      });
    assert(overrideFeaturesRes.status === 200, 'PATCH /platform/organizations/4b/features succeeds (HTTP 200)');
    assert(
      overrideFeaturesRes.body.data.featureOverrides.customDomain === true,
      'Feature override "customDomain: true" saved',
    );

    // Verify backend SubscriptionEntitlementService respects the override
    const entitlementService = app.get(SubscriptionEntitlementService);
    const hasCustomDomain = await entitlementService.hasFeature(org4b!.id, 'customDomain');
    assert(hasCustomDomain === true, 'Backend SubscriptionEntitlementService respects organization feature override!');

    // -------------------------------------------------------------
    // 8. Staff Management by Platform Admin
    // -------------------------------------------------------------
    console.log('\n--- 8. Staff Assignment & Revocation by Platform Admin ---');
    const assignStaffRes = await request(server)
      .post('/api/v1/platform/organizations/4b/staff')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        identifier: newUserEmail,
        roleCode: 'VERIFIER',
      });
    assert(assignStaffRes.status === 201, 'Platform Admin assigns staff member (HTTP 201)');
    const assignedStaffId = assignStaffRes.body.data.id;
    assert(assignStaffRes.body.data.role.code === 'VERIFIER', 'Assigned role is VERIFIER');

    // Revoke the assigned staff member
    const revokeStaffRes = await request(server)
      .delete(`/api/v1/platform/organizations/4b/staff/${assignedStaffId}`)
      .set('Authorization', `Bearer ${platformToken}`);
    assert(revokeStaffRes.status === 200, 'Platform Admin revokes staff member (HTTP 200)');

    // Verify that the global User identity was NOT deleted
    const userStillExists = await prisma.user.findUnique({ where: { id: createdUserId } });
    assert(!!userStillExists, 'Global User identity remains intact after staff revocation');

    // -------------------------------------------------------------
    // 9. Audit Logs Oversight
    // -------------------------------------------------------------
    console.log('\n--- 9. Platform Immutable Audit Log Oversight ---');
    const auditRes = await request(server)
      .get('/api/v1/platform/audit')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(auditRes.status === 200, 'GET /platform/audit returns HTTP 200');
    assert(Array.isArray(auditRes.body.data.logs), 'Audit logs returned as array');
    assert(auditRes.body.data.logs.length >= 1, 'Audit log records exist');

    // -------------------------------------------------------------
    // 10. Financial Oversight & Verification Oversight
    // -------------------------------------------------------------
    console.log('\n--- 10. Operations: Financial & Verification Oversight ---');
    const paymentsRes = await request(server)
      .get('/api/v1/platform/payments')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(paymentsRes.status === 200, 'GET /platform/payments returns HTTP 200');
    assert(Array.isArray(paymentsRes.body.data.payments), 'Payments returned as array');

    const verifyRes = await request(server)
      .get('/api/v1/platform/verification')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(verifyRes.status === 200, 'GET /platform/verification returns HTTP 200');
    assert(Array.isArray(verifyRes.body.data.logs), 'Verification logs returned as array');

    // -------------------------------------------------------------
    // 11. Platform Settings
    // -------------------------------------------------------------
    console.log('\n--- 11. Platform Settings ---');
    const getSettingsRes = await request(server)
      .get('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${platformToken}`);
    assert(getSettingsRes.status === 200, 'GET /platform/settings returns HTTP 200');
    assert(getSettingsRes.body.data.platformName === 'WaanOfii', 'Default platform name is WaanOfii');

    const updateSettingsRes = await request(server)
      .patch('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        supportEmail: 'ops-admin@waanofii.com',
      });
    assert(updateSettingsRes.status === 200, 'PATCH /platform/settings updates settings (HTTP 200)');
    assert(updateSettingsRes.body.data.supportEmail === 'ops-admin@waanofii.com', 'Updated support email saved');

    console.log('\n========================================================');
    console.log('🎉 ALL PLATFORM ADMIN BACKEND TESTS PASSED 100%!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runPlatformAdminTests().catch((err) => {
  console.error('Fatal platform admin test error:', err);
  process.exit(1);
});
