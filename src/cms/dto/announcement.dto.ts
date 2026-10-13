import {
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsString,
} from 'class-validator';
import { ContentStatus } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsNotEmpty()
  title: any;

  @IsNotEmpty()
  content: any;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsOptional()
  imageAttachments?: any;

  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @IsString()
  @IsOptional()
  ctaUrl?: string;

  @IsOptional()
  audience?: any;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  title?: any;

  @IsOptional()
  content?: any;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsOptional()
  imageAttachments?: any;

  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @IsString()
  @IsOptional()
  ctaUrl?: string;

  @IsOptional()
  audience?: any;
}
