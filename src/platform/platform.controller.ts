import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { OrganizationStatus } from '@prisma/client';
import {
  CreatePlatformUserDto,
  UpdateOrganizationConfigDto,
  UpdateOrganizationBrandingDto,
  UpdateOrganizationFeaturesDto,
  AssignPlatformStaffDto,
  UpdatePlatformSettingsDto,
} from './dto/platform.dto';

@Controller('platform')
@UseGuards(JwtAuthGuard)
export class PlatformController {
  constructor(
    @Inject(PlatformService)
    private readonly platformService: PlatformService,
  ) {}

  private assertPlatformAdmin(user: AuthenticatedUser) {
    if (!user || !user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator privileges required');
    }
  }

  // =========================================================================
  // 1. STATS
  // =========================================================================

  @Get('stats')
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    this.assertPlatformAdmin(user);
    return this.platformService.getPlatformStats();
  }

  // =========================================================================
  // 2. USERS
  // =========================================================================

  @Get('users')
  async getUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.getUsers(
      search,
      status,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
  }

  @Post('users')
  async createUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: CreatePlatformUserDto,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.createPlatformUser(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // =========================================================================
  // 3. ORGANIZATIONS
  // =========================================================================

  @Get('organizations')
  async getOrganizations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.getOrganizations(
      search,
      status,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
  }

  @Get('organizations/:identifier')
  async getOrganizationDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.getOrganizationDetail(identifier);
  }

  @Patch('organizations/:identifier')
  async updateOrganizationConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: UpdateOrganizationConfigDto,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.updateOrganizationConfig(
      identifier,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('organizations/:identifier/branding')
  async updateOrganizationBranding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: UpdateOrganizationBrandingDto,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.updateOrganizationBranding(
      identifier,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('organizations/:identifier/features')
  async updateOrganizationFeatures(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: UpdateOrganizationFeaturesDto,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.updateOrganizationFeatures(
      identifier,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('organizations/:identifier/status')
  async updateOrganizationStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body('status') status: OrganizationStatus,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.updateOrganizationStatus(
      identifier,
      status,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('organizations/:identifier')
  async safeDeactivateOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.safeDeactivateOrganization(
      identifier,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // =========================================================================
  // 4. ORGANIZATION STAFF MANAGEMENT
  // =========================================================================

  @Post('organizations/:identifier/staff')
  async assignStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: AssignPlatformStaffDto,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.assignStaff(
      identifier,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('organizations/:identifier/staff/:staffId')
  async revokeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Param('staffId') staffId: string,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.revokeStaff(
      identifier,
      staffId,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // =========================================================================
  // 5. AUDIT LOGS
  // =========================================================================

  @Get('audit')
  async getAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.getAuditLogs(
      organizationId,
      action,
      entityType,
      actorUserId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 25,
    );
  }

  // =========================================================================
  // 6. PAYMENTS & VERIFICATION OVERSIGHT
  // =========================================================================

  @Get('payments')
  async getPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.getPaymentsOversight(
      organizationId,
      status,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 25,
    );
  }

  @Get('verification')
  async getVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('result') result?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.getVerificationOversight(
      organizationId,
      result,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 25,
    );
  }

  // =========================================================================
  // 7. PLATFORM SETTINGS
  // =========================================================================

  @Get('settings')
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    this.assertPlatformAdmin(user);
    return this.platformService.getPlatformSettings();
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: UpdatePlatformSettingsDto,
    @Req() req: Request,
  ) {
    this.assertPlatformAdmin(user);
    return this.platformService.updatePlatformSettings(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
