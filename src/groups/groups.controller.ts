import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreateGroupDto, AddGroupMemberDto, SendGroupMessageDto, EditGroupMessageDto } from './dto/group.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard, TenantGuard)
export class GroupsController {
  constructor(
    @Inject(GroupsService)
    private readonly groupsService: GroupsService,
  ) {}

  @Get()
  async getMyGroups(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.groupsService.getMyGroups(tenant.organizationId, user.id);
  }

  @Post()
  async createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: CreateGroupDto,
      }),
    )
    dto: CreateGroupDto,
  ) {
    return this.groupsService.createGroup(tenant.organizationId, user.id, dto);
  }

  @Get(':groupId')
  async getGroupDetails(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.getGroupDetails(tenant.organizationId, user.id, groupId);
  }

  @Post(':groupId/join')
  async joinGroup(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.joinGroup(tenant.organizationId, user.id, groupId);
  }

  @Post(':groupId/leave')
  async leaveGroup(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.leaveGroup(tenant.organizationId, user.id, groupId);
  }

  @Post(':groupId/members')
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: AddGroupMemberDto,
      }),
    )
    dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(tenant.organizationId, user.id, groupId, dto);
  }

  @Delete(':groupId/members/:targetUserId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.groupsService.removeMember(
      tenant.organizationId,
      user.id,
      groupId,
      targetUserId,
    );
  }

  @Get(':groupId/messages')
  async getGroupMessages(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.groupsService.getGroupMessages(
      tenant.organizationId,
      user.id,
      groupId,
      { limit, before },
    );
  }

  @Post(':groupId/messages')
  async sendGroupMessage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('groupId') groupId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: SendGroupMessageDto,
      }),
    )
    dto: SendGroupMessageDto,
  ) {
    return this.groupsService.sendGroupMessage(
      tenant.organizationId,
      user.id,
      groupId,
      dto,
    );
  }

  @Patch('messages/:messageId')
  async editGroupMessage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('messageId') messageId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: EditGroupMessageDto,
      }),
    )
    dto: EditGroupMessageDto,
  ) {
    return this.groupsService.editGroupMessage(
      tenant.organizationId,
      user.id,
      messageId,
      dto,
    );
  }

  @Delete('messages/:messageId')
  async deleteGroupMessage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('messageId') messageId: string,
  ) {
    return this.groupsService.deleteGroupMessage(
      tenant.organizationId,
      user.id,
      messageId,
    );
  }
}
