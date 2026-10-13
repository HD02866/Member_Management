import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import {
  PaymentStatus,
  MembershipStatus,
  CardStatus,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';

export interface ReconciliationResult {
  paymentId: string;
  reference: string;
  provider: string;
  localStatus: PaymentStatus;
  providerStatus: string;
  discrepancyType?:
    | 'NONE'
    | 'PENDING_RESOLVED_SUCCESS'
    | 'VERIFIED_FLAGGED_FAILED'
    | 'AMOUNT_MISMATCH'
    | 'CURRENCY_MISMATCH'
    | 'TRANSACTION_NOT_FOUND';
  actionTaken: string;
  verifiedAt: Date;
}

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PaymentProviderRegistry)
    private readonly providerRegistry: PaymentProviderRegistry,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}


  /**
   * Reconciles an individual payment by verifying its state directly against the provider.
   */
  async reconcilePayment(
    paymentId: string,
    organizationId: string,
    actorUserId?: string,
  ): Promise<ReconciliationResult> {
    const payment = await this.prisma.withPlatformAdminContext(async (tx) => {
      return tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          paymentMethod: true,
          membership: {
            include: { membershipPlan: true },
          },
          memberProfile: true,
        },
      });
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found in this organization`);
    }

    const providerType =
      payment.paymentMethod?.type === 'TELEBIRR'
        ? 'TELEBIRR'
        : payment.paymentMethod?.type === 'CBE_BIRR'
        ? 'CBE_BIRR'
        : payment.paymentMethod?.type === 'CHAPA'
        ? 'CHAPA'
        : 'MANUAL_BANK';

    const provider = this.providerRegistry.getProvider(providerType as any);

    const txRef = payment.transactionReference || payment.id;

    // Query provider for authoritative state
    const providerResult = await provider.verifyTransaction(txRef, txRef);

    let discrepancyType: ReconciliationResult['discrepancyType'] = 'NONE';
    let actionTaken = 'No change required; records are consistent.';

    // Case 1: Local is PENDING/UNDER_REVIEW but Provider is SUCCESS
    if (
      (payment.status === PaymentStatus.PENDING ||
        payment.status === PaymentStatus.UNDER_REVIEW ||
        payment.status === PaymentStatus.SUBMITTED) &&
      providerResult.isPaid
    ) {
      // Financial integrity check: verify amounts match
      if (
        providerResult.amount &&
        !new Prisma.Decimal(providerResult.amount).equals(payment.amount)
      ) {
        discrepancyType = 'AMOUNT_MISMATCH';
        actionTaken = `Flagged amount mismatch: expected ${payment.amount}, received ${providerResult.amount}`;
      } else if (
        providerResult.currency &&
        providerResult.currency !== payment.currency
      ) {
        discrepancyType = 'CURRENCY_MISMATCH';
        actionTaken = `Flagged currency mismatch: expected ${payment.currency}, received ${providerResult.currency}`;
      } else {
        discrepancyType = 'PENDING_RESOLVED_SUCCESS';
        actionTaken = 'Reconciled: Automatically activated payment and membership.';

        // Execute atomic activation
        await this.prisma.withTenantContext(payment.organizationId, async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.VERIFIED,
              reviewedAt: new Date(),
              reviewedByUserId: actorUserId || null,
            },
          });

          await tx.paymentTransaction.upsert({
            where: {
              provider_providerTxId: {
                provider: provider.providerType,
                providerTxId: providerResult.providerTxId || txRef,
              },
            },
            create: {
              organizationId: payment.organizationId,
              paymentId: payment.id,
              provider: provider.providerType,
              providerTxId: providerResult.providerTxId || txRef,
              providerStatus: 'SUCCESS',
              rawPayload: providerResult.rawPayload || Prisma.JsonNull,
            },
            update: {
              providerStatus: 'SUCCESS',
              rawPayload: providerResult.rawPayload || Prisma.JsonNull,
            },
          });

          // Transition membership to ACTIVE
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


          await tx.membership.update({
            where: { id: payment.membershipId },
            data: {
              status: MembershipStatus.ACTIVE,
              startDate,
              endDate,
            },
          });

          // Ensure digital card exists
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
        });
      }
    } else if (
      payment.status === PaymentStatus.VERIFIED &&
      (providerResult.status === 'FAILED' || providerResult.status === 'REFUNDED')
    ) {
      discrepancyType = 'VERIFIED_FLAGGED_FAILED';
      actionTaken = `Flagged: Local record is VERIFIED but provider reports ${providerResult.status}. Review required.`;
    } else if (providerResult.status === 'UNVERIFIED_NO_CREDENTIALS') {
      actionTaken = 'Provider verification skipped: live credentials not configured.';
    }

    // Write immutable audit log for reconciliation
    await this.auditService.logEvent({
      organizationId: payment.organizationId,
      actorUserId: actorUserId || null,
      action: 'PAYMENT_RECONCILED',
      entityType: 'Payment',
      entityId: payment.id,
      beforeDiff: { status: payment.status },
      afterDiff: {
        providerStatus: providerResult.status,
        discrepancyType,
        actionTaken,
        triggeredBy: actorUserId ? 'STAFF' : 'SYSTEM',
      },
    });


    return {
      paymentId: payment.id,
      reference: txRef,
      provider: providerType,
      localStatus: payment.status,
      providerStatus: providerResult.status,

      discrepancyType,
      actionTaken,
      verifiedAt: new Date(),
    };
  }

  /**
   * Scans all pending payments in a tenant and reconciles them.
   */
  async reconcilePendingPayments(
    organizationId: string,
    actorUserId?: string,
  ): Promise<{ scanned: number; reconciled: number; results: ReconciliationResult[] }> {
    const pendingPayments = await this.prisma.withPlatformAdminContext(async (tx) => {
      return tx.payment.findMany({
        where: {
          organizationId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.UNDER_REVIEW] },
        },
        select: { id: true },
      });
    });

    const results: ReconciliationResult[] = [];
    let reconciledCount = 0;

    for (const p of pendingPayments) {
      try {
        const res = await this.reconcilePayment(p.id, organizationId, actorUserId);
        results.push(res);
        if (res.discrepancyType === 'PENDING_RESOLVED_SUCCESS') {
          reconciledCount++;
        }
      } catch (err: any) {
        this.logger.error(`Failed to reconcile payment ${p.id}: ${err.message}`);
      }
    }

    return {
      scanned: pendingPayments.length,
      reconciled: reconciledCount,
      results,
    };
  }
}
