import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import {
  ApproveMemberDto,
  SuspendMemberDto,
  UpdateAdminNotesDto,
  AdminUpdateMemberProfileDto,
  ResetMemberPasswordDto,
  DeleteMemberDto,
  UpdateDigitalIdPhotoDto,
  AdminCreateUserDto,
} from './dto/admin-member.dto';

import { CmsService } from '../cms/cms.service';

@Controller('members')
export class MembersController {
  constructor(
    @Inject(MembersService)
    private readonly membersService: MembersService,
    @Inject(CmsService)
    private readonly cmsService: CmsService,
  ) {}

  /**
   * Retrieves member announcements for the active tenant.
   * Signed-in members see announcements with audience PUBLIC or MEMBERS.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('announcements')
  async getMemberAnnouncements(
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.cmsService.getAnnouncements(tenant.organizationId, false, 'MEMBERS');
  }

  /**
   * Retrieves the authenticated user's member profile in the active tenant.
   * Enforced by TenantGuard and PostgreSQL RLS.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('me')
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.membersService.getMyProfile(user.id, tenant.organizationId);
  }

  /**
   * Updates permitted personal information for the member profile in the active tenant.
   * Rejects any attempt to modify server-controlled fields (organizationId, status, memberNumber).
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateMemberProfileDto,
      }),
    )
    dto: UpdateMemberProfileDto,
    @Req() req: Request,
  ) {
    return this.membersService.updateMyProfile(
      user.id,
      tenant.organizationId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: List all organization members with query filters (status, search, page).
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:read')
  @Get('admin/list')
  async getMembersList(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.membersService.getMembersList(tenant.organizationId, req.query);
  }

  /**
   * Admin: View complete details of a specific member.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:read')
  @Get('admin/:memberId')
  async getMemberDetails(
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.getMemberDetails(tenant.organizationId, memberId);
  }

  /**
   * Admin: Approve or reject a member application.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:approve')
  @Post('admin/:memberId/review')
  async reviewMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ApproveMemberDto,
      }),
    )
    dto: ApproveMemberDto,
    @Req() req: Request,
  ) {
    return this.membersService.approveOrRejectMember(
      tenant.organizationId,
      memberId,
      dto.decision as any,
      dto.reason,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Suspend a member.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:suspend')
  @Post('admin/:memberId/suspend')
  async suspendMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: SuspendMemberDto,
      }),
    )
    dto: SuspendMemberDto,
    @Req() req: Request,
  ) {
    return this.membersService.suspendMember(
      tenant.organizationId,
      memberId,
      dto.reason,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Reinstate a suspended member.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:suspend')
  @Post('admin/:memberId/reinstate')
  async reinstateMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    return this.membersService.reinstateMember(
      tenant.organizationId,
      memberId,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Update internal notes.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:read')
  @Patch('admin/:memberId/notes')
  async updateAdminNotes(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateAdminNotesDto,
      }),
    )
    dto: UpdateAdminNotesDto,
  ) {
    return this.membersService.updateAdminNotes(
      tenant.organizationId,
      memberId,
      dto.adminNotes,
      user.id,
    );
  }

  /**
   * Admin: Update member details (personal info, contact, address).
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:approve')
  @Patch('admin/:memberId')
  async updateMemberProfile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: AdminUpdateMemberProfileDto,
      }),
    )
    dto: AdminUpdateMemberProfileDto,
    @Req() req: Request,
  ) {
    return this.membersService.adminUpdateMember(
      tenant.organizationId,
      memberId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Securely reset member password.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:suspend')
  @Post('admin/:memberId/reset-password')
  async resetMemberPassword(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ResetMemberPasswordDto,
      }),
    )
    dto: ResetMemberPasswordDto,
    @Req() req: Request,
  ) {
    return this.membersService.resetMemberPassword(
      tenant.organizationId,
      memberId,
      user.id,
      dto.temporaryPassword,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Revoke / delete member profile.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:suspend')
  @Delete('admin/:memberId')
  async deleteMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body()
    dto: DeleteMemberDto | undefined,
    @Req() req: Request,
  ) {
    return this.membersService.deleteMember(
      tenant.organizationId,
      memberId,
      user.id,
      dto?.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Upload or replace a member's digital ID image / card photo.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:approve')
  @Patch('admin/:memberId/digital-id-photo')
  async updateDigitalIdPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateDigitalIdPhotoDto,
      }),
    )
    dto: UpdateDigitalIdPhotoDto,
    @Req() req: Request,
  ) {
    return this.membersService.updateMemberDigitalIdPhoto(
      tenant.organizationId,
      memberId,
      dto.photoUrl,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Remove a member's digital ID image / card photo.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:approve')
  @Delete('admin/:memberId/digital-id-photo')
  async removeDigitalIdPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    return this.membersService.removeMemberDigitalIdPhoto(
      tenant.organizationId,
      memberId,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Admin: Create a new user and member record.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('tenant:members:approve')
  @Post('admin/create-user')
  async createUser(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: AdminCreateUserDto,
      }),
    )
    dto: AdminCreateUserDto,
    @Req() req: Request,
  ) {
    return this.membersService.createUser(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}


