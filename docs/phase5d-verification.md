# Phase 5D local verification

Phase 5D is implemented as the additive migration `20260910010000_phase5d_knowledge_library_tools.sql`. Verification uses the local Supabase stack only; no remote project or hosted service is contacted.

## Implemented foundation

- Extensible provider-owned library sections, categories, tags, protocol/research/resource items, metadata, client-safe flags, effective-dated share grants, and delivery events.
- Immutable version records with draft, review, approved, published, and archived lifecycle transitions, content hashes, approval history, and audit events.
- Permission-controlled provider, fulfillment, salesperson, and client views. Client delivery is explicit, published, client-safe, tenant-scoped, and redacts internal document/source metadata.
- Print and download routes use the guarded delivery RPC and append delivery/audit history.
- Calculator plugin registration supports external and native future engines, versioned manifests, validated input/output/unit schemas, approved protocol/data-source links, checksums, lifecycle, and non-authoritative dosing modes only.
- Salesperson personal calculator configurations are owner-scoped and can reference only published plugin versions; they cannot alter engines, protocols, approvals, or security controls.

## Verification results

| Check | Result |
| --- | --- |
| Clean local database rebuild through Phase 5D | PASS |
| Phase 1–5D regression/security suite | PASS |
| Focused Phase 5D suite | PASS — 18 checks |
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Production build | PASS |
| Local app build workflow (`run-local-app.mjs --build`) | PASS |

The focused suite covers extensible navigation, categories/tags/search, lifecycle/approval/version history, salesperson restrictions, client-safe sharing and redaction, print/download audit history, cross-tenant isolation, direct-table denial, calculator plugin lifecycle/schema constraints, approved source links, personal configuration ownership, and audit coverage.

Calculator execution, peptide/reconstitution calculations, dosing authority, hosted deployment, external storage/provider integration, and Phase 6 release-baseline work remain deferred.
