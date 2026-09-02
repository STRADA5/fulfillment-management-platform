# Phase 6 release baseline and staging readiness

Phase 6 consolidates the recovered Phase 1–5D implementation into a reproducible local release baseline. This document is preparation only; the hosted non-production Supabase connection remains intentionally deferred until the hosted-staging gate is approved.

## Starting repository state

- Baseline branch: `codex/phase6-release-baseline`.
- The recovered worktree contained 30 tracked dirty files and 92 untracked files; all intended source, migrations, tests, generated types, configuration, and verification records are being reconciled on this branch.
- The original Phase 1 migration remains byte-for-byte immutable. Its security correction is the separate forward-only Phase 1 hardening migration.
- The complete chronological chain contains 21 migrations through Phase 5D.
- Local Phase 1–5D verification, clean rebuild, typecheck, lint, production build, and local app build workflow have passed.
- Phase 6 hosted-authenticated smoke verification tooling is included as development-only code in `tests/phase6/hosted-auth-smoke.mjs` and `tools/run-phase6-hosted-smoke.ps1`; its protected credentials and bypass secret remain outside Git.

## Baseline acceptance gates

1. Preserve an archive and Git evidence of the pre-consolidation worktree.
2. Review the complete staged file inventory; no secrets, `.env.local`, `.next`, `node_modules`, or temporary credentials may be included.
3. Confirm every recovered Phase 1–5D migration and test is present exactly once.
4. Confirm the migration hashes in `docs/migration-manifest.sha256`.
5. Run `npm ci`, a clean local Supabase reset, the complete security suite, typecheck, lint, and production build.
6. Confirm `git diff --check`, generated types, package-lock consistency, and secret scanning.
7. Create an immutable release-baseline commit and tag containing the release SHA and migration-manifest hash.
8. Run the configuration-only hosted smoke check from the protected staging PowerShell session; the full hosted six-role matrix remains a separately authorized staging operation.

## Release identity

The release record must include:

- Git commit SHA and signed tag, for example `v0.6.0-rc.1`.
- migration manifest SHA-256 and the highest migration timestamp.
- package-lock hash, Node/npm versions, Supabase CLI version, and database major version.
- exact local test counts and command results.
- target environment: `local` or `staging`.

The tag name is selected during release review; no production version is implied by the Phase 6 candidate tag.

## Hosted-staging gate

Do not create or connect a hosted project until the local baseline commit is clean, all gates pass, the staging data policy is approved, and the project owner explicitly authorizes non-production Supabase creation. Hosted setup then occurs in a separate protected step using only synthetic data and staging secrets.

## Authorized operational roles

- Release owner: owns the release branch, tag, and evidence bundle.
- Migration approver: reviews the manifest and approves hosted staging migration application.
- Supabase project owner: creates and controls the separate staging project.
- Deployment approver: controls the staging application deployment and environment variables.
- Restore approver: authorizes backup restoration and records the incident/change decision.
- Test coordinator: owns synthetic fixtures and hosted smoke/regression evidence.

No one role should silently combine source release, migration, secret, and restore authority.
