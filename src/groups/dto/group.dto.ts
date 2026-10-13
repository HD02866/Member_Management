import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { GroupType, GroupMemberRole } from '@prisma/client';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  membersCanPost?: boolean;

  @IsOptional()
  @IsBoolean()
  membersCanInvite?: boolean;

  @IsOptional()
  @IsArray()
  initialMemberUserIds?: string[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  membersCanPost?: boolean;

  @IsOptional()
  @IsBoolean()
  membersCanInvite?: boolean;
}

export class AddGroupMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsEnum(GroupMemberRole)
  role?: GroupMemberRole;
}

export class SendGroupMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsArray()
  attachments?: {
    url: string;
    mimeType: string;
    sizeBytes: number;
    filename: string;
  }[];
}

export class EditGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
