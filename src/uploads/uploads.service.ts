import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { UploadPurpose } from '@prisma/client';

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save uploaded buffer to disk and record in UploadedFile model.
   */
  async handleFileUpload(
    organizationId: string,
    userId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    purpose: UploadPurpose = UploadPurpose.GENERAL,
  ) {
    // 1. Validate file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size exceeds the 10MB limit');
    }

    // 2. Validate MIME types for images & documents
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Invalid file format: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF, PDF`,
      );
    }

    // 2b. Validate actual file content signatures (magic numbers)
    const buf = file.buffer;
    let isValidContent = false;
    if (buf.length >= 4) {
      // JPEG: FF D8 FF
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      // PNG: 89 50 4E 47
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      // GIF: 47 49 46 38
      const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
      // PDF: 25 50 44 46 (%PDF)
      const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
      // WebP: RIFF .... WEBP
      const isWebp =
        buf.length >= 12 &&
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;

      if (isJpeg || isPng || isGif || isPdf || isWebp) {
        isValidContent = true;
      }
    }

    if (!isValidContent) {
      throw new BadRequestException('File content validation failed. The file format does not match allowed types.');
    }

    // 3. Generate safe unique filename
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const randomHex = crypto.randomBytes(16).toString('hex');
    const safeFilename = `${Date.now()}-${randomHex}${ext}`;
    const filePath = path.join(this.uploadDir, safeFilename);

    // 4. Write to disk
    fs.writeFileSync(filePath, file.buffer);

    // 5. Store record in database
    const publicUrl = `/uploads/${safeFilename}`;

    const record = await this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.uploadedFile.create({
        data: {
          organizationId,
          uploadedByUserId: userId,
          purpose,
          filename: safeFilename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          url: publicUrl,
        },
      });
    });

    return {
      id: record.id,
      url: record.url,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  /**
   * Retrieves an uploaded file with strict tenant and conversation/group participant checks.
   */
  async getAuthorizedFile(
    organizationId: string | undefined,
    userId: string | undefined,
    filename: string,
  ) {
    const cleanFilename = path.basename(filename);
    const filePath = path.join(this.uploadDir, cleanFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Requested file not found');
    }

    // Lookup uploaded file record
    let fileRecord = await this.prisma.withPlatformAdminContext(async (tx) => {
      return tx.uploadedFile.findFirst({
        where: organizationId
          ? { filename: cleanFilename, organizationId }
          : { filename: cleanFilename },
      });
    });

    if (!fileRecord) {
      throw new NotFoundException('File record not found');
    }

    const orgId = fileRecord.organizationId;

    return this.prisma.withTenantContext(orgId, async (tx) => {

      // Check if file is associated with a published public announcement
      const isAnnouncementCover = await tx.announcement.findFirst({
        where: {
          organizationId: orgId,
          coverImageUrl: { contains: cleanFilename },
          deletedAt: null,
          status: 'PUBLISHED',
          audience: 'PUBLIC',
        },
      });
      if (isAnnouncementCover) {
        return {
          filePath,
          mimeType: fileRecord.mimeType,
          originalName: fileRecord.originalName,
        };
      }

      // If user is not authenticated and file is not a public announcement image, require authentication
      if (!userId) {
        throw new ForbiddenException('Authentication required to access this organization file');
      }

      // 1. Author or admin always has access
      if (fileRecord.uploadedByUserId === userId) {
        return {
          filePath,
          mimeType: fileRecord.mimeType,
          originalName: fileRecord.originalName,
        };
      }

      // Check if user is staff/admin
      const isStaff = await tx.staffMembership.findFirst({
        where: { organizationId: orgId, userId, isActive: true },
      });
      if (isStaff) {
        return {
          filePath,
          mimeType: fileRecord.mimeType,
          originalName: fileRecord.originalName,
        };
      }

      // 2. If it's a message attachment, verify user is a participant in the conversation
      const messageAttachment = await tx.messageAttachment.findFirst({
        where: {
          url: { contains: cleanFilename },
        },
        include: {
          message: {
            include: {
              conversation: {
                include: { participants: true },
              },
            },
          },
        },
      });

      if (messageAttachment) {
        const isParticipant = messageAttachment.message.conversation.participants.some(
          (p) => p.userId === userId,
        );
        if (!isParticipant) {
          throw new ForbiddenException('You are not authorized to access this private message attachment');
        }
        return {
          filePath,
          mimeType: fileRecord.mimeType,
          originalName: fileRecord.originalName,
        };
      }

      // 3. If it's a group message attachment, verify user is a member of the group
      const groupAttachment = await tx.groupMessageAttachment.findFirst({
        where: {
          url: { contains: cleanFilename },
        },
        include: {
          message: {
            include: {
              group: {
                include: { members: true },
              },
            },
          },
        },
      });

      if (groupAttachment) {
        const isGroupMember = groupAttachment.message.group.members.some(
          (m) => m.userId === userId,
        );
        if (!isGroupMember && !groupAttachment.message.group.isPublic) {
          throw new ForbiddenException('You are not authorized to access this group attachment');
        }
        return {
          filePath,
          mimeType: fileRecord.mimeType,
          originalName: fileRecord.originalName,
        };
      }

      // 4. If it's a MEMBER_PHOTO, only the member themselves or authorized staff can access
      if (fileRecord.purpose === UploadPurpose.MEMBER_PHOTO) {
        const profile = await tx.memberProfile.findFirst({
          where: {
            organizationId: orgId,
            photoUrl: { contains: cleanFilename },
            deletedAt: null,
          },
        });
        if (profile) {
          if (profile.userId !== userId) {
            throw new ForbiddenException('You are not authorized to view another member\'s private digital ID photo');
          }
          return {
            filePath,
            mimeType: fileRecord.mimeType,
            originalName: fileRecord.originalName,
          };
        }
      }

      // 5. Default: User belongs to the same tenant organization
      const isMember = await tx.memberProfile.findFirst({
        where: { organizationId: orgId, userId, deletedAt: null },
      });
      if (!isMember) {
        throw new ForbiddenException('Access denied to organization file');
      }


      return {
        filePath,
        mimeType: fileRecord.mimeType,
        originalName: fileRecord.originalName,
      };
    });
  }
}
