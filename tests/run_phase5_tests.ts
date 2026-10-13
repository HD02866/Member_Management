import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/database/prisma.service';
import { PaymentStatus, MembershipStatus, MemberStatus, CardStatus, VerificationResult } from '@prisma/client';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runPhase5Tests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII PHASE 5 PAYMENTS, PROOFS & DIGITAL ID INTEGRATION TESTS');
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
      .send({ identifier: 'admin@waanofii.com', password: 'Password123!' });
    assert(adminLoginRes.status === 200, 'Platform Super Admin login succeeds');
    const platformAdminToken = adminLoginRes.body.data.tokens.accessToken;

    // 4B Finance Officer (Aster Finance)
    const asterLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'aster.finance@4bassociation.org', password: 'Password123!' });
    assert(asterLoginRes.status === 200, '4B Finance Officer login succeeds');
    const financeToken = asterLoginRes.body.data.tokens.accessToken;
    const financeUserId = asterLoginRes.body.data.user.id;

    // 4B Admin (Kebede Tadesse)
    const kebedeLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'kebede.admin@4bassociation.org', password: 'Password123!' });
    assert(kebedeLoginRes.status === 200, '4B Admin login succeeds');
    const kebedeToken = kebedeLoginRes.body.data.tokens.accessToken;

    // Resolve 4B and Ethio-Med organization IDs
    const org4BRes = await request(server).get('/api/v1/organizations/4b');
    const orgMedRes = await request(server).get('/api/v1/organizations/ethio-med');
    assert(org4BRes.status === 200, '4B organization resolved');
    assert(orgMedRes.status === 200, 'Ethio-Med organization resolved');
    const org4BId = org4BRes.body.data.id;
    const orgMedId = orgMedRes.body.data.id;

    // Register a fresh applicant user for 4B membership
    const timestamp = Date.now();
    const applicantEmail = `applicant_p5_${timestamp}@example.com`;
    const regApplicantRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: applicantEmail,
        phoneNumber: `+25191188${timestamp.toString().slice(-4)}`,
        firstName: 'Bekele',
        lastName: 'Mola',
        password: 'Password123!',
      });
    assert(regApplicantRes.status === 201, 'Fresh applicant registered');
    const applicantToken = regApplicantRes.body.data.tokens.accessToken;
    const applicantUserId = regApplicantRes.body.data.user.id;

    // Applicant applies for 4B membership
    const plans4B = await request(server)
      .get('/api/v1/memberships/plans')
      .set('x-tenant-id', org4BId);
    assert(plans4B.status === 200 && plans4B.body.data.length > 0, '4B membership plans available');
    const chosenPlan = plans4B.body.data[0];

    const applyRes = await request(server)
      .post('/api/v1/memberships/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({ planId: chosenPlan.id });
    assert(applyRes.status === 201, 'Applicant applied for membership (REGISTERED status)');
    const membershipId = applyRes.body.data.membership.id;

    // -------------------------------------------------------------
    // SUITE 1: Payment Method Discovery & Initiation
    // -------------------------------------------------------------
    console.log('\n--- 1. Payment Method Discovery & Initiation ---');
    // 1.1 Discover active payment methods
    const methodsRes = await request(server)
      .get('/api/v1/payments/methods')
      .set('x-tenant-id', org4BId);
    assert(methodsRes.status === 200, 'GET /payments/methods returns HTTP 200');
    assert(Array.isArray(methodsRes.body.data) && methodsRes.body.data.length > 0, 'Returns active payment methods array');
    const testMethod = methodsRes.body.data[0];

    // 1.2 Unauthenticated payment initiation rejected with 401
    const unauthPayRes = await request(server)
      .post('/api/v1/payments')
      .set('x-tenant-id', org4BId)
      .send({ membershipId, paymentMethodId: testMethod.id });
    assert(unauthPayRes.status === 401, 'Unauthenticated payment initiation rejected with HTTP 401');

    // 1.3 Client tampering with amount/currency/status rejected by DTO validation (HTTP 400)
    const hackedAmountPayRes = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        membershipId,
        amount: '1.00', // Malicious attempt to force price
        status: 'VERIFIED', // Malicious attempt to force status
      });
    assert(
      hackedAmountPayRes.status === 400,
      'Client attempt to supply trusted amount/status rejected with HTTP 400 Bad Request',
    );

    // 1.4 Valid Payment Initiation with Server-Authoritative Pricing
    const initPayRes = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        membershipId,
        paymentMethodId: testMethod.id,
      });
    assert(initPayRes.status === 201, 'POST /payments initiates payment with HTTP 201 Created');
    const payment = initPayRes.body.data.payment;
    assert(payment.status === PaymentStatus.PENDING, 'Payment created with server status PENDING');
    assert(
      Number(payment.amount) === Number(chosenPlan.price) + Number(chosenPlan.registrationFee || 0),
      'Payment amount is strictly determined by server-side plan pricing (Critical Money Rule)',
    );
    assert(payment.currency === (chosenPlan.currency || 'ETB'), 'Payment currency is strictly server-authoritative');
    assert(payment.transactionReference.startsWith('PAY-'), 'Transaction reference is server-generated');
    assert(initPayRes.body.data.nextStep === 'SUBMIT_PAYMENT_PROOF', 'Response instructs nextStep: SUBMIT_PAYMENT_PROOF');
    const paymentId = payment.id;

    // Verify membership status transitioned to PAYMENT_PENDING
    const memCheck = await prisma.membership.findUnique({ where: { id: membershipId } });
    assert(memCheck?.status === MembershipStatus.PAYMENT_PENDING, 'Membership status transitioned to PAYMENT_PENDING');

    // -------------------------------------------------------------
    // SUITE 2: Payment Idempotency & Replay Protection
    // -------------------------------------------------------------
    console.log('\n--- 2. Payment Idempotency & Replay Protection ---');
    const idempotencyKey = `idem_key_${timestamp}`;

    // 2.1 First payment request with Idempotency-Key header
    const idemPayRes1 = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .set('idempotency-key', idempotencyKey)
      .send({ membershipId, paymentMethodId: testMethod.id });
    assert(idemPayRes1.status === 201, 'First payment with Idempotency-Key created with HTTP 201');
    const idemPaymentId = idemPayRes1.body.data.payment.id;

    // 2.2 Repeat request with SAME Idempotency-Key header returns replay without creating second record
    const idemPayRes2 = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .set('idempotency-key', idempotencyKey)
      .send({ membershipId, paymentMethodId: testMethod.id });
    assert(idemPayRes2.status === 201, 'Replay request returns HTTP 201 with existing record');
    assert(idemPayRes2.body.data.isReplay === true, 'Response indicates isReplay: true');
    assert(idemPayRes2.body.data.payment.id === idemPaymentId, 'Replay returns identical payment ID');

    // Verify DB count has exactly 1 record for this idempotency key
    const idemCount = await prisma.payment.count({ where: { idempotencyKey } });
    assert(idemCount === 1, 'Database contains exactly 1 payment record for unique idempotency key');

    // -------------------------------------------------------------
    // SUITE 3: Manual Payment Proof Submission & Validation
    // -------------------------------------------------------------
    console.log('\n--- 3. Manual Payment Proof Submission ---');
    const proofFileUrl = `https://storage.waanofii.local/proofs/4b/slip_${timestamp}.jpg`;

    // 3.1 Invalid file type (executable/HTML) rejected with 400
    const badFileTypeRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/proof`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        fileUrl: proofFileUrl,
        fileType: 'application/x-msdownload', // Disallowed MIME type
        fileSize: 1048576,
      });
    assert(badFileTypeRes.status === 400, 'Disallowed MIME type rejected with HTTP 400 Bad Request');

    // 3.2 File size exceeding 5MB rejected with 400
    const oversizeRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/proof`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        fileUrl: proofFileUrl,
        fileType: 'image/jpeg',
        fileSize: 10 * 1024 * 1024, // 10MB > 5MB limit
      });
    assert(oversizeRes.status === 400, 'Oversized file (>5MB) rejected with HTTP 400 Bad Request');

    // 3.3 Legitimate proof submission
    const validProofRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/proof`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        fileUrl: proofFileUrl,
        fileType: 'image/jpeg',
        fileSize: 204800,
        originalFileName: 'bank_transfer_slip.jpg',
        transactionReference: `FT-CBE-${timestamp.toString().slice(-6)}`,
        notes: 'Paid via CBE Mobile Banking Finfine branch',
      });
    assert(validProofRes.status === 201, 'POST /payments/:id/proof succeeds with HTTP 201 Created');
    assert(validProofRes.body.data.payment.status === PaymentStatus.UNDER_REVIEW, 'Payment status updated to UNDER_REVIEW');

    // Verify membership transitioned to UNDER_REVIEW
    const memProofCheck = await prisma.membership.findUnique({ where: { id: membershipId } });
    assert(memProofCheck?.status === MembershipStatus.UNDER_REVIEW, 'Membership status transitioned to UNDER_REVIEW');

    // 3.4 Member lists own payments
    const myPaymentsRes = await request(server)
      .get('/api/v1/payments/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId);
    assert(myPaymentsRes.status === 200, 'GET /payments/me returns HTTP 200');
    assert(myPaymentsRes.body.data.length >= 1, 'Member sees their payment history');

    // -------------------------------------------------------------
    // SUITE 4: Finance Review & Segregation of Duties
    // -------------------------------------------------------------
    console.log('\n--- 4. Finance Review & Segregation of Duties ---');
    // 4.1 Regular member attempting to access review queue rejected with 403
    const memberReviewRes = await request(server)
      .get('/api/v1/payments/review')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId);
    assert(memberReviewRes.status === 403, 'Regular member accessing finance review queue rejected with HTTP 403');

    // 4.2 Finance Officer accesses review queue
    const financeReviewRes = await request(server)
      .get('/api/v1/payments/review')
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId);
    assert(financeReviewRes.status === 200, 'Finance Officer accessing review queue returns HTTP 200');
    assert(
      financeReviewRes.body.data.some((p: any) => p.id === paymentId),
      'Pending payment is listed in review queue',
    );

    // 4.3 SEGREGATION OF DUTIES: Member CANNOT approve their own payment proof!
    // Give applicant a mock temporary staff role or attempt approval with applicant's token
    const selfApproveRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({ notes: 'Self approval attempt' });
    assert(
      selfApproveRes.status === 403,
      'SEGREGATION OF DUTIES: User cannot approve their own payment proof (HTTP 403 Forbidden)',
    );

    // 4.4 Rejection without reason rejected with 400
    const emptyRejectRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reject`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId)
      .send({});
    assert(emptyRejectRes.status === 400, 'Payment rejection without reason rejected with HTTP 400');

    // 4.5 Legitimate Approval by Finance Officer (Atomic Activation)
    const approveRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId)
      .send({ notes: 'Verified FT reference against CBE statement' });
    assert(approveRes.status === 201, 'POST /payments/:id/approve succeeds with HTTP 201 Created');
    assert(approveRes.body.data.payment.status === PaymentStatus.VERIFIED, 'Payment status updated to VERIFIED');
    assert(approveRes.body.data.membership.status === MembershipStatus.ACTIVE, 'Membership status activated to ACTIVE');
    assert(approveRes.body.data.card !== undefined, 'Digital membership card issued upon approval');
    assert(approveRes.body.data.card.qrToken !== undefined, 'QR verification token generated');
    const issuedCardNumber = approveRes.body.data.card.cardNumber;
    const issuedQrToken = approveRes.body.data.card.qrToken;

    // Verify DB integrity for membership activation
    const activeMember = await prisma.memberProfile.findFirst({ where: { userId: applicantUserId } });
    assert(activeMember?.status === MemberStatus.ACTIVE, 'Member profile transitioned to ACTIVE in database');

    const period = await prisma.membershipPeriod.findFirst({ where: { paymentId } });
    assert(period !== null, 'Membership period record created atomically');
    assert(period?.startDate !== undefined && period?.endDate !== undefined, 'Membership period dates set in UTC');

    // 4.6 Replay Protection: Re-approving already verified payment rejected with 409
    const repeatApproveRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId)
      .send({ notes: 'Duplicate approval attempt' });
    assert(repeatApproveRes.status === 409, 'Replay approval on verified payment rejected with HTTP 409 Conflict');

    // -------------------------------------------------------------
    // SUITE 5: Digital Membership Card & QR Verification
    // -------------------------------------------------------------
    console.log('\n--- 5. Digital Membership Card & QR Verification ---');
    // 5.1 Member fetches their digital card
    const myCardRes = await request(server)
      .get('/api/v1/cards/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId);
    assert(myCardRes.status === 200, 'GET /cards/me returns HTTP 200');
    assert(myCardRes.body.data.cardNumber === issuedCardNumber, 'Returned card number matches issued card');
    assert(myCardRes.body.data.status === CardStatus.ACTIVE, 'Card status reports ACTIVE');
    assert(myCardRes.body.data.qrToken === issuedQrToken, 'Card contains valid QR token');

    // 5.2 Public QR Verification of Valid Token
    const verifyValidRes = await request(server).get(`/api/v1/verify/${issuedQrToken}`);
    assert(verifyValidRes.status === 200, 'GET /verify/:token returns HTTP 200');
    assert(verifyValidRes.body.data.isValid === true, 'Verification confirms card is VALID');
    assert(verifyValidRes.body.data.result === VerificationResult.VALID, 'Result enum is VALID');
    assert(verifyValidRes.body.data.organization.slug === '4b', 'Verification identifies correct organization');
    assert(verifyValidRes.body.data.member.memberNumber !== undefined, 'Returns member number');
    // Verify Minimal Disclosure: private sensitive fields MUST be excluded
    assert(
      !('email' in verifyValidRes.body.data.member) &&
        !('phoneNumber' in verifyValidRes.body.data.member) &&
        !('nationalIdNumber' in verifyValidRes.body.data.member),
      'MINIMAL DISCLOSURE: Verification strictly excludes email, phone, and national ID',
    );

    // 5.3 Public QR Verification of Non-existent Token
    const verifyFakeRes = await request(server).get('/api/v1/verify/fake_token_12345_nonexistent');
    assert(verifyFakeRes.status === 200, 'GET /verify/fake_token returns HTTP 200');
    assert(verifyFakeRes.body.data.isValid === false, 'Fake token confirms isValid: false');
    assert(verifyFakeRes.body.data.result === VerificationResult.INVALID, 'Result enum is INVALID');

    // 5.4 Card Rotation: Member rotates card
    const rotateCardRes = await request(server)
      .post('/api/v1/cards/rotate')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({ reason: 'Lost previous device' });
    assert(rotateCardRes.status === 201, 'POST /cards/rotate returns HTTP 201');
    const newQrToken = rotateCardRes.body.data.card.qrToken;
    assert(newQrToken !== issuedQrToken, 'Rotated card receives a fresh cryptographic token');

    // 5.5 Old token is invalidated
    const verifyOldRes = await request(server).get(`/api/v1/verify/${issuedQrToken}`);
    assert(verifyOldRes.body.data.isValid === false, 'Old QR token is rejected as invalid/revoked');
    assert(
      verifyOldRes.body.data.result === VerificationResult.INVALID ||
        verifyOldRes.body.data.result === VerificationResult.REVOKED,
      'Old QR token returns INVALID or REVOKED',
    );

    // 5.6 New token is VALID
    const verifyNewRes = await request(server).get(`/api/v1/verify/${newQrToken}`);
    assert(verifyNewRes.body.data.isValid === true, 'New QR token is confirmed VALID');

    // 5.7 Explicit Revocation Test: Test card with isRevoked returns REVOKED
    await prisma.verificationToken.update({
      where: { token: newQrToken },
      data: { isRevoked: true },
    });
    const verifyRevokedRes = await request(server).get(`/api/v1/verify/${newQrToken}`);
    assert(verifyRevokedRes.body.data.isValid === false, 'Revoked token confirms isValid: false');
    assert(verifyRevokedRes.body.data.result === VerificationResult.REVOKED, 'Revoked token returns VerificationResult.REVOKED');

    // 5.8 Explicit Expiration Test: Test expired card returns EXPIRED
    await prisma.verificationToken.update({
      where: { token: newQrToken },
      data: { isRevoked: false, expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    });
    const verifyExpiredRes = await request(server).get(`/api/v1/verify/${newQrToken}`);
    assert(verifyExpiredRes.body.data.isValid === false, 'Expired token confirms isValid: false');
    assert(verifyExpiredRes.body.data.result === VerificationResult.EXPIRED, 'Expired token returns VerificationResult.EXPIRED');

    // Restore token validity for subsequent tests
    await prisma.verificationToken.update({
      where: { token: newQrToken },
      data: { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) },
    });

    // -------------------------------------------------------------
    // SUITE 6: Adversarial Cross-Tenant Attack Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Adversarial Cross-Tenant Attack Tests ---');

    // Attack 6.1: 4B member attempts to initiate payment on Ethio-Med
    const crossInitPayRes = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', orgMedId) // Mismatched tenant
      .send({ membershipId, paymentMethodId: testMethod.id });
    assert(
      crossInitPayRes.status === 403 || crossInitPayRes.status === 404,
      'ATTACK BLOCKED: Initiating payment in un-affiliated tenant rejected (HTTP 403/404)',
    );

    // Attack 6.2: 4B member attempts to submit proof to Ethio-Med payment
    const crossProofRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/proof`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', orgMedId) // Mismatched tenant
      .send({
        fileUrl: `https://storage.waanofii.local/proofs/fake_${timestamp}.jpg`,
        fileType: 'image/jpeg',
        fileSize: 102400,
      });
    assert(
      crossProofRes.status === 403 || crossProofRes.status === 404,
      'ATTACK BLOCKED: Submitting proof across tenant boundary rejected (HTTP 403/404)',
    );

    // Attack 6.3: 4B Finance Officer attempts to review Ethio-Med payments
    const crossReviewRes = await request(server)
      .get('/api/v1/payments/review')
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', orgMedId); // 4B officer accessing Ethio-Med
    assert(
      crossReviewRes.status === 403,
      'ATTACK BLOCKED: 4B Finance Officer accessing Ethio-Med review queue rejected with HTTP 403 Forbidden',
    );

    // Attack 6.4: 4B Finance Officer attempts to approve payment with mismatched tenant header
    const crossApproveRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', orgMedId)
      .send({ notes: 'Cross-tenant malicious approval' });
    assert(
      crossApproveRes.status === 403 || crossApproveRes.status === 404,
      'ATTACK BLOCKED: Cross-tenant payment approval rejected (HTTP 403/404)',
    );

    // Attack 6.5: Member attempts to access another member's card
    const crossCardRes = await request(server)
      .get('/api/v1/cards/me')
      .set('Authorization', `Bearer ${kebedeToken}`) // Kebede has no active card
      .set('x-tenant-id', org4BId);
    assert(
      crossCardRes.status === 404,
      'ATTACK BLOCKED: Non-member cannot access member card (HTTP 404 Not Found)',
    );

    console.log('\n========================================================');
    console.log('ALL PHASE 5 PAYMENTS & DIGITAL ID TESTS PASSED!');
    console.log('========================================================\n');
  } finally {
    await app.close();
  }
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 Test execution error:', err);
  process.exit(1);
});
