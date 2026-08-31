# Phase 4B — Inventory Reservations and Lot Allocation

Phase 4B connects submitted orders to trusted inventory without implementing fulfillment execution. It adds additive database support for lot-level reservations, FEFO allocation, partial allocation, explicit backorder/preorder demand, cancellation release, automatic oldest-first demand allocation, and client-safe allocation summaries.

## Security and integrity boundaries

- Allocation mutations execute through authenticated, authorization-checked database functions.
- Inventory changes use the existing append-only inventory ledger; reservations move quantity from available to reserved without reducing physical quantity.
- Eligible lots must be available, unexpired, within BUD and minimum shelf-life constraints, and in active warehouse locations.
- Internal lot, warehouse, supplier, cost, and QC data is not exposed through the client allocation summary.
- New availability processes eligible demand under transaction locks and deterministic priority ordering.
- Cancellation first makes the order ineligible for automatic allocation, then releases reservations atomically.

## Local verification

Final LOCAL verification: **PASS — 29 checks**. The complete Phase 1–5A regression runner passed after a clean database rebuild using the immutable Phase 1 migration plus the forward-only security hardening migration.

Run the complete regression suite against the project-scoped local Supabase stack:

```powershell
npm.cmd run test:security:local
```

Run only Phase 4B while developing:

```powershell
npm.cmd run test:security:local -- --phase4b
```

No remote Supabase project is required or permitted by the test runner; it refuses non-loopback API URLs.

Phase 4B preserves physical inventory, uses ledger-backed reservations, excludes ineligible lots, processes backorders deterministically, supports preorders, releases cancellation reservations atomically, and exposes only client-safe allocation summaries.
