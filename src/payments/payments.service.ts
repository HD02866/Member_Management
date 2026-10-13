import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { ApprovePaymentDto, RejectPaymentDto } from './dto/review-payment.dto';
import { validateProofUrl, validateMimeAndExtension } from './utils/proof-validation.util';
import { ProviderSignatureException } from './providers/common/provider-errors';
import {
  PaymentStatus,
  MembershipStatus,
  MemberStatus,
  CardStatus,
  ReviewDecision,
  PaymentProvider,
  Prisma,
} from '@prisma/client';
import crypto from 'crypto';


@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(PaymentProviderRegistry)
    private readonly providerRegistry: PaymentProviderRegistry,
  ) {}

  /**
   * Retrieves active payment methods configured for the tenant.
   */
  async getPaymentMethods(organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.paymentMethod.findMany({
        where: {
          organizationId,
          isActive: true,
        },
        select: {
          id: true,
          type: true,
          name: true,
          accountName: true,
          accountNumber: true,
          bankName: true,
          branchName: true,
          instructions: true,
          displayOrder: true,
        },
        orderBy: { displayOrder: 'asc' },
      });
    });
  }

  /**
   * Initiates payment for a registered membership under strict server authority and idempotency.
   */
  async initiatePayment(
    userId: string,
    organizationId: string,
    dto: InitiatePaymentDto,
    headerIdempotencyKey?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const effectiveIdempotencyKey = (headerIdempotencyKey || dto.idempotencyKey)?.trim();

    // 1. Idempotency Check: if idempotency key is provided and payment exists, return replayable record
    if (effectiveIdempotencyKey) {
      const existing = await this.prisma.withTenantContext(organizationId, async (tx) => {
        return tx.payment.findUnique({
          where: { idempotencyKey: effectiveIdempotencyKey },
          include: {
            paymentMethod: true,
            membership: {
              include: { membershipPlan: true },
            },
          },
        });
      });

      if (existing) {
        this.logger.log(
          `Idempotency replay: returning existing payment ${existing.id} for key ${effectiveIdempotencyKey}`,
        );
        return {
          payment: existing,
          isReplay: true,
          nextStep:
            existing.status === PaymentStatus.PENDING
              ? 'SUBMIT_PAYMENT_PROOF'
              : 'AWAITING_REVIEW',
          message: 'Payment already initiated with this idempotency key',
        };
      }
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 2. Verify Member Profile belongs to current user in this tenant
      const memberProfile = await tx.memberProfile.findFirst({
        where: {
          userId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!memberProfile) {
        throw new NotFoundException('Member profile not found in this organization');
      }

      // 3. Verify Membership ownership and status
      const membership = await tx.membership.findFirst({
        where: {
          id: dto.membershipId,
          organizationId,
          memberProfileId: memberProfile.id,
        },
        include: {
          membershipPlan: true,
        },
      });

      if (!membership) {
        throw new NotFoundException('Membership record not found for this user in this organization');
      }

      if (membership.status === MembershipStatus.ACTIVE) {
        throw new ConflictException('Membership is already active');
      }

      const plan = membership.membershipPlan;
      if (!plan || !plan.isActive) {
        throw new BadRequestException('Membership plan is no longer active');
      }

      // 4. Critical Money Rule: Deterministic server-authoritative calculation
      // Never trust client amounts or use JavaScript floating-point arithmetic
      const planPrice = new Prisma.Decimal(plan.price);
      const registrationFee = new Prisma.Decimal(plan.registrationFee || 0);
      const authoritativeAmount = planPrice.plus(registrationFee);
      const authoritativeCurrency = plan.currency || 'ETB';

      // 5. Resolve Payment Method
      let paymentMethod: any = null;
      if (dto.paymentMethodId) {
        paymentMethod = await tx.paymentMethod.findFirst({
          where: {
            id: dto.paymentMethodId,
            organizationId,
            isActive: true,
          },
        });
        if (!paymentMethod) {
          throw new NotFoundException('Selected payment method not found or inactive');
        }
      }

      // 6. Generate server-controlled transaction reference
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const transactionReference = `PAY-${new Date().getFullYear()}-${randomSuffix}`;

      // 7. Create Payment record in PENDING status
      const payment = await tx.payment.create({
        data: {
          organizationId,
          membershipId: membership.id,
          memberProfileId: memberProfile.id,
          paymentMethodId: paymentMethod?.id,
          amount: authoritativeAmount,
          currency: authoritativeCurrency,
          status: PaymentStatus.PENDING,
          paymentType: dto.paymentType || 'MEMBERSHIP_DUES',
          transactionReference,
          idempotencyKey: effectiveIdempotencyKey || null,
        },
        include: {
          paymentMethod: true,
          membership: {
            include: { membershipPlan: true },
          },
        },
      });

      // 8. Update membership status to PAYMENT_PENDING
      await tx.membership.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.PAYMENT_PENDING },
      });

      // 9. Dispatch to Provider Abstraction
      const providerType =
        paymentMethod?.type === 'TELEBIRR'
          ? PaymentProvider.TELEBIRR
          : paymentMethod?.type === 'CBE_BIRR'
          ? PaymentProvider.CBE_BIRR
          : paymentMethod?.type === 'CHAPA'
          ? PaymentProvider.CHAPA
          : PaymentProvider.MANUAL_BANK;

      const provider = this.providerRegistry.getProvider(providerType);
      const initiationResult = await provider.initiatePayment({
        paymentId: payment.id,
        organizationId,
        amount: authoritativeAmount.toFixed(2),
        currency: authoritativeCurrency,
        reference: transactionReference,
        payerName: `${memberProfile.firstName} ${memberProfile.lastName}`,
        payerEmail: memberProfile.email || undefined,
        payerPhone: memberProfile.phoneNumber || undefined,
      });

      // 10. Record provider transaction tracking
      await tx.paymentTransaction.create({
        data: {
          organizationId,
          paymentId: payment.id,
          provider: providerType,
          providerTxId: initiationResult.providerTxId || transactionReference,
          providerStatus: 'INITIATED',
          rawPayload: initiationResult.instructions ? JSON.stringify(initiationResult.instructions) : undefined,
        },
      });

      // 11. Immutable Audit Log
      await this.auditService.logEvent({
        organizationId,
        actorUserId: userId,
        action: 'PAYMENT_INITIATED',
        entityType: 'Payment',
        entityId: payment.id,
        afterDiff: {
          paymentId: payment.id,
          amount: authoritativeAmount.toFixed(2),
          currency: authoritativeCurrency,
          reference: transactionReference,
          membershipId: membership.id,
        },
        ipAddress,
        userAgent,
      });

      return {
        payment,
        instructions: initiationResult.instructions,
        requiresProof: initiationResult.requiresProof,
        nextStep: 'SUBMIT_PAYMENT_PROOF',
        message: 'Payment initiated successfully. Please complete transfer and submit proof.',
      };
    });
  }

  /**
   * Submits manual payment proof (bank deposit slip / mobile transaction screenshot).
   */
  async submitPaymentProof(
    userId: string,
    organizationId: string,
    paymentId: string,
    dto: SubmitPaymentProofDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 0. Hardened URL & Extension Validation (Anti-SSRF & Anti-Path Traversal)
    const urlCheck = validateProofUrl(dto.fileUrl);
    if (!urlCheck.isValid) {
      throw new BadRequestException(urlCheck.error || 'Invalid proof file URL');
    }

    const extCheck = validateMimeAndExtension(dto.originalFileName || dto.fileUrl, dto.fileType);
    if (!extCheck.isValid) {
      throw new BadRequestException(extCheck.error || 'File extension does not match MIME type');
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Verify Payment existence and tenant boundary
      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          organizationId,
        },
        include: {
          memberProfile: true,
          membership: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found in this organization');
      }

      // 2. Ownership verification: User must own the member profile
      if (payment.memberProfile.userId !== userId) {
        throw new ForbiddenException('You do not have permission to submit proof for this payment');
      }

      // 3. Status Check: cannot submit proof for already verified/refunded payments
      if (payment.status === PaymentStatus.VERIFIED) {
        throw new ConflictException('Payment has already been verified and confirmed');
      }

      // 4. Create PaymentProof record (DB unique constraint on [organizationId, fileUrl] prevents duplicate reuse)
      const proof = await tx.paymentProof.create({
        data: {
          organizationId,
          paymentId: payment.id,
          fileUrl: dto.fileUrl.trim(),
          fileType: dto.fileType.trim(),
          fileSize: dto.fileSize,
          originalFileName: dto.originalFileName?.trim(),
        },
      });

      // 5. Update Payment status to UNDER_REVIEW
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.UNDER_REVIEW,
          transactionReference: dto.transactionReference?.trim() || payment.transactionReference,
          notes: dto.notes?.trim() || payment.notes,
        },
        include: {
          proofs: true,
        },
      });

      // 6. Update Membership status to UNDER_REVIEW
      await tx.membership.update({
        where: { id: payment.membershipId },
        data: { status: MembershipStatus.UNDER_REVIEW },
      });

      // 7. Immutable Audit Log
      await this.auditService.logEvent({
        organizationId,
        actorUserId: userId,
        action: 'PAYMENT_PROOF_SUBMITTED',
        entityType: 'PaymentProof',
        entityId: proof.id,
        afterDiff: {
          paymentId: payment.id,
          proofId: proof.id,
          fileUrl: proof.fileUrl,
          fileType: proof.fileType,
          fileSize: proof.fileSize,
          transactionReference: updatedPayment.transactionReference,
        },
        ipAddress,
        userAgent,
      });

      return {
        message: 'Payment proof submitted successfully. Your payment is now under review by finance staff.',
        payment: updatedPayment,
        proof,
      };
    });
  }

  /**
   * Retrieves user's payments in the active tenant.
   */
  async getMyPayments(userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const memberProfile = await tx.memberProfile.findFirst({
        where: { userId, organizationId, deletedAt: null },
      });

      if (!memberProfile) {
        return [];
      }

      return tx.payment.findMany({
        where: {
          organizationId,
          memberProfileId: memberProfile.id,
        },
        include: {
          paymentMethod: true,
          membership: {
            include: { membershipPlan: true },
          },
          proofs: {
            orderBy: { uploadedAt: 'desc' },
          },
          reviews: {
            orderBy: { reviewedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Retrieves single payment details with access control.
   */
  async getPaymentById(
    userId: string,
    isStaffOrAdmin: boolean,
    organizationId: string,
    paymentId: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          paymentMethod: true,
          memberProfile: true,
          membership: {
            include: { membershipPlan: true },
          },
          proofs: {
            orderBy: { uploadedAt: 'desc' },
          },
          reviews: {
            include: {
              reviewer: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            orderBy: { reviewedAt: 'desc' },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      // Member can only inspect their own payment; staff can inspect tenant payments
      if (!isStaffOrAdmin && payment.memberProfile.userId !== userId) {
        throw new ForbiddenException('You do not have permission to view this payment');
      }

      return payment;
    });
  }

  /**
   * Retrieves list of payments awaiting finance review in active tenant.
   * Restricted to finance officers and tenant administrators.
   */
  async getPendingReviews(organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.payment.findMany({
        where: {
          organizationId,
          status: {
            in: [PaymentStatus.UNDER_REVIEW, PaymentStatus.SUBMITTED, PaymentStatus.PENDING],
          },
        },
        include: {
          memberProfile: true,
          membership: {
            include: { membershipPlan: true },
          },
          paymentMethod: true,
          proofs: {
            orderBy: { uploadedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Approves a payment and atomically activates the membership and issues the digital card.
   * Enforces strict Segregation of Duties: Reviewer cannot approve their own payment proof!
   */
  async approvePayment(
    reviewerUserId: string,
    organizationId: string,
    paymentId: string,
    dto: ApprovePaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Fetch payment with relational dependencies
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          memberProfile: true,
          membership: {
            include: { membershipPlan: true },
          },
          paymentMethod: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found in this organization');
      }

      // 2. SEGREGATION OF DUTIES: A reviewer CANNOT approve their own payment!
      if (payment.memberProfile.userId === reviewerUserId) {
        throw new ForbiddenException(
          'Segregation of duties: Reviewer cannot approve their own payment proof',
        );
      }

      // 3. Replay Protection: cannot approve already verified payment
      if (payment.status === PaymentStatus.VERIFIED) {
        throw new ConflictException('Payment has already been approved and verified');
      }

      const now = new Date();
      const plan = payment.membership.membershipPlan;

      // 4. Calculate Membership Term Duration (server-side UTC)
      let durationMonths = 12;
      if (plan.billingInterval === 'MONTHLY') {
        durationMonths = plan.durationCount || 1;
      } else if (plan.billingInterval === 'QUARTERLY') {
        durationMonths = (plan.durationCount || 1) * 3;
      } else if (plan.billingInterval === 'BIANNUAL') {
        durationMonths = (plan.durationCount || 1) * 6;
      } else if (plan.billingInterval === 'ANNUAL') {
        durationMonths = (plan.durationCount || 1) * 12;
      }

      const startDate = now;
      const endDate = new Date(startDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

      // 5. ATOMIC APPROVAL TRANSACTION:
      // a. Update Payment
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VERIFIED,
          reviewedByUserId: reviewerUserId,
          reviewedAt: now,
          paidAt: now,
          notes: dto.notes?.trim() || payment.notes,
        },
      });

      // b. Record PaymentReview audit row
      await tx.paymentReview.create({
        data: {
          organizationId,
          paymentId: payment.id,
          reviewerUserId,
          decision: ReviewDecision.APPROVED,
          notes: dto.notes?.trim(),
          reviewedAt: now,
        },
      });

      // c. Record / Update PaymentTransaction
      const existingTx = await tx.paymentTransaction.findFirst({
        where: { organizationId, paymentId: payment.id },
      });

      if (existingTx) {
        await tx.paymentTransaction.update({
          where: { id: existingTx.id },
          data: { providerStatus: 'VERIFIED_BY_REVIEW' },
        });
      } else {
        await tx.paymentTransaction.create({
          data: {
            organizationId,
            paymentId: payment.id,
            provider: payment.paymentMethod?.type === 'TELEBIRR'
              ? PaymentProvider.TELEBIRR
              : PaymentProvider.MANUAL_BANK,
            providerTxId: payment.transactionReference || `TX-${payment.id.slice(0, 8)}`,
            providerStatus: 'VERIFIED_BY_REVIEW',
          },
        });
      }

      // d. Activate Membership
      const updatedMembership = await tx.membership.update({
        where: { id: payment.membershipId },
        data: {
          status: MembershipStatus.ACTIVE,
          startDate,
          endDate,
        },
      });

      // e. Activate MemberProfile
      await tx.memberProfile.update({
        where: { id: payment.memberProfileId },
        data: { status: MemberStatus.ACTIVE },
      });

      // f. Create MembershipPeriod
      await tx.membershipPeriod.create({
        data: {
          organizationId,
          membershipId: payment.membershipId,
          membershipPlanId: plan.id,
          paymentId: payment.id,
          startDate,
          endDate,
          termNumber: 1,
        },
      });

      // g. Issue or Renew Digital Membership Card
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const randomCardSuffix = Math.floor(100000 + Math.random() * 900000);
      const cardNumber = `${org.slug.toUpperCase()}-${now.getFullYear()}-${randomCardSuffix}`;

      let digitalCard = await tx.digitalMembershipCard.findUnique({
        where: { membershipId: payment.membershipId },
      });

      if (digitalCard) {
        digitalCard = await tx.digitalMembershipCard.update({
          where: { id: digitalCard.id },
          data: {
            status: CardStatus.ACTIVE,
            cardVersion: digitalCard.cardVersion + 1,
            issueDate: now,
            expirationDate: endDate,
            revokedAt: null,
            revocationReason: null,
          },
        });
      } else {
        digitalCard = await tx.digitalMembershipCard.create({
          data: {
            organizationId,
            membershipId: payment.membershipId,
            memberProfileId: payment.memberProfileId,
            cardNumber,
            cardVersion: 1,
            status: CardStatus.ACTIVE,
            issueDate: now,
            expirationDate: endDate,
          },
        });
      }

      // h. Generate Cryptographically Secure QR Verification Token (256-bit entropy)
      const qrRawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(qrRawToken).digest('hex');

      await tx.verificationToken.upsert({
        where: { cardId: digitalCard.id },
        create: {
          organizationId,
          cardId: digitalCard.id,
          token: qrRawToken,
          tokenHash,
          expiresAt: endDate,
          isRevoked: false,
        },
        update: {
          token: qrRawToken,
          tokenHash,
          expiresAt: endDate,
          isRevoked: false,
          scanCount: 0,
          lastScannedAt: null,
        },
      });

      // i. Immutable Audit Logs
      await this.auditService.logEvent({
        organizationId,
        actorUserId: reviewerUserId,
        action: 'PAYMENT_APPROVED',
        entityType: 'Payment',
        entityId: payment.id,
        afterDiff: {
          status: PaymentStatus.VERIFIED,
          reviewedByUserId: reviewerUserId,
          paidAmount: payment.amount.toFixed(2),
        },
        ipAddress,
        userAgent,
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId: reviewerUserId,
        action: 'MEMBERSHIP_ACTIVATED',
        entityType: 'Membership',
        entityId: updatedMembership.id,
        afterDiff: {
          status: MembershipStatus.ACTIVE,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        ipAddress,
        userAgent,
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId: reviewerUserId,
        action: 'DIGITAL_CARD_ISSUED',
        entityType: 'DigitalMembershipCard',
        entityId: digitalCard.id,
        afterDiff: {
          cardNumber: digitalCard.cardNumber,
          status: CardStatus.ACTIVE,
          expirationDate: endDate.toISOString(),
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Payment approved, membership activated, and digital card issued successfully.',
        payment: updatedPayment,
        membership: updatedMembership,
        card: {
          id: digitalCard.id,
          cardNumber: digitalCard.cardNumber,
          status: digitalCard.status,
          expirationDate: digitalCard.expirationDate,
          qrToken: qrRawToken,
        },
      };
    });
  }

  /**
   * Rejects a payment proof with a mandatory rejection reason.
   */
  async rejectPayment(
    reviewerUserId: string,
    organizationId: string,
    paymentId: string,
    dto: RejectPaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          memberProfile: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found in this organization');
      }

      // Segregation of duties: Reviewer cannot reject their own payment
      if (payment.memberProfile.userId === reviewerUserId) {
        throw new ForbiddenException(
          'Segregation of duties: Reviewer cannot reject their own payment proof',
        );
      }

      if (payment.status === PaymentStatus.VERIFIED) {
        throw new ConflictException('Cannot reject an already verified and confirmed payment');
      }

      const now = new Date();

      // Update Payment to REJECTED
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REJECTED,
          reviewedByUserId: reviewerUserId,
          reviewedAt: now,
          rejectionReason: dto.rejectionReason.trim(),
          notes: dto.notes?.trim() || payment.notes,
        },
      });

      // Record PaymentReview row
      await tx.paymentReview.create({
        data: {
          organizationId,
          paymentId: payment.id,
          reviewerUserId,
          decision: ReviewDecision.REJECTED,
          rejectionReason: dto.rejectionReason.trim(),
          notes: dto.notes?.trim(),
          reviewedAt: now,
        },
      });

      // Update Membership to REJECTED or PAYMENT_PENDING
      await tx.membership.update({
        where: { id: payment.membershipId },
        data: { status: MembershipStatus.REJECTED },
      });

      // Immutable Audit Log
      await this.auditService.logEvent({
        organizationId,
        actorUserId: reviewerUserId,
        action: 'PAYMENT_REJECTED',
        entityType: 'Payment',
        entityId: payment.id,
        afterDiff: {
          status: PaymentStatus.REJECTED,
          rejectionReason: dto.rejectionReason.trim(),
          reviewedByUserId: reviewerUserId,
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Payment rejected. Member has been notified to re-submit valid proof.',
        payment: updatedPayment,
      };
    });
  }

  /**
   * Secure Webhook Processing Pipeline
   */
  async processWebhook(
    providerParam: string,
    payload: any,
    headers: Record<string, string>,
    rawBody?: Buffer | string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.logger.log(`Processing incoming webhook from provider: ${providerParam}`);

    // 1. Resolve Provider Adapter
    const provider = this.providerRegistry.resolveByParam(providerParam);

    // 2. Extract Provider-Specific Signature
    const signature =
      headers['x-chapa-signature'] ||
      headers['chapa-signature'] ||
      headers['x-telebirr-signature'] ||
      headers['x-cbe-signature'] ||
      headers['signature'] ||
      payload?.sign ||
      payload?.signature;

    // 3. Cryptographic Signature & Payload Verification
    let webhookResult: any;
    try {
      webhookResult = await provider.handleWebhook(payload, signature, rawBody);
      if (!webhookResult || !webhookResult.verified) {
        throw new ProviderSignatureException(providerParam);
      }
    } catch (err: any) {
      this.logger.warn(`Rejected webhook with invalid signature from ${providerParam}: ${err.message}`);
      throw new UnauthorizedException('Invalid or missing webhook signature');
    }



    // 4. Resolve Internal Payment via Reference / ProviderTxId
    const reference = webhookResult.reference || webhookResult.providerTxId;
    if (!reference) {
      throw new BadRequestException('Webhook payload missing transaction reference');
    }

    // Find the payment across organizations using Platform Admin Context
    const payment = await this.prisma.withPlatformAdminContext(async (tx) => {
      // First try matching transactionReference directly
      let p = await tx.payment.findFirst({
        where: { transactionReference: reference },
        include: {
          membership: { include: { membershipPlan: true } },
          memberProfile: true,
          paymentMethod: true,
        },
      });

      // If not found directly, try matching PaymentTransaction
      if (!p) {
        const txRecord = await tx.paymentTransaction.findFirst({
          where: { providerTxId: reference },
          include: {
            payment: {
              include: {
                membership: { include: { membershipPlan: true } },
                memberProfile: true,
                paymentMethod: true,
              },
            },
          },
        });
        p = txRecord?.payment || null;
      }

      return p;
    });

    if (!payment) {
      this.logger.warn(`Webhook received for non-existent payment reference: ${reference}`);
      throw new NotFoundException(`No payment order found matching reference "${reference}"`);
    }

    // 5. Replay Protection: If already VERIFIED, treat as idempotent replay
    if (payment.status === PaymentStatus.VERIFIED) {
      this.logger.log(`Idempotent webhook replay for already verified payment ${payment.id}`);
      return {
        success: true,
        isReplay: true,
        message: 'Payment already verified and processed.',
        paymentId: payment.id,
      };
    }

    // 6. Financial Integrity: Check Amount & Currency Anti-Tampering
    if (webhookResult.amount) {
      const webhookAmount = new Prisma.Decimal(webhookResult.amount);
      if (!webhookAmount.equals(payment.amount)) {
        this.logger.error(
          `Payment amount mismatch in webhook: expected ${payment.amount}, received ${webhookAmount}`,
        );
        await this.auditService.logEvent({
          organizationId: payment.organizationId,
          actorUserId: null,
          action: 'PAYMENT_AMOUNT_MISMATCH',
          entityType: 'Payment',
          entityId: payment.id,
          beforeDiff: { expectedAmount: payment.amount.toFixed(2) },
          afterDiff: {
            receivedAmount: webhookAmount.toFixed(2),
            provider: providerParam,
            triggeredBy: 'SYSTEM_WEBHOOK',
          },
          ipAddress,
          userAgent,
        });

        throw new BadRequestException('Payment amount mismatch between provider and order');
      }
    }

    if (webhookResult.currency && webhookResult.currency !== payment.currency) {
      this.logger.error(
        `Payment currency mismatch in webhook: expected ${payment.currency}, received ${webhookResult.currency}`,
      );
      throw new BadRequestException('Payment currency mismatch between provider and order');
    }

    // 7. Atomic State Transitions Under PostgreSQL Tenant Context
    return this.prisma.withTenantContext(payment.organizationId, async (tx) => {
      if (webhookResult.isPaid) {
        // A. Update Payment status to VERIFIED
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.VERIFIED,
            reviewedAt: new Date(),
          },
        });

        // B. Upsert PaymentTransaction record
        await tx.paymentTransaction.upsert({
          where: {
            provider_providerTxId: {
              provider: provider.providerType,
              providerTxId: webhookResult.providerTxId || reference,
            },
          },
          create: {
            organizationId: payment.organizationId,
            paymentId: payment.id,
            provider: provider.providerType,
            providerTxId: webhookResult.providerTxId || reference,
            providerStatus: 'SUCCESS',
            rawPayload: webhookResult.rawPayload || Prisma.JsonNull,
            rawWebhook: payload || Prisma.JsonNull,
          },
          update: {
            providerStatus: 'SUCCESS',
            rawWebhook: payload || Prisma.JsonNull,
          },
        });

        // C. Calculate membership duration and period
        const plan = payment.membership.membershipPlan;
        let durationMonths = 12;
        if (plan.billingInterval === 'MONTHLY') {
          durationMonths = plan.durationCount || 1;
        } else if (plan.billingInterval === 'QUARTERLY') {
          durationMonths = (plan.durationCount || 1) * 3;
        } else if (plan.billingInterval === 'BIANNUAL') {
          durationMonths = (plan.durationCount || 1) * 6;
        } else if (plan.billingInterval === 'ANNUAL') {
          durationMonths = (plan.durationCount || 1) * 12;
        }

        const now = new Date();
        const startDate = now;
        const endDate = new Date(startDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);


        // D. Transition Membership to ACTIVE
        await tx.membership.update({
          where: { id: payment.membershipId },
          data: {
            status: MembershipStatus.ACTIVE,
            startDate,
            endDate,
          },
        });

        // E. Transition MemberProfile to ACTIVE
        await tx.memberProfile.update({
          where: { id: payment.memberProfileId },
          data: { status: MemberStatus.ACTIVE },
        });

        // F. Create MembershipPeriod record
        await tx.membershipPeriod.create({
          data: {
            organizationId: payment.organizationId,
            membershipId: payment.membershipId,
            membershipPlanId: plan.id,
            paymentId: payment.id,
            startDate,
            endDate,
            termNumber: 1,
          },
        });

        // G. Issue Digital Membership Card with SHA-256 token hash
        const existingCard = await tx.digitalMembershipCard.findUnique({
          where: { membershipId: payment.membershipId },
        });

        if (!existingCard) {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const randomCardNum = Math.floor(10000 + Math.random() * 90000);
          const cardNumber = `CARD-${new Date().getFullYear()}-${randomCardNum}`;

          await tx.digitalMembershipCard.create({
            data: {
              organizationId: payment.organizationId,
              membershipId: payment.membershipId,
              memberProfileId: payment.memberProfileId,
              cardNumber,
              status: CardStatus.ACTIVE,
              issueDate: now,
              expirationDate: endDate,
              verificationToken: {
                create: {
                  organizationId: payment.organizationId,
                  token: rawToken,
                  tokenHash,
                  expiresAt: endDate,
                  isRevoked: false,
                },
              },
            },
          });
        }

        // H. Immutable Audit Log
        await this.auditService.logEvent({
          organizationId: payment.organizationId,
          actorUserId: null,
          action: 'PROVIDER_PAYMENT_VERIFIED',
          entityType: 'Payment',
          entityId: payment.id,
          beforeDiff: { status: payment.status },
          afterDiff: {
            status: PaymentStatus.VERIFIED,
            provider: provider.providerType,
            providerTxId: webhookResult.providerTxId,
            membershipStatus: MembershipStatus.ACTIVE,
            triggeredBy: 'SYSTEM_WEBHOOK',
          },
          ipAddress,
          userAgent,
        });

        return {
          success: true,
          paymentId: payment.id,
          status: PaymentStatus.VERIFIED,
          isPaid: true,
        };
      } else {
        // Provider reported failure or cancellation
        const newStatus =
          webhookResult.status === 'REFUNDED' || webhookResult.status === 'REVERSED'
            ? PaymentStatus.REFUNDED
            : PaymentStatus.FAILED;

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: newStatus },
        });

        await tx.paymentTransaction.upsert({
          where: {
            provider_providerTxId: {
              provider: provider.providerType,
              providerTxId: webhookResult.providerTxId || reference,
            },
          },
          create: {
            organizationId: payment.organizationId,
            paymentId: payment.id,
            provider: provider.providerType,
            providerTxId: webhookResult.providerTxId || reference,
            providerStatus: webhookResult.status || 'FAILED',
            rawPayload: webhookResult.rawPayload || Prisma.JsonNull,
            rawWebhook: payload || Prisma.JsonNull,
          },
          update: {
            providerStatus: webhookResult.status || 'FAILED',
            rawWebhook: payload || Prisma.JsonNull,
          },
        });

        await this.auditService.logEvent({
          organizationId: payment.organizationId,
          actorUserId: null,
          action: newStatus === PaymentStatus.REFUNDED ? 'PAYMENT_REVERSED' : 'PROVIDER_PAYMENT_FAILED',
          entityType: 'Payment',
          entityId: payment.id,
          beforeDiff: { status: payment.status },
          afterDiff: { status: newStatus, providerStatus: webhookResult.status, triggeredBy: 'SYSTEM_WEBHOOK' },
          ipAddress,
          userAgent,
        });


        return {
          success: true,
          paymentId: payment.id,
          status: newStatus,
          isPaid: false,
        };
      }
    });
  }

  /**
   * Reverses / Refunds a previously verified payment.
   * Enforces role authorization and transitions membership & cards safely.
   */
  async reversePayment(
    reviewerUserId: string,
    organizationId: string,
    paymentId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('A reason is mandatory when reversing a payment');
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          membership: true,
          memberProfile: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found in this organization');
      }

      if (payment.status !== PaymentStatus.VERIFIED) {
        throw new BadRequestException(
          `Cannot reverse a payment that is not in VERIFIED status (current: ${payment.status})`,
        );
      }

      // Update payment to REFUNDED
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          rejectionReason: reason.trim(),
          reviewedAt: new Date(),
          reviewedByUserId: reviewerUserId,
        },
      });

      // Suspend / Expire membership
      await tx.membership.update({
        where: { id: payment.membershipId },
        data: {
          status: MembershipStatus.SUSPENDED,
          suspensionReason: `Payment reversed: ${reason.trim()}`,
          suspendedAt: new Date(),
        },
      });

      // Revoke Digital Card
      const card = await tx.digitalMembershipCard.findUnique({
        where: { membershipId: payment.membershipId },
        include: { verificationToken: true },
      });

      if (card) {
        await tx.digitalMembershipCard.update({
          where: { id: card.id },
          data: {
            status: CardStatus.REVOKED,
            revokedAt: new Date(),
            revocationReason: `Payment reversed: ${reason.trim()}`,
          },
        });

        if (card.verificationToken) {
          await tx.verificationToken.update({
            where: { id: card.verificationToken.id },
            data: { isRevoked: true },
          });
        }
      }

      // Immutable Audit Log
      await this.auditService.logEvent({
        organizationId,
        actorUserId: reviewerUserId,
        action: 'PAYMENT_REVERSED',
        entityType: 'Payment',
        entityId: payment.id,
        beforeDiff: { status: PaymentStatus.VERIFIED, membershipStatus: MembershipStatus.ACTIVE },
        afterDiff: {
          status: PaymentStatus.REFUNDED,
          reversalReason: reason.trim(),
          membershipStatus: MembershipStatus.SUSPENDED,
          cardStatus: CardStatus.REVOKED,
        },
        ipAddress,
        userAgent,
      });

      return {
        message: 'Payment reversed and refunded successfully.',
        payment: updatedPayment,
      };
    });
  }
}
