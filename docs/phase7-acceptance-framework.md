# Phase 7 hosted-staging acceptance framework

This is the first Phase 7 implementation task. It defines local acceptance records and validation only. It does not connect to Vercel, Supabase, staging, Production, or any other hosted service.

The machine-readable definition is [`config/phase7-acceptance.json`](../config/phase7-acceptance.json), validated by `npm.cmd run validate:phase7`. The validator reads local files only and performs no network requests.

## Release and target identity

Before any hosted gate is attempted, record the exact repository branch, full release commit SHA, release/version identifier, clean-worktree result, and migration-manifest verification. The initial Phase 7 baseline records the Phase 6 reconciliation commit `f8e3547` and roadmap commit `6126e16`; a later Phase 7 release candidate must record its own exact SHA.

The hosted target must be explicitly classified as non-production staging before access. `PHASE7_PREVIEW_URL` is a protected process input for a future authorized run; it is not a default or a permission to connect. The approved staging Supabase project reference is `nftufhffzlokryafcbku`. Missing, production, arbitrary, malformed, or mismatched Preview targets are `BLOCKED`/`FAIL`, never `PASS`.

The unresolved Phase 6 Vercel automation-bypass issue is recorded as a blocker. It must not be bypassed by weakening Deployment Protection, accepting arbitrary hosts, or changing Production settings.

## Local release-identity evidence

`tools/generate-phase7-release-evidence.mjs` implements the local portions of P7-REL-01 and P7-REL-02. It reads the repository, Git metadata, `package.json`, migration files, and `docs/migration-manifest.sha256` only. It does not invoke a remote Git operation, make an HTTP request, execute migrations, contact Supabase, or accept a target URL. It never cleans a dirty worktree.

Run the local evidence tool with `npm.cmd run evidence:phase7:release`. Supply `--expected-commit <sha>` for an approved release comparison, and optionally `--expected-branch <branch>` or `--expected-version <version>`. The JSON output contains only redacted release metadata and gate statuses. Without an expected commit, the commit-comparison portion remains `NOT_RUN`; deployment identity remains `NOT_RUN` because it requires a separately authorized hosted check. The tool exits nonzero for blocked or unsupported input, but still emits only a safe category.

The mismatch and no-network tests run with `npm.cmd run test:phase7:release`. They cover repository/branch/commit/worktree/version/manifest success and mismatches, dirty-state failure, rejection of target-URL input including Production-shaped URLs, and absence of network clients.

## Synthetic role matrix

The matrix is intentionally ordered and matches the Phase 6 hosted definitions:

1. Unrelated synthetic Client B — `CLIENT_USER`, client-B context; must not see Client A, salesperson, pricing-tier administration, or provider administration data/actions.
2. Multi-role synthetic Client A — `CLIENT_USER`, client-A context; must not see Client B, salesperson, pricing-tier administration, or provider administration data/actions.
3. Salesperson A — `STAFF`, provider context; may see only assigned Client A attribution and authorized salesperson reporting.
4. Salesperson B — `STAFF`, provider context; may see only assigned Client B attribution and authorized salesperson reporting.
5. Fulfillment Operator — `WAREHOUSE`, provider context; may use authorized fulfillment, inventory, receiving, QC, warehouse, and library workflows, but not provider administration, salesperson commissions, billing, or client-relationship administration.
6. Platform Super-Admin / Provider Administrator — `SUPER_ADMIN`, platform context; receives only the capabilities allowed by the established platform security model.

Every role requires a fresh isolated browser/session context. No passwords, tokens, cookies, credential blobs, raw authorization headers, or sensitive session values may enter evidence. The existing Phase 6 runner remains the source for hosted route-level assertions; this framework does not weaken or replace those checks.

## Gate evidence model

Each gate has an ID, category, status, evidence checklist, and redacted evidence reference. Valid statuses are:

- `PASS`: all required evidence is present and independently reviewable.
- `FAIL`: an expected control or behavior did not hold; preserve the exact redacted role/route/resource outcome.
- `NOT_RUN`: the gate has not been attempted.
- `BLOCKED`: a prerequisite or infrastructure issue prevents a meaningful attempt.

No `NOT_RUN` or `BLOCKED` gate may be reported as passed. A failure in tenant isolation, authorization, release identity, or target safety stops the acceptance window and is not repaired automatically.

The framework records only redacted metadata: status, timestamp, release SHA, target classification, safe route/status outcome, approver, and an evidence reference. It never records credentials, secrets, service keys, access/session tokens, cookie values, raw authorization headers, customer data, production data, or document contents.

## Recovery and readiness placeholders

The framework reserves gates for backup/restore rehearsal, application rollback, migration failure/recovery evidence, monitoring and logging readiness, and CI/release-candidate verification. These remain `NOT_RUN` until their evidence is produced in the approved non-production process. Database rollback means restore or a compensating forward migration; locked historical migrations are never edited or deleted.

## Current Phase 7 status

At framework creation, hosted access and all hosted role/recovery/readiness gates are `NOT_RUN` except the known Vercel automation-bypass blocker, which is `BLOCKED`. This is not a hosted validation result and does not contact any service. Phase 7 may proceed only through separately authorized local or non-production actions while preserving the target, synthetic-data, release-identity, and security gates.
