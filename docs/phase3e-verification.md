# Phase 3E — Client/customer foundation

## Final result

PASS: clean LOCAL rebuild, all 285 regression assertions, generated database types, typecheck, lint, and production build. No remote Supabase project was contacted or modified. No locked migration was changed during this phase; SHA-256 comparison of all eight previous migrations matched the preserved baseline.

The new additive migration is `20260830010000_phase3e_client_customer_foundation.sql` (SHA-256 `89C487FE8B4BD29360E0E20FCB1CAD0D790FC983DD5170650C53475231DE6774`). All nine migration versions were reapplied successfully. All five new tables have RLS enabled and authenticated SELECT policies; authenticated direct writes are denied. Final fixture cleanup left zero Phase 3E organizations.

## Architecture and security

- Active super-admins onboard client organizations and establish explicit service relationships. Provider/client parties and client account parent/slug are immutable through these workflows. Onboarding creates no memberships, catalog grants, or stock activity.
- Customer records belong to a client organization, not to its parent/provider. Customer owner and customer number cannot be reassigned, including through the trusted update path.
- Customer/contact, lifecycle, address, and history permissions are separate. Provider access additionally requires an active explicit service grant with `read` or `manage` capability. Catalog connections, hierarchy, and editable organization settings confer no customer authority.
- Customer reads/mutations require an active profile and active client organization. Provider access also requires an active provider and service relationship. Suspended customers remain visible to authorized users for history; address mutation requires an active customer. Reactivation requires lifecycle permission.
- Server Actions authenticate, validate, and call RPCs using the actor's authenticated session. RPCs independently authorize and validate, enforce immutable organization relationships, and generate transactional trusted audit events. No Phase 3E action uses a service-role client.
- Customer, address, and service edits use optimistic versions. Address default changes serialize on the customer row and have unique indexes. Grant locks protect customer mutations against committed service revocation.
- Address revisions preserve prior values and are accessible only with address-view authority. Future orders must copy the address used into their own immutable snapshot; that order system is deliberately not implemented.
- General audit metadata excludes customer/address PII. Service capability changes record previous/new capabilities in protected lifecycle history. Authenticated users cannot forge, rewrite, or delete history.
- No Phase 3E inventory mutation exists. A populated inventory fixture verifies balances, transactions, and reservations remain byte-for-byte unchanged across customer/service operations.
- Existing supplier, cost, pricing, QC, and quarantine boundaries are preserved by the complete regression run. Source scan found no embedded secret-key/JWT pattern in inspected source/tests/docs. The privileged invitation client remains `server-only`; actual environment files remain Git-ignored.

## Reproducible LOCAL checks

Run from the project directory with the local Docker/Supabase stack available:

```powershell
npm.cmd exec -- supabase db reset --local
$foundationTypes = npm.cmd exec -- supabase gen types typescript --local
if ($LASTEXITCODE -ne 0) { throw 'Local type generation failed' }
$foundationTypes | Set-Content -Encoding utf8 src/types/database.ts
npm.cmd run test:security:local
npm.cmd run typecheck
npm.cmd run lint
node supabase/tests/run-local-app.mjs --build
```

Reset is destructive to disposable LOCAL database contents only. Do not use this workflow against hosted projects. Test/build wrappers obtain local configuration without committing credentials. To run only the new suite: `npm.cmd run test:security:local -- --phase3e`. Default tests clean their own fixtures.

| Verification | Result |
| --- | --- |
| Phase 1 | PASS — 10 |
| Phase 2A | PASS — 10 |
| Phase 2B | PASS — 10 |
| Phase 3A including edit/confidentiality regression | PASS — 13 |
| Phase 3B inventory integrity | PASS — 19 |
| Phase 3C procurement/QC integrity | PASS — 54 |
| Phase 3D catalog/pricing | PASS — 87 |
| Phase 3E customer/service foundation | PASS — 82 |
| Total | PASS — 285 |
| Local clean rebuild / local type generation | PASS |
| TypeScript / lint / production build | PASS / PASS / PASS |

