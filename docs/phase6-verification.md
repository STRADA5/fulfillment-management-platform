# Phase 6 local verification

Phase 6 local release-baseline preparation was performed on `codex/phase6-release-baseline`. No hosted Supabase project was created, linked, migrated, or contacted. No production data, credentials, or live provider was used.

## Baseline contents

- Recovered Phase 1–5D application code, migrations, tests, generated types, and documentation are included on the baseline branch.
- The chronological migration chain contains 21 migrations through `20260910010000_phase5d_knowledge_library_tools.sql`.
- `20260819010000_phase1_identity_and_tenancy.sql` remains immutable and the Phase 1 security correction remains forward-only in `20260820010000_phase1_security_hardening.sql`.
- `supabase/seed.sql` remains an intentionally empty bootstrap-safe local seed.
- `docs/migration-manifest.sha256` matches every migration file.
- Staging environment, CI, synthetic-data, backup/restore, rollback, monitoring, and authorized-role runbooks are documented without real secrets.
- The Phase 6 hosted smoke runner is present as development-only tooling. It requires a direct Playwright dev dependency, exact Preview URL validation, a process-scoped Vercel bypass secret, and Windows Credential Manager input for the six synthetic identities.

## Verification results

| Gate | Result |
| --- | --- |
| Clean local database rebuild through Phase 5D | PASS |
| Complete Phase 1–5D security/regression suite | PASS |
| Phase 5D focused suite | PASS — 18 checks |
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Production build | PASS |
| Local app build workflow | PASS |
| Migration manifest hashes | PASS |
| Hosted Supabase access | NOT RUN — intentionally deferred |
| Hosted authenticated smoke matrix | BLOCKED — Vercel automation-bypass path remains unresolved; no application failure inferred |
| Production credentials/data/providers | NOT USED |

## Hosted-staging gate remaining

Hosted non-production access becomes appropriate only after this local baseline is reviewed and the project owner explicitly approves creation of a separate synthetic-data-only Supabase project. The required inputs are listed in `docs/phase6-staging-runbook.md`; no production credential is required or requested.

## Hosted runner implementation status

- Configuration-only validation must be run from the protected staging PowerShell session with `npm run test:hosted:phase6 -- -ConfigOnly`.
- The six-role hosted matrix must be run only with the exact staging Preview URL and approved synthetic Credential Manager entries.
- Current hosted-testing issue: the protected Preview responds with an application-classified HTTP 404 and no bypass cookie when the automation-bypass headers are used; normal browser access remains successful. Treat this as unresolved Vercel/Preview testing infrastructure, not as authorization evidence, and do not rotate secrets or weaken Deployment Protection without a separately approved diagnosis.
- No browser artifacts, credentials, session values, or production targets may be recorded.
