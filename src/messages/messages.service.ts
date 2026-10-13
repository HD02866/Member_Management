import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StartConversationDto, SendMessageDto, EditMessageDto } from './dto/messaging.dto';
import { MessageStatus } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List conversations for the authenticated user within the organization.
   */
  async getMyConversations(organizationId: string, userId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const participants = await tx.conversationParticipant.findMany({
        where: {
          userId,
          conversation: { organizationId },
        },
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phoneNumber: true,
                      memberProfiles: {
                        where: { organizationId, deletedAt: null },
                        select: { memberNumber: true, photoUrl: true, status: true },
                        take: 1,
                      },
                      staffMemberships: {
                        where: { organizationId, isActive: true },
                        include: { role: { select: { name: true, code: true } } },
                        take: 1,
                      },
                    },
                  },
                },
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                  sender: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { conversation: { updatedAt: 'desc' } },
      });

      const mapped = await Promise.all(
        participants.map(async (p) => {
          const conv = p.conversation;
          const otherParticipant = conv.participants.find((part) => part.userId !== userId);
          const lastMessage = conv.messages[0] || null;

          // Compute unread count for current user
          const unreadCount = await tx.message.count({
            where: {
              conversationId: conv.id,
              senderUserId: { not: userId },
              deletedAt: null,
              ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
            },
          });

          return {
            id: conv.id,
            type: conv.type,
            updatedAt: conv.updatedAt,
            isMuted: p.isMuted,
            isArchived: p.isArchived,
            lastReadAt: p.lastReadAt,
            unreadCount,
            otherUser: otherParticipant
              ? {
                  id: otherParticipant.user.id,
                  firstName: otherParticipant.user.firstName,
                  lastName: otherParticipant.user.lastName,
                  email: otherParticipant.user.email,
                  lastReadAt: otherParticipant.lastReadAt,
                  memberProfile: otherParticipant.user.memberProfiles[0] || null,
                  staffRole: otherParticipant.user.staffMemberships[0]?.role?.name || null,
                }
              : null,
            lastMessage: lastMessage
              ? {
                  id: lastMessage.id,
                  content: lastMessage.content,
                  status: lastMessage.status,
                  createdAt: lastMessage.createdAt,
                  senderId: lastMessage.senderUserId,
                  senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
                }
              : null,
          };
        }),
      );

      return mapped;
    });
  }

  /**
   * Start or retrieve an existing direct conversation with another user.
   */
  async startConversation(
    organizationId: string,
    currentUserId: string,
    dto: StartConversationDto,
  ) {
    if (currentUserId === dto.recipientUserId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Verify recipient exists and belongs to this organization
      const recipientProfile = await tx.memberProfile.findFirst({
        where: {
          organizationId,
          userId: dto.recipientUserId,
          deletedAt: null,
        },
      });
      const recipientStaff = await tx.staffMembership.findFirst({
        where: {
          organizationId,
          userId: dto.recipientUserId,
          isActive: true,
        },
      });

      if (!recipientProfile && !recipientStaff) {
        throw new NotFoundException('Recipient is not a member or staff of this organization');
      }

      // Check if conversation already exists between these two users
      const existing = await tx.conversation.findFirst({
        where: {
          organizationId,
          AND: [
            { participants: { some: { userId: currentUserId } } },
            { participants: { some: { userId: dto.recipientUserId } } },
          ],
        },
        include: {
          participants: true,
        },
      });

      if (existing) {
        if (dto.initialMessage) {
          await tx.message.create({
            data: {
              conversationId: existing.id,
              senderUserId: currentUserId,
              content: dto.initialMessage.trim(),
            },
          });
          await tx.conversation.update({
            where: { id: existing.id },
            data: { updatedAt: new Date() },
          });
        }
        return existing;
      }

      // Create new conversation with both participants
      const conv = await tx.conversation.create({
        data: {
          organizationId,
          type: 'DIRECT',
          participants: {
            create: [
              { userId: currentUserId },
              { userId: dto.recipientUserId },
            ],
          },
        },
      });

      if (dto.initialMessage) {
        await tx.message.create({
          data: {
            conversationId: conv.id,
            senderUserId: currentUserId,
            content: dto.initialMessage.trim(),
          },
        });
      }

      return conv;
    });
  }

  /**
   * Get messages in a conversation (paginated, with authorization check).
   */
  async getConversationMessages(
    organizationId: string,
    userId: string,
    conversationId: string,
    query: { limit?: string; before?: string },
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Authorize participant
      const participant = await tx.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new ForbiddenException('You are not a participant in this conversation');
      }

      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
      const where: any = {
        conversationId,
        deletedAt: null,
      };

      if (query.before) {
        where.createdAt = { lt: new Date(query.before) };
      }

      const messages = await tx.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Update current participant lastReadAt
      const now = new Date();
      await tx.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadAt: now },
      });

      // Find other participant's lastReadAt to accurately reflect read receipts
      const otherParticipant = await tx.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: userId } },
        select: { lastReadAt: true },
      });

      const otherReadAt = otherParticipant?.lastReadAt;

      // Map messages with computed delivery/read status:
      // If message is sent by current user and otherParticipant read after message creation => READ
      const mappedMessages = messages.reverse().map((msg) => {
        let status = msg.status;
        if (msg.senderUserId === userId) {
          if (otherReadAt && new Date(otherReadAt) >= new Date(msg.createdAt)) {
            status = MessageStatus.READ;
          } else {
            status = MessageStatus.SENT;
          }
        }
        return {
          ...msg,
          status,
        };
      });

      return mappedMessages;
    });
  }

  /**
   * Send a message to a conversation.
   */
  async sendMessage(
    organizationId: string,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    if (!dto.content?.trim() && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException('Message must contain content or an attachment');
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Authorize participant
      const participant = await tx.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new ForbiddenException('You are not a participant in this conversation');
      }

      // Check sender account status
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (user?.status === 'SUSPENDED' || user?.status === 'DEACTIVATED') {
        throw new ForbiddenException('Suspended accounts cannot send messages');
      }

      const message = await tx.message.create({
        data: {
          conversationId,
          senderUserId: userId,
          content: dto.content?.trim() || null,
          status: MessageStatus.SENT,
          attachments: dto.attachments && dto.attachments.length > 0
            ? {
                create: dto.attachments.map((att) => ({
                  url: att.url,
                  mimeType: att.mimeType,
                  sizeBytes: att.sizeBytes,
                  filename: att.filename,
                })),
              }
            : undefined,
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true },
          },
          attachments: true,
        },
      });

      // Update conversation timestamp
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Notify the other participant
      const otherParticipants = await tx.conversationParticipant.findMany({
        where: { conversationId, userId: { not: userId } },
      });

      for (const other of otherParticipants) {
        if (!other.isMuted) {
          await tx.notification.create({
            data: {
              organizationId,
              recipientUserId: other.userId,
              title: `New message from ${message.sender.firstName}`,
              message: message.content || 'Sent an attachment',
              actionUrl: `/app/messages/${conversationId}`,
            },
          });
        }
      }

      return message;
    });
  }

  /**
   * Edit user's own message.
   */
  async editMessage(
    organizationId: string,
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const message = await tx.message.findUnique({
        where: { id: messageId },
        include: { conversation: true },
      });

      if (!message || message.conversation.organizationId !== organizationId) {
        throw new NotFoundException('Message not found');
      }

      if (message.senderUserId !== userId) {
        throw new ForbiddenException('You can only edit your own messages');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Cannot edit a deleted message');
      }

      return tx.message.update({
        where: { id: messageId },
        data: {
          content: dto.content.trim(),
          editedAt: new Date(),
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } },
          attachments: true,
        },
      });
    });
  }

  /**
   * Delete user's own message (soft delete).
   */
  async deleteMessage(
    organizationId: string,
    userId: string,
    messageId: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const message = await tx.message.findUnique({
        where: { id: messageId },
        include: { conversation: true },
      });

      if (!message || message.conversation.organizationId !== organizationId) {
        throw new NotFoundException('Message not found');
      }

      if (message.senderUserId !== userId) {
        throw new ForbiddenException('You can only delete your own messages');
      }

      await tx.message.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          status: MessageStatus.DELETED,
          content: 'This message was deleted',
        },
      });

      return { success: true };
    });
  }

  /**
   * Search for members/staff to start a conversation with.
   */
  async searchUsersToChat(organizationId: string, currentUserId: string, query: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const q = (query || '').trim();
      const where: any = {
        organizationId,
        userId: { not: currentUserId },
        deletedAt: null,
        status: 'ACTIVE',
      };

      if (q) {
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { memberNumber: { contains: q, mode: 'insensitive' } },
        ];
      }

      const members = await tx.memberProfile.findMany({
        where,
        take: 20,
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          memberNumber: true,
          photoUrl: true,
          user: {
            select: {
              email: true,
              staffMemberships: {
                where: { organizationId, isActive: true },
                include: { role: { select: { name: true, code: true } } },
                take: 1,
              },
            },
          },
        },
      });

      return members.map((m) => ({
        userId: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        memberNumber: m.memberNumber,
        photoUrl: m.photoUrl,
        email: m.user.email,
        staffRole: m.user.staffMemberships[0]?.role?.name || null,
      }));
    });
  }
}
