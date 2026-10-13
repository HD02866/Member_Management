import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';

export const ALLOWED_PROOF_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export class SubmitPaymentProofDto {
  @IsString({ message: 'File URL must be a valid string' })
  @IsNotEmpty({ message: 'File URL is required' })
  @MaxLength(500, { message: 'File URL cannot exceed 500 characters' })
  fileUrl: string;

  @IsString({ message: 'File type must be a valid MIME type' })
  @IsNotEmpty({ message: 'File type is required' })
  @IsIn(ALLOWED_PROOF_MIME_TYPES, {
    message: 'File type must be one of: image/jpeg, image/png, image/webp, application/pdf',
  })
  fileType: string;

  @IsInt({ message: 'File size must be an integer (bytes)' })
  @Min(1024, { message: 'File size must be at least 1 KB' })
  @Max(5 * 1024 * 1024, { message: 'File size cannot exceed 5 MB' }) // 5MB max
  fileSize: number;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Original file name cannot exceed 255 characters' })
  originalFileName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Transaction reference cannot exceed 100 characters' })
  transactionReference?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}
