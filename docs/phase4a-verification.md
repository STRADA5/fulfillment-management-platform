# Phase 4A — Order intake, snapshots, and verification

## Final result

**PASS.** A clean LOCAL rebuild applied all ten repository migrations. All 332 security/integrity assertions passed: 285 locked-phase assertions plus 47 Phase 4A assertions. Local database type generation, TypeScript checking, ESLint, the production build, and real browser workflow checks passed. No remote Supabase project was contacted or modified.

The only new migration is `20260831010000_phase4a_order_intake.sql`. The nine locked migrations retained their recorded SHA-256 values.

## Architecture

- Order authority is independent of catalog and customer authority. Client members need `orders.view`/`orders.create`; provider users need the same permissions plus an active explicit service relationship whose separate `order_access` is `read` or `manage`. Hierarchy and catalog connection alone grant nothing.
- Client users can submit authorized orders but cannot accept them. Provider `ADMIN` users require explicit `manage` order service access to accept/cancel. Only submitted-to-accepted/cancelled and accepted-to-cancelled transitions exist in Phase 4A.
- Submission accepts only client, customer, address, currency, catalog entry identifiers, integer quantities, and an idempotency key. The database reauthorizes every relationship and resolves current catalog/tier pricing. Browser prices are never accepted.
- Submitted records snapshot client, customer/contact, ship-to address, public product/SKU descriptions, quantity, resolved four-decimal unit price, currency, rounded line total, and pricing provenance. Authenticated direct writes/deletes are denied.
- Money uses fixed-precision PostgreSQL `numeric`. Calculation uses four-decimal unit prices and currency-aware final rounding (zero-decimal JPY/KRW, three-decimal BHD/JOD/KWD/OMR/TND, otherwise two decimals).
- Order numbers use `SVFC-ORD-YYYY-######` with a transactionally locked per-seller annual counter. Verification numbers use a separate non-resetting per-seller sequence in `SVFC-######-##`, avoiding collisions after annual order-number resets and supporting later shipment verifications.
- One successful transaction creates the order, lines/snapshots, initial verification (`-01`), lifecycle history, and trusted audits. Identical retries return the existing order; reusing a key for different content fails.
- The verification snapshot contains the approved future fields with shipment, tracking, cartons, warehouse verification, client-safe QC, ETA, and remaining lines explicitly unassigned. It contains no internal QC notes, supplier identity/cost, dispute, warehouse, or acquisition data.
- The UI provides order contexts, customer/address selection, authorized catalog, quantities/review, submission, lists/search/filter, immutable detail, verification data, lifecycle history, internal acceptance/cancellation, and super-admin service-capability administration.
- Phase 4A has no inventory mutation RPC. Tests compare balances, ledger transactions, and reservations byte-for-byte before/after order operations.

## Verification

| Suite | Result |
| --- | --- |
| Phase 1 | PASS — 10 |
| Phase 2A | PASS — 10 |
| Phase 2B | PASS — 10 |
| Phase 3A | PASS — 13 |
| Phase 3B | PASS — 19 |
| Phase 3C | PASS — 54 |
| Phase 3D | PASS — 87 |
| Phase 3E | PASS — 82 |
| Phase 4A | PASS — 47 |
| Total | **PASS — 332** |
| Local types / typecheck / lint / production build | **PASS / PASS / PASS / PASS** |

Phase 4A asserts catalog-only denial, explicit provider access, cross-client privacy, customer/address/catalog injection denial, price tampering denial, exact tier snapshots, master-data-change resilience, order/verification numbering, concurrent submissions, idempotency/payload matching, duplicate verification prevention, direct rewrite/deletion denial, status authority, service revocation, suspended/inactive/anonymous denial, restricted projection fields, inventory non-interference, trusted audit coverage, and PII-redacted audit metadata.

The repeatable command is `npm.cmd run test:security:local`; use `-- --phase4a` for only the new suite. `-- --phase4a --keep-phase4a` retains disposable local fixtures solely for browser testing and prints random local credentials; reset the local database afterward.

## Browser verification

A real local Auth session exercised `/orders`: authorized client context, customer/address selection, published product/SKU, displayed pricing, quantity review, Server Action submission, generated order `SVFC-ORD-2026-000004`, total `198.00 USD`, automatic verification `SVFC-000004-01`, snapshots, line detail, and lifecycle history. Client acceptance controls were absent as intended. The browser tab was closed and a final local reset removed all disposable fixtures.

This is a manual smoke workflow, not a maintained automated browser suite. The super-admin service-access form and provider acceptance button compiled and their RPCs were exercised through authenticated API tests, but were not both repeated in the browser. The first client-side detail-link click occurred while the dev route was compiling and did not navigate; direct navigation then rendered and verified the route. This did not affect the production build or database workflow.

## Files

Created:

- `supabase/migrations/20260831010000_phase4a_order_intake.sql`
- `supabase/tests/phase4a-orders.mjs`
- `src/lib/orders/actions.ts`
- `src/components/orders/order-intake-form.tsx`
- `src/components/orders/order-status-form.tsx`
- `src/components/orders/service-access-form.tsx`
- `src/app/(app)/orders/[id]/page.tsx`
- `src/app/(app)/orders/service-access/page.tsx`
- `docs/phase4a-verification.md`

Modified/regenerated: `src/app/(app)/orders/page.tsx`, `src/config/navigation.ts`, `src/types/database.ts`, `supabase/tests/run-local-security-tests.mjs`, and `README.md`. No package was installed. Existing unrelated dirty/untracked work was preserved.

## Remaining issues

### BLOCKERS

None found within Phase 4A and completed LOCAL verification.

### SHOULD FIX BEFORE PRODUCTION

- Add maintained browser E2E coverage for all form roles/statuses, service access, accessibility/mobile behavior, and adversarial Server Action posts.
- Complete hosted non-production validation, rate limits, monitoring, PII/audit retention, backup/restore, and incident procedures.
- Make `SVFC` configurable before another fulfillment brand; confirm currencies/rounding through an authoritative supported-currency policy.
- Add privileged out-of-band snapshot protections and correction procedures; authenticated application roles are already denied.
- Replace the bounded 100-item intake projection with scalable search and authoritative quantity-aware preview. Submission already resolves the final tier.
- Add denied-operation security telemetry and broader rollover, revocation/submission, capacity, and load concurrency testing.

### FUTURE IMPROVEMENTS

- Phase 4B: reservations, lot/location allocation, FEFO, backorders/preorders, and demand queues.
- Later phases: addendums, split planning, picking, packing, dispatch, shipping charges, tracking, carriers, notifications, exceptions, replacements, invoices, and payments.

PHASE 4A SAFE TO LOCK: YES
