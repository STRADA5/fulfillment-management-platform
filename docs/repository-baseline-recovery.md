# Repository baseline recovery

Verified locally on 2026-08-30. This record documents the repository-baseline correction performed before Phase 5B.

## Correction

- `20260819010000_phase1_identity_and_tenancy.sql` was restored byte-for-byte to the Git `HEAD` baseline.
- The intentional active-profile, active-organization, restricted-grant, and service-role security correction was moved into the additive migration `20260820010000_phase1_security_hardening.sql`.
- `supabase/seed.sql` was added as an intentionally empty local seed file. Disposable fixtures remain owned by the phase-specific tests.
- Later Phase 2A–5A migrations and application functionality were preserved.

## Verification

- Clean LOCAL database reset: PASS. All 18 migrations applied in chronological order, followed by the empty seed.
- Phase 1–5A regression/security/integrity suites: PASS — 497 checks.
- Typecheck: PASS.
- ESLint: PASS.
- Production build: PASS.
- No Phase 5B implementation was started.

The original Phase 1 migration must remain immutable in future work. Any further changes to its security behavior must be additive migrations with explicit regression coverage.
