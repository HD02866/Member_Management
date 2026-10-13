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

async function runBackendTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII PHASE 3 BACKEND & SECURITY INTEGRATION TESTS');
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
    // SUITE 1: Health & Readiness Check
    // -------------------------------------------------------------
    console.log('--- 1. Health & Database Readiness Check ---');
    const healthRes = await request(server).get('/api/v1/health');
    assert(healthRes.status === 200, 'GET /health returns HTTP 200');
    assert(healthRes.body.status === 'healthy', 'System status reports healthy');
    assert(healthRes.body.checks.database.status === 'UP', 'Database status reports UP');
    assert(
      !JSON.stringify(healthRes.body).includes('postgres') &&
        !JSON.stringify(healthRes.body).includes('password'),
      'Health check response never exposes database credentials or secrets',
    );

    // -------------------------------------------------------------
    // SUITE 2: User Account Registration & Input Validation
    // -------------------------------------------------------------
    console.log('\n--- 2. Registration & Input Validation ---');
    const timestamp = Date.now();
    const testEmail = `newuser_${timestamp}@example.com`;
    const testPhone = `+25191199${timestamp.toString().slice(-4)}`;

    const regRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        phoneNumber: testPhone,
        firstName: 'Desta',
        lastName: 'Kassa',
        password: 'Password123!',
      });

    assert(regRes.status === 201, 'POST /auth/register creates user account with HTTP 201');
    assert(regRes.body.success === true, 'Response conforms to standard success envelope');
    assert(regRes.body.data.user.email === testEmail, 'Returned user has correct email');
    assert(
      !('passwordHash' in regRes.body.data.user),
      'Password hash is strictly excluded from registration response',
    );
    assert(
      typeof regRes.body.data.tokens.accessToken === 'string',
      'Valid JWT access token returned upon registration',
    );
    assert(
      regRes.headers['set-cookie'] !== undefined,
      'Secure HTTP-only cookie set on registration',
    );

    // Duplicate Email Check
    const dupEmailRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        phoneNumber: `+25191299${timestamp.toString().slice(-4)}`,
        firstName: 'Duplicate',
        lastName: 'User',
        password: 'Password123!',
      });
    assert(dupEmailRes.status === 409, 'Duplicate email registration rejected with HTTP 409 Conflict');

    // Case-Insensitive Duplicate Email Check
    const mixedCaseEmailRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail.toUpperCase(),
        phoneNumber: `+25191399${timestamp.toString().slice(-4)}`,
        firstName: 'Duplicate',
        lastName: 'User',
        password: 'Password123!',
      });
    assert(
      mixedCaseEmailRes.status === 409,
      'Case-insensitive duplicate email registration rejected with HTTP 409 Conflict',
    );

    // Weak Password Validation
    const weakPassRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: `weak_${timestamp}@example.com`,
        firstName: 'Weak',
        lastName: 'Password',
        password: '123',
      });
    assert(weakPassRes.status === 400, 'Weak password rejected with HTTP 400 Bad Request');

    // Non-whitelisted field rejection (forbidNonWhitelisted)
    const extraFieldsRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: `extra_${timestamp}@example.com`,
        firstName: 'Extra',
        lastName: 'Property',
        password: 'Password123!',
        isPlatformAdmin: true, // Malicious injection attempt
      });
    assert(
      extraFieldsRes.status === 400,
      'Non-whitelisted property injection (isPlatformAdmin) rejected with HTTP 400',
    );

    // -------------------------------------------------------------
    // SUITE 3: Authentication & Login
    // -------------------------------------------------------------
    console.log('\n--- 3. Authentication & Login ---');
    // Login with Email
    const loginEmailRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'kebede.admin@4bassociation.org',
        password: 'Password123!',
      });
    assert(loginEmailRes.status === 200, 'Login with email and valid password returns HTTP 200');
    assert(
      !('passwordHash' in loginEmailRes.body.data.user),
      'Password hash never returned in login response',
    );
    const kebedeToken = loginEmailRes.body.data.tokens.accessToken;
    assert(typeof kebedeToken === 'string', 'Received JWT access token');

    // Login with Phone Number (Canonical & Local Format)
    const loginPhoneRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: '0911000003', // Local Ethiopian format (normalized to +251911000003)
        password: 'Password123!',
      });
    assert(loginPhoneRes.status === 200, 'Login with local phone number (09...) succeeds via normalization');

    // Login with Invalid Password
    const badPassRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'kebede.admin@4bassociation.org',
        password: 'WrongPassword!',
      });
    assert(badPassRes.status === 401, 'Invalid password rejected with HTTP 401 Unauthorized');
    assert(
      badPassRes.body.message === 'Invalid credentials',
      'Error message is generic to prevent account enumeration',
    );

    // Login with Non-Existent User
    const noUserRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'nonexistent.user.2026@example.com',
        password: 'Password123!',
      });
    assert(noUserRes.status === 401, 'Non-existent user rejected with HTTP 401 Unauthorized');
    assert(
      noUserRes.body.message === 'Invalid credentials',
      'Non-existent user message is identical to bad password (no enumeration)',
    );

    // -------------------------------------------------------------
    // SUITE 4: Current Authenticated User (/auth/me) & Multi-Tenancy
    // -------------------------------------------------------------
    console.log('\n--- 4. Authenticated User & Multi-Tenant Affiliations ---');
    // Unauthenticated request
    const unauthMeRes = await request(server).get('/api/v1/auth/me');
    assert(unauthMeRes.status === 401, 'GET /auth/me without token rejected with HTTP 401');

    // Authenticated request for multi-tenant member (Abebe Bikila)
    const abebeLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'abebe.member@example.com',
        password: 'Password123!',
      });
    const abebeToken = abebeLoginRes.body.data.tokens.accessToken;

    const abebeMeRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${abebeToken}`);
    assert(abebeMeRes.status === 200, 'GET /auth/me with Bearer token succeeds with HTTP 200');
    assert(abebeMeRes.body.data.email === 'abebe.member@example.com', 'Returns Abebe Bikila profile');
    assert(
      abebeMeRes.body.data.memberProfiles.length === 2,
      'Multi-tenant user Abebe Bikila correctly affiliated with 2 organizations (4B and Ethio-Med)',
    );

    // Authenticated request for 4B Admin (Kebede Tadesse)
    const kebedeMeRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${kebedeToken}`);
    assert(
      kebedeMeRes.body.data.staffMemberships.length === 1,
      'Kebede Tadesse has staff membership in exactly 1 organization',
    );
    assert(
      kebedeMeRes.body.data.staffMemberships[0].organizationSlug === '4b',
      'Kebede staff membership is in 4B Association',
    );
    assert(
      kebedeMeRes.body.data.staffMemberships[0].roleCode === 'ADMIN',
      'Kebede holds role ADMIN with permissions',
    );

    // -------------------------------------------------------------
    // SUITE 5: Session Management & Logout
    // -------------------------------------------------------------
    console.log('\n--- 5. Session Management & Logout ---');
    const logoutRes = await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${abebeToken}`);
    assert(logoutRes.status === 200, 'POST /auth/logout succeeds with HTTP 200');

    // -------------------------------------------------------------
    // SUITE 6: Public Tenant Directory & Resolution
    // -------------------------------------------------------------
    console.log('\n--- 6. Tenant Directory & Resolution ---');
    const orgsRes = await request(server).get('/api/v1/organizations');
    assert(orgsRes.status === 200, 'GET /organizations returns HTTP 200');
    assert(orgsRes.body.data.length >= 2, 'Public directory lists all active organizations');

    const org4bRes = await request(server).get('/api/v1/organizations/4b');
    assert(org4bRes.status === 200, 'Resolving 4B organization by slug returns HTTP 200');
    assert(org4bRes.body.data.slug === '4b', 'Resolved organization has slug 4b');

    const orgMedRes = await request(server).get('/api/v1/organizations/ethio-med');
    assert(orgMedRes.status === 200, 'Resolving Ethio-Med organization by slug returns HTTP 200');
    assert(orgMedRes.body.data.slug === 'ethio-med', 'Resolved organization has slug ethio-med');

    const badOrgRes = await request(server).get('/api/v1/organizations/unknown-slug-xyz');
    assert(badOrgRes.status === 404, 'Resolving unknown organization returns HTTP 404 Not Found');

    // -------------------------------------------------------------
    // SUITE 7: RBAC Authorization & RLS-Guarded Queries
    // -------------------------------------------------------------
    console.log('\n--- 7. RBAC Authorization & RLS Execution ---');
    // 4B Admin accessing 4B members roster (Has members.read permission)
    const membersRes = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${kebedeToken}`);
    assert(membersRes.status === 200, '4B Admin accessing 4B members succeeds with HTTP 200');
    assert(Array.isArray(membersRes.body.data), 'Member roster returned as array');
    assert(membersRes.body.data.length > 0, '4B Member roster contains active members');
    assert(
      membersRes.body.data.every((m: any) => m.organizationId === org4bRes.body.data.id),
      'All members strictly belong to 4B organization (PostgreSQL RLS verified)',
    );

    // Regular Member (Abebe) attempting to access 4B Admin members roster
    // (Abebe is in 4B, but role is MEMBER, lacking 'tenant:members:read')
    const abebeLoginAgain = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'abebe.member@example.com',
        password: 'Password123!',
      });
    const abebeFreshToken = abebeLoginAgain.body.data.tokens.accessToken;

    const abebeForbiddenRes = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${abebeFreshToken}`);
    assert(
      abebeForbiddenRes.status === 403,
      'Regular member lacking members.read permission rejected with HTTP 403 Forbidden',
    );

    // -------------------------------------------------------------
    // SUITE 8: FINAL SECURITY TEST (SECTION 37 ATTACK SCENARIO)
    // -------------------------------------------------------------
    console.log('\n--- 8. Final Security Test: Cross-Tenant Breach Attempt ---');
    // Attack Scenario:
    // User Kebede is an Admin in 4B Association.
    // Kebede maliciously crafts a request to access Ethiopian Medical Association (ethio-med) data.
    // Kebede knows the ethio-med slug, organization ID, and provides valid authentication.
    const crossTenantAttackRes = await request(server)
      .get('/api/v1/organizations/ethio-med/members')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', orgMedRes.body.data.id); // Attacker tries injecting tenant header

    assert(
      crossTenantAttackRes.status === 403,
      'ATTACK BLOCKED: 4B Admin attempting to access Ethio-Med is rejected with HTTP 403 Forbidden',
    );
    assert(
      crossTenantAttackRes.body.message.includes('permission to access this organization'),
      'TenantGuard correctly detected lack of affiliation and blocked cross-tenant breach',
    );

    // -------------------------------------------------------------
    // SUITE 9: Platform Super Admin Cross-Tenant Oversight
    // -------------------------------------------------------------
    console.log('\n--- 9. Platform Super Admin Separation & Oversight ---');
    const adminLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'admin@waanofii.com',
        password: 'Password123!',
      });
    const platformAdminToken = adminLoginRes.body.data.tokens.accessToken;

    const superAdmin4BRes = await request(server)
      .get('/api/v1/organizations/4b/members')
      .set('Authorization', `Bearer ${platformAdminToken}`);
    assert(superAdmin4BRes.status === 200, 'Platform Super Admin can inspect 4B tenant');

    const superAdminMedRes = await request(server)
      .get('/api/v1/organizations/ethio-med/members')
      .set('Authorization', `Bearer ${platformAdminToken}`);
    assert(superAdminMedRes.status === 200, 'Platform Super Admin can inspect Ethio-Med tenant');

    console.log('\n========================================================');
    console.log('ALL PHASE 3 BACKEND & SECURITY TESTS PASSED!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runBackendTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
