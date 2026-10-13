import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Req,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AllowProspectiveMember } from '../common/decorators/allow-prospective-member.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { ApprovePaymentDto, RejectPaymentDto } from './dto/review-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentReconciliationService } from './reconciliation/payment-reconciliation.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
    @Inject(PaymentReconciliationService)
    private readonly reconciliationService: PaymentReconciliationService,
  ) {}


  /**
   * Retrieves active payment methods configured for the resolved tenant.
   * Publicly accessible by visitors and members.
   */
  @Public()
  @UseGuards(TenantGuard)
  @Get('methods')
  async getPaymentMethods(@CurrentTenant() tenant: TenantContext) {
    return this.paymentsService.getPaymentMethods(tenant.organizationId);
  }

  /**
   * Initiates payment for a membership application under strict server pricing and idempotency.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @AllowProspectiveMember()
  @Post()
  async initiatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Headers('idempotency-key') headerIdempotencyKey: string | undefined,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: InitiatePaymentDto,
      }),
    )
    dto: InitiatePaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.initiatePayment(
      user.id,
      tenant.organizationId,
      dto,
      headerIdempotencyKey,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Submits manual payment proof (bank deposit slip / mobile transaction receipt).
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @AllowProspectiveMember()
  @Post(':id/proof')
  async submitProof(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: SubmitPaymentProofDto,
      }),
    )
    dto: SubmitPaymentProofDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.submitPaymentProof(
      user.id,
      tenant.organizationId,
      paymentId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Retrieves current user's payments in the active tenant.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('me')
  async getMyPayments(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.paymentsService.getMyPayments(user.id, tenant.organizationId);
  }

  /**
   * Retrieves payments awaiting finance review in the active tenant.
   * Requires 'tenant:payments:read' permission or platform admin.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:payments:read')
  @Get('review')
  async getPendingReviews(@CurrentTenant() tenant: TenantContext) {
    return this.paymentsService.getPendingReviews(tenant.organizationId);
  }

  /**
   * Reconciles all pending payments in the active tenant against payment providers.
   * Requires 'tenant:payments:approve' permission.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:payments:approve')
  @Post('reconcile/batch')
  async reconcileBatch(
    @CurrentUser() reviewer: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.reconciliationService.reconcilePendingPayments(
      tenant.organizationId,
      reviewer.id,
    );
  }


  /**
   * Retrieves details of a specific payment.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(':id')
  async getPaymentById(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
  ) {
    const isStaffOrAdmin =
      user.isPlatformAdmin ||
      (tenant.userRole !== 'MEMBER' && tenant.userRole !== 'PROSPECTIVE_MEMBER');
    return this.paymentsService.getPaymentById(
      user.id,
      isStaffOrAdmin,
      tenant.organizationId,
      paymentId,
    );
  }

  /**
   * Approves a payment and activates the associated membership and digital card.
   * Enforces strict Segregation of Duties.
   * Requires 'tenant:payments:approve' permission.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:payments:approve')
  @Post(':id/approve')
  async approvePayment(
    @CurrentUser() reviewer: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ApprovePaymentDto,
      }),
    )
    dto: ApprovePaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.approvePayment(
      reviewer.id,
      tenant.organizationId,
      paymentId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Rejects a payment proof with a mandatory rejection reason.
   * Requires 'tenant:payments:approve' permission.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:payments:approve')
  @Post(':id/reject')
  async rejectPayment(
    @CurrentUser() reviewer: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: RejectPaymentDto,
      }),
    )
    dto: RejectPaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.rejectPayment(
      reviewer.id,
      tenant.organizationId,
      paymentId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Reconciles a specific payment against external provider records.
   * Requires 'tenant:payments:approve' permission.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:payments:approve')
  @Post(':id/reconcile')
  async reconcilePayment(
    @CurrentUser() reviewer: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
  ) {
    return this.reconciliationService.reconcilePayment(
      paymentId,
      tenant.organizationId,
      reviewer.id,
    );
  }

  /**
   * Reverses / Refunds a previously verified payment.
   * Suspends membership and revokes associated digital cards.
   * Requires 'tenant:payments:approve' permission.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:payments:approve')
  @Post(':id/reverse')
  async reversePayment(
    @CurrentUser() reviewer: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ReversePaymentDto,
      }),
    )
    dto: ReversePaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.reversePayment(
      reviewer.id,
      tenant.organizationId,
      paymentId,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }
}

