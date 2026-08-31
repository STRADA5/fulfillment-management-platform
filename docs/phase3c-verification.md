# Phase 3C local verification checkpoint

Verified August 28, 2026. **PHASE 3C PASS** for the local foundation described below. No Phase 3D/4 work or remote Supabase operations were performed.

## Results

| Check | Final result |
| --- | --- |
| Clean local migration rebuild | PASS (all seven migrations, exit 0) |
| Phase 1 | PASS, 10/10 |
| Phase 2A | PASS, 10/10 |
| Phase 2B | PASS, 10/10 |
| Phase 3A | PASS, 9/9 plus 4/4 edit/security tests |
| Phase 3B | PASS, 19/19 |
| Phase 3C | PASS, 54/54 |
| Tenant isolation | PASS |
| Procurement / receiving integrity | PASS |
| QC / quarantine / release integrity | PASS |
| Supplier identity / supplier-cost confidentiality | PASS |
| TypeScript | PASS |
| ESLint | PASS |
| Production build | PASS |

Final automated total: **116 passing checks**. Earlier failed attempts were investigated, not counted as passes: local Docker resource/health failures; missing supplier permission in the authorized fixture; retained disposable roles affecting the fixed-role regression assertion; and a lint error in date calculation. No security assertion was removed or relaxed.

## Security corrections

- A shared ledger guard covers the existing receiving, adjustment, transfer, reservation, damage, quarantine and release callers. QC-controlled inventory cannot gain availability through legacy receipt, positive adjustment, generic quarantine release, a forged reservation, or eligibility-changing lot edits.
- Procurement receipts require QC server-side. A submitted checkbox cannot waive it. QC control is server-owned and persists once established.
- Receipt/lot relationships, quantities and existing expiration/BUD values are validated. QC inspection capacity and cumulative partial releases are serialized and bounded.
- `qc_release_events` preserve release history without rewriting inspections. `qc_hold_decisions` provide an independently audited approval/rejection path for later operational holds, bounded by the original quarantine transaction.
- Receiving headers/lines, QC inspections and quality decision events deny authenticated history changes. Ledger and balance direct writes remain prohibited.
- Supplier-sensitive procurement reads and mutations also require `suppliers.view`; the default ADMIN role was not given that permission. Tests use a disposable explicitly authorized global test role, removed during cleanup.
- Warehouse receiving has a separate non-supplier/non-cost work projection.
- Purchasing, receiving, QC, quarantine/release, supplier exceptions/credits and quality-document changes use trusted audit events. The Phase 3A supplier audit-metadata redaction regression still passes.
- Expired/BUD-ineligible, rejected and recalled stock cannot gain availability through the guarded paths. Quarantined stock is excluded from availability; QC-controlled accepted stock reaches availability through authorized quality release logic. Transfers/reservation release preserve already-approved stock rather than creating approval.
- Legacy non-QC inventory remains supported for Phase 3B compatibility. Product-specific QC policy configuration is deferred; all procurement receipts currently require QC.

## Phase 3C test inventory

All of the following passed in the final run:

1. Purchase-order idempotency.
2. Procurement relationship integrity.
3. Cross-tenant procurement denial.
4. Partial and duplicate receiving.
5. Damage/rejection inventory-state separation.
6. QC authorization and release.
7. Expired release denial.
8. Documents and supplier replacement-resolution lifecycle.
9. Tenant/client/anonymous isolation.
10. Cost and inactive-context controls.
11. Trusted Phase 3C audit events.
12. Direct mutation denial.
13. Generic quarantine release cannot bypass QC permission.
14. Legacy receipt cannot introduce approved QC stock.
15. Positive adjustment cannot mint approved QC stock.
16. Receipt input cannot waive QC.
17. Lot editing cannot extend controlled expiry.
18. Receipt cannot overwrite existing lot dates.
19. Receiving/QC/release/ledger direct deletion denied.
20. Concurrent inspection approval capacity.
21. Concurrent partial release capacity.
22. Cumulative partial release accounting.
23. Inspection history preserved after release.
24. Approved-stock transfer succeeds.
25. Transfer cannot exceed approved availability.
26. Approved reservation/release remains functional.
27. Forged reservation release denied.
28. Negative damage reversal denied.
29. Suspended actor QC mutation denied.
30. Anonymous QC release denied.
31. Warehouse supplier-identity disclosure denied.
32. Warehouse receiving work projection remains usable and non-sensitive.
33. BUD expiry independently prevents release.
34. Re-quarantine of approved inventory.
35. Unauthorized hold resolution denied.
36. Idempotent operational hold approval/rejection.
37. Duplicate hold resolution denied.
38. Hold decisions immutable.
39. Quality-document edit fields persist.
40. Documented over-receipt supported.
41. Failed-QC stock remains unavailable.
42. Lot editor cannot promote failed-QC stock.
43. Client cannot clear QC-control flag.
44. All new operational tables enforce cross-tenant RLS.
45. Default ADMIN lacks ungranted supplier authority.
46. Concurrent operational hold decisions serialize.
47. Concurrent PO submission creates one order.
48. Concurrent receiving counts once.
49. Invalid inspection lot relationship denied.
50. Inactive organization cannot release QC.
51. Credit lifecycle/repeated resolution preserve one claim.
52. Hold decisions/document edits/issue changes produce audit events.
53. Expiration reconciliation is ledger-based and idempotent.
54. Unauthorized expiry processing denied.

## UI verification and scope

