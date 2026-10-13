import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrganizationStatus } from '@prisma/client';

export class UpdateOrganizationStatusDto {
  @IsEnum(OrganizationStatus, {
    message:
      'Status must be one of: ONBOARDING, PENDING_APPROVAL, ACTIVE, GRACE_PERIOD, SUSPENDED, DEACTIVATED',
  })
  @IsNotEmpty()
  status: OrganizationStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
