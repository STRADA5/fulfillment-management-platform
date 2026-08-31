# Phase 3D — Client catalog visibility and client-specific pricing

## Security and ownership

This phase adds migration `20260829010000_phase3d_client_catalog_pricing.sql`; locked Phase 1–3C migrations are unchanged. Inventory remains fulfillment-company controlled. No stock mutation, allocation, reservation, ordering, checkout, or inventory ownership is introduced.

An active super-admin must explicitly establish a seller/client connection. This is deliberately not inferred from organization hierarchy. An active company user with `client_catalog.manage` may publish only that company's products and variants to explicitly connected active clients. Each product and each SKU needs its own grant; a product grant never exposes all present or future variants.

Clients with an active client membership and `client_catalog.view` use `get_my_client_catalog`. It returns only approved public name/description, product/variant identifiers, explicitly published SKU, resolved selling price/currency, and pagination count. It never returns master descriptions/internal notes, suppliers, acquisition costs, QC/disputes, warehouse data, inventory, pricing rules, or other clients' identities/prices. A super-admin can preview the same narrow projection; an ordinary seller administrator has no implicit client membership.

The three new tables have RLS and no authenticated direct-write grants. The private policy predicate is executable by authenticated callers for RLS evaluation but is not exposed as a public API RPC. Mutations reauthenticate/re-authorize in the database, validate tenant relationships and inputs, serialize changes per seller, and generate trusted audit events. Server Actions also validate UUIDs, enums, numbers, and UTC dates. Browser-selected organization IDs are checked against server-authorized companies, not trusted.

Selling-price authority is separate from catalog authority and supplier-cost authority. Catalog-only administrators cannot see pricing rules or use price mutations. Audit metadata intentionally excludes selling-price values and customer identities; trusted events identify actor, seller, operation, affected record, status, and timestamp through the existing audit architecture.

## Pricing rules

- Base rules have no client; client-specific rules and temporary overrides require an explicit active client connection.
- A rule can target a product or an individual SKU, with currency, positive integer quantity range, four-decimal unit price, status, and UTC effective interval.
- Resolution: override before client-specific before base; within a kind, SKU-specific before product-level; then the highest applicable minimum quantity.
- Effective intervals include the start and exclude the end. Overrides require an end. Clients cannot request an arbitrary historical/future evaluation time.
- Future, expired, and inactive rules never apply. Currency does not silently fall back. No applicable price is represented by null, not zero.
- Overlapping active rules at the same target/kind/currency/minimum tier are rejected. Per-seller transaction locks protect concurrent writes.
- These are informational catalog prices, not order quotes. Future ordering will require authoritative price snapshots, monetary rounding/tax rules, and revalidation at order creation.

## Local commands

Use `npm.cmd` on Windows (`npm` elsewhere):

```text
npm.cmd run test:security:local
npm.cmd run test:security:local -- --phase3d
npm.cmd run typecheck
npm.cmd run lint
node supabase/tests/run-local-app.mjs --build
```

The local application helper supplies local Supabase values in memory, overriding any hosted values in environment files. The full runner executes all prior suites before Phase 3D. The new suite uses real authenticated local API calls; the service role only provisions/cleans controlled fixtures and verifies otherwise-private state.

Optional `--phase3d --keep-phase3d` retains disposable fixtures and prints random LOCAL test logins for browser checks. Do not commit these credentials. A local-only database reset removes retained fixtures; the default test path cleans up its own fixtures. Never use login/link/push/linked flags or hosted environments for this workflow.

## Verification record

Final status: **PASS**, verified locally on 2026-08-28. A clean `supabase db reset --local` applied all eight migrations. Read-only SQL confirmed those eight migration versions and RLS enabled on all three new tables. SHA-256 checks matched the seven locked migrations to their values at the start of this phase.

| Check | Result |
| --- | --- |
| Phase 1 | PASS — 10 checks |
| Phase 2A | PASS — 10 checks |
| Phase 2B | PASS — 10 checks |
| Phase 3A, including edit security | PASS — 13 checks |
| Phase 3B | PASS — 19 checks |
| Phase 3C | PASS — 54 checks |
| Phase 3D | PASS — 87 checks |
| Local type generation | PASS |
| Typecheck | PASS |
| ESLint | PASS — no warnings/errors |
| Production build using local settings | PASS |

