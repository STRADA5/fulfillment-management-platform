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

## Local CI and release-candidate evidence

`tools/run-phase7-local-ci.mjs` implements the local P7-CI-01 gate. It runs the existing typecheck, lint, serial production build, complete local security/regression suite, Phase 6 authorization regression, Phase 7 definition validator, secret scan, and build-artifact identity checks. It invokes the existing release-identity tool for repository, branch, commit, worktree, version, and migration-manifest evidence. It never cleans fixtures, edits files, accepts a target URL, contacts a remote Git/Vercel/Supabase/Production service, or records child-process output.

Run `npm.cmd run test:phase7:ci` for aggregation and fail-closed behavior tests. The full candidate command is `node tools/run-phase7-local-ci.mjs`; its JSON output records only safe gate statuses, exit categories, manifest/release metadata from the existing evidence tool, and a digest/length for the local build identifier. A nonzero command, stale fixture failure, unreadable evidence, dirty worktree, release mismatch, missing artifact, `BLOCKED`, or `NOT_RUN` result prevents an overall `PASS`. The local CI gate does not claim hosted deployment identity; that remains a separate hosted acceptance gate.

### Completed P7-CI-01 evidence — candidate 21d7fe7

Evidence reference: `P7-CI-01-21D7FE7-20260913`, recorded in
[`docs/phase7-ci-release-evidence.json`](phase7-ci-release-evidence.json).
The authoritative run completed at `2026-09-13T03:06:42.027Z` with all **11/11
mandatory gates PASS**, against exactly
`21d7fe78cba61f6f16a49a303a31efa2cf38285e` on
`codex/phase7-hosted-staging-preview`. The isolated candidate was clean before and
after validation. This evidence is written outside that checkout: it does not
change the candidate, claim the operator evidence worktree was validated, or
substitute its HEAD for the validated SHA.

The unchanged runner's `buildEvidence` implementation supplied the aggregate. A
temporary external adapter captured/redacted subprocess output and stopped on
nonzero results without changing package tasks, assertions, or acceptance rules.
The production command remained `cmd.exe /d /s /c npm.cmd run build` (`next build`).

| Recorded check | Result and scope |
| --- | --- |
| Target safety | PASS — repository-local Docker/Supabase, API `127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322`, healthy containers and local-only child environment. |
| Release identity | PASS — exact candidate, branch, clean worktree and version `0.1.0`; this local run's hosted deployment check remains NOT_RUN. |
| Migration/manifest | PASS — 25 locked migrations; matching set/manifest digest `ed8e928bccf6afbc6a7ac8558674874eb54fb6af017d12a5e56dac291d26a2ff`. |
| Windows/Linux materialization | PASS — identical immutable Git, Windows and existing Linux archive hashes for 25 migrations, the manifest and `.gitattributes` (27 files); not a Linux application-build claim. Read-only corroboration at `2026-09-13T03:15:26.428Z` made no database queries. |
| Typecheck, lint, production build | PASS individually. |
| Authorization/tenant isolation | PASS — complete local security regressions and the Phase 6 browser authorization suite. |
| Phase 6 authorization and auth/session preservation | PASS — isolated local Client/STAFF/ADMIN checks, protected route boundaries and authorized reporting; the earlier Phase 6 failure did not reproduce. |
| Migration/recovery and local observability | PASS — existing local validator regression suites; not a new rehearsal or provider operational-readiness result. |
| Secret scan and build-artifact identity | PASS — 228 candidate files scanned; final local build identifier length 21, SHA-256 `bc2dac2c5a85651a7e12a4801619562b0cdfea933b35e4aff3a27acbd9a5180f`. |

The local-only corrections were a native Windows command executable path and
locked dependency materialization inside the isolated candidate. `npm ci` retrieved
only existing lockfile-pinned artifacts from `registry.npmjs.org`; 379 installed
package identities matched the lockfile, including `playwright-core` **1.51.1**.
The resulting `node_modules` is a real directory with no external dependency links.
No dependency versions or install-script approvals were changed. No application
source, package files, historical migrations, candidate tests/acceptance rules,
hosted data or credentials were changed to achieve PASS. All 237 original operator
files and the complete original dependency fingerprint were unchanged after CI.
Only redacted metadata and receipt digests are included here, not temporary
helpers, installation trees, raw logs or operator artifacts. This recording step
edits evidence only; it makes no commit, push or deployment.

