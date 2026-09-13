# Audit fixes and handoff

Prepared 2026-09-12 (America/Chicago) against development revision `db0bcb4a0830aef461829cdd6ff51b2bb49c7385` on `codex/phase7-hosted-staging-preview`.

## What this batch changes

- A new forward migration requires every explicitly selected salesperson to belong to the authorized provider. The shared authorization helper protects both dashboard and salesperson-report entry points. Self-scoped salesperson access, own-provider administrator access, provider-wide reports, and existing commission lifecycle behavior remain intact.
- Company and client reports now sum one row per order; equal-valued orders are not collapsed, and joining order lines does not multiply revenue.
- Article body and summary fields accept LF/CRLF paragraphs and tabs while retaining size limits and rejection of other control characters. Single-line validation remains unchanged.
- Next.js and its ESLint configuration move from 16.3.1 to 16.3.5; Playwright moves from 1.51.1 to 1.63.0. The lockfile includes patched sharp 0.35.4 and js-yaml 4.3.2.
- The inventory migration's incorrect manifest entry is corrected. No historical SQL file changes. The new migration is included in the complete 26-file manifest.
- Regression coverage is added to the existing database and browser suites and to CI. Two existing evidence tests now use isolated synthetic policy fixtures instead of incorrectly comparing fixture evidence with the last approved hosted release.

## Migration reconciliation evidence

`20260825020000_phase3b_inventory_foundation.sql` has repository SHA-256 `ac5e4a9b7ae5a5ec5a225c9b071d0918ef7b454dd584656101d7f092488b9661`. Its prior manifest entry was incorrect and stopped the upstream CI job before all quality checks.

A read-only check of the approved staging project's migration history returned 55 SQL statements for that migration. Concatenating those statements and removing whitespace and semicolons gives MD5 `c84d771f1fb7929455b134bcb22eef7d`, matching the same normalization of the repository file. This supports manifest reconciliation; it is not a byte-for-byte hosted file checksum or proof of the failing production project's schema. The four Phase 7 migrations also matched their staging history under this normalization.

The new `20260915010000_audit_tenant_reports.sql` was initialized with the CLI and sequenced after the existing future-dated `20260914010000` migration. It replaces only three function definitions within a transaction. It does not rewrite order totals, commission snapshots, permissions tables, or other stored business data.

Canonical 26-file manifest digest (the repository evidence tool's sorted-line format): `f5fe9b08aa0b260c59714b472bdffb0647cba8b590f764f424e95b60761bcc3b`.

## Local verification

- Clean dependency install (`npm ci --ignore-scripts`) and dependency audit: passed; zero known advisories reported after updating.
- Typecheck and production build: passed.
- Lint: no errors; the pre-existing unused-variable warning in `tests/phase7/rollback-evidence.mjs` remains.
- Full chronological migration rebuild on disposable PostgreSQL 17.6/Supabase: passed.
- Complete `test:security:local` suite: passed, including the extended 47-check Phase 5B suite.
- Negative controls: the new tenant test failed with the original helper; after applying only the helper fix, the repeated-value revenue test still failed with the original report function. Applying the full migration made the focused suite pass.
- `test:library-text`: passed, covering LF, CRLF, tabs, prohibited controls, length/required constraints, and unchanged single-line behavior.
- Phase 7 salesperson scope, release identity, local-CI validator, recovery, rollback, migration recovery, and observability evidence tests: passed.
- Local security advisors: no ERROR findings; two existing mutable-search-path warnings remain in unrelated financial helper functions. This is not a broad security certification.
- Browser authorization suites (`test:auth:phase6`, `test:auth:phase7-role-aware`, Chromium): passed. A multiline library article was saved through the actual server action and its body/summary verified in the database, accounting for browsers' CRLF form encoding.
- Remote PR checks: see the PR's current validation record.

Only synthetic local fixtures were written. The test environment is isolated from existing local projects. No hosted database changes were made.

## What Shane needs to do

1. Open the PR and, if GitHub asks, approve running the contributor's workflow. If Vercel asks for fork-deployment authorization, review and approve only the intended non-production Preview.
2. Wait for checks to finish and review the summary. Merge this PR into `codex/phase7-hosted-staging-preview`; it is intentionally not a release into the older `main` branch.
3. Separately arrange an authorized staging rollout of the new migration, verify the target and pending migration list, then test tenant isolation and reports there. Do not blindly push the full migration history at an unverified project.
4. Update the release-acceptance configuration only when the new source/schema identity is actually approved. This batch deliberately does not mark old hosted acceptance evidence as applicable to the new revision.

The PR body is the current record for tested commit, GitHub checks, Preview status, and outstanding approvals. This document is the durable implementation/runbook explanation.

## Deployment boundaries

The existing GitHub workflow runs local Supabase and application checks; it has no hosted migration or manual deployment step. No active local Git hooks were found. Vercel is connected to the upstream repository, and the reviewed development revision has a successful Preview deployment. Direct access to Shane's Vercel project configuration is unavailable to this account, so its private build/environment overrides were not independently inspected; any fork Preview authorization stays with the owner.

At pre-publication inspection, the staging Supabase project had no GitHub integration selected. The startup-failing project had a GitHub connection but both Deploy to production and Automatic branching were off. This PR neither transfers that project nor changes those settings. No payment, carrier, outbound-message, mobile, or Edge Function rollout is added by this patch.

Merging source alone does not apply the database fixes. The infrastructure support case and the hosted database rollout remain separate from this PR.