Phase 3E covers cross-client reads/search/counts/context enumeration, unauthorized mutations, immutable ownership and identifiers, catalog/hierarchy/settings non-authority, read/manage service capability, duplicate/unauthorized service changes, stale writes, address privacy and validation, revision preservation, real concurrent default selection, direct write/deletion denial, customer and service lifecycle, inactive clients/providers, suspended users/super-admins, anonymous access, trusted audit metadata/history, inventory non-interference, and no automatic memberships. Each assertion is retained in `supabase/tests/phase3e-customers.mjs`.

## UI verification and limits

Real local browser smoke checks before the continuation exercised customer creation and prefilled editing, address creation/editing with preserved revisions, client onboarding, and service creation/editing/suspension. The final client name/status edit was confirmed on resume through a LOCAL database read: the edited name and inactive status persisted. The browser session itself did not survive the interruption.

The final service-history detail addition was verified through authenticated API tests, types, source review, and the build; its rendered UI was not re-tested in a fresh browser session. Browser coverage is not a standalone maintained E2E suite and does not exhaustively cover every role, form, status, forged Server Action, pagination, mobile, or accessibility combination.

No automated regression was skipped, weakened, or disabled. Fixtures are synthetic, but RLS and RPC tests use real authenticated local sessions; service-role access is used for setup/cleanup. Default-address concurrency uses overlapping real requests, not simulated concurrency. Exhaustive race/load/soak testing, including simultaneous service revocation and edits, was not performed.

Inherited coverage limits: Phase 3C expiry processing simulates elapsed time by backdating a local fixture; pricing uses past/future fixtures rather than waiting for time transitions. Quality-document tests cover metadata, not file storage. Hosted invitation email delivery, redirect behavior, storage, and production deployment are not tested end-to-end. Optional local Storage/Realtime/Studio/analytics services were stopped; this foundation uses local Database/Auth/REST. No remote testing was attempted.

## Files in this phase

Created:

- `supabase/migrations/20260830010000_phase3e_client_customer_foundation.sql`
- `supabase/tests/phase3e-customers.mjs`
- `src/lib/customers/actions.ts`
- `src/components/customers/foundation-form.tsx`
- `docs/phase3e-verification.md`

Modified/regenerated:

- `supabase/tests/run-local-security-tests.mjs`
- `src/types/database.ts`
- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/customers/page.tsx`
- `src/config/navigation.ts`
- `README.md`

No packages were installed for this continuation. Existing unrelated dirty/untracked work was preserved. Next-generated `AGENTS.md` and `CLAUDE.md` remain present; they are not application features or migrations. Generated build output is ignored by Git.

## Remaining issues

### BLOCKER

None found within the approved Phase 3E scope and local verification coverage.

### SHOULD FIX BEFORE PRODUCTION

- Add maintained browser regression tests, full role/status coverage, accessibility/mobile checks, and hosted non-production integration validation before deployment.
- Improve large-list UX: customer/address and lifecycle history displays have bounded result sets; addresses show at most 100, history/revisions at most 50. Client/service selectors need dedicated search/pagination and friendlier authorized names. Service/client lists currently share pagination.
- Add client-account optimistic concurrency (customer/address/service edits already have versions), broader revocation/concurrency/load testing, and operational rate limits/monitoring.
- Define PII retention, privileged audit retention/recovery, backup/restore, and deletion policies. Local SQL access is privileged and outside authenticated RLS protections.
- Address validation is structural, not postal deliverability or country-specific validation. Add appropriate validation before real shipping.

### FUTURE IMPROVEMENTS

- Build immutable order-address snapshots when the order phase is approved; do not reference mutable master addresses as historical truth.
- Consider more granular delegated onboarding/service administration instead of the current explicit super-admin gate.
- Improve history diffs, authorized actor labels, and scalable search. Do not turn this foundation into a marketing CRM.

PHASE 3E SAFE TO LOCK: YES
