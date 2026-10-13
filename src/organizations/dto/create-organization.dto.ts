import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrganizationProfileDto {
  @IsString()
  @IsOptional()
  mission?: string;

  @IsString()
  @IsOptional()
  vision?: string;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsString()
  @IsOptional()
  history?: string;

  @IsString()
  @IsOptional()
  contactDetails?: string;
}

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Organization slug is required' })
  @MinLength(2, { message: 'Slug must be at least 2 characters long' })
  @MaxLength(50, { message: 'Slug cannot exceed 50 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric and may contain single hyphens (e.g., ethio-med)',
  })
  slug: string;

  @IsEmail({}, { message: 'Must provide a valid contact email' })
  @IsNotEmpty({ message: 'Contact email is required' })
  contactEmail: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  defaultLanguage?: string = 'en';

  @IsString()
  @IsOptional()
  timezone?: string = 'Africa/Addis_Ababa';

  @IsString()
  @IsOptional()
  currency?: string = 'ETB';

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationProfileDto)
  profile?: OrganizationProfileDto;
}
