import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Inject,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantContext } from '../common/types/tenant-context.type';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContentStatus } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  CreatePositionDto,
  UpdatePositionDto,
  CreateLeaderDto,
  UpdateLeaderDto,
} from './dto/leadership.dto';
import { CreateProgramDto, UpdateProgramDto } from './dto/program.dto';
import { CreateBenefitDto, UpdateBenefitDto } from './dto/benefit.dto';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Controller('cms')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequirePermissions('tenant:content:manage')
export class CmsController {
  constructor(
    @Inject(CmsService)
    private readonly cmsService: CmsService,
  ) {}

  // ==========================================
  // PROFILE
  // ==========================================

  @Get('profile')
  async getProfile(@CurrentTenant() tenant: TenantContext) {
    return this.cmsService.getProfile(tenant.organizationId);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updateProfile(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ==========================================
  // LEADERSHIP
  // ==========================================

  @Get('leadership')
  async getLeadership(@CurrentTenant() tenant: TenantContext) {
    return this.cmsService.getLeadership(tenant.organizationId, true);
  }

  @Post('leadership/positions')
  async createPosition(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePositionDto,
    @Req() req: Request,
  ) {
    return this.cmsService.createPosition(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('leadership/positions/:id')
  async updatePosition(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updatePosition(
      tenant.organizationId,
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('leadership/positions/:id')
  async deletePosition(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.deletePosition(
      tenant.organizationId,
      id,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('leadership/leaders')
  async createLeader(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaderDto,
    @Req() req: Request,
  ) {
    return this.cmsService.createLeader(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('leadership/leaders/:id')
  async updateLeader(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaderDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updateLeader(
      tenant.organizationId,
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('leadership/leaders/:id')
  async deleteLeader(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.deleteLeader(
      tenant.organizationId,
      id,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ==========================================
  // PROGRAMS
  // ==========================================

  @Get('programs')
  async getPrograms(@CurrentTenant() tenant: TenantContext) {
    return this.cmsService.getPrograms(tenant.organizationId, true);
  }

  @Post('programs')
  async createProgram(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProgramDto,
    @Req() req: Request,
  ) {
    return this.cmsService.createProgram(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('programs/:id')
  async updateProgram(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updateProgram(
      tenant.organizationId,
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('programs/:id/publish')
  @HttpCode(200)
  async publishProgram(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.setProgramStatus(
      tenant.organizationId,
      id,
      ContentStatus.PUBLISHED,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('programs/:id/archive')
  @HttpCode(200)
  async archiveProgram(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.setProgramStatus(
      tenant.organizationId,
      id,
      ContentStatus.ARCHIVED,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('programs/:id')
  async deleteProgram(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.deleteProgram(
      tenant.organizationId,
      id,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ==========================================
  // BENEFITS
  // ==========================================

  @Get('benefits')
  async getBenefits(@CurrentTenant() tenant: TenantContext) {
    return this.cmsService.getBenefits(tenant.organizationId, true);
  }

  @Post('benefits')
  async createBenefit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBenefitDto,
    @Req() req: Request,
  ) {
    return this.cmsService.createBenefit(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('benefits/:id')
  async updateBenefit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBenefitDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updateBenefit(
      tenant.organizationId,
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('benefits/:id')
  async deleteBenefit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.deleteBenefit(
      tenant.organizationId,
      id,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ==========================================
  // RULES
  // ==========================================

  @Get('rules')
  async getRules(@CurrentTenant() tenant: TenantContext) {
    return this.cmsService.getRules(tenant.organizationId, true);
  }

  @Post('rules')
  async createRule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRuleDto,
    @Req() req: Request,
  ) {
    return this.cmsService.createRule(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('rules/:id')
  async updateRule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updateRule(
      tenant.organizationId,
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('rules/:id')
  async deleteRule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.deleteRule(
      tenant.organizationId,
      id,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ==========================================
  // ANNOUNCEMENTS
  // ==========================================

  @Get('announcements')
  async getAnnouncements(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    const audience = req.query.audience as string | undefined;
    const includeDrafts = req.query.includeDrafts === 'true';
    return this.cmsService.getAnnouncements(tenant.organizationId, includeDrafts, audience);
  }

  @Post('announcements')
  async createAnnouncement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
    @Req() req: Request,
  ) {
    return this.cmsService.createAnnouncement(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('announcements/:id')
  async updateAnnouncement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: Request,
  ) {
    return this.cmsService.updateAnnouncement(
      tenant.organizationId,
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('announcements/:id/publish')
  @HttpCode(200)
  async publishAnnouncement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.setAnnouncementStatus(
      tenant.organizationId,
      id,
      ContentStatus.PUBLISHED,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('announcements/:id/archive')
  @HttpCode(200)
  async archiveAnnouncement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.setAnnouncementStatus(
      tenant.organizationId,
      id,
      ContentStatus.ARCHIVED,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.cmsService.deleteAnnouncement(
      tenant.organizationId,
      id,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
