# Project Roadmap

This roadmap reflects the repository state at the Phase 6 local release baseline (`f8e3547`). It is planning documentation only; future phases below are not implemented by this document.

## Completed foundation

- Phases 1–5A: core platform, tenant isolation, fulfillment, inventory, ordering, shipping, reporting, and release-tested security foundations.
- Phase 5B: salesperson attribution, configurable salesperson commissions, immutable snapshots, lifecycle and payout tracking, pricing tiers, dashboards, and reporting.
- Phase 5C: extensible multi-role client organizations, effective-dated capabilities and relationships, client-owned/distributor-owned product relationships, direct-to-customer fulfillment, separate salesperson and client-affiliate attribution, independent commission ledgers/snapshots, payout history, confidentiality, and audit history.
- Phase 5D: Knowledge Library & Tools framework for protocols, research/reference materials, extensible categories, document versioning and approval, client-safe sharing, and calculator/plugin metadata. Calculator execution, including the separate peptide calculator, remains deferred.
- Phase 6: local release-baseline consolidation and hosted non-production database/security readiness. The unresolved Vercel automation-bypass issue remains a Preview testing-infrastructure issue, not a reason to weaken application security.

## Phase 7 — Hosted staging validation and production-readiness hardening

Phase 7 is the next implementation phase. It should complete controlled non-production hosted validation and the remaining release-readiness evidence without using production data or credentials. Its scope includes the approved staging test-user matrix, hosted smoke testing when the Preview tooling blocker is resolved, operational runbooks, monitoring/logging checks, backup/restore and rollback evidence, release gates, and final production-readiness decisions.

The Phase 6 Vercel automation-bypass problem remains a gated testing-infrastructure item. It must not be solved by weakening Deployment Protection or Production safeguards.

## Phase 8 — External Affiliate / Referral Program & Campaign Attribution

This phase adds an external affiliate-company/partner program in addition to the existing salesperson system and Phase 5C client referral relationships.

### Business capabilities

- Unique external affiliate accounts and stable affiliate IDs.
- Configurable affiliate commission rules, percentages, eligibility, effective dates, and approval controls.
- Multiple campaigns per affiliate, with unique referral links and generated QR codes tied to a specific affiliate and campaign.
- Durable referral-link/QR click or entry attribution that persists through customer/session identity and order creation.
- Independent order-level affiliate attribution that can coexist with salesperson attribution on the same order without overwriting either relationship.
- Affiliate commission calculation, immutable order-time snapshots, ledger entries, pending/approved/paid lifecycle, payout history, statements, and audit history.
- Refund, cancellation, and chargeback adjustments with traceable reversal/adjustment records rather than rewriting historical commission snapshots.
- Affiliate dashboard, administrative affiliate/campaign management, campaign performance, conversion, order, sales, commission, and payout reporting.

### Security and dependency gates

- Preserve the Phase 5B salesperson attribution and commission model as a separate relationship and ledger.
- Preserve the Phase 5C client-affiliate/referral relationship model; external affiliates must not be forced into incompatible rigid account types.
- Enforce tenant and relationship scoping so affiliates see only their own permitted links, campaigns, attributed orders, commissions, and statements; clients, salespeople, and unrelated users must not see affiliate-confidential financial data.
- Use server-side permission checks, RLS/RPC enforcement, immutable snapshots, concurrency-safe transitions/payouts, and complete audit events.
- Decide the external affiliate onboarding/identity model, attribution retention window, cookie/session policy, QR/link domain strategy, refund timing rules, and payout approval roles before schema implementation.

## Phase 9 — Mobile platform readiness and application distribution

This phase prepares the platform for future Apple iOS and Android/Google Play applications. Native mobile applications are not part of the current Phase 7 or Phase 8 implementation.

- Establish API/service-layer boundaries so web and mobile clients reuse backend business logic rather than duplicating authorization or financial rules in UI code.
- Reuse the existing authentication, authorization, tenant isolation, role model, and permission vocabulary with web/mobile parity.
- Define mobile-safe session, refresh, revocation, device, and deep-link flows without exposing service credentials.
- Make dashboards and critical workflows responsive, accessible, and usable from mobile clients.
- Preserve referral-link and QR attribution across mobile deep links and app/browser handoff.
- Prepare push-notification contracts, consent/preferences, event routing, observability, and provider abstractions where appropriate.
- Define API versioning, compatibility, error contracts, rate limits, abuse controls, and mobile-specific security tests before app-store distribution.

Native iOS/Android builds, store accounts, store submissions, production push providers, and production mobile credentials remain deferred until the service contracts and non-production validation are complete.

## Phase 10 — Training, documentation, and enablement

At platform completion, this phase creates the structured training program for YouTube, internal operations, and customer onboarding.

Deliverables must cover:

- Platform overview and getting started.
- Administrator training.
- Fulfillment and staff training.
- Wholesale client training.
- Salesperson training.
- Affiliate training.
- Inventory, receiving, and QC.
- Ordering and fulfillment.
- Shipping and tracking.
- Commissions and payouts.
- Reporting and analytics.
- Knowledge Library and Tools.
- Troubleshooting, security, and account management.

The production package must include written user guides, role-specific quick references, screen-recording shot lists, lesson scripts, voiceover and caption scripts, sequencing for training videos, accessibility review, version ownership, and update/retirement procedures.

## Cross-phase non-regression requirements

- Do not modify locked migrations. Any future schema change is additive and forward-only.
- Preserve tenant isolation, role/permission boundaries, commission confidentiality, auditability, concurrency protections, and independent salesperson/affiliate attribution.
- Keep synthetic-only staging data separate from production data and credentials.
- Require unit, integration, security, RLS/policy, authorization, concurrency, audit, regression, typecheck, lint, build, and appropriate hosted non-production tests for each implemented phase.
- Record release identity, migration manifests, rollback/recovery evidence, and deferred items before locking a phase.

## Revised sequence and phase count

The next phase is Phase 7. The remaining sequence before production launch is:

1. Phase 7 — Hosted staging validation and production-readiness hardening.
2. Phase 8 — External Affiliate / Referral Program & Campaign Attribution.
3. Phase 9 — Mobile platform readiness and application distribution.
4. Phase 10 — Training, documentation, and enablement.

There are 10 top-level phases in the revised roadmap. Counting the established lettered subphases individually, the roadmap contains 23 detailed phase/subphase entries through Phase 10.
