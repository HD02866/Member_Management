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

async function runStaffAndMultiTenantTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII MULTI-ORG & STAFF EXPERIENCE VERIFICATION');
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
    // 1. Setup & Authenticate Test Actors
    // -------------------------------------------------------------
    console.log('--- 1. Authenticate Test Actors ---');
    
    // 4B Admin (Kebede Tadesse)
    const kebedeLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'kebede.admin@4bassociation.org', password: 'Password123!' });
    assert(kebedeLogin.status === 200, '4B Admin login succeeds');
    const kebedeToken = kebedeLogin.body.data.tokens.accessToken;

    // 4B Owner (Selam Bekele)
    const selamLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'selam.owner@4bassociation.org', password: 'Password123!' });
    assert(selamLogin.status === 200, '4B Owner login succeeds');
    const selamToken = selamLogin.body.data.tokens.accessToken;

    // Member (Abebe Bikila)
    const abebeLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'abebe.member@example.com', password: 'Password123!' });
    assert(abebeLogin.status === 200, 'Regular Member login succeeds');
    const abebeToken = abebeLogin.body.data.tokens.accessToken;

    // Resolve 4B and Ethio-Med IDs
    const org4b = await prisma.organization.findUnique({ where: { slug: '4b' } });
    const orgMed = await prisma.organization.findUnique({ where: { slug: 'ethio-med' } });
    assert(!!org4b, '4B organization resolved');
    assert(!!orgMed, 'Ethio-Med organization resolved');

    // -------------------------------------------------------------
    // 2. Public Registration with Organization Selection
    // -------------------------------------------------------------
    console.log('--- 2. Public Registration Creates MEMBER (Never Staff) ---');
    const uniqueEmail = `test.member.${Date.now()}@example.com`;
    const regRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'TestFirst',
        lastName: 'TestLast',
        email: uniqueEmail,
        password: 'Password123!',
        organizationSlug: '4b',
      });

    assert(regRes.status === 201, 'Public registration with organizationSlug returns HTTP 201');
    const newUserId = regRes.body.data.user.id;
    const newUserToken = regRes.body.data.tokens.accessToken;

    // Verify MemberProfile was created
    const memberProfile = await prisma.memberProfile.findFirst({
      where: { userId: newUserId, organizationId: org4b!.id },
    });
    assert(!!memberProfile, 'MemberProfile record created automatically in 4B Association');
    assert(memberProfile?.status === 'ACTIVE', 'Member status is ACTIVE');
    assert(memberProfile?.memberNumber.startsWith('4B-'), 'Member number has correct org prefix (4B-...)');

    // Verify User has NO StaffMembership
    const staffCheck = await prisma.staffMembership.findFirst({
      where: { userId: newUserId },
    });
    assert(!staffCheck, 'Zero staff memberships exist for new public registrant (strict role boundary)');

    // Verify /me/organizations reflects member affiliation
    const affilRes = await request(server)
      .get('/api/v1/me/organizations')
      .set('Authorization', `Bearer ${newUserToken}`);
    assert(affilRes.status === 200, 'GET /me/organizations returns HTTP 200');
    const affil4b = affilRes.body.data.find((o: any) => o.slug === '4b');
    assert(!!affil4b, 'Affiliated with 4B Association');
    assert(affil4b.isMember === true, 'isMember is true');
    assert(affil4b.isStaff === false, 'isStaff is false');

    // -------------------------------------------------------------
    // 3. Available Staff Roles
    // -------------------------------------------------------------
    console.log('--- 3. Available Staff Roles Endpoint ---');
    const rolesRes = await request(server)
      .get('/api/v1/organizations/roles/available')
      .set('Authorization', `Bearer ${kebedeToken}`);
    assert(rolesRes.status === 200, 'GET /organizations/roles/available returns HTTP 200');
    const rolesList = rolesRes.body.data;
    const roleCodes = rolesList.map((r: any) => r.code);
    assert(roleCodes.includes('OWNER'), 'Includes OWNER role');
    assert(roleCodes.includes('ADMIN'), 'Includes ADMIN role');
    assert(roleCodes.includes('FINANCE_OFFICER'), 'Includes FINANCE_OFFICER role');
    assert(roleCodes.includes('VERIFIER'), 'Includes VERIFIER role');

    // -------------------------------------------------------------
    // 4. Staff Roster & Authorization
    // -------------------------------------------------------------
    console.log('--- 4. Staff Roster & Access Controls ---');
    // 4B Admin accesses 4B staff
    const staffRoster = await request(server)
      .get('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(staffRoster.status === 200, '4B Admin GET /organizations/4b/staff returns HTTP 200');
    assert(Array.isArray(staffRoster.body.data), 'Staff roster is returned as array');
    assert(staffRoster.body.data.length >= 4, '4B staff roster contains seeded staff members');

    // Regular member blocked from staff roster
    const memberStaffAttempt = await request(server)
      .get('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${abebeToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(
      memberStaffAttempt.status === 403,
      'ATTACK BLOCKED: Regular member cannot access staff roster (HTTP 403 Forbidden)',
    );

    // Cross-tenant staff access blocked
    const crossTenantStaffAttempt = await request(server)
      .get('/api/v1/organizations/ethio-med/staff')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', orgMed!.id);
    assert(
      crossTenantStaffAttempt.status === 403,
      'ATTACK BLOCKED: 4B Admin cannot access Ethio-Med staff roster (HTTP 403 Forbidden)',
    );

    // -------------------------------------------------------------
    // 5. Staff Assignment & Privilege Escalation Prevention
    // -------------------------------------------------------------
    console.log('--- 5. Staff Assignment & Privilege Escalation Prevention ---');
    // Privilege Escalation Test: 4B Admin attempting to assign OWNER role is rejected
    const escalateAttempt = await request(server)
      .post('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4b!.id)
      .send({
        identifier: uniqueEmail,
        roleCode: 'OWNER',
      });
    assert(
      escalateAttempt.status === 403,
      'PRIVILEGE ESCALATION BLOCKED: Organization Admin cannot assign OWNER role (HTTP 403 Forbidden)',
    );

    // Valid assignment: 4B Admin assigns new user as VERIFIER
    const assignRes = await request(server)
      .post('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4b!.id)
      .send({
        identifier: uniqueEmail,
        roleCode: 'VERIFIER',
      });
    assert(assignRes.status === 201, '4B Admin successfully assigns user as VERIFIER (HTTP 201)');
    const createdStaffId = assignRes.body.data.id;
    assert(assignRes.body.data.role.code === 'VERIFIER', 'Assigned role is VERIFIER');
    assert(assignRes.body.data.isActive === true, 'Assigned staff is active');

    // Duplicate assignment rejected with 409
    const dupAssign = await request(server)
      .post('/api/v1/organizations/4b/staff')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4b!.id)
      .send({
        identifier: uniqueEmail,
        roleCode: 'VERIFIER',
      });
    assert(dupAssign.status === 409, 'Duplicate staff assignment rejected with HTTP 409 Conflict');

    // -------------------------------------------------------------
    // 6. Staff Role Modification & Status Update
    // -------------------------------------------------------------
    console.log('--- 6. Staff Role Modification & Deactivation ---');
    const updateRes = await request(server)
      .patch(`/api/v1/organizations/4b/staff/${createdStaffId}`)
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4b!.id)
      .send({
        roleCode: 'FINANCE_OFFICER',
      });
    assert(updateRes.status === 200, '4B Admin updates staff role to FINANCE_OFFICER (HTTP 200)');
    assert(updateRes.body.data.role.code === 'FINANCE_OFFICER', 'Staff role updated to FINANCE_OFFICER');

    // -------------------------------------------------------------
    // 7. Revoke Staff Membership
    // -------------------------------------------------------------
    console.log('--- 7. Revoke Staff Membership ---');
    const revokeRes = await request(server)
      .delete(`/api/v1/organizations/4b/staff/${createdStaffId}`)
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(revokeRes.status === 200, '4B Admin revokes staff member (HTTP 200)');

    // Verify record deleted from database
    const revokedCheck = await prisma.staffMembership.findUnique({
      where: { id: createdStaffId },
    });
    assert(!revokedCheck, 'Staff membership successfully deleted from PostgreSQL');

    // -------------------------------------------------------------
    // 8. Safety: Prevent Revoking the Last Active OWNER
    // -------------------------------------------------------------
    console.log('--- 8. Safety: Protection of Last Active Owner ---');
    const ownerStaff = await prisma.staffMembership.findFirst({
      where: {
        organizationId: org4b!.id,
        role: { code: 'OWNER' },
      },
    });
    assert(!!ownerStaff, '4B Owner staff membership found');

    const revokeOwnerAttempt = await request(server)
      .delete(`/api/v1/organizations/4b/staff/${ownerStaff!.id}`)
      .set('Authorization', `Bearer ${selamToken}`)
      .set('x-tenant-id', org4b!.id);
    assert(
      revokeOwnerAttempt.status === 400,
      'SAFETY CHECK PASSED: Cannot remove the last active Organization Owner (HTTP 400 Bad Request)',
    );

    // -------------------------------------------------------------
    // 9. Audit Trail Verification
    // -------------------------------------------------------------
    console.log('--- 9. Immutable Audit Trail Verification ---');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: org4b!.id,
        action: { in: ['STAFF_ASSIGNED', 'STAFF_UPDATED', 'STAFF_REVOKED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    assert(auditLogs.length >= 3, 'Audit logs recorded for staff assignment, update, and revocation');
    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes('STAFF_ASSIGNED'), 'Audit log contains STAFF_ASSIGNED');
    assert(actions.includes('STAFF_UPDATED'), 'Audit log contains STAFF_UPDATED');
    assert(actions.includes('STAFF_REVOKED'), 'Audit log contains STAFF_REVOKED');

    console.log('\n========================================================');
    console.log('🎉 ALL STAFF & MULTI-TENANT EXPERIENCE TESTS PASSED!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runStaffAndMultiTenantTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
