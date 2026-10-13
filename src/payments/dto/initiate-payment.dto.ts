import { IsNotEmpty, IsUUID, IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { PaymentType } from '@prisma/client';

export class InitiatePaymentDto {
  @IsUUID('4', { message: 'Must provide a valid UUID membership ID' })
  @IsNotEmpty({ message: 'Membership ID is required' })
  membershipId: string;

  @IsUUID('4', { message: 'Must provide a valid UUID payment method ID' })
  @IsOptional()
  paymentMethodId?: string;

  @IsEnum(PaymentType, { message: 'Invalid payment type' })
  @IsOptional()
  paymentType?: PaymentType = PaymentType.MEMBERSHIP_DUES;

  @IsString()
  @IsOptional()
  @MaxLength(128, { message: 'Idempotency key cannot exceed 128 characters' })
  idempotencyKey?: string;
}
