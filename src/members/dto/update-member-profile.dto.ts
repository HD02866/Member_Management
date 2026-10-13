import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  IsObject,
  IsDateString,
} from 'class-validator';

export class UpdateMemberProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  photoUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  nationalIdNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsObject()
  @IsOptional()
  customFieldsData?: Record<string, any>;
}
