import { IsNotEmpty, IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';

export const ALLOWED_STAFF_ROLES = ['OWNER', 'ADMIN', 'FINANCE_OFFICER', 'VERIFIER'] as const;
export type StaffRoleCode = (typeof ALLOWED_STAFF_ROLES)[number];

export class AssignStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'User identifier (email, phone, or ID) is required' })
  identifier: string;

  @IsString()
  @IsIn(ALLOWED_STAFF_ROLES, {
    message: 'Role must be one of: OWNER, ADMIN, FINANCE_OFFICER, VERIFIER',
  })
  roleCode: StaffRoleCode;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_STAFF_ROLES, {
    message: 'Role must be one of: OWNER, ADMIN, FINANCE_OFFICER, VERIFIER',
  })
  roleCode?: StaffRoleCode;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
