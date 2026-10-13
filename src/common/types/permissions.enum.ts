export enum PermissionCode {
  // Members
  MEMBERS_READ = 'tenant:members:read',
  MEMBERS_APPROVE = 'tenant:members:approve',
  MEMBERS_SUSPEND = 'tenant:members:suspend',

  // Payments & Finance
  PAYMENTS_READ = 'tenant:payments:read',
  PAYMENTS_APPROVE = 'tenant:payments:approve',

  // Cards & Verification
  CARDS_ISSUE = 'tenant:cards:issue',
  CARDS_REVOKE = 'tenant:cards:revoke',
  CARDS_VERIFY = 'tenant:cards:verify',

  // Content & Governance
  CONTENT_MANAGE = 'tenant:content:manage',
  ORGANIZATION_READ = 'tenant:organization:read',
  ORGANIZATION_UPDATE = 'tenant:organization:update',
  CMS_READ = 'tenant:cms:read',
  CMS_MANAGE = 'tenant:cms:manage',
  LEADERSHIP_MANAGE = 'tenant:leadership:manage',
  PROGRAMS_MANAGE = 'tenant:programs:manage',
  BENEFITS_MANAGE = 'tenant:benefits:manage',
  RULES_MANAGE = 'tenant:rules:manage',
  ANNOUNCEMENTS_MANAGE = 'tenant:announcements:manage',

  // Staff & Settings
  STAFF_MANAGE = 'tenant:staff:manage',
  SETTINGS_MANAGE = 'tenant:settings:manage',

  // Audit
  AUDIT_VIEW = 'tenant:audit:view',
}

// Convenient mapping for simplified permission checks e.g. 'members.read'
export const PermissionAliases: Record<string, string> = {
  'members.read': PermissionCode.MEMBERS_READ,
  'members.approve': PermissionCode.MEMBERS_APPROVE,
  'members.suspend': PermissionCode.MEMBERS_SUSPEND,
  'payments.read': PermissionCode.PAYMENTS_READ,
  'payments.review': PermissionCode.PAYMENTS_APPROVE,
  'payments.approve': PermissionCode.PAYMENTS_APPROVE,
  'digital_ids.read': PermissionCode.CARDS_VERIFY,
  'digital_ids.manage': PermissionCode.CARDS_ISSUE,
  'content.manage': PermissionCode.CONTENT_MANAGE,
  'organization.manage': PermissionCode.SETTINGS_MANAGE,
  'staff.manage': PermissionCode.STAFF_MANAGE,
  'audit.read': PermissionCode.AUDIT_VIEW,
  'reports.read': PermissionCode.AUDIT_VIEW,

  // CMS Aliases
  'tenant:organization:read': PermissionCode.SETTINGS_MANAGE,
  'tenant:organization:update': PermissionCode.SETTINGS_MANAGE,
  'tenant:cms:read': PermissionCode.CONTENT_MANAGE,
  'tenant:cms:manage': PermissionCode.CONTENT_MANAGE,
  'tenant:leadership:manage': PermissionCode.CONTENT_MANAGE,
  'tenant:programs:manage': PermissionCode.CONTENT_MANAGE,
  'tenant:benefits:manage': PermissionCode.CONTENT_MANAGE,
  'tenant:rules:manage': PermissionCode.CONTENT_MANAGE,
  'tenant:announcements:manage': PermissionCode.CONTENT_MANAGE,
  'cms.read': PermissionCode.CONTENT_MANAGE,
  'cms.manage': PermissionCode.CONTENT_MANAGE,
  'announcements.manage': PermissionCode.CONTENT_MANAGE,
  'programs.manage': PermissionCode.CONTENT_MANAGE,
  'benefits.manage': PermissionCode.CONTENT_MANAGE,
  'rules.manage': PermissionCode.CONTENT_MANAGE,
  'leadership.manage': PermissionCode.CONTENT_MANAGE,
};
