import { IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  mission?: any;

  @IsOptional()
  vision?: any;

  @IsOptional()
  history?: any;

  @IsOptional()
  values?: any;

  @IsOptional()
  brandingConfig?: any;

  @IsOptional()
  socialLinks?: any;
}
