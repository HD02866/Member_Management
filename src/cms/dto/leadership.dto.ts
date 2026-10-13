import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  IsEmail,
} from 'class-validator';

export class CreatePositionDto {
  @IsNotEmpty()
  title: any;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class UpdatePositionDto {
  @IsOptional()
  title?: any;

  @IsString()
  @IsOptional()
  code?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class CreateLeaderDto {
  @IsString()
  @IsNotEmpty()
  positionId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsOptional()
  bio?: any;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateLeaderDto {
  @IsString()
  @IsOptional()
  positionId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsOptional()
  bio?: any;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
