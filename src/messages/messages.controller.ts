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
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { StartConversationDto, SendMessageDto, EditMessageDto } from './dto/messaging.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagesController {
  constructor(
    @Inject(MessagesService)
    private readonly messagesService: MessagesService,
  ) {}

  /**
   * List all conversations for the current user.
   */
  @Get('conversations')
  async getMyConversations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.messagesService.getMyConversations(tenant.organizationId, user.id);
  }

  /**
   * Start or open a conversation with another user.
   */
  @Post('conversations')
  async startConversation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: StartConversationDto,
      }),
    )
    dto: StartConversationDto,
  ) {
    return this.messagesService.startConversation(
      tenant.organizationId,
      user.id,
      dto,
    );
  }

  /**
   * Search users in the organization to chat with.
   */
  @Get('users/search')
  async searchUsers(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Query('q') query: string,
  ) {
    return this.messagesService.searchUsersToChat(
      tenant.organizationId,
      user.id,
      query,
    );
  }

  /**
   * Get messages in a conversation.
   */
  @Get('conversations/:conversationId')
  async getConversationMessages(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messagesService.getConversationMessages(
      tenant.organizationId,
      user.id,
      conversationId,
      { limit, before },
    );
  }

  /**
   * Send a message to a conversation.
   */
  @Post('conversations/:conversationId')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('conversationId') conversationId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: SendMessageDto,
      }),
    )
    dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      tenant.organizationId,
      user.id,
      conversationId,
      dto,
    );
  }

  /**
   * Edit a message.
   */
  @Patch(':messageId')
  async editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('messageId') messageId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        expectedType: EditMessageDto,
      }),
    )
    dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(
      tenant.organizationId,
      user.id,
      messageId,
      dto,
    );
  }

  /**
   * Delete a message.
   */
  @Delete(':messageId')
  async deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(
      tenant.organizationId,
      user.id,
      messageId,
    );
  }
}
