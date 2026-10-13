import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantContext } from '../common/types/tenant-context.type';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationStatus } from '@prisma/client';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Query('status') status?: NotificationStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      user.id,
      tenant.organizationId,
      {
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, user.id, tenant.organizationId);
  }

  @Post('mark-all-read')
  async markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.notificationsService.markAllAsRead(user.id, tenant.organizationId);
  }

  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.notificationsService.getUserPreferences(user.id, tenant.organizationId);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateNotificationPreferencesDto,
    @Req() req: Request,
  ) {
    return this.notificationsService.updateUserPreferences(
      user.id,
      tenant.organizationId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions('tenant:content:manage')
  @Post('broadcast')
  async broadcastNotification(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: BroadcastNotificationDto,
    @Req() req: Request,
  ) {
    return this.notificationsService.broadcastToTenant(
      tenant.organizationId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
