import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
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
import { sanitizeContentValue } from './utils/sanitize-content.util';

@Injectable()
export class CmsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // 1. ORGANIZATION PROFILE
  // ==========================================

  async getProfile(organizationId: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const profile = await tx.organizationProfile.findUnique({
        where: { organizationId },
      });
      return profile || {};
    });
  }

  async updateProfile(
    organizationId: string,
    dto: UpdateProfileDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.organizationProfile.findUnique({
        where: { organizationId },
      });

      const profile = await tx.organizationProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          mission: cleanDto.mission !== undefined ? cleanDto.mission : undefined,
          vision: cleanDto.vision !== undefined ? cleanDto.vision : undefined,
          history: cleanDto.history !== undefined ? cleanDto.history : undefined,
          values: cleanDto.values !== undefined ? cleanDto.values : undefined,
          brandingConfig:
            cleanDto.brandingConfig !== undefined ? cleanDto.brandingConfig : undefined,
          socialLinks: cleanDto.socialLinks !== undefined ? cleanDto.socialLinks : undefined,
        },
        update: {
          ...(cleanDto.mission !== undefined ? { mission: cleanDto.mission } : {}),
          ...(cleanDto.vision !== undefined ? { vision: cleanDto.vision } : {}),
          ...(cleanDto.history !== undefined ? { history: cleanDto.history } : {}),
          ...(cleanDto.values !== undefined ? { values: cleanDto.values } : {}),
          ...(cleanDto.brandingConfig !== undefined
            ? { brandingConfig: cleanDto.brandingConfig }
            : {}),
          ...(cleanDto.socialLinks !== undefined ? { socialLinks: cleanDto.socialLinks } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'CMS_PROFILE_UPDATED',
        entityType: 'OrganizationProfile',
        entityId: profile.id,
        beforeDiff: existing ? { ...existing } : undefined,
        afterDiff: { ...profile },
        ipAddress,
        userAgent,
      });

      return profile;
    });
  }

  // ==========================================
  // 2. LEADERSHIP POSITIONS & LEADERS
  // ==========================================

  async getLeadership(organizationId: string, includeInactive: boolean = false) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const positions = await tx.leadershipPosition.findMany({
        where: { organizationId },
        orderBy: { displayOrder: 'asc' },
        include: {
          leaders: {
            where: {
              organizationId,
              deletedAt: null,
              ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return positions;
    });
  }

  async createPosition(
    organizationId: string,
    dto: CreatePositionDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const position = await tx.leadershipPosition.create({
        data: {
          organizationId,
          code: cleanDto.code.trim().toLowerCase(),
          title: cleanDto.title,
          displayOrder: cleanDto.displayOrder ?? 0,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'LEADERSHIP_POSITION_CREATED',
        entityType: 'LeadershipPosition',
        entityId: position.id,
        afterDiff: position,
        ipAddress,
        userAgent,
      });

      return position;
    });
  }

  async updatePosition(
    organizationId: string,
    positionId: string,
    dto: UpdatePositionDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.leadershipPosition.findFirst({
        where: { id: positionId, organizationId },
      });
      if (!existing) {
        throw new NotFoundException(`Leadership position ${positionId} not found`);
      }

      const updated = await tx.leadershipPosition.update({
        where: { id: positionId },
        data: {
          ...(cleanDto.title !== undefined ? { title: cleanDto.title } : {}),
          ...(cleanDto.code !== undefined ? { code: cleanDto.code.trim().toLowerCase() } : {}),
          ...(cleanDto.displayOrder !== undefined ? { displayOrder: cleanDto.displayOrder } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'LEADERSHIP_POSITION_UPDATED',
        entityType: 'LeadershipPosition',
        entityId: updated.id,
        beforeDiff: existing,
        afterDiff: updated,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async deletePosition(
    organizationId: string,
    positionId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.leadershipPosition.findFirst({
        where: { id: positionId, organizationId },
      });
      if (!existing) {
        throw new NotFoundException(`Leadership position ${positionId} not found`);
      }

      await tx.leadershipPosition.delete({
        where: { id: positionId },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'LEADERSHIP_POSITION_DELETED',
        entityType: 'LeadershipPosition',
        entityId: positionId,
        beforeDiff: existing,
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Position deleted successfully' };
    });
  }

  async createLeader(
    organizationId: string,
    dto: CreateLeaderDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const position = await tx.leadershipPosition.findFirst({
        where: { id: cleanDto.positionId, organizationId },
      });
      if (!position) {
        throw new BadRequestException(`Position ${cleanDto.positionId} does not exist in this tenant`);
      }

      const leader = await tx.leader.create({
        data: {
          organizationId,
          positionId: cleanDto.positionId,
          name: cleanDto.name.trim(),
          photoUrl: cleanDto.photoUrl,
          bio: cleanDto.bio,
          email: cleanDto.email?.toLowerCase().trim(),
          phone: cleanDto.phone?.trim(),
          displayOrder: cleanDto.displayOrder ?? 0,
          isActive: cleanDto.isActive ?? true,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'LEADER_CREATED',
        entityType: 'Leader',
        entityId: leader.id,
        afterDiff: leader,
        ipAddress,
        userAgent,
      });

      return leader;
    });
  }

  async updateLeader(
    organizationId: string,
    leaderId: string,
    dto: UpdateLeaderDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.leader.findFirst({
        where: { id: leaderId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Leader ${leaderId} not found`);
      }

      const updated = await tx.leader.update({
        where: { id: leaderId },
        data: {
          ...(cleanDto.name !== undefined ? { name: cleanDto.name.trim() } : {}),
          ...(cleanDto.positionId !== undefined ? { positionId: cleanDto.positionId } : {}),
          ...(cleanDto.photoUrl !== undefined ? { photoUrl: cleanDto.photoUrl } : {}),
          ...(cleanDto.bio !== undefined ? { bio: cleanDto.bio } : {}),
          ...(cleanDto.email !== undefined ? { email: cleanDto.email?.toLowerCase().trim() } : {}),
          ...(cleanDto.phone !== undefined ? { phone: cleanDto.phone?.trim() } : {}),
          ...(cleanDto.displayOrder !== undefined ? { displayOrder: cleanDto.displayOrder } : {}),
          ...(cleanDto.isActive !== undefined ? { isActive: cleanDto.isActive } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'LEADER_UPDATED',
        entityType: 'Leader',
        entityId: updated.id,
        beforeDiff: existing,
        afterDiff: updated,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async deleteLeader(
    organizationId: string,
    leaderId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.leader.findFirst({
        where: { id: leaderId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Leader ${leaderId} not found`);
      }

      await tx.leader.update({
        where: { id: leaderId },
        data: { deletedAt: new Date(), isActive: false },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'LEADER_DELETED',
        entityType: 'Leader',
        entityId: leaderId,
        beforeDiff: existing,
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Leader deleted successfully' };
    });
  }

  // ==========================================
  // 3. PROGRAMS
  // ==========================================

  async getPrograms(organizationId: string, includeDrafts: boolean = false) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.program.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(includeDrafts ? {} : { status: ContentStatus.PUBLISHED }),
        },
        orderBy: { startDate: 'desc' },
      });
    });
  }

  async createProgram(
    organizationId: string,
    dto: CreateProgramDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const program = await tx.program.create({
        data: {
          organizationId,
          title: cleanDto.title,
          description: cleanDto.description,
          category: cleanDto.category?.trim(),
          coverImageUrl: cleanDto.coverImageUrl,
          status: cleanDto.status ?? ContentStatus.DRAFT,
          startDate: cleanDto.startDate ? new Date(cleanDto.startDate) : undefined,
          endDate: cleanDto.endDate ? new Date(cleanDto.endDate) : undefined,
          isMembersOnly: cleanDto.isMembersOnly ?? false,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'PROGRAM_CREATED',
        entityType: 'Program',
        entityId: program.id,
        afterDiff: program,
        ipAddress,
        userAgent,
      });

      return program;
    });
  }

  async updateProgram(
    organizationId: string,
    programId: string,
    dto: UpdateProgramDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.program.findFirst({
        where: { id: programId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Program ${programId} not found`);
      }

      const updated = await tx.program.update({
        where: { id: programId },
        data: {
          ...(cleanDto.title !== undefined ? { title: cleanDto.title } : {}),
          ...(cleanDto.description !== undefined ? { description: cleanDto.description } : {}),
          ...(cleanDto.category !== undefined ? { category: cleanDto.category?.trim() } : {}),
          ...(cleanDto.coverImageUrl !== undefined ? { coverImageUrl: cleanDto.coverImageUrl } : {}),
          ...(cleanDto.status !== undefined ? { status: cleanDto.status } : {}),
          ...(cleanDto.startDate !== undefined
            ? { startDate: cleanDto.startDate ? new Date(cleanDto.startDate) : null }
            : {}),
          ...(cleanDto.endDate !== undefined
            ? { endDate: cleanDto.endDate ? new Date(cleanDto.endDate) : null }
            : {}),
          ...(cleanDto.isMembersOnly !== undefined ? { isMembersOnly: cleanDto.isMembersOnly } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'PROGRAM_UPDATED',
        entityType: 'Program',
        entityId: updated.id,
        beforeDiff: existing,
        afterDiff: updated,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async setProgramStatus(
    organizationId: string,
    programId: string,
    status: ContentStatus,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.program.findFirst({
        where: { id: programId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Program ${programId} not found`);
      }

      const updated = await tx.program.update({
        where: { id: programId },
        data: { status },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: status === ContentStatus.PUBLISHED ? 'PROGRAM_PUBLISHED' : 'PROGRAM_ARCHIVED',
        entityType: 'Program',
        entityId: programId,
        beforeDiff: { status: existing.status },
        afterDiff: { status },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async deleteProgram(
    organizationId: string,
    programId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.program.findFirst({
        where: { id: programId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Program ${programId} not found`);
      }

      await tx.program.update({
        where: { id: programId },
        data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'PROGRAM_DELETED',
        entityType: 'Program',
        entityId: programId,
        beforeDiff: existing,
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Program deleted successfully' };
    });
  }

  // ==========================================
  // 4. BENEFITS
  // ==========================================

  async getBenefits(organizationId: string, includeInactive: boolean = false) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.benefit.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: { displayOrder: 'asc' },
      });
    });
  }

  async createBenefit(
    organizationId: string,
    dto: CreateBenefitDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const benefit = await tx.benefit.create({
        data: {
          organizationId,
          title: cleanDto.title,
          description: cleanDto.description,
          icon: cleanDto.icon,
          displayOrder: cleanDto.displayOrder ?? 0,
          isActive: cleanDto.isActive ?? true,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'BENEFIT_CREATED',
        entityType: 'Benefit',
        entityId: benefit.id,
        afterDiff: benefit,
        ipAddress,
        userAgent,
      });

      return benefit;
    });
  }

  async updateBenefit(
    organizationId: string,
    benefitId: string,
    dto: UpdateBenefitDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.benefit.findFirst({
        where: { id: benefitId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Benefit ${benefitId} not found`);
      }

      const updated = await tx.benefit.update({
        where: { id: benefitId },
        data: {
          ...(cleanDto.title !== undefined ? { title: cleanDto.title } : {}),
          ...(cleanDto.description !== undefined ? { description: cleanDto.description } : {}),
          ...(cleanDto.icon !== undefined ? { icon: cleanDto.icon } : {}),
          ...(cleanDto.displayOrder !== undefined ? { displayOrder: cleanDto.displayOrder } : {}),
          ...(cleanDto.isActive !== undefined ? { isActive: cleanDto.isActive } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'BENEFIT_UPDATED',
        entityType: 'Benefit',
        entityId: updated.id,
        beforeDiff: existing,
        afterDiff: updated,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async deleteBenefit(
    organizationId: string,
    benefitId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.benefit.findFirst({
        where: { id: benefitId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Benefit ${benefitId} not found`);
      }

      await tx.benefit.update({
        where: { id: benefitId },
        data: { deletedAt: new Date(), isActive: false },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'BENEFIT_DELETED',
        entityType: 'Benefit',
        entityId: benefitId,
        beforeDiff: existing,
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Benefit deleted successfully' };
    });
  }

  // ==========================================
  // 5. RULES & POLICIES
  // ==========================================

  async getRules(organizationId: string, includeInactive: boolean = false) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.rule.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: { displayOrder: 'asc' },
      });
    });
  }

  async createRule(
    organizationId: string,
    dto: CreateRuleDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const rule = await tx.rule.create({
        data: {
          organizationId,
          title: cleanDto.title,
          contentMarkdown: cleanDto.contentMarkdown,
          pdfAttachmentUrl: cleanDto.pdfAttachmentUrl,
          displayOrder: cleanDto.displayOrder ?? 0,
          isActive: cleanDto.isActive ?? true,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'RULE_CREATED',
        entityType: 'Rule',
        entityId: rule.id,
        afterDiff: rule,
        ipAddress,
        userAgent,
      });

      return rule;
    });
  }

  async updateRule(
    organizationId: string,
    ruleId: string,
    dto: UpdateRuleDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.rule.findFirst({
        where: { id: ruleId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Rule ${ruleId} not found`);
      }

      const updated = await tx.rule.update({
        where: { id: ruleId },
        data: {
          ...(cleanDto.title !== undefined ? { title: cleanDto.title } : {}),
          ...(cleanDto.contentMarkdown !== undefined
            ? { contentMarkdown: cleanDto.contentMarkdown }
            : {}),
          ...(cleanDto.pdfAttachmentUrl !== undefined
            ? { pdfAttachmentUrl: cleanDto.pdfAttachmentUrl }
            : {}),
          ...(cleanDto.displayOrder !== undefined ? { displayOrder: cleanDto.displayOrder } : {}),
          ...(cleanDto.isActive !== undefined ? { isActive: cleanDto.isActive } : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'RULE_UPDATED',
        entityType: 'Rule',
        entityId: updated.id,
        beforeDiff: existing,
        afterDiff: updated,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async deleteRule(
    organizationId: string,
    ruleId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.rule.findFirst({
        where: { id: ruleId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Rule ${ruleId} not found`);
      }

      await tx.rule.update({
        where: { id: ruleId },
        data: { deletedAt: new Date(), isActive: false },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'RULE_DELETED',
        entityType: 'Rule',
        entityId: ruleId,
        beforeDiff: existing,
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Rule deleted successfully' };
    });
  }

  // ==========================================
  // 6. ANNOUNCEMENTS
  // ==========================================

  async getAnnouncements(organizationId: string, includeDrafts: boolean = false, audience?: string) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: any = {
        organizationId,
        deletedAt: null,
      };

      const now = new Date();

      if (!includeDrafts) {
        where.status = ContentStatus.PUBLISHED;
        // Do not leak announcements scheduled for the future
        where.OR = [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ];
        // Do not return expired announcements
        where.AND = [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ];
      }

      if (audience) {
        if (audience === 'PUBLIC') {
          where.audience = 'PUBLIC';
        } else if (audience === 'MEMBERS') {
          where.audience = { in: ['PUBLIC', 'MEMBERS'] };
        } else if (audience === 'STAFF') {
          where.audience = { in: ['PUBLIC', 'MEMBERS', 'STAFF'] };
        }
      }

      return tx.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      });
    });
  }

  async createAnnouncement(
    organizationId: string,
    dto: CreateAnnouncementDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const isPublished = cleanDto.status === ContentStatus.PUBLISHED;
      const scheduledDate = cleanDto.scheduledAt ? new Date(cleanDto.scheduledAt) : undefined;
      const expiresDate = cleanDto.expiresAt ? new Date(cleanDto.expiresAt) : undefined;
      const pubDate = isPublished
        ? (scheduledDate && scheduledDate > new Date() ? scheduledDate : new Date())
        : (scheduledDate || new Date());

      const announcement = await tx.announcement.create({
        data: {
          organizationId,
          authorUserId: actorUserId,
          title: cleanDto.title,
          content: cleanDto.content,
          summary: cleanDto.summary?.trim(),
          coverImageUrl: cleanDto.coverImageUrl,
          imageAttachments: cleanDto.imageAttachments || undefined,
          ctaLabel: cleanDto.ctaLabel?.trim(),
          ctaUrl: cleanDto.ctaUrl?.trim(),
          audience: cleanDto.audience || 'MEMBERS',
          isPinned: cleanDto.isPinned ?? false,
          status: cleanDto.status ?? ContentStatus.DRAFT,
          publishedAt: pubDate,
          scheduledAt: scheduledDate,
          expiresAt: expiresDate,
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'ANNOUNCEMENT_CREATED',
        entityType: 'Announcement',
        entityId: announcement.id,
        afterDiff: announcement,
        ipAddress,
        userAgent,
      });

      return announcement;
    });
  }

  async updateAnnouncement(
    organizationId: string,
    announcementId: string,
    dto: UpdateAnnouncementDto,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const cleanDto = sanitizeContentValue(dto);

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.announcement.findFirst({
        where: { id: announcementId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Announcement ${announcementId} not found`);
      }

      const willBePublished = cleanDto.status === ContentStatus.PUBLISHED;
      let newPublishedAt = existing.publishedAt;
      if (willBePublished && existing.status !== ContentStatus.PUBLISHED) {
        newPublishedAt = new Date();
      }

      const updated = await tx.announcement.update({
        where: { id: announcementId },
        data: {
          ...(cleanDto.title !== undefined ? { title: cleanDto.title } : {}),
          ...(cleanDto.content !== undefined ? { content: cleanDto.content } : {}),
          ...(cleanDto.summary !== undefined ? { summary: cleanDto.summary?.trim() } : {}),
          ...(cleanDto.coverImageUrl !== undefined ? { coverImageUrl: cleanDto.coverImageUrl } : {}),
          ...(cleanDto.imageAttachments !== undefined ? { imageAttachments: cleanDto.imageAttachments } : {}),
          ...(cleanDto.ctaLabel !== undefined ? { ctaLabel: cleanDto.ctaLabel?.trim() } : {}),
          ...(cleanDto.ctaUrl !== undefined ? { ctaUrl: cleanDto.ctaUrl?.trim() } : {}),
          ...(cleanDto.audience !== undefined ? { audience: cleanDto.audience } : {}),
          ...(cleanDto.isPinned !== undefined ? { isPinned: cleanDto.isPinned } : {}),
          ...(cleanDto.status !== undefined ? { status: cleanDto.status, publishedAt: newPublishedAt } : {}),
          ...(cleanDto.scheduledAt !== undefined
            ? { scheduledAt: cleanDto.scheduledAt ? new Date(cleanDto.scheduledAt) : null }
            : {}),
          ...(cleanDto.expiresAt !== undefined
            ? { expiresAt: cleanDto.expiresAt ? new Date(cleanDto.expiresAt) : null }
            : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'ANNOUNCEMENT_UPDATED',
        entityType: 'Announcement',
        entityId: updated.id,
        beforeDiff: existing,
        afterDiff: updated,
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async setAnnouncementStatus(
    organizationId: string,
    announcementId: string,
    status: ContentStatus,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.announcement.findFirst({
        where: { id: announcementId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Announcement ${announcementId} not found`);
      }

      const updated = await tx.announcement.update({
        where: { id: announcementId },
        data: {
          status,
          ...(status === ContentStatus.PUBLISHED && existing.status !== ContentStatus.PUBLISHED
            ? { publishedAt: new Date() }
            : {}),
        },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: status === ContentStatus.PUBLISHED ? 'ANNOUNCEMENT_PUBLISHED' : 'ANNOUNCEMENT_ARCHIVED',
        entityType: 'Announcement',
        entityId: announcementId,
        beforeDiff: { status: existing.status },
        afterDiff: { status },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  async deleteAnnouncement(
    organizationId: string,
    announcementId: string,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.announcement.findFirst({
        where: { id: announcementId, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Announcement ${announcementId} not found`);
      }

      await tx.announcement.update({
        where: { id: announcementId },
        data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
      });

      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'ANNOUNCEMENT_DELETED',
        entityType: 'Announcement',
        entityId: announcementId,
        beforeDiff: existing,
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Announcement deleted successfully' };
    });
  }
}
