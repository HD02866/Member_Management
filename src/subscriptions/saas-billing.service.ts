import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma, SaasInvoiceStatus } from '@prisma/client';
import {
  CreateSaasInvoiceDto,
  SettleSaasInvoiceDto,
} from './dto/invoice.dto';

@Injectable()
export class SaasBillingService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a new SaaS subscription invoice. Platform admin operation.
   */
  async createInvoice(
    dto: CreateSaasInvoiceDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const sub = await this.prisma.withPlatformAdminContext((tx) =>
      tx.organizationSubscription.findUnique({
        where: { organizationId: dto.organizationId },
      }),
    );

    if (!sub) {
      throw new NotFoundException(
        `Organization ${dto.organizationId} does not have an active subscription record`,
      );
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const invoiceNumber = `INV-${year}-${randomSuffix}`;
    const amountDecimal = new Prisma.Decimal(dto.amount);

    if (amountDecimal.lte(0)) {
      throw new BadRequestException('Invoice amount must be strictly positive');
    }

    const invoice = await this.prisma.withPlatformAdminContext((tx) =>
      tx.saasInvoice.create({
        data: {
          organizationId: dto.organizationId,
          subscriptionId: sub.id,
          invoiceNumber,
          amount: amountDecimal,
          currency: dto.currency || 'ETB',
          status: SaasInvoiceStatus.ISSUED,
          dueDate: new Date(dto.dueDate),
          notes: dto.notes?.trim(),
        },
      }),
    );

    await this.auditService.logEvent({
      organizationId: dto.organizationId,
      actorUserId,
      action: 'SAAS_INVOICE_CREATED',
      entityType: 'SaasInvoice',
      entityId: invoice.id,
      afterDiff: {
        invoiceNumber,
        amount: invoice.amount.toString(),
        currency: invoice.currency,
        status: invoice.status,
      },
      ipAddress,
      userAgent,
    });

    return invoice;
  }

  /**
   * Settles a SaaS invoice with payment reference.
   */
  async settleInvoice(
    invoiceId: string,
    dto: SettleSaasInvoiceDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const invoice = await this.prisma.withPlatformAdminContext((tx) =>
      tx.saasInvoice.findUnique({
        where: { id: invoiceId },
      }),
    );

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === SaasInvoiceStatus.PAID) {
      return {
        success: true,
        message: 'Invoice is already marked PAID',
        invoice,
      };
    }

    const paidDate = dto.paidDate ? new Date(dto.paidDate) : new Date();

    const updated = await this.prisma.withPlatformAdminContext((tx) =>
      tx.saasInvoice.update({
        where: { id: invoiceId },
        data: {
          status: SaasInvoiceStatus.PAID,
          paidDate,
          paymentReference: dto.paymentReference.trim(),
        },
      }),
    );

    await this.auditService.logEvent({
      organizationId: invoice.organizationId,
      actorUserId,
      action: 'SAAS_INVOICE_SETTLED',
      entityType: 'SaasInvoice',
      entityId: invoice.id,
      beforeDiff: { status: invoice.status },
      afterDiff: {
        status: SaasInvoiceStatus.PAID,
        paidDate,
        paymentReference: dto.paymentReference.trim(),
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Retrieves invoices for a tenant or platform admin.
   */
  async listInvoices(organizationId: string, isPlatformAdmin: boolean = false) {
    if (isPlatformAdmin && !organizationId) {
      return this.prisma.withPlatformAdminContext((tx) =>
        tx.saasInvoice.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
        }),
      );
    }

    return this.prisma.withTenantContext(organizationId, (tx) =>
      tx.saasInvoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}
