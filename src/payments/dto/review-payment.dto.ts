import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class ApprovePaymentDto {
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}

export class RejectPaymentDto {
  @IsString({ message: 'Rejection reason is required' })
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters long' })
  @MaxLength(500, { message: 'Rejection reason cannot exceed 500 characters' })
  rejectionReason: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}
