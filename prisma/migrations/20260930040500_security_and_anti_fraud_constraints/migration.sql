-- CreateIndex
CREATE UNIQUE INDEX "payment_proofs_organization_id_file_url_key" ON "payment_proofs"("organization_id", "file_url");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_provider_tx_id_key" ON "payment_transactions"("provider", "provider_tx_id");

-- Security Constraint: A user must possess at least one authentication identifier (Email OR Phone Number)
ALTER TABLE "users" ADD CONSTRAINT "check_user_has_auth_identifier" CHECK ("email" IS NOT NULL OR "phone_number" IS NOT NULL);

-- Security Constraint: Email must be case-insensitively unique to prevent spoofing with mixed-case variations
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" (LOWER("email")) WHERE "email" IS NOT NULL;

-- Financial Integrity Constraint: Payment amounts must always be strictly positive
ALTER TABLE "payments" ADD CONSTRAINT "check_payment_amount_positive" CHECK ("amount" > 0);
