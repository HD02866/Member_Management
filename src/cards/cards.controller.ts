import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { CardsService } from './cards.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';

@Controller()
export class CardsController {
  constructor(
    @Inject(CardsService)
    private readonly cardsService: CardsService,
  ) {}

  /**
   * Retrieves the authenticated member's digital membership card in the active tenant.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('cards/me')
  async getMyCard(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.cardsService.getMyCard(user.id, tenant.organizationId);
  }

  /**
   * Rotates member's digital membership card and invalidates previous QR verification secret.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('cards/rotate')
  async rotateCard(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body('reason') reason: string | undefined,
    @Req() req: Request,
  ) {
    return this.cardsService.rotateCard(
      user.id,
      tenant.organizationId,
      reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * Public QR code verification endpoint.
   * Scanned by field agents, event check-ins, or partners.
   * Returns minimal safe verification certificate.
   */
  @Public()
  @Get('verify/:token')
  async verifyCardToken(
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    return this.cardsService.verifyToken(
      token,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
