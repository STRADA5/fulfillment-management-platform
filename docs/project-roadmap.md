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

## Phase 8A — Client-level automatic compound discount and order-calculation consistency

This future pricing enhancement extends the completed Phase 3D client-catalog pricing and Phase 4A order-snapshot foundations. It is a separate post-Phase 7 implementation phase and does not alter the current Phase 7 authorization/security correction. It should be completed before subscription billing so invoices and access-related commercial reporting consume the same authoritative order amounts.

### Client and product discount controls

- Give each client organization an optional persistent default discount percentage with enabled/disabled state, optional effective start, optional expiration, administrator override, and complete audit history.
- Apply an eligible client's default discount automatically when that client places an eligible order; no coupon or discount code is required.
- Add an administrator-controlled product-level flag such as `eligible_for_client_discount` so a product can opt out even when the client has a default discount.
- Limit the discount to eligible compound/product line items. Medical supplies, accessories, shipping, taxes, service charges, packaging charges, and every other explicitly excluded non-compound category must remain undiscounted.
- Permit only authorized provider/administrator users to create or change client discount settings. Clients must not modify their own discount.

### Centralized pricing and record consistency

- Define and enforce one server-authoritative calculation order for catalog/cart, checkout, order creation, invoice generation, processor-facing line items, transaction history, reporting, and salesperson commission calculations where commissions use product revenue.
- Record normal client price, automatic discount percentage, discount amount, final line-item price, and source reason `CLIENT DEFAULT DISCOUNT` in internal order/invoice history.
- Preserve the existing processor-facing SKU-only product-description design. Send the correct discounted amount to the processor without exposing the internal product name.
- Keep pricing calculations tenant-isolated, deterministic, fixed-precision, idempotent, concurrency-safe, and auditable. Discount changes must not rewrite historical order, invoice, processor, or commission snapshots.
- Use additive, forward-only schema/RLS/RPC work. Model client settings and product eligibility explicitly rather than embedding discount state in coupon-only or rigid account-type structures.

### Required validation

- Test eligible compound discounting, excluded compounds, medical-supply exclusion, accessory exclusion, shipping exclusion, no-discount normal pricing, product-level opt-out precedence, disabled/expired discounts, cross-client isolation, and authorized administrator-only controls.
- Prove cart/checkout/order/invoice totals agree, processor-facing amounts equal the authoritative final internal amounts, SKU-only descriptions remain intact, and salesperson commission revenue uses the defined discounted basis where applicable.
- Add audit, tenant-isolation, authorization, concurrency, idempotency, refund/cancellation, and historical-snapshot regression coverage before the phase is locked.

This phase depends on Phase 3D pricing, Phase 4A order snapshots, Phase 5A financial records, Phase 5B commission snapshots, and the Phase 6–7 release/staging gates. It is not part of the current Phase 7 implementation scope.

## Phase 8 — Hosted Subscription Billing, Invoicing & Delinquency Access Control

This phase adds the commercial foundation for organizations that subscribe to the hosted platform while preserving the separate outright-purchase/white-label model. Subscription access billing must remain distinct from customer order billing, salesperson commissions, and affiliate commissions, while integrating with each where business relationships and historical reporting require it.

### Commercial and billing capabilities

- Represent the commercial mode for an organization as a configurable entitlement/relationship: outright platform purchase/white-label or hosted recurring subscription; do not force either model into an incompatible rigid account type.
- Configurable subscription plans, recurring monthly platform access fees, per-client billing terms, plan changes, exemptions, arrangements, and effective dates.
- Automated invoices/statements with controlled invoice numbering, immutable history, due dates, payment status/history, downloadable invoice artifacts, and client invoice views.
- Payment-provider integration contracts, webhook/event ingestion, idempotent payment reconciliation, and a provider-neutral ledger; live payment providers and production credentials require later non-production and production gates.
- Configurable grace periods, late fees, payment reminders, overdue notices, and late-payment notices with delivery/audit evidence.
- Administrator billing dashboard and client billing/invoice view with least-privilege financial confidentiality.

### Delinquency and restoration controls

