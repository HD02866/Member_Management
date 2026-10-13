import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class AssignSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  saasPlanId: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  durationMonths?: number;
}

export class UpdateSubscriptionStatusDto {
  @IsEnum(SubscriptionStatus)
  @IsNotEmpty()
  status: SubscriptionStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
