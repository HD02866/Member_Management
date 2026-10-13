-- ==============================================================================
-- WAANOFII POSTGRESQL ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- SECURE ROLE-BASED ACCESS CONTROL FOR MULTI-TENANCY:
-- 1. waanofii_app: The standard application connection role.
--    - Configured with NOBYPASSRLS.
--    - Bound strictly to the tenant context in app.current_organization_id.
--    - Has NO membership in waanofii_platform_admin and CANNOT set role to it.
-- 2. waanofii_platform_admin: The trusted platform administrative role.
--    - Configured with NOBYPASSRLS.
--    - Membership in this role grants cross-tenant visibility for platform-level
--      administrative queries and maintenance.
--    - CANNOT be assumed or self-assigned by waanofii_app.
-- ==============================================================================

-- 1. Ensure roles exist with strict privileges
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'waanofii_platform_admin') THEN
        CREATE ROLE waanofii_platform_admin NOINHERIT NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'waanofii_app') THEN
        CREATE ROLE waanofii_app NOINHERIT NOBYPASSRLS;
    END IF;
END $$;

-- 2. Prevent role self-promotion: waanofii_app must NOT be a member of waanofii_platform_admin
REVOKE waanofii_platform_admin FROM waanofii_app;

-- 3. Grant schema usage and table DML privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM waanofii_app;

GRANT USAGE ON SCHEMA public TO waanofii_app, waanofii_platform_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO waanofii_app, waanofii_platform_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO waanofii_app, waanofii_platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO waanofii_app, waanofii_platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO waanofii_app, waanofii_platform_admin;

-- 4. Apply RLS and FORCE policies on all tenant-owned tables
DO $$
DECLARE
    tbl text;
    tenant_tables text[] := ARRAY[
        'organization_domains',
        'organization_subscriptions',
        'organization_profiles',
        'staff_memberships',
        'member_profiles',
        'membership_plans',
        'memberships',
        'membership_periods',
        'payments',
        'payment_methods',
        'payment_proofs',
        'payment_reviews',
        'payment_transactions',
        'digital_membership_cards',
        'verification_tokens',
        'verification_logs',
        'leadership_positions',
        'leaders',
        'programs',
        'benefits',
        'rules',
        'announcements',
        'notifications',
        'notification_preferences',
        'audit_logs',
        'saas_invoices'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables LOOP
        -- Enable and Force RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

        -- Drop existing policy if exists to make script idempotent
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);

        -- Create strict tenant isolation policy using trusted role verification
        -- Notice: We check pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
        -- and strictly reject any untrusted GUC session variable self-assignment.
        EXECUTE format('
            CREATE POLICY tenant_isolation_policy ON %I
            AS PERMISSIVE
            FOR ALL
            USING (
                pg_has_role(CURRENT_USER, ''waanofii_platform_admin'', ''MEMBER'')
                OR organization_id = NULLIF(current_setting(''app.current_organization_id'', true), '''')
            )
            WITH CHECK (
                pg_has_role(CURRENT_USER, ''waanofii_platform_admin'', ''MEMBER'')
                OR organization_id = NULLIF(current_setting(''app.current_organization_id'', true), '''')
            );
        ', tbl);
    END LOOP;

    -- Special handling for 'roles': system roles have organization_id IS NULL and can be read by any tenant
    ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE roles FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS roles_isolation_policy ON roles;
    CREATE POLICY roles_isolation_policy ON roles
    AS PERMISSIVE
    FOR ALL
    USING (
        pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
        OR organization_id IS NULL
        OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
    )
    WITH CHECK (
        pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
        OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
    );

    -- Special handling for 'organizations': tenant can view their own organization record
    ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS organizations_isolation_policy ON organizations;
    CREATE POLICY organizations_isolation_policy ON organizations
    AS PERMISSIVE
    FOR ALL
    USING (
        pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
        OR id = NULLIF(current_setting('app.current_organization_id', true), '')
    )
    WITH CHECK (
        pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
        OR id = NULLIF(current_setting('app.current_organization_id', true), '')
    );
END $$;