The deployed Preview remains separately identified as
`https://fulfillment-management-platform-j4ntvrkrz.vercel.app`,
`dpl_HNwQgTJB7oupc81kWJ197RY3o7jt`, application commit
`213a2cea3ebf2435d138b201de0a5883e8d8d4e0`. Candidate `21d7fe7` was not deployed by
this validation. Earlier pending-CI references are historical and superseded only
for P7-CI-01; they do not override this candidate-scoped record.

### Remaining launch-critical gates after local CI PASS

1. **P7-OBS-01 remains BLOCKED — EXTERNAL_PROVIDER_BLOCKED.** Preserve
   [`docs/phase7-observability-evidence.json`](phase7-observability-evidence.json)
   and its passing sub-evidence. Provider availability, the unavailable Supabase
   access/retention/private-configuration checks, and all other recorded routing,
   suppression, retention and review requirements must be verified before PASS.
   Local observability tests do not close this operational gate.
2. **P7-BLOCK-VERCEL-AUTOMATION-BYPASS remains open; latest bounded verification: FAIL.**
   The Release Owner supplied fresh authenticated-dashboard confirmation of
   `This project` with the rule "All tokens can access matching environments,
   development tokens can access preview". This satisfies the prior manual
   reconfirmation requirement; an absent API field is not required to duplicate it.
   The single authorized run at `2026-09-14T04:03:51.1330749Z` through
   `2026-09-14T04:04:26.4783268Z` passed live immutable identity, fresh development
   OIDC, Deployment Protection, unauthenticated protection and application login
   access. Exactly one Salesperson A authentication **passed**, reaching
   `/dashboard` and verifying the exact approved account email. The runner then
   stopped at `SALESPERSON_A_IDENTITY` with `OFF_TARGET_REQUEST_BLOCKED` (exit 1).
   The refused destination and its original occurrence time are not established
   by the existing redacted output. No application or credential defect is inferred.
   Salesperson-record/tenant/client validation, `/salespeople` to `/reports`
   session preservation, bounded denials and the final provider-settings comparison
   remain unproven. No retry, repair, guard change, business-data mutation,
   credential change or Production access occurred. The 67 local target/proxy
   regressions passed; runner and launcher hashes remained unchanged.

   Historical preflight (superseded by the fresh operator confirmation):
   At `2026-09-14T03:33:33.180Z`, fixed read-only Vercel control-plane lookups
   verified the current canonical Preview, project/team, deployment, commit,
   READY/non-production state, Production-alias exclusion and enabled Deployment
   Protection. The existing exact `POST /login` target policy also passed.
   The project API does not expose Trusted Sources, and no authenticated dashboard
   tab was available to independently confirm the previously approved rule remains
   unchanged. An absent `trustedSources` property, including equal hashes of
   `null`, is not proof of an unchanged rule. The final bounded attempt stopped
   before fresh OIDC acquisition, Preview requests, credential retrieval or login.
   Authentication/session/denial checks are NOT_RUN, not application failures.
   Fresh authenticated operator/dashboard confirmation was then required; no Vercel
   configuration change is indicated or authorized. The 67 offline target/proxy
   safety checks passed. Existing capture, manual-role and CI evidence is preserved.

   Historical bounded-run evidence follows; it is not the latest attempt:
   The stale `5uxw6i3a` runner pin recorded at the local CI checkpoint has since
   been reconciled in separately scoped operator-workspace tooling, without
   changing the validated candidate. The authorized 2026-09-13 bounded run on
   current Preview `j4ntvrkrz` passed live immutable identity, fresh development
   OIDC, unauthenticated protection, and authorized application `/login` access.
   It then stopped at `SALESPERSON_A_AUTHENTICATION` with
   `OFF_TARGET_REQUEST_BLOCKED`. The refused destination was not recorded;
   neither a credential defect nor an application defect is established.
   Authentication success, session/isolation checks and the final protection
   comparison are not proven. Redacted evidence and limitations are recorded in
   [`phase7-vercel-automated-access-evidence.json`](phase7-vercel-automated-access-evidence.json).
   No retry, repair, Vercel configuration change or Production request occurred.
   Diagnose the refused request only under separate authorization; do not weaken
   the guard or relabel prior manual six-role evidence as automated evidence.