The final complete regression command exited zero: **203 checks passed**. No regression was skipped, disabled, or removed. Phase 3D covers tenant isolation, explicit grants/no hierarchy inheritance, hidden and inactive entries, cross-client prices, supplier/acquisition-cost confidentiality with populated fixtures, separated catalog/pricing permissions, base/client/SKU/tier/override precedence, future/expired/inactive rules, malformed inputs, concurrent overlap denial, suspended users/memberships, inactive organizations, anonymous users, super-admin behavior, trusted audit events, and no inventory ownership/stock changes.

Issues corrected during implementation: the private RLS predicate needed authenticated execute permission to support policy evaluation; test cleanup needed child-before-parent organization deletion; the catalog-only test role needed its required description. A restricted-column SELECT denial is asserted as SQLSTATE 42501, with a separate non-cost-column row-denial assertion. These fixes did not loosen data visibility or remove security checks. The final run passed after the fixes.

Local browser checks completed: create a catalog assignment; load/edit/hide it; create/load/edit a price; search assignments; client catalog visibility; quantity-tier preview; hidden-entry exclusion; client denial from the administration route. These used real local logins and Server Actions, not mocked requests.

Browser checks informed the permission-aware forms and company-scoped form keys. The final supplemental permission flags were checked through the real API, generated types, and build, rather than another exhaustive browser pass.

## Files changed in this phase

- New: `supabase/migrations/20260829010000_phase3d_client_catalog_pricing.sql`.
- New: `supabase/tests/phase3d-client-catalog.mjs`.
- New: `src/lib/client-catalog/actions.ts`.
- New: `src/app/(app)/client-catalog-admin/page.tsx`.
- New: `src/app/(app)/client-catalog/page.tsx`.
- New: `docs/phase3d-client-catalog.md`.
- Updated: `supabase/tests/run-local-security-tests.mjs`, `src/config/navigation.ts`, `README.md`.
- Regenerated locally: `src/types/database.ts`.

Pre-existing repository changes were preserved. No package installation, commit, remote Supabase operation, or later-phase development was performed. Next-generated temporary `AGENTS.md` and `CLAUDE.md` were removed during cleanup; no pre-existing instruction files were removed. The source credential scan found no embedded privileged Supabase key/JWT, and environment files remain Git-ignored.

## Scope limits and follow-up

- No hosted/staging/production environment was used. Hosted deployment/cookie behavior, external invitations/delivery, storage, and hosted recovery need separate non-production validation before production.
- Browser coverage is a smoke test, not an exhaustive automated browser matrix. Database tests exercise authorization, effective dates, concurrency, and confidentiality directly. Date tests use past/future fixtures, not a mocked clock or waiting for scheduled activation.
- Super-admin connection forms, every date/status/role combination, and adversarial Server Action submissions were not all browser-tested. The underlying authorization/mutation paths were exercised through authenticated API tests. Existing Phase 3C expiry test 53 simulates elapsed time by backdating a local fixture; existing quality-document tests cover metadata, not actual file storage. External invitation email delivery and hosted redirect behavior were not tested end-to-end.
- Before production: improve client selectors with authorized display names, paginate/search large product/SKU selectors, expand browser/accessibility coverage, add operational rate limits/monitoring, and establish privileged audit-retention/recovery procedures.
- Current administration requires catalog-management authority to enter the page, plus pricing authority to use price forms. A standalone pricing-only workspace can be added later if needed.
- Future improvements: finer-grained locking at high write volume, bulk assignments, reusable price lists, and restricted price-revision snapshots for richer financial forensics. Client-specific roles, orders, checkout, taxes, shipping, payments, and branding remain outside this phase.

**BLOCKERS:** none identified for locking this local phase. Production readiness is a separate gate; the before-production items above remain open.

**NEXT PHASE SAFE TO LOCK: YES**
