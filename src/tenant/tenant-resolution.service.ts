import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrganizationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

export interface ResolvedTenant {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
}

@Injectable()
export class TenantResolutionService {
  private readonly logger = new Logger(TenantResolutionService.name);
  private readonly tenantBaseDomain: string;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.tenantBaseDomain =
      this.configService?.get<string>('tenantBaseDomain') ||
      process.env.TENANT_BASE_DOMAIN ||
      'waanofii.local';
  }

  /**
   * Resolves a tenant by looking across all supported discovery vectors:
   * 1. Direct explicit header: 'x-tenant-id' (UUID) or 'x-tenant-slug'
   * 2. Host header / Subdomain: e.g. 'tenant.waanofii.com' or custom domain 'members.org.org'
   * 3. Path parameter: e.g. '/api/v1/organizations/:slug/...'
   */
  async resolveTenant(
    host?: string,
    headers?: Record<string, string | string[] | undefined>,
    path?: string,
  ): Promise<ResolvedTenant | null> {
    // Vector 1: Explicit Headers (API clients, mobile, testing)
    const headerId =
      this.getHeaderValue(headers, 'x-tenant-id') ||
      this.getHeaderValue(headers, 'x-organization-id');
    if (headerId) {
      if (this.isValidUuid(headerId)) {
        const org = await this.prisma.organization.findUnique({
          where: { id: headerId },
          select: { id: true, name: true, slug: true, status: true },
        });
        if (org) return org;
      }
      return null;
    }

    const headerSlug =
      this.getHeaderValue(headers, 'x-tenant-slug') ||
      this.getHeaderValue(headers, 'x-organization-slug');
    if (headerSlug) {
      const org = await this.prisma.organization.findUnique({
        where: { slug: headerSlug.toLowerCase().trim() },
        select: { id: true, name: true, slug: true, status: true },
      });
      if (org) return org;
      return null;
    }

    // Vector 2: Host header (Subdomain or Custom Domain)
    if (host) {
      const cleanHost = host.split(':')[0].toLowerCase().trim();

      // Check if it's a subdomain of the base domain
      if (this.tenantBaseDomain && cleanHost.endsWith(this.tenantBaseDomain)) {
        const subdomainPart = cleanHost.replace(`.${this.tenantBaseDomain}`, '');
        if (subdomainPart && subdomainPart !== 'www' && subdomainPart !== 'api' && subdomainPart !== cleanHost) {
          const org = await this.prisma.organization.findUnique({
            where: { slug: subdomainPart },
            select: { id: true, name: true, slug: true, status: true },
          });
          if (org) return org;
        }
      }

      // Check custom domain mapping (skip for localhost and loopback)
      if (cleanHost !== 'localhost' && cleanHost !== '127.0.0.1' && cleanHost !== '::1') {
        const domainRecord = await this.prisma.organizationDomain.findFirst({
          where: { domain: cleanHost, isVerified: true },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        });
        if (domainRecord?.organization) {
          return domainRecord.organization;
        }
      }
    }

    // Vector 3: URL Path Fallback (/api/v1/organizations/:identifier/...)
    if (path) {
      const match = path.match(/\/organizations\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const identifier = match[1].toLowerCase().trim();
        const org = this.isValidUuid(identifier)
          ? await this.prisma.organization.findUnique({
              where: { id: identifier },
              select: { id: true, name: true, slug: true, status: true },
            })
          : await this.prisma.organization.findUnique({
              where: { slug: identifier },
              select: { id: true, name: true, slug: true, status: true },
            });

        if (org) return org;
      }
    }

    // Vector 4: Default Tenant Fallback (Only when configured in environment)
    const defaultSlug =
      this.configService?.get<string>('defaultTenantSlug') ||
      process.env.DEFAULT_TENANT_SLUG;
    if (defaultSlug) {
      const org = await this.prisma.organization.findFirst({
        where: {
          slug: defaultSlug.toLowerCase().trim(),
          status: OrganizationStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true, name: true, slug: true, status: true },
      });
      if (org) return org;
    }

    return null;
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined> | undefined,
    headerName: string,
  ): string | undefined {
    if (!headers) return undefined;
    const val = headers[headerName] || headers[headerName.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  }

  private isValidUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }
}
