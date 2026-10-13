export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  userRole?: string;
  permissions?: string[];
  isPlatformAdmin?: boolean;
}
