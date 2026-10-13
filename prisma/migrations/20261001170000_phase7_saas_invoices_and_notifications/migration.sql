-- CreateEnum
CREATE TYPE "SaasInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "idempotency_key" TEXT;
CREATE INDEX "notifications_organization_id_idempotency_key_idx" ON "notifications"("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "notifications_organization_id_idempotency_key_key" ON "notifications"("organization_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;

-- CreateTable
CREATE TABLE "saas_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "SaasInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "payment_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_invoices_invoice_number_key" ON "saas_invoices"("invoice_number");
CREATE INDEX "saas_invoices_organization_id_idx" ON "saas_invoices"("organization_id");
CREATE INDEX "saas_invoices_subscription_id_idx" ON "saas_invoices"("subscription_id");
CREATE INDEX "saas_invoices_status_idx" ON "saas_invoices"("status");
CREATE INDEX "saas_invoices_invoice_number_idx" ON "saas_invoices"("invoice_number");

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security for saas_invoices
ALTER TABLE "saas_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_invoices" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "saas_invoices";
CREATE POLICY tenant_isolation_policy ON "saas_invoices"
AS PERMISSIVE
FOR ALL
USING (
    pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
)
WITH CHECK (
    pg_has_role(CURRENT_USER, 'waanofii_platform_admin', 'MEMBER')
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "saas_invoices" TO waanofii_app, waanofii_platform_admin;