The previously completed six-role and recovery results are not reopened by this
local-only correction. No third technical gate or TENANT-BRAND-01 feature is added.
Final release-owner acceptance remains pending closure of the two blockers above;
local CI PASS is not a declaration of launch readiness. The next redacted
request-target diagnostic can advance independently of unavailable Supabase
operator controls; runner changes, retries or configuration changes require
separate authorization.

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

## Recorded manual hosted authorization evidence

Evidence reference: `P7-AUTH-MANUAL-CLIENT-AB-001`.

The approved non-Production Preview at `fulfillment-management-platform-8io6zsa3s.vercel.app` was manually validated on branch `codex/phase7-hosted-staging-preview` for the corrected Phase 7 application release identity `f55c107dcff17b21fd46e163f3576c719ce5a071`. The manual hosted authorization validation status is `PASS` for the Client A/B checkpoint below. This record does not claim automated browser CI success; Playwright/Edge remains `INFRA_BLOCKED/NOT_RUN`.

- Client B authentication, organization context, client-safe navigation, `/dashboard`, `/client-catalog`, and `/library`: `PASS`.
- Client B direct access to `/administration`, `/branding`, `/salespeople`, `/pricing-tiers`, and `/client-relationships`: denied as expected; `PASS`.
- Client B provider/platform administration controls and cross-tenant Client A data: not exposed; `PASS`.
- Client A authentication, organization context, client-safe navigation, `/dashboard`, `/client-catalog`, and `/library`: `PASS`.
- Client A direct access to `/administration`, `/branding`, `/salespeople`, `/pricing-tiers`, and `/client-relationships`: denied as expected; `PASS`.
- Client A provider/platform administration controls: not exposed; `PASS`. The hosted Client A account carried the client-side `CLIENT_ADMIN` role during this check, proving the corrected provider/platform boundary for that role as well as ordinary client-side access.
- Client A/B tenant isolation: manually verified; `PASS`.

### Salesperson B hosted validation

Evidence reference: `P7-AUTH-MANUAL-SALESPERSON-B-001`.

The same approved non-Production Preview at `fulfillment-management-platform-bc94hc28g.vercel.app` was manually validated for Salesperson B on the corrected Phase 7 release chain. This historical evidence records manual hosted authorization validation only; Playwright/Edge remains `INFRA_BLOCKED/NOT_RUN`.

- Salesperson B authentication, provider context, assigned-client navigation, and Client B visibility: `PASS`.
- Client A absence from assigned clients and cross-salesperson private assignment/commission data: `PASS`.
- Self-scoped commission/reporting, assigned-client sales totals, commission status, payout history, and reports: `PASS`.
- Salesperson B provider/platform administration boundary and Client A attribution absence: `PASS`.

No hosted data, users, memberships, roles, passwords, Windows credentials, Production aliases, or Production environments were modified or contacted. Provider/platform administrator role coverage and the remaining synthetic-role gates are not asserted by this checkpoint and remain subject to the ordered acceptance matrix.

### Current Preview release-identity reconciliation

Evidence reference: `P7-RELEASE-CURRENT-PREVIEW-213A2CE`.

The current approved non-Production Preview is `https://fulfillment-management-platform-j4ntvrkrz.vercel.app`, deployment `dpl_HNwQgTJB7oupc81kWJ197RY3o7jt`, deployed from commit `213a2cea3ebf2435d138b201de0a5883e8d8d4e0`, with deployment target `Preview`. The prior `q39nhsf03` Preview is historical evidence only. Production was not deployed or contacted.

The six-role isolated-session matrix is reconciled as `PASS` for this Preview: Platform Super-Admin/Provider Administrator, Fulfillment Operator, Client A, Client B, Salesperson A, and Salesperson B. Evidence is redacted route, identity, authorization-boundary, and session-outcome metadata only; no passwords, tokens, cookies, hosted business data, or raw session values are recorded.

