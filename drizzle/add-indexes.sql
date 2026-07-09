-- ═══════════════════════════════════════════════════════════════════════════
-- Caploom — Missing Database Indexes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- IMPORTANT: All indexes use CREATE INDEX CONCURRENTLY to avoid table locks.
-- Run in low-traffic window. Execute one at a time if concerned about load.
--
-- Connect to your Neon database and run these:
-- psql $DATABASE_URL -f add-indexes.sql
--
-- Or copy-paste into Neon SQL Editor section by section.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Company Members (most queried join table) ─────────────────────────────
-- Every tRPC request resolves company membership via user → company lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_members_company_id
  ON company_members ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_members_user_id
  ON company_members ("userId");

-- Composite for the common "is user X a member of company Y?" check
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_company_members_user_company
  ON company_members ("userId", "companyId");

-- ─── Investors ─────────────────────────────────────────────────────────────
-- investor list page, investor detail, allocation lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investors_company_id
  ON investors ("companyId");

-- ─── Allocations (shares held by investors) ────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_company_id
  ON allocations ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_investor_id
  ON allocations ("investorId");

-- ─── Funding Rounds ────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funding_rounds_company_id
  ON funding_rounds ("companyId");

-- ─── ESOP Pools & Grants ───────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_esop_pools_company_id
  ON esop_pools ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_esop_grants_company_id
  ON esop_grants ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_esop_grants_pool_id
  ON esop_grants ("poolId");

-- ─── Audit Logs (frequently filtered by company + date range) ──────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_company_id
  ON audit_logs ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_company_created
  ON audit_logs ("companyId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs ("companyId", "resourceType", "resourceId");

-- ─── Share Register Entries ────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_register_entries_company_id
  ON register_entries ("companyId");

-- ─── Snapshots ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_snapshots_company_id
  ON snapshots ("companyId");

-- ─── Invitations ───────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invitations_company_id
  ON invitations ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invitations_token
  ON invitations ("token");

-- ─── Instruments (convertible notes, SAFEs, warrants) ──────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instruments_company_id
  ON instruments ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instruments_investor_id
  ON instruments ("investorId");

-- ─── Signing Requests (DocuSeal eSignature) ────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signing_requests_company_id
  ON signing_requests ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signing_requests_submission_id
  ON signing_requests ("submissionId");

-- ─── Notifications ─────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_company_user
  ON notifications ("companyId", "userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON notifications ("companyId", "userId", "read") WHERE "read" = false;

-- ─── Investor Activities (CRM) ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investor_activities_company_id
  ON investor_activities ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investor_activities_investor
  ON investor_activities ("investorId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investor_activities_upcoming
  ON investor_activities ("companyId", "dueDate") WHERE status = 'pending';

-- ─── Share Transfers ───────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_share_transfers_company_id
  ON share_transfers ("companyId");

-- ─── Share Classes ─────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_share_classes_company_id
  ON share_classes ("companyId");

-- ─── Financial Projections & Scenarios ─────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_projections_company_id
  ON financial_projections ("companyId");

-- ─── 409A Valuations ───────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_409a_valuations_company_id
  ON "409a_valuations" ("companyId");

-- ─── 83b Elections ─────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_83b_elections_company_id
  ON "83b_elections" ("companyId");

-- ─── Taiwan Compliance ─────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tech_share_tax_company_id
  ON tech_share_tax_records ("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_angel_tax_company_id
  ON angel_tax_deductions ("companyId");

-- ─── Support Tickets ───────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_user_id
  ON support_tickets ("user_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_status
  ON support_tickets ("status");

-- ─── Admin Audit Logs ──────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_logs_admin_user
  ON admin_audit_logs ("admin_user_id");

-- ─── Anti-Dilution Provisions ──────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anti_dilution_company_id
  ON anti_dilution_provisions ("companyId");

-- ─── Import Logs ───────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_logs_company_id
  ON import_logs ("companyId");

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION — Run after all indexes are created:
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
