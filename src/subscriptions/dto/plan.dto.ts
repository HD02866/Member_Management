import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateSaasPlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNotEmpty()
  price: string | number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @IsOptional()
  maxMembers?: number;

  @IsInt()
  @IsOptional()
  maxStaff?: number;

  @IsInt()
  @IsOptional()
  storageLimitMb?: number;

  @IsOptional()
  features?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSaasPlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  price?: string | number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @IsOptional()
  maxMembers?: number;

  @IsInt()
  @IsOptional()
  maxStaff?: number;

  @IsInt()
  @IsOptional()
  storageLimitMb?: number;

  @IsOptional()
  features?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
