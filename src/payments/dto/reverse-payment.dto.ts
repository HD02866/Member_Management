import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReversePaymentDto {
  @IsString({ message: 'Reversal reason must be a valid string' })
  @IsNotEmpty({ message: 'Reversal reason is mandatory' })
  @MaxLength(500, { message: 'Reversal reason cannot exceed 500 characters' })
  reason: string;
}
