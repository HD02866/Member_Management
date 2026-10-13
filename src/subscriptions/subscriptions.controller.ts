import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  Inject,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionEntitlementService } from './subscription-entitlement.service';
import { SaasBillingService } from './saas-billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TenantContext } from '../common/types/tenant-context.type';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateSaasPlanDto, UpdateSaasPlanDto } from './dto/plan.dto';
import {
  AssignSubscriptionDto,
  UpdateSubscriptionStatusDto,
} from './dto/subscription.dto';
import {
  CreateSaasInvoiceDto,
  SettleSaasInvoiceDto,
} from './dto/invoice.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    @Inject(SubscriptionsService)
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(SubscriptionEntitlementService)
    private readonly entitlementService: SubscriptionEntitlementService,
    @Inject(SaasBillingService)
    private readonly billingService: SaasBillingService,
  ) {}

  // ==========================================
  // PUBLIC / TENANT ROUTES
  // ==========================================

  @Public()
  @Get('plans')
  async getPublicPlans() {
    return this.subscriptionsService.listPlans(false);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:settings:manage')
  @Get('me')
  async getMySubscription(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptionsService.getTenantSubscription(tenant.organizationId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:settings:manage')
  @Get('usage')
  async getMyUsage(@CurrentTenant() tenant: TenantContext) {
    return this.entitlementService.getUsageMetrics(tenant.organizationId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:settings:manage')
  @Get('invoices')
  async getMyInvoices(@CurrentTenant() tenant: TenantContext) {
    return this.billingService.listInvoices(tenant.organizationId, false);
  }

  // ==========================================
  // PLATFORM ADMIN ROUTES
  // ==========================================

  @UseGuards(JwtAuthGuard)
  @Get('admin/plans')
  async getAdminPlans(@CurrentUser() user: AuthenticatedUser) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.subscriptionsService.listPlans(true);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/plans')
  async createPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaasPlanDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.subscriptionsService.createPlan(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/plans/:id')
  async updatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaasPlanDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.subscriptionsService.updatePlan(
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  async getAllSubscriptions(@CurrentUser() user: AuthenticatedUser) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.subscriptionsService.listAllSubscriptions();
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/assign')
  async assignSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignSubscriptionDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.subscriptionsService.assignSubscription(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/:id/status')
  async updateSubscriptionStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.subscriptionsService.updateSubscriptionStatus(
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/invoices')
  async getAllInvoices(@CurrentUser() user: AuthenticatedUser) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.billingService.listInvoices('', true);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/invoices')
  async createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaasInvoiceDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.billingService.createInvoice(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/invoices/:id/settle')
  @HttpCode(200)
  async settleInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SettleSaasInvoiceDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.billingService.settleInvoice(
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
