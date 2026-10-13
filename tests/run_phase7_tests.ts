import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/database/prisma.service';
import {
  OrganizationStatus,
  ContentStatus,
  SaasInvoiceStatus,
  NotificationStatus,
  NotificationChannel,
} from '@prisma/client';
import { sanitizeContent, sanitizeText } from '../src/cms/utils/sanitize-content.util';
import { SubscriptionEntitlementService } from '../src/subscriptions/subscription-entitlement.service';
import { SaasBillingService } from '../src/subscriptions/saas-billing.service';
import { NotificationsService } from '../src/notifications/notifications.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runPhase7Tests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII PHASE 7 ORG OPS, CMS, NOTIFICATIONS & SAAS BILLING');
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
  const entitlementService = app.get(SubscriptionEntitlementService);
  const billingService = app.get(SaasBillingService);
  const notificationsService = app.get(NotificationsService);

  // Ensure test organizations are ACTIVE before starting
  await prisma.withPlatformAdminContext((tx) =>
    tx.organization.updateMany({
      data: { status: OrganizationStatus.ACTIVE },
    }),
  );

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate Test Actors
    // -------------------------------------------------------------
    console.log('--- Setup: Authenticating Test Actors ---');
    // Platform Super Admin
    const adminLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin@waanofii.com', password: 'Password123!' });
    assert(adminLoginRes.status === 200, 'Platform Super Admin login succeeds');
    const platformAdminToken = adminLoginRes.body.data.tokens.accessToken;
    const platformAdminId = adminLoginRes.body.data.user.id;

    // 4B Owner (Selam Bekele - Full privileges)
    const selamLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'selam.owner@4bassociation.org', password: 'Password123!' });
    assert(selamLoginRes.status === 200, '4B Owner login succeeds');
    const ownerToken = selamLoginRes.body.data.tokens.accessToken;
    const ownerUserId = selamLoginRes.body.data.user.id;

    // 4B Admin (Kebede Tadesse - Content/Admin privileges)
    const kebedeLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'kebede.admin@4bassociation.org', password: 'Password123!' });
    assert(kebedeLoginRes.status === 200, '4B Admin login succeeds');
    const kebedeToken = kebedeLoginRes.body.data.tokens.accessToken;

    // Multi-tenant regular member (Abebe Bikila - No admin permissions)
    const abebeLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'abebe.member@example.com', password: 'Password123!' });
    assert(abebeLoginRes.status === 200, 'Regular member Abebe login succeeds');
    const memberToken = abebeLoginRes.body.data.tokens.accessToken;
    const memberUserId = abebeLoginRes.body.data.user.id;

    // Resolve 4B (Tenant A) and Ethio-Med (Tenant B) organizations
    const org4BRes = await request(server).get('/api/v1/organizations/4b');
    const orgMedRes = await request(server).get('/api/v1/organizations/ethio-med');
    assert(org4BRes.status === 200, '4B organization resolved');
    assert(orgMedRes.status === 200, 'Ethio-Med organization resolved');
    const org4BId = org4BRes.body.data.id;
    const orgMedId = orgMedRes.body.data.id;

    // Ethio-Med Owner (Yohannes Owner)
    const yohannesLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'yohannes.owner@ethiomed.org', password: 'Password123!' });
    assert(yohannesLoginRes.status === 200, 'Ethio-Med Owner login succeeds');
    const yohannesToken = yohannesLoginRes.body.data.tokens.accessToken;

    // =============================================================
    // SECTION 1: Organization Operations & Lifecycle Administration
    // =============================================================
    console.log('\n--- 1. Organization Operations & Lifecycle Administration ---');

    // 1.1 Platform Admin lists all organizations with full operational metadata
    const listAllRes = await request(server)
      .get('/api/v1/organizations/admin/all')
      .set('Authorization', `Bearer ${platformAdminToken}`);
    assert(listAllRes.status === 200, 'Platform Admin lists all organizations with metadata (HTTP 200)');
    assert(Array.isArray(listAllRes.body.data), 'Returns array of organizations');
    assert(listAllRes.body.data.length >= 2, 'Lists at least 4B and Ethio-Med organizations');
    assert(
      listAllRes.body.data.some((o: any) => o.id === org4BId && o.status === OrganizationStatus.ACTIVE),
      'Lists 4B organization as ACTIVE',
    );

    // 1.2 Non-platform admin blocked from listing all organizations
    const unauthorizedListRes = await request(server)
      .get('/api/v1/organizations/admin/all')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert(unauthorizedListRes.status === 403, 'Non-platform admin blocked from admin listing (HTTP 403)');

    // 1.3 Update organization status: ACTIVE -> SUSPENDED by Platform Admin
    const suspendRes = await request(server)
      .patch(`/api/v1/organizations/${orgMedId}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        status: OrganizationStatus.SUSPENDED,
        reason: 'Temporary regulatory audit suspension',
      });
    assert(suspendRes.status === 200, 'Platform admin suspends organization (HTTP 200)');
    assert(suspendRes.body.data.status === OrganizationStatus.SUSPENDED, 'Organization status is SUSPENDED');

    // 1.4 Audit log generated for lifecycle transition
    const auditRecord = await prisma.withPlatformAdminContext((tx) =>
      tx.auditLog.findFirst({
        where: {
          action: 'ORGANIZATION_STATUS_UPDATE',
          entityId: orgMedId,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    assert(!!auditRecord, 'Audit log created for organization status update');
    assert(auditRecord?.organizationId === orgMedId, 'Audit log correctly scoped to target organization');

    // 1.5 Mutating tenant request on SUSPENDED organization blocked by TenantGuard
    const suspendedMutationRes = await request(server)
      .post('/api/v1/cms/leadership/positions')
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId)
      .send({
        title: { en: 'Chief Officer' },
        code: `EXEC_${Date.now()}`,
      });
    assert(
      suspendedMutationRes.status === 403,
      'Mutating POST request on SUSPENDED organization blocked with HTTP 403',
    );
    assert(
      suspendedMutationRes.body.message.includes('suspended'),
      'Blocked response mentions organization operations are suspended',
    );

    // 1.6 Read-only requests on SUSPENDED organization remain permitted
    const suspendedReadRes = await request(server)
      .get('/api/v1/cms/profile')
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId);
    assert(suspendedReadRes.status === 200, 'Read GET request on SUSPENDED organization allowed (HTTP 200)');

    // 1.7 Illegal status payload rejected
    const invalidStatusRes = await request(server)
      .patch(`/api/v1/organizations/${orgMedId}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ status: 'INVALID_STATUS_VALUE' });
    assert(invalidStatusRes.status === 400, 'Invalid status string rejected with HTTP 400 Bad Request');

    // 1.8 Reactivate organization: SUSPENDED -> ACTIVE
    const reactivateRes = await request(server)
      .patch(`/api/v1/organizations/${orgMedId}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        status: OrganizationStatus.ACTIVE,
        reason: 'Regulatory audit successfully completed',
      });
    assert(reactivateRes.status === 200, 'Platform admin reactivates organization to ACTIVE (HTTP 200)');
    assert(reactivateRes.body.data.status === OrganizationStatus.ACTIVE, 'Organization status is ACTIVE again');

    // 1.9 Mutating request succeeds after reactivation
    const activeMutationRes = await request(server)
      .post('/api/v1/cms/leadership/positions')
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId)
      .send({
        title: { en: 'Chief Medical Officer' },
        code: `CMO_${Date.now()}`,
      });
    assert(activeMutationRes.status === 201, 'Mutating POST request succeeds after reactivation (HTTP 201)');

    // 1.10 Tenant settings update by Tenant Admin
    const updatedPhone = '+251911998877';
    const updateSettingsRes = await request(server)
      .patch(`/api/v1/organizations/${org4BId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        contactPhone: updatedPhone,
        address: 'Bole Subcity, Woreda 03, House 456, Addis Ababa',
      });
    assert(updateSettingsRes.status === 200, 'Tenant admin updates organization settings (HTTP 200)');
    assert(updateSettingsRes.body.data.contactPhone === updatedPhone, 'Settings update persists contact phone');

    // 1.11 Unauthorized user blocked from updating organization settings
    const unauthorizedSettingsRes = await request(server)
      .patch(`/api/v1/organizations/${org4BId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId)
      .send({ contactPhone: '+251911000000' });
    assert(unauthorizedSettingsRes.status === 403, 'Regular member blocked from updating settings (HTTP 403)');

    // 1.12 DEACTIVATED lifecycle test: Deactivated organization blocks all operations
    const deactivateRes = await request(server)
      .patch(`/api/v1/organizations/${orgMedId}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        status: OrganizationStatus.DEACTIVATED,
        reason: 'Archival testing',
      });
    assert(deactivateRes.status === 200, 'Platform admin deactivates organization (HTTP 200)');

    const deactivatedBlockRes = await request(server)
      .get('/api/v1/cms/profile')
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId);
    assert(deactivatedBlockRes.status === 403, 'All requests on DEACTIVATED org blocked with HTTP 403');
    assert(
      deactivatedBlockRes.body.message.includes('deactivated'),
      'Blocked message indicates organization is deactivated',
    );

    // Restore to ACTIVE so subsequent tests remain unaffected
    await request(server)
      .patch(`/api/v1/organizations/${orgMedId}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ status: OrganizationStatus.ACTIVE, reason: 'Restored for test suite' });

    // =============================================================
    // SECTION 2: Organization CMS Management & XSS Sanitization
    // =============================================================
    console.log('\n--- 2. Organization CMS Management & XSS Sanitization ---');

    // 2.1 XSS Sanitization Unit Tests
    let caughtScript = false;
    try {
      sanitizeText('<script>alert("pwned")</script>Welcome to our community');
    } catch {
      caughtScript = true;
    }
    assert(caughtScript, 'Sanitizer detects and rejects <script> tags with BadRequestException');

    let caughtImg = false;
    try {
      sanitizeText('<img src="x" onerror="document.cookie=steal()" />Safe text');
    } catch {
      caughtImg = true;
    }
    assert(caughtImg, 'Sanitizer detects and rejects onerror handlers with BadRequestException');

    let caughtJsUri = false;
    try {
      sanitizeText('<a href="javascript:alert(1)">Click here</a>');
    } catch {
      caughtJsUri = true;
    }
    assert(caughtJsUri, 'Sanitizer detects and rejects javascript: URIs with BadRequestException');

    const cleanInput = 'Welcome to our community and general assembly';
    const cleanOutput = sanitizeText(cleanInput);
    assert(cleanOutput === cleanInput, 'Sanitizer passes clean legitimate text unchanged');

    // 2.2 CMS Profile: Malicious update blocked, clean update succeeds
    const maliciousProfileRes = await request(server)
      .patch('/api/v1/cms/profile')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        mission: {
          en: 'To empower our community <script>alert("profile_xss")</script>',
        },
      });
    assert(
      maliciousProfileRes.status === 400,
      'ATTACK BLOCKED: CMS profile update with malicious script rejected with HTTP 400',
    );

    const updateProfileRes = await request(server)
      .patch('/api/v1/cms/profile')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        mission: {
          en: 'To empower our community and foster growth',
          am: 'ማህበረሰባችንን ማብቃት እና እድገትን ማፋጠን',
        },
        vision: {
          en: 'A connected, transparent, and resilient network',
          am: 'የተሳሰረ፣ ግልጽ እና ጽኑ አውታረ መረብ',
        },
        socialLinks: {
          telegram: 'https://t.me/waanofii_4b',
          website: 'https://4bassociation.org',
        },
      });
    assert(updateProfileRes.status === 200, 'Tenant admin updates CMS profile with clean content (HTTP 200)');
    assert(
      updateProfileRes.body.data.mission.en === 'To empower our community and foster growth',
      'Stored CMS profile mission matches clean content',
    );

    const getProfileRes = await request(server)
      .get('/api/v1/cms/profile')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(getProfileRes.status === 200, 'GET /cms/profile returns HTTP 200');
    assert(getProfileRes.body.data.socialLinks.telegram === 'https://t.me/waanofii_4b', 'Profile persists social links');

    // 2.3 CMS Leadership Positions & Leaders
    const posCode = `DIR_${Date.now()}`;
    const createPosRes = await request(server)
      .post('/api/v1/cms/leadership/positions')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'Executive Director', am: 'ዋና ዳይሬክተር' },
        code: posCode,
        displayOrder: 1,
      });
    assert(createPosRes.status === 201, 'Create leadership position succeeds (HTTP 201)');
    const positionId = createPosRes.body.data.id;
    assert(createPosRes.body.data.code === posCode.toLowerCase(), 'Leadership position code persisted');

    // Malicious leader bio rejected
    const maliciousLeaderRes = await request(server)
      .post('/api/v1/cms/leadership/leaders')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        positionId,
        name: 'Dr. Malicious',
        bio: { en: 'Injected <img src=x onerror=alert(1)>' },
      });
    assert(
      maliciousLeaderRes.status === 400,
      'ATTACK BLOCKED: Leader creation with malicious XSS bio rejected with HTTP 400',
    );

    const createLeaderRes = await request(server)
      .post('/api/v1/cms/leadership/leaders')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        positionId,
        name: 'Dr. Almaz Tefera',
        email: 'almaz.tefera@4bassociation.org',
        displayOrder: 1,
        bio: {
          en: 'Experienced public health leader with 15+ years experience',
        },
        isActive: true,
      });
    assert(createLeaderRes.status === 201, 'Create leader person succeeds (HTTP 201)');
    const leaderId = createLeaderRes.body.data.id;

    const updateLeaderRes = await request(server)
      .patch(`/api/v1/cms/leadership/leaders/${leaderId}`)
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        name: 'Dr. Almaz Tefera, MD, MPH',
      });
    assert(updateLeaderRes.status === 200, 'Update leader person succeeds (HTTP 200)');
    assert(updateLeaderRes.body.data.name === 'Dr. Almaz Tefera, MD, MPH', 'Leader name updated');

    const getLeadershipRes = await request(server)
      .get('/api/v1/cms/leadership')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(getLeadershipRes.status === 200, 'GET /cms/leadership returns HTTP 200');
    assert(
      getLeadershipRes.body.data.some((pos: any) =>
        pos.leaders?.some((l: any) => l.id === leaderId),
      ),
      'Leadership roster contains created leader',
    );

    // 2.4 CMS Programs Lifecycle (Draft -> Publish -> Archive)
    const createProgRes = await request(server)
      .post('/api/v1/cms/programs')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'Annual Youth Mentorship Program 2026', am: 'የ2026 የወጣቶች ማሰልጠኛ ፕሮግራም' },
        description: { en: 'Hands-on training and mentorship for emerging professionals' },
        category: 'Education',
        status: ContentStatus.DRAFT,
        isMembersOnly: true,
      });
    assert(createProgRes.status === 201, 'Create CMS program succeeds (HTTP 201)');
    const programId = createProgRes.body.data.id;
    assert(createProgRes.body.data.status === ContentStatus.DRAFT, 'Program starts in DRAFT status');

    const publishProgRes = await request(server)
      .post(`/api/v1/cms/programs/${programId}/publish`)
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(publishProgRes.status === 200, 'Publish CMS program succeeds (HTTP 200)');
    assert(publishProgRes.body.data.status === ContentStatus.PUBLISHED, 'Program status is PUBLISHED');
    assert(publishProgRes.body.data.id === programId, 'Published program ID matches');

    const archiveProgRes = await request(server)
      .post(`/api/v1/cms/programs/${programId}/archive`)
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(archiveProgRes.status === 200, 'Archive CMS program succeeds (HTTP 200)');
    assert(archiveProgRes.body.data.status === ContentStatus.ARCHIVED, 'Program status is ARCHIVED');

    // 2.5 CMS Benefits Management
    const createBenefitRes = await request(server)
      .post('/api/v1/cms/benefits')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'Access to Legal Consultations', am: 'የህግ ምክር አገልግሎት' },
        description: { en: 'Complimentary quarterly legal consultation sessions' },
        icon: 'scale',
        displayOrder: 2,
        isActive: true,
      });
    assert(createBenefitRes.status === 201, 'Create membership benefit succeeds (HTTP 201)');
    const benefitId = createBenefitRes.body.data.id;

    const listBenefitsRes = await request(server)
      .get('/api/v1/cms/benefits')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(listBenefitsRes.status === 200, 'GET /cms/benefits returns HTTP 200');
    assert(
      listBenefitsRes.body.data.some((b: any) => b.id === benefitId),
      'Benefits list includes newly created benefit',
    );

    // 2.6 CMS Rules & Bylaws
    const createRuleRes = await request(server)
      .post('/api/v1/cms/rules')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'Code of Ethics and Professional Conduct', am: 'የስነ-ምግባር ደንብ' },
        content: { en: 'All members must uphold transparency and mutual respect.' },
        category: 'Governance',
        displayOrder: 1,
        isActive: true,
      });
    assert(createRuleRes.status === 201, 'Create organization rule succeeds (HTTP 201)');
    const ruleId = createRuleRes.body.data.id;

    const listRulesRes = await request(server)
      .get('/api/v1/cms/rules')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(listRulesRes.status === 200, 'GET /cms/rules returns HTTP 200');
    assert(listRulesRes.body.data.some((r: any) => r.id === ruleId), 'Rules list includes newly created rule');

    // 2.7 CMS Announcements Lifecycle
    const createAnnounceRes = await request(server)
      .post('/api/v1/cms/announcements')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'General Assembly Meeting Notice 2026' },
        content: { en: 'The annual assembly will convene at the main hall on Saturday.' },
        isPinned: true,
        status: ContentStatus.DRAFT,
      });
    assert(createAnnounceRes.status === 201, 'Create CMS announcement succeeds (HTTP 201)');
    const announcementId = createAnnounceRes.body.data.id;
    assert(createAnnounceRes.body.data.status === ContentStatus.DRAFT, 'Announcement starts as DRAFT');

    const publishAnnounceRes = await request(server)
      .post(`/api/v1/cms/announcements/${announcementId}/publish`)
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId);
    assert(publishAnnounceRes.status === 200, 'Publish CMS announcement succeeds (HTTP 200)');
    assert(publishAnnounceRes.body.data.status === ContentStatus.PUBLISHED, 'Announcement status is PUBLISHED');

    // 2.8 RBAC Enforcement: Regular member blocked from mutating CMS
    const memberCmsRes = await request(server)
      .post('/api/v1/cms/announcements')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'Unauthorized Announcement' },
        content: { en: 'Should be blocked' },
      });
    assert(memberCmsRes.status === 403, 'Regular member blocked from CMS mutation (HTTP 403)');

    // 2.9 Multi-Tenant Isolation: Ethio-Med admin blocked from mutating 4B announcement
    const crossTenantCmsRes = await request(server)
      .patch(`/api/v1/cms/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId)
      .send({
        title: { en: 'Malicious Cross-Tenant Overwrite' },
      });
    assert(
      crossTenantCmsRes.status === 404 || crossTenantCmsRes.status === 403,
      'Cross-tenant CMS modification blocked by RLS/Tenant boundary (HTTP 404/403)',
    );

    // =============================================================
    // SECTION 3: Notifications & Preferences
    // =============================================================
    console.log('\n--- 3. Notifications & Preferences ---');

    // 3.1 Send direct notification to member
    const notifTitle = `Important Membership Alert ${Date.now()}`;
    const sendResult = await notificationsService.sendNotification({
      organizationId: org4BId,
      recipientUserId: memberUserId,
      title: notifTitle,
      message: 'Please review your upcoming annual renewal details.',
      channel: NotificationChannel.IN_APP,
      idempotencyKey: `notif_key_${Date.now()}`,
    });
    const sentNotif = sendResult.notification;
    assert(!!sentNotif?.id, 'Notification dispatched successfully');
    assert(sentNotif?.status === NotificationStatus.UNREAD, 'Notification initially has UNREAD status');

    // 3.2 Member fetches notifications
    const getNotifsRes = await request(server)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId);
    assert(getNotifsRes.status === 200, 'Member retrieves notifications (HTTP 200)');
    assert(
      getNotifsRes.body.data.items?.some((n: any) => n.id === sentNotif.id),
      'Notifications list contains dispatched notification',
    );
    assert(typeof getNotifsRes.body.data.unreadCount === 'number', 'Reports unread count metric');

    // 3.3 Mark single notification as read
    const markReadRes = await request(server)
      .patch(`/api/v1/notifications/${sentNotif.id}/read`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId);
    assert(markReadRes.status === 200, 'Mark notification as read succeeds (HTTP 200)');
    assert(markReadRes.body.data.status === NotificationStatus.READ, 'Notification status updated to READ');
    assert(!!markReadRes.body.data.readAt, 'readAt timestamp recorded');

    // 3.4 Mark all notifications as read
    const markAllRes = await request(server)
      .post('/api/v1/notifications/mark-all-read')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId);
    assert(markAllRes.status === 201, 'POST /notifications/mark-all-read succeeds (HTTP 201)');

    // 3.5 Notification preferences
    const getPrefsRes = await request(server)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId);
    assert(getPrefsRes.status === 200, 'GET /notifications/preferences returns HTTP 200');

    const updatePrefsRes = await request(server)
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        emailEnabled: false,
        inAppEnabled: true,
      });
    assert(updatePrefsRes.status === 200, 'PATCH /notifications/preferences succeeds (HTTP 200)');
    assert(updatePrefsRes.body.data.emailEnabled === false, 'Preference emailEnabled updated to false');

    // 3.6 Idempotency test: Re-sending with same idempotencyKey does NOT create duplicate
    const idempKey = `dedup_test_${Date.now()}`;
    const firstRes = await notificationsService.sendNotification({
      organizationId: org4BId,
      recipientUserId: memberUserId,
      title: 'First Delivery',
      message: 'Initial dispatch',
      idempotencyKey: idempKey,
    });
    const secondRes = await notificationsService.sendNotification({
      organizationId: org4BId,
      recipientUserId: memberUserId,
      title: 'Duplicate Delivery',
      message: 'Should be deduplicated',
      idempotencyKey: idempKey,
    });
    assert(firstRes.notification.id === secondRes.notification.id, 'Duplicate notification with same idempotencyKey deduplicated');
    assert(secondRes.isDuplicate === true, 'Duplicate notification flagged with isDuplicate: true');

    // 3.7 Tenant Broadcast: Admin sends broadcast to all members
    const broadcastRes = await request(server)
      .post('/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: 'Urgent Maintenance Broadcast',
        message: 'Platform scheduled maintenance tonight at midnight.',
      });
    assert(broadcastRes.status === 201, 'Admin broadcasts notification (HTTP 201)');
    assert(
      (broadcastRes.body.data.deliveredCount ?? broadcastRes.body.data.recipientCount) > 0,
      'Broadcast reports non-zero delivered count',
    );

    // 3.8 RBAC: Regular member blocked from broadcasting
    const memberBroadcastRes = await request(server)
      .post('/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: 'Spam broadcast',
        message: 'Should be rejected',
      });
    assert(memberBroadcastRes.status === 403, 'Regular member blocked from broadcast (HTTP 403)');

    // =============================================================
    // SECTION 4: SaaS Plans, Subscriptions & Entitlements
    // =============================================================
    console.log('\n--- 4. SaaS Plans, Subscriptions & Entitlements ---');

    // 4.1 Platform Admin creates new SaaS Plan
    const planTimestamp = Date.now();
    const planCode = `ENTERPRISE_${planTimestamp}`;
    const planName = `Enterprise Tier ${planTimestamp}`;
    const createPlanRes = await request(server)
      .post('/api/v1/subscriptions/admin/plans')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: planName,
        code: planCode,
        description: 'Comprehensive tier for large associations with full feature access',
        price: 25000,
        currency: 'ETB',
        maxMembers: 10000,
        maxStaff: 50,
        storageLimitMb: 10240,
        features: {
          customBranding: true,
          advancedAnalytics: true,
          smsGateway: true,
          prioritySupport: true,
        },
        isActive: true,
      });
    if (createPlanRes.status !== 201) {
      console.log('DEBUG createPlanRes status:', createPlanRes.status, 'body:', createPlanRes.body);
    }
    assert(createPlanRes.status === 201, 'Platform Admin creates SaaS Plan (HTTP 201)');
    const createdPlanId = createPlanRes.body.data.id;
    assert(createPlanRes.body.data.code === planCode, 'Plan code persisted');

    // 4.2 Non-platform admin blocked from creating SaaS Plan
    const unauthorizedPlanRes = await request(server)
      .post('/api/v1/subscriptions/admin/plans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Hacked Plan',
        code: 'HACK',
        price: 0,
      });
    assert(unauthorizedPlanRes.status === 403, 'Tenant Admin blocked from creating SaaS Plan (HTTP 403)');

    // 4.3 Public plans listing
    const publicPlansRes = await request(server).get('/api/v1/subscriptions/plans');
    assert(publicPlansRes.status === 200, 'Public SaaS plans listing returns HTTP 200');
    assert(
      publicPlansRes.body.data.some((p: any) => p.id === createdPlanId),
      'Public plans includes newly created enterprise tier',
    );

    // 4.4 Platform Admin assigns subscription to organization
    const assignSubRes = await request(server)
      .post('/api/v1/subscriptions/admin/assign')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        organizationId: org4BId,
        saasPlanId: createdPlanId,
        durationMonths: 12,
      });
    assert(assignSubRes.status === 201, 'Platform Admin assigns SaaS subscription to 4B (HTTP 201)');
    assert(assignSubRes.body.data.saasPlanId === createdPlanId, 'Subscription links to assigned plan');

    // 4.5 Tenant retrieves current subscription
    const getMySubRes = await request(server)
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-id', org4BId);
    assert(getMySubRes.status === 200, 'GET /subscriptions/me returns HTTP 200');
    assert(getMySubRes.body.data.saasPlan.code === planCode, 'Subscription reflects newly assigned plan');

    // 4.6 Usage metrics calculation
    const getUsageRes = await request(server)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-id', org4BId);
    assert(getUsageRes.status === 200, 'GET /subscriptions/usage returns HTTP 200');
    assert(typeof getUsageRes.body.data.currentMembers === 'number', 'Reports currentMembers metric');
    assert(getUsageRes.body.data.maxMembers === 10000, 'Reports plan capacity maxMembers: 10000');
    assert(getUsageRes.body.data.memberCapacityPercentage >= 0, 'Reports member capacity percentage');
    assert(typeof getUsageRes.body.data.currentStaff === 'number', 'Reports currentStaff metric');

    // 4.7 Centralized Entitlement Service Checks
    const hasBranding = await entitlementService.hasFeature(org4BId, 'customBranding');
    assert(hasBranding === true, 'Entitlement service verifies customBranding feature: true');

    const hasFakeFeature = await entitlementService.hasFeature(org4BId, 'nonExistentSuperFeature');
    assert(hasFakeFeature === false, 'Entitlement service confirms nonExistentSuperFeature: false');

    let assertFeatureThrew = false;
    try {
      await entitlementService.assertFeature(org4BId, 'nonExistentSuperFeature');
    } catch (e: any) {
      assertFeatureThrew = true;
    }
    assert(assertFeatureThrew, 'assertFeature throws ForbiddenException when feature is missing from plan');

    const memberLimitCheck = await entitlementService.checkMemberLimit(org4BId);
    assert(memberLimitCheck.allowed === true, 'Member count is well within 10,000 capacity');

    // =============================================================
    // SECTION 5: SaaS Billing & Invoices
    // =============================================================
    console.log('\n--- 5. SaaS Billing & Invoices ---');

    // 5.1 Platform Admin generates SaaS billing invoice
    const createInvoiceRes = await request(server)
      .post('/api/v1/subscriptions/admin/invoices')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        organizationId: org4BId,
        amount: 25000,
        currency: 'ETB',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Annual SaaS subscription invoice for 4B Association',
      });
    assert(createInvoiceRes.status === 201, 'Platform Admin generates SaaS invoice (HTTP 201)');
    const invoiceId = createInvoiceRes.body.data.id;
    assert(createInvoiceRes.body.data.status === SaasInvoiceStatus.ISSUED, 'Invoice created with status ISSUED');
    assert(createInvoiceRes.body.data.organizationId === org4BId, 'Invoice correctly assigned to organization');

    // 5.2 Non-admin blocked from creating SaaS invoice
    const unauthorizedInvoiceRes = await request(server)
      .post('/api/v1/subscriptions/admin/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        organizationId: org4BId,
        amount: 100,
        dueDate: new Date().toISOString(),
      });
    assert(unauthorizedInvoiceRes.status === 403, 'Tenant Admin blocked from creating SaaS invoice (HTTP 403)');

    // 5.3 Tenant views their own invoices
    const getInvoicesRes = await request(server)
      .get('/api/v1/subscriptions/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-id', org4BId);
    assert(getInvoicesRes.status === 200, 'Tenant retrieves their own SaaS invoices (HTTP 200)');
    assert(
      getInvoicesRes.body.data.some((inv: any) => inv.id === invoiceId),
      'Invoices list includes newly issued invoice',
    );

    // 5.4 Platform Admin settles SaaS invoice
    const settleInvoiceRes = await request(server)
      .post(`/api/v1/subscriptions/admin/invoices/${invoiceId}/settle`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        paymentReference: `REF_SAAS_${Date.now()}`,
      });
    assert(settleInvoiceRes.status === 200, 'Platform Admin settles invoice (HTTP 200)');
    assert(settleInvoiceRes.body.data.status === SaasInvoiceStatus.PAID, 'Invoice status is PAID');
    assert(!!settleInvoiceRes.body.data.paidDate, 'Invoice paidDate timestamp recorded');

    // 5.5 Invoices are protected by PostgreSQL RLS
    const directRlsInvoices = await prisma.withTenantContext(orgMedId, (tx) =>
      tx.saasInvoice.findMany(),
    );
    assert(
      directRlsInvoices.every((inv) => inv.organizationId === orgMedId),
      'PostgreSQL RLS guarantees Ethio-Med context CANNOT query 4B invoices',
    );

    // =============================================================
    // SECTION 6: Comprehensive Security & Adversarial Attacks
    // =============================================================
    console.log('\n--- 6. Comprehensive Security & Adversarial Attack Suite ---');

    // 6.1 Attack: Cross-Tenant CMS Deletion attempt
    const crossTenantDeleteRes = await request(server)
      .delete(`/api/v1/cms/leadership/positions/${positionId}`)
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId);
    assert(
      crossTenantDeleteRes.status === 404 || crossTenantDeleteRes.status === 403,
      'ATTACK BLOCKED: Cross-tenant CMS position deletion blocked (HTTP 404/403)',
    );

    // 6.2 Attack: Cross-Tenant Notification Read attempt
    const crossTenantNotifRes = await request(server)
      .patch(`/api/v1/notifications/${sentNotif.id}/read`)
      .set('Authorization', `Bearer ${yohannesToken}`)
      .set('x-tenant-id', orgMedId);
    assert(
      crossTenantNotifRes.status === 404 || crossTenantNotifRes.status === 403,
      'ATTACK BLOCKED: Cross-tenant notification read manipulation blocked (HTTP 404/403)',
    );

    // 6.3 Attack: Regular member attempts to settle SaaS invoice
    const memberSettleRes = await request(server)
      .post(`/api/v1/subscriptions/admin/invoices/${invoiceId}/settle`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ paymentReference: 'FAKE_PAY' });
    assert(
      memberSettleRes.status === 403,
      'ATTACK BLOCKED: Non-platform-admin blocked from settling SaaS invoices (HTTP 403)',
    );

    // 6.4 Attack: Privilege Escalation — member attempts to update organization status
    const privEscStatusRes = await request(server)
      .patch(`/api/v1/organizations/${org4BId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: OrganizationStatus.ACTIVE });
    assert(
      privEscStatusRes.status === 403,
      'ATTACK BLOCKED: Regular member blocked from changing organization lifecycle status (HTTP 403)',
    );

    // 6.5 Attack: XSS injection attempt into organization rules rejected
    const xssRuleRes = await request(server)
      .post('/api/v1/cms/rules')
      .set('Authorization', `Bearer ${kebedeToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        title: { en: 'Bylaw <script>alert(document.cookie)</script>' },
        content: { en: 'Legitimate rule content <svg/onload=alert(1)>' },
        category: 'Governance',
      });
    assert(
      xssRuleRes.status === 400,
      'ATTACK BLOCKED: Rule creation with malicious XSS script rejected with HTTP 400',
    );

    console.log('\n========================================================');
    console.log('ALL PHASE 7 ORG OPS, CMS, NOTIF & BILLING TESTS PASSED!');
    console.log('========================================================\n');
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    try {
      await prisma.withPlatformAdminContext((tx) =>
        tx.organization.updateMany({
          data: { status: OrganizationStatus.ACTIVE },
        }),
      );
    } catch {}
    await app.close();
  }
}

runPhase7Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
