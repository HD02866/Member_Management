import {
  IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsUrl, MaxLength, IsNotEmpty,
} from 'class-validator';

export enum MemberApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ApproveMemberDto {
  @IsEnum(MemberApprovalDecision)
  decision: MemberApprovalDecision;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class SuspendMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class UpdateAdminNotesDto {
  @IsString()
  @MaxLength(5000)
  adminNotes: string;
}

export class AdminUpdateMemberProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class ListMembersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string; // PENDING_APPROVAL, ACTIVE, SUSPENDED, ARCHIVED

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;
}

export class ResetMemberPasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  temporaryPassword?: string;
}

export class DeleteMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateDigitalIdPhotoDto {
  @IsString()
  @IsNotEmpty()
  photoUrl: string;
}

export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  memberNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  roleCode?: string; // MEMBER, ADMIN, etc.

  @IsOptional()
  @IsString()
  membershipPlanId?: string;

  @IsOptional()
  @IsString()
  initialStatus?: string; // ACTIVE, PENDING_APPROVAL

  @IsOptional()
  @IsString()
  initialPassword?: string;
}