The role-by-role reconciliation for this unchanged Preview identity is:

- Platform Super-Admin/Provider Administrator: `PASS`, carried forward from the completed hosted role evidence and the unchanged deployed release identity.
- Fulfillment Operator: `PASS`, carried forward from the completed hosted `/dashboard` and `/shipping` validation and the unchanged deployed release identity.
- Client A: `PASS`, carried forward from the completed hosted identity, client-catalog, library, and tenant-boundary evidence.
- Client B: `PASS`, carried forward from the completed hosted identity, client-catalog, library, and tenant-boundary evidence.
- Salesperson A: `PASS`, with direct current-Preview revalidation of authentication, identity, assigned Client A visibility, and `/salespeople` to `/reports` session preservation.
- Salesperson B: `PASS`, carried forward from the completed hosted identity, assigned Client B scope, reporting/session, library/tools, and isolation evidence.

No role requires another manual hosted check for this reconciliation because the current Preview deployment identity is unchanged and no role, authorization, credential, hosted-data, or application-code state changed after the recorded validations.

This reconciliation does not mark the remaining recovery, monitoring, CI, or automated-browser gates as passed. The historical Vercel automation-bypass blocker remains fail-closed for the automated browser path; the corrective action is to record the approved operator-assisted Preview access path separately and rerun the affected target/browser gate without weakening Deployment Protection or Production safeguards.

## Recovery and readiness placeholders

The framework reserves gates for backup/restore rehearsal, application rollback, migration failure/recovery evidence, monitoring and logging readiness, and CI/release-candidate verification. P7-OPS-01 has a local-only validator at `tools/validate-phase7-recovery-evidence.mjs` and focused tests at `tests/phase7/recovery-evidence.mjs`. P7-OPS-02 has a separate local-only validator at `tools/validate-phase7-rollback-evidence.mjs` and focused tests at `tests/phase7/rollback-evidence.mjs`. P7-OPS-03 has a local-only validator at `tools/validate-phase7-migration-recovery-evidence.mjs` and focused tests at `tests/phase7/migration-recovery-evidence.mjs`. P7-OBS-01 now has a local-only validator at `tools/validate-phase7-observability-evidence.mjs` and focused tests at `tests/phase7/observability-evidence.mjs`; it validates redacted application/Supabase/audit source evidence, required alert signals, bounded access, retention, approval, exact non-Production target identity, release identity, and no-Production-contact evidence. The validator never reads logs, contacts a service, sends notifications, performs deployment, or records payloads. Run `npm.cmd run evidence:phase7:observability -- --evidence <local-json-path>` for a supplied local evidence record; absent, incomplete, Production/arbitrary-target, `BLOCKED`, or `NOT_RUN` evidence cannot pass. Actual hosted observability configuration and checks remain deferred to separately authorized non-Production staging. The OPS-03 validator independently reads the local migration files and manifest, checks deterministic count/order/hash identity, requires explicit failure classification and rollback-versus-forward-fix evidence, validates an exact non-Production recovery destination and approval evidence, and requires post-recovery schema, compatibility, authorization, integrity, and no-Production-contact checks. It never executes or edits migrations, performs recovery, contacts Supabase, or makes a network request. Run `npm.cmd run evidence:phase7:migration-recovery -- --evidence <local-json-path>` for a supplied local evidence record; absent, incomplete, altered, reordered, duplicate, `BLOCKED`, or `NOT_RUN` evidence cannot pass. The actual migration failure/recovery rehearsal remains `NOT_RUN` and deferred to separately authorized non-Production staging; locked historical migrations are never edited or deleted.

## Current Phase 7 status

At framework creation, hosted access and all hosted role/recovery/readiness gates are `NOT_RUN` except the known Vercel automation-bypass blocker, which is `BLOCKED`. This is not a hosted validation result and does not contact any service. Phase 7 may proceed only through separately authorized local or non-production actions while preserving the target, synthetic-data, release-identity, and security gates.