- Effective-dated, configurable delinquency states with a warning stage before restriction, a restricted state that can prevent new orders/actions while preserving appropriate account visibility, and a broader suspension state after a configured threshold.
- Never delete an organization or business records for nonpayment. Preserve orders, inventory history, commissions, affiliate attribution, salesperson attribution, messages, audit records, invoices, and related history during restriction or suspension.
- Preserve essential administrative, compliance, support, and data-export access according to policy rather than applying an indiscriminate data lockout.
- Support automatic restoration after qualifying payment when configured, administrator manual restoration, administrator override, late-fee waiver, grace-period extension, payment arrangements, and client-specific exemptions.
- Record complete audit history for billing status changes, notices, restrictions, overrides, waivers, extensions, arrangements, restorations, reconciliation, and payout/access decisions.

### Integration and safety gates

- Integrate subscription status with Phase 5C client organizations and service capabilities without overwriting role relationships or deleting business history.
- Keep salesperson attribution/commission snapshots and external affiliate/QR attribution/commission snapshots independent from subscription billing; neither attribution may overwrite the other on an order or invoice-related report.
- Reuse Phase 5A payment/refund/audit primitives where appropriate, with separate immutable subscription-invoice and access-status history.
- Integrate with the notification architecture, mobile API/service-layer contracts, Knowledge Library/tools permissions where access policy applies, and the future training/documentation program.
- Require tenant-isolated, server-side permission and RLS/RPC enforcement for billing data; commission, affiliate, provider, and client billing information must be confidential to authorized users.
- Before schema implementation, define plan/term versioning, invoice numbering ownership, tax/legal requirements, payment-provider boundaries, idempotency/reconciliation rules, state-transition policy, export access, retention, and recovery behavior. All later schema work is additive and forward-only.

### Required validation and deployment gates

- Test plan selection and effective-dated terms, invoice numbering/history, due dates, provider events, idempotent reconciliation, late-fee/reminder/notices, delinquency transitions, new-order/action restrictions, preserved visibility/export access, restoration and overrides, arrangements/exemptions, audit completeness, tenant isolation, confidentiality, concurrency, and non-deletion of historical records.
- Validate synthetic-only non-production provider/payment/email workflows before any production integration. Production data, credentials, payment providers, and customer notifications remain prohibited until explicitly approved by later release gates.

This phase depends on the Phase 5A financial primitives, Phase 5B salesperson commission snapshots, Phase 5C client organizations and separate attribution relationships, Phase 4F notifications, and Phase 6–7 release/staging readiness. It is not part of the current Phase 7 implementation scope.

## Phase 9 — External Affiliate / Referral Program & Campaign Attribution

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

## Phase 10 — Mobile platform readiness and application distribution

This phase prepares the platform for future Apple iOS and Android/Google Play applications. Native mobile applications are not part of the current Phase 7 or Phase 8 implementation.

- Establish API/service-layer boundaries so web and mobile clients reuse backend business logic rather than duplicating authorization or financial rules in UI code.
- Reuse the existing authentication, authorization, tenant isolation, role model, and permission vocabulary with web/mobile parity.
- Define mobile-safe session, refresh, revocation, device, and deep-link flows without exposing service credentials.
- Make dashboards and critical workflows responsive, accessible, and usable from mobile clients.
- Preserve referral-link and QR attribution across mobile deep links and app/browser handoff.
- Prepare push-notification contracts, consent/preferences, event routing, observability, and provider abstractions where appropriate.
- Define API versioning, compatibility, error contracts, rate limits, abuse controls, and mobile-specific security tests before app-store distribution.

Native iOS/Android builds, store accounts, store submissions, production push providers, and production mobile credentials remain deferred until the service contracts and non-production validation are complete.

## Phase 11 — Training, documentation, and enablement

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
- Hosted subscription setup and plan administration.
- Invoicing, statements, making and recording payments, and billing troubleshooting.
- Late fees, grace periods, reminders, overdue/late notices, and account restriction states.
- Administrator billing controls, overrides, waivers, extensions, payment arrangements, and restoring suspended accounts.
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
2. Phase 8A — Client-level automatic compound discount and order-calculation consistency.
3. Phase 8 — Hosted Subscription Billing, Invoicing & Delinquency Access Control.
4. Phase 9 — External Affiliate / Referral Program & Campaign Attribution.
5. Phase 10 — Mobile platform readiness and application distribution.
6. Phase 11 — Training, documentation, and enablement.

There are 11 top-level phases in the revised roadmap. Counting the established lettered subphases individually, the roadmap contains 25 detailed phase/subphase entries through Phase 11.
