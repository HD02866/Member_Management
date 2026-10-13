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
  PaymentStatus,
  MembershipStatus,
  CardStatus,
  VerificationResult,
  PaymentProvider,
} from '@prisma/client';
import { PaymentProviderRegistry } from '../src/payments/providers/payment-provider.registry';
import {
  PaymentProviderException,
  ProviderTimeoutException,
  ProviderNetworkException,
  ProviderSignatureException,
  ProviderAmountMismatchException,
} from '../src/payments/providers/common/provider-errors';
import { executeWithRetry } from '../src/payments/providers/common/retry.util';
import {
  validateProofUrl,
  validateMimeAndExtension,
  validateFileMagicBytes,
} from '../src/payments/utils/proof-validation.util';


function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runPhase6Tests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 WAANOFII PHASE 6 EXTERNAL PAYMENTS & PRODUCTION OPS TESTS');
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
  const providerRegistry = app.get(PaymentProviderRegistry);

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

    // Resolve 4B and Ethio-Med organizations
    const org4BRes = await request(server).get('/api/v1/organizations/4b');
    const orgMedRes = await request(server).get('/api/v1/organizations/ethio-med');
    assert(org4BRes.status === 200, '4B organization resolved');
    assert(orgMedRes.status === 200, 'Ethio-Med organization resolved');
    const org4BId = org4BRes.body.data.id;
    const orgMedId = orgMedRes.body.data.id;

    // Register a fresh member applicant in 4B
    const timestamp = Date.now();
    const applicantEmail = `applicant_p6_${timestamp}@example.com`;
    const regApplicantRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: applicantEmail,
        phoneNumber: `+25191199${timestamp.toString().slice(-4)}`,
        firstName: 'Tola',
        lastName: 'Desta',
        password: 'Password123!',
      });
    assert(regApplicantRes.status === 201, 'Fresh Phase 6 applicant registered');
    const applicantToken = regApplicantRes.body.data.tokens.accessToken;
    const applicantUserId = regApplicantRes.body.data.user.id;

    // Get 4B membership plan
    const plans4B = await request(server)
      .get('/api/v1/memberships/plans')
      .set('x-tenant-id', org4BId);
    assert(plans4B.status === 200 && plans4B.body.data.length > 0, '4B membership plans available');
    const plan4BId = plans4B.body.data[0].id;
    const planFee = plans4B.body.data[0].renewalFee || plans4B.body.data[0].registrationFee || 1000;

    // Apply for membership
    const applyRes = await request(server)
      .post('/api/v1/memberships/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({ planId: plan4BId });
    assert(applyRes.status === 201, 'Phase 6 applicant applied for membership');
    const membershipId = applyRes.body.data.membership.id;


    // =============================================================
    // 1. DIGITAL ID TOKEN HARDENING (SHA-256 HASH-ONLY LOOKUP)
    // =============================================================
    console.log('\n--- 1. Digital ID Token Hardening (SHA-256 Hash-Only Lookup) ---');

    // Generate random raw token and compute SHA-256
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Create a temporary card with verification token to test hash lookup
    const memberProfile = await prisma.withPlatformAdminContext((tx) =>
      tx.memberProfile.findFirst({ where: { userId: applicantUserId, organizationId: org4BId } }),
    );
    assert(!!memberProfile, 'Applicant member profile exists');

    // Temporarily set membership to ACTIVE so card verification passes status check
    await prisma.withPlatformAdminContext((tx) =>
      tx.membership.update({
        where: { id: membershipId },
        data: { status: MembershipStatus.ACTIVE },
      }),
    );

    const tempCard = await prisma.withPlatformAdminContext((tx) =>
      tx.digitalMembershipCard.create({
        data: {
          organizationId: org4BId,
          membershipId,
          memberProfileId: memberProfile!.id,
          cardNumber: `CARD-P6-${timestamp}`,
          status: CardStatus.ACTIVE,
          issueDate: new Date(),
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          verificationToken: {
            create: {
              organizationId: org4BId,
              token: rawToken,
              tokenHash,
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              isRevoked: false,
            },
          },
        },
        include: { verificationToken: true },
      }),
    );
    assert(!!tempCard.verificationToken, 'Digital card created with verification token');

    // Direct hash lookup in database
    const tokenLookup = await prisma.withPlatformAdminContext((tx) =>
      tx.verificationToken.findUnique({
        where: { tokenHash },
      }),
    );
    assert(!!tokenLookup && tokenLookup.tokenHash === tokenHash, 'Verification token found via tokenHash index');

    // Verify card publicly via GET /verify/:token
    const verifyRes = await request(server).get(`/api/v1/verify/${rawToken}`);
    assert(verifyRes.status === 200, 'GET /verify/:token returns HTTP 200');
    assert(verifyRes.body.data.isValid === true, 'Verification confirms card is valid');
    assert(verifyRes.body.data.result === VerificationResult.VALID, 'Verification result is VALID');
    assert(verifyRes.body.data.organization?.name === '4B Association', 'Verification correctly resolves organization');

    // Minimal Disclosure: check that PII is NOT leaked
    assert(verifyRes.body.data.email === undefined, 'MINIMAL DISCLOSURE: Email strictly omitted');
    assert(verifyRes.body.data.phoneNumber === undefined, 'MINIMAL DISCLOSURE: Phone number strictly omitted');
    assert(verifyRes.body.data.nationalId === undefined, 'MINIMAL DISCLOSURE: National ID strictly omitted');

    // Tampered token verification fails
    const tamperedToken = rawToken.slice(0, -4) + 'ffff';
    const verifyTamperedRes = await request(server).get(`/api/v1/verify/${tamperedToken}`);
    assert(verifyTamperedRes.status === 200, 'Tampered token returns HTTP 200');
    assert(verifyTamperedRes.body.data.isValid === false, 'Tampered token confirms isValid: false');
    assert(verifyTamperedRes.body.data.result === VerificationResult.INVALID, 'Tampered token result is INVALID');

    // Clean up temporary card and reset membership to REGISTERED for subsequent tests
    await prisma.withPlatformAdminContext(async (tx) => {
      await tx.verificationToken.deleteMany({ where: { cardId: tempCard.id } });
      await tx.digitalMembershipCard.delete({ where: { id: tempCard.id } });
      await tx.membership.update({
        where: { id: membershipId },
        data: { status: MembershipStatus.REGISTERED },
      });
    });


    // =============================================================
    // 2. PAYMENT PROOF UPLOAD SECURITY HARDENING
    // =============================================================
    console.log('\n--- 2. Payment Proof Upload Security Hardening ---');

    // A. URL scheme validation
    assert(!validateProofUrl('http://insecure.com/proof.jpg').isValid, 'Rejects insecure HTTP URL scheme');
    assert(!validateProofUrl('ftp://ftp.example.com/slip.png').isValid, 'Rejects FTP URL scheme');
    assert(!validateProofUrl('file:///etc/passwd').isValid, 'Rejects FILE protocol scheme');
    assert(!validateProofUrl('javascript:alert(1)').isValid, 'Rejects javascript: scheme');
    assert(validateProofUrl('https://storage.waanofii.com/proofs/slip1.jpg').isValid, 'Accepts valid HTTPS URL');
    assert(validateProofUrl('/uploads/proofs/slip1.png').isValid, 'Accepts relative uploads path');

    // B. SSRF protection
    assert(!validateProofUrl('https://127.0.0.1/evil.jpg').isValid, 'SSRF: Blocks loopback IP 127.0.0.1');
    assert(!validateProofUrl('https://localhost:8080/evil.jpg').isValid, 'SSRF: Blocks localhost hostname');
    assert(!validateProofUrl('https://169.254.169.254/latest/meta-data').isValid, 'SSRF: Blocks AWS/cloud metadata IP');
    assert(!validateProofUrl('https://10.0.0.5/private.jpg').isValid, 'SSRF: Blocks RFC1918 10.x.x.x private IP');
    assert(!validateProofUrl('https://192.168.1.100/private.jpg').isValid, 'SSRF: Blocks RFC1918 192.168.x.x private IP');
    assert(!validateProofUrl('https://172.16.5.1/private.jpg').isValid, 'SSRF: Blocks RFC1918 172.16.x.x private IP');

    // C. Path traversal protection
    assert(!validateProofUrl('/uploads/../../etc/passwd').isValid, 'Path traversal: Blocks ../ traversal');
    assert(!validateProofUrl('/uploads/%2e%2e/secret').isValid, 'Path traversal: Blocks URL-encoded %2e%2e traversal');
    assert(!validateProofUrl('/uploads/proof.jpg\0.png').isValid, 'Path traversal: Blocks null byte injection');

    // D. Extension matching
    assert(validateMimeAndExtension('slip.jpg', 'image/jpeg').isValid, 'Accepts matching .jpg / image/jpeg');
    assert(validateMimeAndExtension('slip.png', 'image/png').isValid, 'Accepts matching .png / image/png');
    assert(validateMimeAndExtension('receipt.pdf', 'application/pdf').isValid, 'Accepts matching .pdf / application/pdf');
    assert(!validateMimeAndExtension('exploit.exe', 'image/jpeg').isValid, 'Rejects dangerous .exe disguised as JPEG');
    assert(!validateMimeAndExtension('shell.sh', 'image/png').isValid, 'Rejects dangerous .sh disguised as PNG');
    assert(!validateMimeAndExtension('malware.php', 'application/pdf').isValid, 'Rejects dangerous .php disguised as PDF');

    // E. Binary magic bytes validation
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49]);
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    const fakeBuffer = Buffer.from('NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT');

    assert(validateFileMagicBytes(pngBuffer, 'image/png').isValid, 'Magic bytes: Confirms valid PNG header');
    assert(validateFileMagicBytes(jpegBuffer, 'image/jpeg').isValid, 'Magic bytes: Confirms valid JPEG header');
    assert(validateFileMagicBytes(pdfBuffer, 'application/pdf').isValid, 'Magic bytes: Confirms valid PDF header');
    assert(!validateFileMagicBytes(fakeBuffer, 'image/png').isValid, 'Magic bytes: Rejects plain text spoofed as PNG');
    assert(!validateFileMagicBytes(fakeBuffer, 'application/pdf').isValid, 'Magic bytes: Rejects plain text spoofed as PDF');


    // =============================================================
    // 3. PROVIDER ARCHITECTURE, ERROR HIERARCHY & BOUNDED RETRIES
    // =============================================================
    console.log('\n--- 3. Provider Architecture, Error Hierarchy & Bounded Retries ---');

    // Provider Registry resolution
    const mbProvider = providerRegistry.getProvider(PaymentProvider.MANUAL_BANK);
    assert(mbProvider.providerType === PaymentProvider.MANUAL_BANK, 'Resolves MANUAL_BANK provider');
    assert(mbProvider.isConfigured === true, 'MANUAL_BANK isConfigured is true');

    const chapaProvider = providerRegistry.getProvider(PaymentProvider.CHAPA);
    assert(chapaProvider.providerType === PaymentProvider.CHAPA, 'Resolves CHAPA provider');

    const telebirrProvider = providerRegistry.getProvider(PaymentProvider.TELEBIRR);
    assert(telebirrProvider.providerType === PaymentProvider.TELEBIRR, 'Resolves TELEBIRR provider');

    const cbeBirrProvider = providerRegistry.getProvider(PaymentProvider.CBE_BIRR);
    assert(cbeBirrProvider.providerType === PaymentProvider.CBE_BIRR, 'Resolves CBE_BIRR provider');

    // Parameter-based case-insensitive resolution
    assert(providerRegistry.resolveByParam('chapa').providerType === PaymentProvider.CHAPA, 'resolveByParam("chapa") works');
    assert(providerRegistry.resolveByParam('TELEBIRR').providerType === PaymentProvider.TELEBIRR, 'resolveByParam("TELEBIRR") works');
    assert(providerRegistry.resolveByParam('cbe_birr').providerType === PaymentProvider.CBE_BIRR, 'resolveByParam("cbe_birr") works');
    assert(providerRegistry.resolveByParam('bank').providerType === PaymentProvider.MANUAL_BANK, 'resolveByParam("bank") works');

    // Error Hierarchy tests
    const timeoutErr = new ProviderTimeoutException('CHAPA', 'Connection timed out');
    assert(timeoutErr instanceof PaymentProviderException, 'ProviderTimeoutException is a PaymentProviderException');
    assert(timeoutErr.retryable === true, 'ProviderTimeoutException is marked retryable');
    assert(timeoutErr.statusCode === 504, 'ProviderTimeoutException has HTTP 504');

    const sigErr = new ProviderSignatureException('TELEBIRR', 'Bad signature');
    assert(sigErr.retryable === false, 'ProviderSignatureException is NOT retryable');
    assert(sigErr.statusCode === 401, 'ProviderSignatureException has HTTP 401');

    const mismatchErr = new ProviderAmountMismatchException('CHAPA', 100, 200);
    assert(mismatchErr.retryable === false, 'ProviderAmountMismatchException is NOT retryable');
    assert(mismatchErr.statusCode === 400, 'ProviderAmountMismatchException has HTTP 400');

    // Retry utility test: succeeds after retry
    let attempts = 0;
    const retryResult = await executeWithRetry(
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new ProviderNetworkException('CHAPA', 'Temporary connection drop');
        }
        return 'SUCCESS_AFTER_RETRY';
      },
      { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 },
    );
    assert(retryResult === 'SUCCESS_AFTER_RETRY' && attempts === 2, 'executeWithRetry successfully recovers from transient network fault');

    // Retry utility test: halts on non-retryable error immediately
    let nonRetryAttempts = 0;
    try {
      await executeWithRetry(
        async () => {
          nonRetryAttempts++;
          throw new ProviderSignatureException('CHAPA', 'Invalid HMAC');
        },
        { maxRetries: 3, initialDelayMs: 10 },
      );
      assert(false, 'Should have thrown signature exception');
    } catch (e: any) {
      assert(e instanceof ProviderSignatureException && nonRetryAttempts === 1, 'executeWithRetry halts immediately on non-retryable error without retrying');
    }

    // Unconfigured provider status check (labeled: IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED)
    const unconfVerify = await chapaProvider.verifyTransaction('TEST_TX_REF', 'TEST_ORDER');
    assert(
      unconfVerify.status === 'UNVERIFIED_NO_CREDENTIALS',
      'Unconfigured provider returns UNVERIFIED_NO_CREDENTIALS (IMPLEMENTED — EXTERNAL VERIFICATION NOT TESTED)',
    );

    // =============================================================
    // 4. WEBHOOK INGRESS, CRYPTOGRAPHIC SIGNATURE & REPLAY PROTECTION
    // =============================================================
    console.log('\n--- 4. Webhook Ingress, Cryptographic Signature & Replay Protection ---');

    // Ensure 4B has a Chapa payment method
    let chapaMethod = await prisma.withPlatformAdminContext((tx) =>
      tx.paymentMethod.findFirst({
        where: { organizationId: org4BId, type: 'CHAPA' as any },
      }),
    );
    if (!chapaMethod) {
      chapaMethod = await prisma.withPlatformAdminContext((tx) =>
        tx.paymentMethod.create({
          data: {
            organizationId: org4BId,
            type: 'CHAPA' as any,
            name: 'Chapa Online Checkout',
            instructions: { en: 'Pay securely using Chapa payment gateway' },
            isActive: true,
          },
        }),
      );
    }

    // Initiate an electronic payment in 4B
    const initPayRes = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({
        membershipId,
        paymentMethodId: chapaMethod.id,
      });
    assert(initPayRes.status === 201, 'Initiated Chapa payment order');
    const paymentId = initPayRes.body.data.payment.id;
    const txRef = initPayRes.body.data.payment.transactionReference;
    const paymentAmount = initPayRes.body.data.payment.amount;
    assert(!!txRef, 'Payment generated transaction reference');


    // A. Webhook missing signature -> 401 Unauthorized
    const noSigRes = await request(server)
      .post('/api/v1/payments/webhooks/chapa')
      .send({ tx_ref: txRef, status: 'success', amount: paymentAmount, currency: 'ETB' });
    assert(noSigRes.status === 401, 'Webhook missing signature rejected with HTTP 401 Unauthorized');

    // B. Webhook invalid signature -> 401 Unauthorized
    const badSigRes = await request(server)
      .post('/api/v1/payments/webhooks/chapa')
      .set('x-chapa-signature', 'invalidsignature1234567890abcdef')
      .send({ tx_ref: txRef, status: 'success', amount: paymentAmount, currency: 'ETB' });
    assert(badSigRes.status === 401, 'Webhook with forged signature rejected with HTTP 401 Unauthorized');

    // C. Financial Integrity: Amount Mismatch Attack
    // Since Chapa is in mock mode (no real webhookSecret configured), handleWebhook accepts matching test payload or mock sign
    // Let's test amount mismatch via processWebhook
    const fakeAmount = (parseFloat(paymentAmount) + 500).toString();
    const mockSig = 'MOCK_SANDBOX_VERIFIED';
    const amountMismatchRes = await request(server)
      .post('/api/v1/payments/webhooks/chapa')
      .set('x-chapa-signature', mockSig)
      .send({ tx_ref: txRef, status: 'success', amount: fakeAmount, currency: 'ETB' });
    assert(
      amountMismatchRes.status === 400,
      'ATTACK BLOCKED: Webhook with tampered amount rejected with HTTP 400 Bad Request',
    );

    // D. Valid Webhook -> Activates Payment, Membership, and issues Digital Card
    const validWebhookRes = await request(server)
      .post('/api/v1/payments/webhooks/chapa')
      .set('x-chapa-signature', mockSig)
      .send({
        tx_ref: txRef,
        status: 'success',
        amount: paymentAmount,
        currency: 'ETB',
        reference: `CHAPA-${timestamp}`,
      });
    assert(validWebhookRes.status === 200, 'Valid webhook processed with HTTP 200 OK');
    assert(validWebhookRes.body.data.status === PaymentStatus.VERIFIED, 'Payment status transitioned to VERIFIED');

    // Verify database state after webhook
    const dbPayment = await prisma.withPlatformAdminContext((tx) =>
      tx.payment.findUnique({ where: { id: paymentId } }),
    );
    assert(dbPayment?.status === PaymentStatus.VERIFIED, 'Payment is confirmed VERIFIED in database');

    const dbMembership = await prisma.withPlatformAdminContext((tx) =>
      tx.membership.findUnique({ where: { id: membershipId } }),
    );
    assert(dbMembership?.status === MembershipStatus.ACTIVE, 'Membership is confirmed ACTIVE in database');

    const dbCard = await prisma.withPlatformAdminContext((tx) =>
      tx.digitalMembershipCard.findUnique({
        where: { membershipId },
        include: { verificationToken: true },
      }),
    );
    assert(!!dbCard && dbCard.status === CardStatus.ACTIVE, 'Digital card is issued and ACTIVE');
    assert(!!dbCard?.verificationToken?.tokenHash, 'Digital card contains valid tokenHash');

    // E. Replay Protection: Replaying the same webhook returns isReplay: true without side-effects
    const replayWebhookRes = await request(server)
      .post('/api/v1/payments/webhooks/chapa')
      .set('x-chapa-signature', mockSig)
      .send({
        tx_ref: txRef,
        status: 'success',
        amount: paymentAmount,
        currency: 'ETB',
      });
    assert(replayWebhookRes.status === 200, 'Replayed webhook returns HTTP 200 OK');
    assert(replayWebhookRes.body.data.isReplay === true, 'Replay protection identifies isReplay: true');

    // =============================================================
    // 5. PAYMENT RECONCILIATION SERVICE
    // =============================================================
    console.log('\n--- 5. Payment Reconciliation Service ---');

    // Regular member cannot trigger reconciliation
    const memberReconcileRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reconcile`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId);
    assert(
      memberReconcileRes.status === 403,
      'Regular member forbidden from triggering reconciliation (HTTP 403)',
    );

    // Finance Officer reconciles verified payment
    const financeReconcileRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reconcile`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId);
    assert(financeReconcileRes.status === 201, 'Finance Officer reconciles payment with HTTP 201');
    assert(financeReconcileRes.body.data.paymentId === paymentId, 'Reconciliation confirms paymentId');
    assert(financeReconcileRes.body.data.localStatus === PaymentStatus.VERIFIED, 'Reconciliation confirms localStatus');

    // Batch reconciliation across tenant
    const batchReconcileRes = await request(server)
      .post('/api/v1/payments/reconcile/batch')
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId);
    assert(batchReconcileRes.status === 201, 'Batch reconciliation succeeds with HTTP 201');
    assert(typeof batchReconcileRes.body.data.scanned === 'number', 'Batch reconciliation returns scanned count');

    // =============================================================
    // 6. PAYMENT REVERSAL & REFUND LIFECYCLE
    // =============================================================
    console.log('\n--- 6. Payment Reversal & Refund Lifecycle ---');

    // A. Unauthorized user cannot reverse payment
    const unauthorizedReverseRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-tenant-id', org4BId)
      .send({ reason: 'Unauthorized reversal attempt' });
    assert(
      unauthorizedReverseRes.status === 403,
      'Unauthorized applicant forbidden from reversing payment (HTTP 403)',
    );

    // B. Reversal without reason rejected -> 400 Bad Request
    const noReasonReverseRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId)
      .send({ reason: '' });
    assert(
      noReasonReverseRes.status === 400,
      'Reversal without mandatory reason rejected with HTTP 400 Bad Request',
    );

    // C. Authorized Finance Officer executes reversal
    const reverseRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId)
      .send({ reason: 'Fraudulent transaction chargeback requested by bank' });
    assert(reverseRes.status === 201, 'Authorized payment reversal succeeds with HTTP 201');

    // D. Verify state cascade in database
    const reversedPayment = await prisma.withPlatformAdminContext((tx) =>
      tx.payment.findUnique({ where: { id: paymentId } }),
    );
    assert(reversedPayment?.status === PaymentStatus.REFUNDED, 'Payment status updated to REFUNDED');

    const suspendedMembership = await prisma.withPlatformAdminContext((tx) =>
      tx.membership.findUnique({ where: { id: membershipId } }),
    );
    assert(
      suspendedMembership?.status === MembershipStatus.SUSPENDED,
      'Membership status transitioned to SUSPENDED upon reversal',
    );

    const revokedCard = await prisma.withPlatformAdminContext((tx) =>
      tx.digitalMembershipCard.findUnique({
        where: { membershipId },
        include: { verificationToken: true },
      }),
    );
    assert(revokedCard?.status === CardStatus.REVOKED, 'Digital card transitioned to REVOKED upon reversal');
    assert(
      revokedCard?.verificationToken?.isRevoked === true,
      'Verification token marked isRevoked: true in database',
    );

    // E. Verify QR verification immediately fails for revoked card
    const cardToken = revokedCard?.verificationToken?.token;
    assert(!!cardToken, 'Revoked card token exists');
    const verifyRevokedRes = await request(server).get(`/api/v1/verify/${cardToken}`);
    assert(verifyRevokedRes.status === 200, 'GET /verify/:token for revoked card returns HTTP 200');
    assert(verifyRevokedRes.body.data.isValid === false, 'Verification confirms card is NO LONGER valid');
    assert(
      verifyRevokedRes.body.data.result === VerificationResult.REVOKED,
      'Verification result reports REVOKED',
    );

    // F. Re-reversing an already refunded payment rejected -> 400 Bad Request
    const doubleReverseRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', org4BId)
      .send({ reason: 'Attempt double reverse' });
    assert(
      doubleReverseRes.status === 400,
      'Double reversal on already refunded payment rejected with HTTP 400 Bad Request',
    );

    // =============================================================
    // 7. ADVERSARIAL CROSS-TENANT ATTACK TESTS
    // =============================================================
    console.log('\n--- 7. Adversarial Cross-Tenant Attack Tests ---');

    // 4B Finance Officer attempting to reverse Ethio-Med payment
    const crossTenantReverseRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', orgMedId)
      .send({ reason: 'Cross-tenant attack' });
    assert(
      crossTenantReverseRes.status === 403 || crossTenantReverseRes.status === 404,
      'ATTACK BLOCKED: Cross-tenant payment reversal rejected (HTTP 403/404)',
    );

    // 4B Finance Officer attempting to reconcile Ethio-Med payment
    const crossTenantReconcileRes = await request(server)
      .post(`/api/v1/payments/${paymentId}/reconcile`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('x-tenant-id', orgMedId);
    assert(
      crossTenantReconcileRes.status === 403 || crossTenantReconcileRes.status === 404,
      'ATTACK BLOCKED: Cross-tenant payment reconciliation rejected (HTTP 403/404)',
    );

    console.log('\n========================================================');
    console.log('ALL PHASE 6 EXTERNAL PAYMENTS & OPS TESTS PASSED!');
    console.log('========================================================\n');
  } catch (error) {
    console.error('❌ Phase 6 Test execution failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runPhase6Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
