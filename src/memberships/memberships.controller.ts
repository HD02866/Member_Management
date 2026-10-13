import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { MembershipsService } from './memberships.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AllowProspectiveMember } from '../common/decorators/allow-prospective-member.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { ApplyMembershipDto } from './dto/apply-membership.dto';

@Controller('memberships')
export class MembershipsController {
  constructor(
    @Inject(MembershipsService)
    private readonly membershipsService: MembershipsService,
  ) {}

  /**
   * Discovers active membership plans for the resolved tenant.
   * Publicly accessible by visitors and authenticated users.
   */
  @Public()
  @UseGuards(TenantGuard)
  @Get('plans')
  async getPlans(@CurrentTenant() tenant: TenantContext) {
    return this.membershipsService.getPlans(tenant.organizationId);
  }

  /**
   * Applies for a membership in the active tenant.
   * Allows authenticated prospective members to register.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @AllowProspectiveMember()
  @Post('apply')
  async applyForMembership(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ApplyMembershipDto,
      }),
    )
    dto: ApplyMembershipDto,
    @Req() req: Request,
  ) {
    return this.membershipsService.applyForMembership(
      user.id,
      tenant.organizationId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Retrieves current user's memberships in the active tenant.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('me')
  async getMyMemberships(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.membershipsService.getMyMemberships(user.id, tenant.organizationId);
  }
}
