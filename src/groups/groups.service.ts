import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddGroupMemberDto,
  SendGroupMessageDto,
  EditGroupMessageDto,
} from './dto/group.dto';
import { GroupMemberRole, GroupType } from '@prisma/client';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List groups the user belongs to, plus public groups in the organization.
   */
  async getMyGroups(organizationId: string, userId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const groups = await tx.group.findMany({
        where: {
          organizationId,
          isArchived: false,
          OR: [
            { members: { some: { userId } } },
            { isPublic: true },
          ],
        },
        include: {
          members: {
            where: { userId },
            select: { role: true, lastReadAt: true, isMuted: true },
          },
          _count: {
            select: { members: true, messages: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const mapped = await Promise.all(
        groups.map(async (g) => {
          const myMembership = g.members[0];
          let unreadCount = 0;
          if (myMembership) {
            unreadCount = await tx.groupMessage.count({
              where: {
                groupId: g.id,
                senderUserId: { not: userId },
                deletedAt: null,
                ...(myMembership.lastReadAt ? { createdAt: { gt: myMembership.lastReadAt } } : {}),
              },
            });
          }

          return {
            id: g.id,
            name: g.name,
            description: g.description,
            avatarUrl: g.avatarUrl,
            type: g.type,
            isPublic: g.isPublic,
            membersCanPost: g.membersCanPost,
            memberCount: g._count.members,
            isMember: g.members.length > 0,
            myRole: myMembership?.role || null,
            isMuted: myMembership?.isMuted || false,
            unreadCount,
            lastMessage: g.messages[0]
              ? {
                  id: g.messages[0].id,
                  content: g.messages[0].content,
                  createdAt: g.messages[0].createdAt,
                  senderName: `${g.messages[0].sender.firstName} ${g.messages[0].sender.lastName}`,
                }
              : null,
          };
        }),
      );

      return mapped;
    });
  }

  /**
   * Create a new group.
   */
  async createGroup(organizationId: string, userId: string, dto: CreateGroupDto) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Check user account status
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (user?.status === 'SUSPENDED' || user?.status === 'DEACTIVATED') {
        throw new ForbiddenException('Suspended accounts cannot create groups');
      }

      // If creating an OFFICIAL or ANNOUNCEMENT_ONLY group, verify staff privileges
      if (dto.type === GroupType.OFFICIAL || dto.type === GroupType.ANNOUNCEMENT_ONLY) {
        const staff = await tx.staffMembership.findFirst({
          where: { organizationId, userId, isActive: true },
        });
        if (!staff) {
          throw new ForbiddenException('Only staff/administrators can create official or announcement groups');
        }
      }

      const initialMemberIds = Array.from(
        new Set([userId, ...(dto.initialMemberUserIds || [])]),
      );

      const group = await tx.group.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          avatarUrl: dto.avatarUrl,
          type: dto.type || GroupType.COMMUNITY,
          isPublic: dto.isPublic || false,
          membersCanPost: dto.membersCanPost !== undefined ? dto.membersCanPost : true,
          membersCanInvite: dto.membersCanInvite !== undefined ? dto.membersCanInvite : false,
          createdByUserId: userId,
          members: {
            create: initialMemberIds.map((mId) => ({
              userId: mId,
              role: mId === userId ? GroupMemberRole.OWNER : GroupMemberRole.MEMBER,
            })),
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      return group;
    });
  }

  /**
   * Get single group details including roster.
   */
  async getGroupDetails(organizationId: string, userId: string, groupId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: groupId, organizationId, isArchived: false },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  memberProfiles: {
                    where: { organizationId, deletedAt: null },
                    select: { memberNumber: true, photoUrl: true },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { role: 'asc' },
          },
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      const isMember = group.members.some((m) => m.userId === userId);
      if (!isMember && !group.isPublic) {
        throw new ForbiddenException('You must be a member of this private group to view details');
      }

      const myMembership = group.members.find((m) => m.userId === userId);

      return {
        ...group,
        isMember,
        myRole: myMembership?.role || null,
      };
    });
  }

  /**
   * Join a public group.
   */
  async joinGroup(organizationId: string, userId: string, groupId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: groupId, organizationId, isArchived: false },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      if (!group.isPublic) {
        throw new ForbiddenException('Cannot join a private group without an invitation');
      }

      const existing = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });

      if (existing) {
        return existing;
      }

      return tx.groupMember.create({
        data: {
          groupId,
          userId,
          role: GroupMemberRole.MEMBER,
        },
      });
    });
  }

  /**
   * Leave a group.
   */
  async leaveGroup(organizationId: string, userId: string, groupId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });

      if (!member) {
        throw new BadRequestException('You are not a member of this group');
      }

      if (member.role === GroupMemberRole.OWNER) {
        // Check if there is another member to transfer ownership to
        const nextAdmin = await tx.groupMember.findFirst({
          where: { groupId, userId: { not: userId } },
          orderBy: { role: 'asc' }, // ADMIN first, then MEMBER
        });

        if (nextAdmin) {
          await tx.groupMember.update({
            where: { id: nextAdmin.id },
            data: { role: GroupMemberRole.OWNER },
          });
        }
      }

      await tx.groupMember.delete({
        where: { id: member.id },
      });

      return { success: true };
    });
  }

  /**
   * Add a member to a group (owner/admin only or membersCanInvite).
   */
  async addMember(
    organizationId: string,
    currentUserId: string,
    groupId: string,
    dto: AddGroupMemberDto,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: groupId, organizationId, isArchived: false },
        include: { members: true },
      });

      if (!group) throw new NotFoundException('Group not found');

      const currentMembership = group.members.find((m) => m.userId === currentUserId);
      const isAuthorized =
        currentMembership &&
        (currentMembership.role === GroupMemberRole.OWNER ||
          currentMembership.role === GroupMemberRole.ADMIN ||
          group.membersCanInvite);

      if (!isAuthorized) {
        throw new ForbiddenException('Not authorized to add members to this group');
      }

      const existing = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: dto.userId } },
      });
      if (existing) {
        throw new BadRequestException('User is already a member of this group');
      }

      return tx.groupMember.create({
        data: {
          groupId,
          userId: dto.userId,
          role: dto.role || GroupMemberRole.MEMBER,
        },
      });
    });
  }

  /**
   * Remove a member or leave.
   */
  async removeMember(
    organizationId: string,
    currentUserId: string,
    groupId: string,
    targetUserId: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const currentMembership = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: currentUserId } },
      });

      if (
        !currentMembership ||
        (currentMembership.role !== GroupMemberRole.OWNER &&
          currentMembership.role !== GroupMemberRole.ADMIN)
      ) {
        throw new ForbiddenException('Only group owners and admins can remove members');
      }

      const targetMembership = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
      });

      if (!targetMembership) {
        throw new NotFoundException('Target user is not a member of this group');
      }

      if (targetMembership.role === GroupMemberRole.OWNER) {
        throw new BadRequestException('Cannot remove the group owner');
      }

      await tx.groupMember.delete({
        where: { id: targetMembership.id },
      });

      return { success: true };
    });
  }

  /**
   * Get messages in a group (paginated).
   */
  async getGroupMessages(
    organizationId: string,
    userId: string,
    groupId: string,
    query: { limit?: string; before?: string },
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: groupId, organizationId, isArchived: false },
      });
      if (!group) throw new NotFoundException('Group not found');

      const isMember = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });

      if (!isMember && !group.isPublic) {
        throw new ForbiddenException('You must be a member to read group messages');
      }

      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
      const where: any = { groupId, deletedAt: null };

      if (query.before) {
        where.createdAt = { lt: new Date(query.before) };
      }

      const messages = await tx.groupMessage.findMany({
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

      // Update last read if member
      const now = new Date();
      if (isMember) {
        await tx.groupMember.update({
          where: { id: isMember.id },
          data: { lastReadAt: now },
        });
      }

      // Fetch all group members with lastReadAt to accurately report which members have read each message
      const allMembers = await tx.groupMember.findMany({
        where: { groupId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      const mappedMessages = messages.reverse().map((msg) => {
        const readByMembers = allMembers
          .filter(
            (m) =>
              m.userId !== msg.senderUserId &&
              m.lastReadAt &&
              new Date(m.lastReadAt) >= new Date(msg.createdAt),
          )
          .map((m) => ({
            id: m.user.id,
            name: `${m.user.firstName} ${m.user.lastName}`,
            readAt: m.lastReadAt,
          }));

        return {
          ...msg,
          readBy: readByMembers,
          readCount: readByMembers.length,
        };
      });

      return mappedMessages;
    });
  }

  /**
   * Send a message to a group.
   */
  async sendGroupMessage(
    organizationId: string,
    userId: string,
    groupId: string,
    dto: SendGroupMessageDto,
  ) {
    if (!dto.content?.trim() && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException('Message must have content or attachment');
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: groupId, organizationId, isArchived: false },
      });
      if (!group) throw new NotFoundException('Group not found');

      const member = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });

      if (!member) {
        throw new ForbiddenException('You must be a member of this group to send messages');
      }

      // Check posting permission
      if (
        !group.membersCanPost &&
        member.role !== GroupMemberRole.OWNER &&
        member.role !== GroupMemberRole.ADMIN
      ) {
        throw new ForbiddenException('Only group administrators can post messages in this group');
      }

      // Check account status
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (user?.status === 'SUSPENDED' || user?.status === 'DEACTIVATED') {
        throw new ForbiddenException('Suspended accounts cannot post messages');
      }

      const message = await tx.groupMessage.create({
        data: {
          groupId,
          senderUserId: userId,
          content: dto.content?.trim() || null,
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
          sender: { select: { id: true, firstName: true, lastName: true } },
          attachments: true,
        },
      });

      await tx.group.update({
        where: { id: groupId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

  /**
   * Edit user's own group message.
   */
  async editGroupMessage(
    organizationId: string,
    userId: string,
    messageId: string,
    dto: EditGroupMessageDto,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const message = await tx.groupMessage.findUnique({
        where: { id: messageId },
        include: { group: true },
      });

      if (!message || message.group.organizationId !== organizationId) {
        throw new NotFoundException('Group message not found');
      }

      if (message.senderUserId !== userId) {
        throw new ForbiddenException('You can only edit your own messages');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Cannot edit a deleted message');
      }

      return tx.groupMessage.update({
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
   * Delete group message (sender or group owner/admin moderation).
   */
  async deleteGroupMessage(
    organizationId: string,
    userId: string,
    messageId: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const message = await tx.groupMessage.findUnique({
        where: { id: messageId },
        include: { group: true },
      });

      if (!message || message.group.organizationId !== organizationId) {
        throw new NotFoundException('Group message not found');
      }

      // Check if user is author OR group owner/admin
      const isAuthor = message.senderUserId === userId;
      let isModerator = false;
      if (!isAuthor) {
        const membership = await tx.groupMember.findUnique({
          where: { groupId_userId: { groupId: message.groupId, userId } },
        });
        if (
          membership &&
          (membership.role === GroupMemberRole.OWNER ||
            membership.role === GroupMemberRole.ADMIN)
        ) {
          isModerator = true;
        }
      }

      if (!isAuthor && !isModerator) {
        throw new ForbiddenException('You do not have permission to delete this message');
      }

      await tx.groupMessage.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          content: 'This message was deleted',
        },
      });

      return { success: true };
    });
  }
}
