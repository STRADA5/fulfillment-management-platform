# Fulfillment Management Platform

The secure multi-tenant fulfillment platform currently includes the Phase 1 foundation through Phase 5D: authentication, tenant and permission administration, catalog and inventory, procurement/QC, client/customer access, order intake and allocation, fulfillment, shipping, notifications, returns, billing, salesperson attribution, commissions, pricing tiers, reporting, configurable multi-role client relationships, and the Knowledge Library & Tools framework.

## Technology stack

- [Next.js](https://nextjs.org/) with the App Router
- React and TypeScript
- Tailwind CSS
- ESLint
- Supabase JavaScript and server-side rendering packages
- npm

## Local development

Requirements: a current Node.js LTS release and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Additional quality commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:security:local
```

## Environment variables

Copy `.env.example` to `.env.local` and provide the URL and publishable key for the intended local or non-production Supabase project. Keep the service-role key server-only.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The public landing page does not require these values, but authentication and protected routes do. Supabase utilities validate them when used.

> **Security warning:** Never commit secrets or populated environment files to Git. Only variables intentionally prefixed with `NEXT_PUBLIC_` may be included in browser code. `SUPABASE_SERVICE_ROLE_KEY` is used only by the trusted user-invitation server boundary and must remain server-only. Database passwords and other privileged credentials must never enter browser code.

## Architecture

The project uses the Next.js `src` and App Router structure. Shared infrastructure lives under `src/lib`; Supabase browser, authenticated server, and privileged server-only clients have separate entry points. Protected routes combine server-side permission checks with database RLS. Membership and role-permission mutations execute as the authenticated actor through guarded, audited database functions; the privileged client is limited to Supabase Auth invitation operations.

`npm run test:security:local` requires the local Supabase stack and refuses non-loopback API URLs. It runs every Phase 1 through Phase 5D security/integrity suite in order. Fixtures are disposable local data; never use this runner against a hosted project. The local migration chain includes the forward-only Phase 1 security hardening migration immediately after the immutable Phase 1 foundation.

## Client/customer foundation (Phase 3E)

`/clients` provides trusted client onboarding and explicit provider/customer-data service grants; `/customers` provides permission-scoped customer contact, address, and lifecycle administration. Customer ownership is immutable. Neither catalog access nor a parent organization relationship grants customer access. Service grants require both an explicit capability and the user's corresponding permissions. These workflows do not reserve, allocate, or modify inventory.

See [Phase 3E architecture and final verification](docs/phase3e-verification.md) for local commands, permission boundaries, address history, verification results, and remaining production follow-up.

## Order intake and verification foundation (Phase 4A)

`/orders` supports authorized intake, server-generated annual order numbers, quantity-tier price resolution, immutable client/customer/address/product/price snapshots, and an automatically issued initial verification record. Order access is a separate explicit service capability; catalog access, customer access, and organization hierarchy do not confer order authority. Phase 4A performs no inventory reservation, allocation, or deduction.

See [Phase 4A architecture and final verification](docs/phase4a-verification.md). Later order execution, shipping, notifications, returns, and financial workflows are covered by the completed Phase 4B–5A implementation and [verification record](docs/phase4c-5a-verification.md).

## Client catalog visibility and selling prices (Phase 3D)

Internal administration is at `/client-catalog-admin`; the read-only client catalog is at `/client-catalog`. A super-admin first establishes an explicit fulfillment-company/client connection. Authorized company administrators can then publish individual products/SKUs and manage effective-dated selling prices. Parent/child organization relationships do not publish catalog items. Product grants do not implicitly grant their variants, and neither grants nor prices transfer inventory ownership.

Clients receive only approved public descriptions, explicitly published SKUs, and their currently applicable selling prices. Supplier data, acquisition costs, stock, warehouses, and QC details are not included. See [Phase 3D architecture and verification](docs/phase3d-client-catalog.md) for pricing precedence, tests, and limits. Order intake is implemented separately in Phase 4A.

## Operational and financial workflows (Phases 4B–5A)

The recovered implementation includes inventory reservations and FEFO allocation (4B), picking, split shipments and dispatch (4C), carrier-neutral shipping and tracking (4D), immutable addendums and continuation shipments (4E), client-safe notifications and discrepancy cases (4F), replacements, returns, RMAs and reconciliation (4G), and invoices, payments, credits, refunds, statements, and immutable financial history (5A). See the [Phase 4C–5A verification record](docs/phase4c-5a-verification.md).

## Salespeople, commissions, pricing tiers, and reporting (Phase 5B)

`/salespeople` provides provider-only salesperson dashboards, client assignment, commission rules, lifecycle transitions, and payout tracking. `/pricing-tiers` manages configurable tiers and effective-dated tier prices. `/reports` supports authorized monthly/yearly company, client, and salesperson reports. Assignment and pricing are snapshotted into future order/commission history; client order views never expose provider commission data. Phase 5B adds 26 local security, attribution, pricing, lifecycle, payout, confidentiality, and tenant-isolation checks; see [the Phase 5B verification record](docs/phase5b-verification.md).

## Multi-role client relationships (Phase 5C)

`/client-relationships` provides provider administration for composable client capabilities, product/inventory ownership relationships, and separate client affiliate/referral relationships. A client organization can combine wholesale purchasing, provider or self-fulfillment, direct-to-customer fulfillment, client-owned or distributor-owned products, supplier/brand partnership, affiliate participation, and future service capabilities without becoming a rigid account type. Salesperson attribution remains separate from client affiliate attribution; the two commission ledgers, lifecycle histories, payout records, and confidentiality boundaries are independent. Phase 5C adds 21 local security, capability, ownership, attribution, concurrency, referral payout, audit, confidentiality, and tenant-isolation checks; see [the Phase 5C verification record](docs/phase5c-verification.md).

The intended architecture is a multi-tenant SaaS fulfillment platform deployed on Vercel, with Supabase providing PostgreSQL, authentication, storage, and backend services. See [the security model](docs/security-model.md) and [migration instructions](supabase/README.md) before connecting a project.

## Release baseline and staging readiness (Phase 6)

Phase 6 consolidates the recovered implementation into a traceable release baseline and prepares, but does not yet connect, a separate hosted non-production staging environment. The local verification record, migration manifest, environment template, CI gates, synthetic-data policy, backup/restore procedure, and staging runbook are documented in [the Phase 6 verification record](docs/phase6-verification.md), [the Phase 6 release baseline](docs/phase6-release-baseline.md), [the migration manifest](docs/migration-manifest.sha256), and [the staging runbook](docs/phase6-staging-runbook.md). Production credentials, production data, live integrations, and production resources remain prohibited.

## Knowledge Library & Tools (Phase 5D)

`/library` provides provider-controlled protocols, research/reference materials, extensible sections/categories/tags, version history, approval and publishing lifecycle, audited print/download delivery, and explicit client-safe sharing. Calculator support is a metadata-only plugin framework for external or future native engines: manifests, validated input/output/unit schemas, approved protocol/data-source links, lifecycle, checksums, permissions, and salesperson-owned personal templates are supported, but no calculator executes and no dosing is prescribed by this phase. Provider-owned library tables are not directly readable by authenticated clients; delivery is permission-checked and client metadata is redacted. See [the Phase 5D verification record](docs/phase5d-verification.md).

## Authentication setup

Public self-registration is disabled at the application level. Create or invite users through a trusted Supabase administrative process. Configure the Supabase Auth site URL and allowed redirect URLs for local, preview, and production deployments so password recovery can return to `/auth/callback?next=/reset-password`.

Database changes are not applied automatically. Follow [the Supabase migration and bootstrap instructions](supabase/README.md) against a non-production project first.