- Browser-tested sign-in with a disposable local account.
- Browser-tested inbound shipment, quality-document and supplier-issue edit navigation, loaded values, submissions, success messages and persisted values after reload. This included shipment reference/carrier, document name/type, issue description/status and credit amount.
- Inspected QC and quarantine forms, queues and immutable-history navigation in the browser.
- Added PO-line edit navigation/form, receiving/QC read-only detail routes, operational work queues, list search/status/supplier/product/warehouse filters where those authorized columns are present, permission-gated edit links, expiry-processing action and operational quarantine decision form.
- Receiving and QC inspections have no historical edit workflow. Corrections/state transitions are represented by subsequent audited operations.

## Migrations

Chronological repository migration chain:

1. `20260819010000_phase1_identity_and_tenancy.sql`
2. `20260823010000_phase2a_membership_administration.sql`
3. `20260823020000_phase2b_role_permission_administration.sql`
4. `20260825010000_phase3a_product_supplier_foundation.sql`
5. `20260825020000_phase3b_inventory_foundation.sql`
6. `20260826010000_phase3c_procurement_quality.sql` (existing Phase 3C migration)
7. `20260828010000_phase3c_qc_integrity_hardening.sql` (new in this continuation)

No locked Phase 1/2/3A/3B migration was edited by this continuation. Existing dirty/untracked repository work was preserved; this checkpoint is not a Git commit or claim that the worktree matches HEAD.

## Files changed in this continuation

New:

- `supabase/migrations/20260828010000_phase3c_qc_integrity_hardening.sql`
- `supabase/tests/run-local-app.mjs`
- `src/app/(app)/operations/page.tsx`
- `src/app/(app)/operations/history/[kind]/[id]/page.tsx`
- `src/app/(app)/qc/quarantine/page.tsx`
- `docs/phase3c-verification.md`

Updated existing work:

- `supabase/tests/phase3c-procurement-quality.mjs`
- `supabase/tests/cleanup-phase3c-fixtures.mjs`
- `supabase/tests/run-local-security-tests.mjs`
- `supabase/tests/tenant-isolation.mjs` (failure diagnostics only; assertions preserved)
- `src/types/database.ts` (generated from local database)
- `src/lib/procurement/actions.ts`
- `src/components/catalog/catalog-list.tsx`
- `src/config/navigation.ts`
- `src/app/(app)/receiving/page.tsx`
- `src/app/(app)/qc/page.tsx`
- `src/app/(app)/inbound-shipments/page.tsx`
- `src/app/(app)/quality-documents/page.tsx`
- `src/app/(app)/supplier-issues/page.tsx`
- `src/app/(app)/purchasing/[id]/page.tsx`
- `src/app/(app)/operations/edit/[kind]/[id]/page.tsx`

No packages were installed in this continuation. No credentials were committed. The source scan found no embedded privileged key/JWT in the checked application, tests or documentation. The existing privileged Supabase client is server-only, and secret-bearing environment files are Git-ignored. The dev server generated temporary `AGENTS.md` and `CLAUDE.md`; those generated-only files were removed during cleanup and can be regenerated by Next. The temporary app server and browser tab were stopped/closed. Final local SQL checks confirmed all seven migration versions and zero remaining Phase 3C fixture organizations or test roles.

## Repeatable commands

```powershell
npm.cmd exec -- supabase db reset --local
npm.cmd run test:security:local
npm.cmd run typecheck
npm.cmd run lint
node supabase/tests/run-local-app.mjs --build
```

The build helper invokes the production Next build with settings sourced from local Supabase, avoiding accidental use of production environment settings. Without `--build`, it starts the local development app. Type generation used `supabase gen types typescript --local` and saved its successful output to `src/types/database.ts`.

The final clean rebuild and tests used the resource-reduced local stack:

```powershell
npm.cmd exec -- supabase start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

PostgreSQL, authentication, REST, the gateway and local mail service remained running. No health checks were ignored. Full-stack attempts had failed with resource/health timeouts; the reduced stack started successfully and its subsequent reset exited successfully.

## Limitations and remaining work

**BLOCKER:** None identified by the completed local security/regression checks. This is not a production deployment approval or an assertion of exhaustive security proof.

**SHOULD FIX BEFORE PRODUCTION:**

- Exercise all forms and role combinations in a hosted non-production environment, including browser-level receiving, inspection/release, operational hold decisions and PO-line edits. Those mutations were tested through authenticated local API calls and/or compiled/source-reviewed here; not every one was submitted end-to-end through a browser.
- Add maintained automated browser regression coverage and broader browser/mobile/accessibility testing. The three repaired edit workflows were browser-tested manually through automation, not added to a standalone browser test suite.
- Replace loaded-row-only filters/queues with complete server-side pagination/aggregation before datasets exceed the API row limit. Current tables disclose their loaded-row counts; large-volume completeness and load/soak behavior were not tested.
- Validate full optional-service startup on an adequately resourced local/hosted non-production environment. Storage upload/download, realtime delivery, Studio, edge-runtime and hosted deployment were not exercised. Phase 3C stores document metadata, not production files.
- Review global-role grants before onboarding real users. Default ADMIN does not inherit supplier visibility; grant supplier authority explicitly through the trusted super-admin workflow.

**FUTURE IMPROVEMENT:** Configurable product-specific QC requirements/waivers, scheduled expiry processing and alerts, tenant-customizable roles, richer human-readable selectors, and supplier-performance reporting derived from the retained procurement/receipt/QC/issue records. These were not introduced as later operational modules.

All database fixtures were synthetic. RLS/mutation requests used real independently authenticated local Supabase sessions; privileged access was used only for fixture setup/cleanup. Expiration test 53 deliberately backdated a local lot to simulate elapsed time. Concurrency tests used real overlapping requests, not mocked concurrency. No existing regression test was skipped or disabled. No remote Supabase project was contacted or modified.

PHASE 3C SAFE TO LOCK: YES
