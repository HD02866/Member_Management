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

async function runImageMasterSuite() {
  console.log('\n========================================================');
  console.log('📸 4BAYE MASTER VERIFICATION: IMAGES, ATTACHMENTS, IDS & PDF');
  console.log('========================================================\n');

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
    // 1. Authenticate Test Actors
    // -------------------------------------------------------------
    console.log('--- 1. Authenticating Test Actors ---');
    const kebedeLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'kebede.admin@4bassociation.org', password: 'Password123!' });
    assert(kebedeLogin.status === 200, '4B Admin login succeeds');
    const adminToken = kebedeLogin.body.data.tokens.accessToken;

    const abebeLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'abebe.member@example.com', password: 'Password123!' });
    assert(abebeLogin.status === 200, 'Member Abebe login succeeds');
    const memberToken = abebeLogin.body.data.tokens.accessToken;

    const org4B = await prisma.organization.findUnique({ where: { slug: '4b' } });
    assert(!!org4B, '4B organization resolved in DB');

    // -------------------------------------------------------------
    // 2. Member Digital ID Photo Upload by Admin
    // -------------------------------------------------------------
    console.log('\n--- 2. Member Digital ID Photo Upload & Retrieval ---');
    const memberProfile = await prisma.memberProfile.findFirst({
      where: { organizationId: org4B!.id, userId: abebeLogin.body.data.user.id },
    });
    assert(!!memberProfile, 'Member profile found in 4B');

    // Create a 1x1 valid PNG buffer: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
    ]);

    const uploadPhotoRes = await request(server)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', org4B!.id)
      .field('purpose', 'MEMBER_PHOTO')
      .attach('file', validPngBuffer, 'test_member_id.png');
    assert(uploadPhotoRes.status === 201, 'Admin uploads Digital ID photo file (HTTP 201)');
    const uploadedPhotoUrl = uploadPhotoRes.body.data.url;
    assert(!!uploadedPhotoUrl, 'Uploaded file returned URL');

    // Admin associates photo with member profile
    const associateRes = await request(server)
      .patch(`/api/v1/members/admin/${memberProfile!.id}/digital-id-photo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', org4B!.id)
      .send({ photoUrl: uploadedPhotoUrl });
    assert(associateRes.status === 200, 'Admin associates photo with member profile (HTTP 200)');
    assert(associateRes.body.data.photoUrl === uploadedPhotoUrl, 'Photo URL updated on member profile');

    // Member views own Digital Card via /cards/me
    const myCardRes = await request(server)
      .get('/api/v1/cards/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4B!.id);
    assert(myCardRes.status === 200, 'Member retrieves Digital Card (HTTP 200)');
    assert(myCardRes.body.data.memberProfile?.photoUrl === uploadedPhotoUrl, 'Digital Card includes uploaded photo URL');

    // Authorized member retrieves the photo via GET /api/v1/uploads/:filename
    const photoFilename = uploadedPhotoUrl.replace('/uploads/', '');
    const getPhotoRes = await request(server)
      .get(`/api/v1/uploads/${photoFilename}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4B!.id);
    assert(getPhotoRes.status === 200, 'Member retrieves their own photo file (HTTP 200)');
    assert(getPhotoRes.headers['content-type'].includes('image/png'), 'Photo served with image/png MIME type');

    // -------------------------------------------------------------
    // 3. Announcement Cover Upload & Public Availability
    // -------------------------------------------------------------
    console.log('\n--- 3. Announcement Cover Upload & Public Access ---');
    const uploadCoverRes = await request(server)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', org4B!.id)
      .field('purpose', 'GENERAL')
      .attach('file', validPngBuffer, 'announcement_banner.png');
    assert(uploadCoverRes.status === 201, 'Admin uploads announcement cover (HTTP 201)');
    const coverUrl = uploadCoverRes.body.data.url;
    const coverFilename = coverUrl.replace('/uploads/', '');

    // Admin creates published public announcement with cover
    const createAnnRes = await request(server)
      .post('/api/v1/cms/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', org4B!.id)
      .send({
        title: { en: 'Annual 4Baye Assembly 2026' },
        content: { en: 'Official convening of the 4Baye General Assembly.' },
        coverImageUrl: coverUrl,
        audience: 'PUBLIC',
        status: 'PUBLISHED',
      });
    assert(createAnnRes.status === 201, 'Admin creates public announcement (HTTP 201)');

    // Unauthenticated visitor retrieves announcement image file
    const getPublicCoverRes = await request(server)
      .get(`/api/v1/uploads/${coverFilename}`)
      .set('x-tenant-id', org4B!.id);
    assert(getPublicCoverRes.status === 200, 'Public visitor retrieves announcement cover image (HTTP 200)');
    assert(getPublicCoverRes.headers['content-type'].includes('image/png'), 'Public cover served with correct MIME');

    // -------------------------------------------------------------
    // 4. Chat Image Attachments & Participant Access Control
    // -------------------------------------------------------------
    console.log('\n--- 4. Private Chat Image Attachments & Isolation ---');
    // Upload chat attachment
    const uploadChatAttRes = await request(server)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', org4B!.id)
      .field('purpose', 'GENERAL')
      .attach('file', validPngBuffer, 'secret_receipt.png');
    assert(uploadChatAttRes.status === 201, 'Admin uploads chat attachment image (HTTP 201)');
    const chatAttUrl = uploadChatAttRes.body.data.url;
    const chatAttFilename = chatAttUrl.replace('/uploads/', '');

    // Admin creates or finds conversation with Member Abebe
    let conv = await prisma.conversation.findFirst({
      where: {
        organizationId: org4B!.id,
        participants: { every: { userId: { in: [kebedeLogin.body.data.user.id, abebeLogin.body.data.user.id] } } },
      },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          organizationId: org4B!.id,
          participants: {
            create: [
              { userId: kebedeLogin.body.data.user.id },
              { userId: abebeLogin.body.data.user.id },
            ],
          },
        },
      });
    }

    // Send private message with attachment
    const sendMsgRes = await request(server)
      .post(`/api/v1/messages/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', org4B!.id)
      .send({
        content: 'Please find attached copy of the receipt',
        attachments: [
          {
            url: chatAttUrl,
            filename: 'secret_receipt.png',
            mimeType: 'image/png',
            sizeBytes: validPngBuffer.length,
          },
        ],
      });
    assert(sendMsgRes.status === 201, 'Private message sent with attachment (HTTP 201)');

    // Conversation participant (Member Abebe) can access the attachment
    const getChatAttRes = await request(server)
      .get(`/api/v1/uploads/${chatAttFilename}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-tenant-id', org4B!.id);
    assert(getChatAttRes.status === 200, 'Participant retrieves private chat attachment (HTTP 200)');

    // Unauthenticated user attempting to access private attachment is rejected
    const getUnauthAttRes = await request(server)
      .get(`/api/v1/uploads/${chatAttFilename}`)
      .set('x-tenant-id', org4B!.id);
    assert(getUnauthAttRes.status === 403, 'ATTACK BLOCKED: Unauthenticated user denied private attachment (HTTP 403 Forbidden)');

    // -------------------------------------------------------------
    // 5. Digital ID Verification Token Minimal Disclosure
    // -------------------------------------------------------------
    console.log('\n--- 5. Digital ID Verification Token Verification ---');
    assert(!!myCardRes.body.data.qrToken, 'Active member card contains QR verification token');
    const verifyRes = await request(server).get(`/api/v1/verify/${myCardRes.body.data.qrToken}`);
    assert(verifyRes.status === 200, 'Public verify portal validates QR token (HTTP 200)');
    assert(verifyRes.body.data.isValid === true, 'Verification confirms card is VALID');
    assert(verifyRes.body.data.result === 'VALID', 'Verification result is VALID');
    assert(!verifyRes.body.data.member?.email, 'Privacy: Member email is NEVER disclosed on public verification');

    console.log('\n========================================================');
    console.log('🎉 ALL IMAGE LIFECYCLE & ACCESS CONTROL TESTS PASSED 100%!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runImageMasterSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
