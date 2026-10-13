import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ValidationPipe,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { OrganizationsService } from './organizations.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { AssignStaffDto, UpdateStaffDto } from './dto/assign-staff.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Public()
  @Get()
  async getDirectory() {
    return this.organizationsService.getPublicDirectory();
  }

  /**
   * Platform Admin listing of all organizations with full operational metadata.
   */
  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  async getAllOrganizationsForAdmin(@CurrentUser() user: AuthenticatedUser) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
    return this.organizationsService.getAllForPlatformAdmin();
  }

  /**
   * Retrieves available staff roles for assignment.
   */
  @UseGuards(JwtAuthGuard)
  @Get('roles/available')
  async getAvailableStaffRoles() {
    return this.organizationsService.getAvailableStaffRoles();
  }

  /**
   * Onboard a new organization.
   * Restricted to platform administrators.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: CreateOrganizationDto,
      }),
    )
    dto: CreateOrganizationDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException(
        'Platform administrator privileges required to onboard new organizations',
      );
    }
    return this.organizationsService.createOrganization(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Protected tenant endpoint.
   * Requires:
   * 1. JWT Authentication (JwtAuthGuard)
   * 2. Valid Tenant Resolution & User Affiliation (TenantGuard)
   * 3. RBAC Permission 'members.read' (PermissionsGuard)
   * 4. RLS transaction isolation inside withTenantContext
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('members.read')
  @Get(':identifier/members')
  async getMembers(
    @Param('identifier') _identifier: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.organizationsService.getMembersRoster(tenant.organizationId);
  }

  /**
   * Protected tenant endpoint for retrieving staff roster.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:staff:manage')
  @Get(':identifier/staff')
  async getStaff(
    @Param('identifier') _identifier: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.organizationsService.getStaffRoster(tenant.organizationId);
  }

  /**
   * Protected tenant endpoint for assigning a new staff member.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:staff:manage')
  @Post(':identifier/staff')
  async assignStaff(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('identifier') _identifier: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: AssignStaffDto,
      }),
    )
    dto: AssignStaffDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.assignStaff(
      tenant.organizationId,
      dto,
      user.id,
      tenant.userRole,
      user.isPlatformAdmin,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Protected tenant endpoint for updating a staff member's role or status.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:staff:manage')
  @Patch(':identifier/staff/:staffId')
  async updateStaff(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('identifier') _identifier: string,
    @Param('staffId') staffId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateStaffDto,
      }),
    )
    dto: UpdateStaffDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.updateStaff(
      tenant.organizationId,
      staffId,
      dto,
      user.id,
      tenant.userRole,
      user.isPlatformAdmin,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Protected tenant endpoint for revoking staff membership.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:staff:manage')
  @Delete(':identifier/staff/:staffId')
  async revokeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('identifier') _identifier: string,
    @Param('staffId') staffId: string,
    @Req() req: Request,
  ) {
    return this.organizationsService.revokeStaff(
      tenant.organizationId,
      staffId,
      user.id,
      tenant.userRole,
      user.isPlatformAdmin,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Get(':identifier')
  async getOrganization(@Param('identifier') identifier: string) {
    return this.organizationsService.getByIdentifier(identifier);
  }

  /**
   * Platform Admin lifecycle transition (activate, suspend, deactivate).
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':identifier/status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateOrganizationStatusDto,
      }),
    )
    dto: UpdateOrganizationStatusDto,
    @Req() req: Request,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException(
        'Platform administrator privileges required to change organization status',
      );
    }
    return this.organizationsService.updateOrganizationStatus(
      identifier,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Tenant Admin settings update.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:settings:manage')
  @Patch(':identifier')
  async updateOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('identifier') _identifier: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateOrganizationDto,
      }),
    )
    dto: UpdateOrganizationDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.updateOrganization(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
