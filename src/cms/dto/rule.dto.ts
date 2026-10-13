import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateRuleDto {
  @IsNotEmpty()
  title: any;

  @IsOptional()
  contentMarkdown?: any;

  @IsString()
  @IsOptional()
  pdfAttachmentUrl?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRuleDto {
  @IsOptional()
  title?: any;

  @IsOptional()
  contentMarkdown?: any;

  @IsString()
  @IsOptional()
  pdfAttachmentUrl?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
