import { SetMetadata } from '@nestjs/common';
import { PermissionAliases } from '../types/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: string[]) => {
  // Normalize aliases to canonical permission codes
  const normalized = permissions.map((p) => PermissionAliases[p] || p);
  return SetMetadata(PERMISSIONS_KEY, normalized);
};
