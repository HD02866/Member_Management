import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UseInterceptors,
  UploadedFile as NestUploadedFile,
  Body,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TenantContext } from '../common/types/tenant-context.type';
import { UploadPurpose } from '@prisma/client';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    @Inject(UploadsService)
    private readonly uploadsService: UploadsService,
  ) {}

  @Post()
  @UseGuards(TenantGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
    @NestUploadedFile() file: any,
    @Body('purpose') purpose?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided in request body');
    }

    const uploadPurpose = purpose && Object.values(UploadPurpose).includes(purpose as UploadPurpose)
      ? (purpose as UploadPurpose)
      : UploadPurpose.GENERAL;

    return this.uploadsService.handleFileUpload(
      tenant.organizationId,
      user.id,
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      uploadPurpose,
    );
  }

  @Public()
  @Get(':filename')
  async getFile(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @CurrentTenant() tenant: TenantContext | undefined,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const fileInfo = await this.uploadsService.getAuthorizedFile(
      tenant?.organizationId,
      user?.id,
      filename,
    );

    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.originalName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(fileInfo.filePath);
  }
}
