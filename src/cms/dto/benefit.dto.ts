import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateBenefitDto {
  @IsNotEmpty()
  title: any;

  @IsOptional()
  description?: any;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBenefitDto {
  @IsOptional()
  title?: any;

  @IsOptional()
  description?: any;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
