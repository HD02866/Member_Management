import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { OrganizationStatus } from '@prisma/client';

export class CreatePlatformUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

export class UpdateOrganizationConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;
}

export class UpdateOrganizationBrandingDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  navbarBrandingMode?: 'ORGANIZATION_ONLY' | 'CO_BRANDED' | 'WAANOFII_ONLY';

  @IsOptional()
  @IsObject()
  cardTemplate?: {
    layout?: 'STANDARD' | 'COMPACT' | 'MODERN';
    showPhone?: boolean;
    showPhoto?: boolean;
    showIssueDate?: boolean;
    accentColor?: string;
    customTitle?: string;
  };
}

export class UpdateOrganizationFeaturesDto {
  @IsObject()
  featureOverrides: Record<string, boolean>;
}

export class AssignPlatformStaffDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // Email, phone, or User ID

  @IsString()
  @IsNotEmpty()
  roleCode: string; // OWNER, ADMIN, FINANCE_OFFICER, VERIFIER
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  sessionTimeoutMinutes?: string;
}
