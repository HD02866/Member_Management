import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CardStatus, VerificationResult, MembershipStatus } from '@prisma/client';
import crypto from 'crypto';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves active digital membership card for the authenticated member in the active tenant.
   */
  async getMyCard(userId: string, organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const memberProfile = await tx.memberProfile.findFirst({
        where: { userId, organizationId, deletedAt: null },
      });

      if (!memberProfile) {
        throw new NotFoundException('Member profile not found in this organization');
      }

      let card = await tx.digitalMembershipCard.findFirst({
        where: {
          organizationId,
          memberProfileId: memberProfile.id,
          status: CardStatus.ACTIVE,
        },
        include: {
          verificationToken: {
            where: { isRevoked: false },
          },
          membership: {
            include: {
              membershipPlan: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { cardVersion: 'desc' },
      });

      if (!card) {
        // Find existing membership or create default active membership
        let membership = await tx.membership.findFirst({
          where: { organizationId, memberProfileId: memberProfile.id },
          include: { membershipPlan: true },
          orderBy: { createdAt: 'desc' },
        });

        if (!membership) {
          const defaultPlan = await tx.membershipPlan.findFirst({
            where: { organizationId, isActive: true },
          }) || await tx.membershipPlan.findFirst({
            where: { organizationId },
          });

          if (!defaultPlan) {
            throw new NotFoundException('No membership plan configured for organization');
          }

          const now = new Date();
          const oneYear = new Date(now);
          oneYear.setFullYear(oneYear.getFullYear() + 1);

          membership = await tx.membership.create({
            data: {
              organizationId,
              memberProfileId: memberProfile.id,
              membershipPlanId: defaultPlan.id,
              status: MembershipStatus.ACTIVE,
              startDate: now,
              endDate: oneYear,
            },
            include: { membershipPlan: true },
          });
        }

        const now = new Date();
        const expirationDate = membership.endDate && membership.endDate > now
          ? membership.endDate
          : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

        const cleanMemberNumber = memberProfile.memberNumber || Math.floor(10000 + Math.random() * 90000).toString();
        const cardNumber = `CARD-${cleanMemberNumber}`;

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        card = await tx.digitalMembershipCard.create({
          data: {
            organizationId,
            membershipId: membership.id,
            memberProfileId: memberProfile.id,
            cardNumber,
            cardVersion: 1,
            status: CardStatus.ACTIVE,
            issueDate: now,
            expirationDate,
            verificationToken: {
              create: {
                organizationId,
                token: rawToken,
                tokenHash,
                expiresAt: expirationDate,
                isRevoked: false,
              },
            },
          },
          include: {
            verificationToken: true,
            membership: {
              include: {
                membershipPlan: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
          },
        });
      }

      // Format card data safely with QR verification token
      return {
        id: card.id,
        cardNumber: card.cardNumber,
        cardVersion: card.cardVersion,
        status: card.status,
        issueDate: card.issueDate,
        expirationDate: card.expirationDate,
        pdfUrl: card.pdfUrl,
        qrToken: card.verificationToken?.token || null,
        member: {
          firstName: memberProfile.firstName,
          lastName: memberProfile.lastName,
          memberNumber: memberProfile.memberNumber,
          photoUrl: memberProfile.photoUrl,
        },
        memberProfile: {
          firstName: memberProfile.firstName,
          lastName: memberProfile.lastName,
          memberNumber: memberProfile.memberNumber,
          photoUrl: memberProfile.photoUrl,
        },
        membership: {
          planName: card.membership.membershipPlan.name,
          status: card.membership.status,
        },
        organization: card.organization,
      };
    });
  }

  /**
   * Rotates a digital membership card, invalidating the previous token and generating a fresh card & QR token.
   */
  async rotateCard(
    userId: string,
    organizationId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const memberProfile = await tx.memberProfile.findFirst({
        where: { userId, organizationId, deletedAt: null },
      });

      if (!memberProfile) {
        throw new NotFoundException('Member profile not found');
      }

      const existingCard = await tx.digitalMembershipCard.findFirst({
        where: {
          organizationId,
          memberProfileId: memberProfile.id,
          status: CardStatus.ACTIVE,
        },
        include: {
          verificationToken: true,
          membership: true,
        },
      });

      if (!existingCard) {
        throw new NotFoundException('No active digital membership card found to rotate');
      }

      const now = new Date();

      // Generate new cryptographically secure QR token (64 hex characters)
      const newQrToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(newQrToken).digest('hex');

      // Update card version
      const updatedCard = await tx.digitalMembershipCard.update({
        where: { id: existingCard.id },
        data: {
          cardVersion: existingCard.cardVersion + 1,
          updatedAt: now,
        },
      });

      // Rotate verification token (1-to-1 relationship on cardId)
      if (existingCard.verificationToken) {
        await tx.verificationToken.update({
          where: { id: existingCard.verificationToken.id },
          data: {
            token: newQrToken,
            tokenHash,
            expiresAt: existingCard.expirationDate,
            isRevoked: false,
            scanCount: 0,
            lastScannedAt: null,
            updatedAt: now,
          },
        });
      } else {
        await tx.verificationToken.create({
          data: {
            organizationId,
            cardId: updatedCard.id,
            token: newQrToken,
            tokenHash,
            expiresAt: existingCard.expirationDate,
            isRevoked: false,
          },
        });
      }

      // Immutable Audit Log
      await this.auditService.logEvent({
        organizationId,
        actorUserId: userId,
        action: 'DIGITAL_CARD_ROTATED',
        entityType: 'DigitalMembershipCard',
        entityId: updatedCard.id,
        beforeDiff: {
          cardVersion: existingCard.cardVersion,
          oldTokenRevoked: true,
        },
        afterDiff: {
          cardVersion: updatedCard.cardVersion,
          rotationReason: reason || 'User requested rotation',
        },
        ipAddress,
        userAgent,
      });

      return {
        message: 'Digital membership card and QR verification token rotated successfully.',
        card: {
          id: updatedCard.id,
          cardNumber: updatedCard.cardNumber,
          cardVersion: updatedCard.cardVersion,
          status: updatedCard.status,
          expirationDate: updatedCard.expirationDate,
          qrToken: newQrToken,
        },
      };
    });
  }

  /**
   * Public QR code verification endpoint.
   * Scanned by event verifiers, partners, or general public.
   * Adheres strictly to Minimal Disclosure principles.
   */
  async verifyToken(token: string, ipAddress?: string, userAgent?: string) {
    const cleanToken = token?.trim();

    if (!cleanToken) {
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        message: 'Verification token is empty or invalid',
      };
    }

    // 1. Digital ID Hardening: Compute SHA-256 hash of the bearer token
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    // 2. Query primary by tokenHash (hash-only lookup preserves secrecy even in DB snapshots)
    let verificationRecord = await this.prisma.withPlatformAdminContext(async (tx) => {
      return tx.verificationToken.findUnique({
        where: { tokenHash },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          card: {
            include: {
              memberProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                  memberNumber: true,
                  photoUrl: true,
                },
              },
              membership: {
                include: {
                  membershipPlan: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    // 3. Backward-compatible fallback for unmigrated legacy seed tokens
    if (!verificationRecord) {
      verificationRecord = await this.prisma.withPlatformAdminContext(async (tx) => {
        return tx.verificationToken.findFirst({
          where: { token: cleanToken, tokenHash: null },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
            card: {
              include: {
                memberProfile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    memberNumber: true,
                    photoUrl: true,
                  },
                },
                membership: {
                  include: {
                    membershipPlan: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        });
      });

      // Auto-upgrade legacy token with computed hash
      if (verificationRecord) {
        await this.prisma.withPlatformAdminContext(async (tx) => {
          await tx.verificationToken.update({
            where: { id: verificationRecord!.id },
            data: { tokenHash },
          });
        });
      }
    }

    if (!verificationRecord) {
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        message: 'Invalid verification code or membership card does not exist.',
      };
    }

    const now = new Date();
    const { card, organization } = verificationRecord;

    // Check Revocation Status
    if (verificationRecord.isRevoked || card.status === CardStatus.REVOKED) {
      await this.logVerification(card.id, organization.id, VerificationResult.REVOKED, ipAddress, userAgent);
      return {
        isValid: false,
        result: VerificationResult.REVOKED,
        message: 'This digital membership card has been revoked.',
        organization: { name: organization.name, slug: organization.slug },
        card: { cardNumber: card.cardNumber, status: CardStatus.REVOKED },
      };
    }

    // Check Expiration Status
    if (verificationRecord.expiresAt < now || card.expirationDate < now) {
      await this.logVerification(card.id, organization.id, VerificationResult.EXPIRED, ipAddress, userAgent);
      return {
        isValid: false,
        result: VerificationResult.EXPIRED,
        message: 'This digital membership card has expired.',
        organization: { name: organization.name, slug: organization.slug },
        card: {
          cardNumber: card.cardNumber,
          status: CardStatus.EXPIRED,
          expirationDate: card.expirationDate,
        },
      };
    }

    // Check Membership Status
    if (card.membership.status !== MembershipStatus.ACTIVE) {
      await this.logVerification(card.id, organization.id, VerificationResult.INVALID, ipAddress, userAgent);
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        message: 'The associated membership is not currently active.',
        organization: { name: organization.name, slug: organization.slug },
      };
    }

    // Card is VALID! Update token scan statistics and log verification
    await this.prisma.withPlatformAdminContext(async (tx) => {
      await tx.verificationToken.update({
        where: { id: verificationRecord.id },
        data: {
          scanCount: { increment: 1 },
          lastScannedAt: now,
        },
      });

      await tx.verificationLog.create({
        data: {
          organizationId: organization.id,
          cardId: card.id,
          verificationResult: VerificationResult.VALID,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          scannedAt: now,
        },
      });
    });

    // Minimal Safe Disclosure: Return ONLY non-sensitive identity attributes
    return {
      isValid: true,
      result: VerificationResult.VALID,
      message: 'Membership Verified Active',
      verifiedAt: now.toISOString(),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
      },
      member: {
        displayName: `${card.memberProfile.firstName} ${card.memberProfile.lastName.charAt(0)}.`,
        memberNumber: card.memberProfile.memberNumber,
        photoUrl: card.memberProfile.photoUrl,
      },
      membership: {
        planName: card.membership.membershipPlan.name,
        status: card.membership.status,
        validUntil: card.expirationDate.toISOString(),
      },
      card: {
        cardNumber: card.cardNumber,
        cardVersion: card.cardVersion,
        status: card.status,
      },
    };
  }

  private async logVerification(
    cardId: string,
    organizationId: string,
    result: VerificationResult,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.withPlatformAdminContext(async (tx) => {
        await tx.verificationLog.create({
          data: {
            organizationId,
            cardId,
            verificationResult: result,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            scannedAt: new Date(),
          },
        });
      });
    } catch (err: any) {
      this.logger.error('Failed to write verification log:', err.message);
    }
  }
}
