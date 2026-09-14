# Administrator-controlled tenant branding and brand isolation

## Backlog identity and release scope

- **Backlog ID:** TENANT-BRAND-01.
- **Status:** specification recorded; implementation not started.
- **Business invariant:** ONE LICENSED TENANT ORGANIZATION = ONE ACTIVE APPROVED BUSINESS BRAND.
- **Recommended phase:** post-Phase 7 commercialization, coordinated with Phase 8 subscription/white-label entitlements and the Phase 8B document archive. Implement before offering this branding capability to additional licensed tenants.
- **Current-release impact:** none. This item does not add a Phase 7 launch gate, change acceptance evidence, authorize schema/runtime changes, or require another Preview deployment. Existing Phase 7 gates continue independently.
- **Scope reviewed:** repository foundations at `8094cdad51b2874383ac9ef2a241a368998bada0`. This is a source-inspection reference, not a new deployed-release identity or evidence of implemented branding controls.
- **Related planning:** [project roadmap](project-roadmap.md), [security model](security-model.md), and [Phase 7 acceptance framework](phase7-acceptance-framework.md).

This specification records the Release Owner's branding requirement. It does not approve unresolved commercial options, provision administrators, purchase domains/services, or alter credentials. Proposed entity, RPC and route names below are design contracts, not existing implementations.

## 1. Existing implementation versus required work

| Inspected foundation | What exists now | What must not be inferred |
| --- | --- | --- |
| `supabase/migrations/20260819010000_phase1_identity_and_tenancy.sql` | `organizations.branding` is object-valued JSON; organizations, memberships, roles and `branding.read` exist. | No approved/versioned brand schema, license constraint or active-brand lock is established by this JSON field. |
| `src/app/(app)/branding/page.tsx` and `src/config/navigation.ts` | `/branding` is a permission-protected **placeholder**, with a navigation entry using `branding.read`. | It is not an editor, request queue, approval workflow or tenant theme renderer. |
| `src/lib/auth/authorization.ts`, `src/lib/auth/role-policy.ts`, shell components | Authenticated organization context, role-aware permissions and authorized membership switching exist. The shell uses a generic platform title and fixed styling. | Displaying an organization name is not centralized approved-brand resolution. Membership switching is not a license/brand switcher. |
| `20260820010000_phase1_security_hardening.sql` and organization RPCs | Organization update grants include `branding`, name and contact fields, subject to existing authorization/RLS. Client-profile update paths also exist. | The future locked-brand invariant cannot rely on hiding an editor. Existing write paths must be reconciled before enabling locked branding. |
| Order/billing migrations and `/orders/[id]`, `/billing` | Order/customer/address and financial snapshots, issued financial records and history protections exist. | They do not establish immutable approved-brand snapshots. A financial page is not a complete branded PDF generator. |
| `/library/print` and `/api/library/delivery` | Permission/RPC-controlled version delivery exists: printable library content and a JSON attachment endpoint. | These are not a platform-wide branded PDF/document pipeline. |
| `src/lib/shipping/carriers.ts` | Local deterministic label references and carrier-adapter contracts exist. | Live branded carrier labels are not implemented; regulated carrier content must not be restyled arbitrarily. |

The existing `branding_label_services` client capability is not an entitlement to run another independent company or an alternative active tenant brand. These foundations can be extended forward-only; no architectural incompatibility requiring interruption of the current Phase 7 release was identified in this review.

## 2. Tenant, business and licensing boundary

1. A **licensed tenant** is the organization holding the platform workspace entitlement for one business brand. Map this explicitly to the organization/license model during implementation; do not assume every `client_company`, customer, department or salesperson is a separately licensed tenant.
2. An active onboarded licensed tenant has exactly one approved active brand. An unconfigured tenant may have none, but must remain in onboarding and cannot issue branded output using another tenant's brand or an unapproved draft.
3. Multiple historical versions and inactive requests are allowed. Multiple simultaneously active independent brands, tenant-facing brand selectors and per-user/per-order issuer-brand overrides are forbidden.
4. Switching between independently authorized memberships in separately licensed organizations remains legitimate. Every switch reauthorizes tenant context and invalidates prior tenant branding state; it cannot switch brands within one license.
5. Provider, customer, supplier, product and carrier names can remain factual counterparty information where already authorized. They must not become selectable substitute issuer/workspace identities. Branding must not grant visibility into supplier, cost, commission or other private data.
6. A proposed independent second company requires a separate tenant and applicable separate subscription/license. Platform Administration records that decision and refers to separate onboarding. No automatic reassignment of orders, clients, commissions, documents or licenses is part of this feature.
7. A legitimate rebrand preserves the same licensed business. The reviewer records the basis for this classification. Repeated requests to alternate businesses must be rejected, not treated as harmless theme changes. Software enforces platform identity selection; review and license policy address misrepresentation of the underlying business.

## 3. Approved profile contract

All identity-defining fields are versioned together and become immutable on approval. Surface-specific settings are representations of **the same approved business**, not independent identities.

| Group | Required fields and constraints |
| --- | --- |
| Business identity | Legal/business name; approved display/trade name; licensed tenant reference. Distinguish legal issuer identity from optional presentation name. |
| Assets | Primary logo; alternate/logo mark for the same brand; favicon. Store immutable, tenant-bound asset versions and content digests, not overwriteable public URLs. |
| Theme | Primary, secondary and accent colors; supported typography and theme configuration. Use validated tokens, accessible contrast and approved fonts; no arbitrary script, HTML or CSS execution. |
| Public business contacts | Business contact information, website, support contact and approved footer language. These are approved business-facing values, not private operator notification contacts. |
| Document identities | Invoice, report, packing-slip and customer-document identity configurations, all bound to the single business profile. No alternate independent issuer selection. |
| Salesperson/email identities | Salesperson-material and email identity configurations. Personal salesperson attribution may appear as authorized content, never as another company brand or another salesperson's private information. |
| Domain | Optional verified custom domain/subdomain mapping, subject to entitlement, exact-host ownership verification and security policy. No domain provisioning is authorized by this specification. |
| Commercial controls | White-label settings and the applicable platform-managed entitlement/policy version. Brand approval cannot create its own entitlement. |
| Lifecycle | Effective date/time, approval state, approver, approved timestamp, tenant-local version and superseded-version reference. Use server timestamps and UTC effective times. |

Validate field lengths, links, logo formats, image sizes and allowed template/theme values on the server. Submitted files are quarantined pending safe type/content inspection; reject executable/active content and cross-tenant asset references. Exact size limits and supported font/theme sets require implementation-time approval, not invented provider limits.

## 4. Workflow, locking and atomic activation

The required version lifecycle is:

`DRAFT -> PENDING APPROVAL -> APPROVED & LOCKED -> SUPERSEDED/ARCHIVED`

Requests additionally record rejected, revisions-requested, withdrawn or suspended decisions. These request outcomes never replace the currently active approved version.

| Operation | Authorized actor and required result |
| --- | --- |
| Initial onboarding | Authorized Platform Administrator configures and approves the tenant's first brand before branded operation is enabled. |
| Draft/request | A permitted tenant user uploads proposed assets, provides a reason and edits only the request draft. Submission freezes the reviewed revision and its digest. |
| Preview | An authorized requester/reviewer previews the inactive proposal with a clear draft watermark. It cannot send customer email, issue a transaction document or change live tenant pages. |
| Review | Platform reviewer compares current and proposed versions, verifies assets/entitlement and classifies legitimate rebrand versus separate business. |
| Revisions/rejection | Record reviewer, decision and reason. A revision creates a new request revision; rejected or suspended content remains inactive. Existing active branding is unchanged. |
| Approval | Approval applies to the exact submitted revision/digest, never to subsequently editable data. Immediate activation swaps the active version atomically. |
| Scheduled approval | Approved future content remains locked but inactive until its effective time. There is only one active version; scheduled changes are not alternate selectable profiles. Activation rechecks lock, suspension, entitlement and expected prior version. |
| Supersession | The previous version becomes historical, not editable or deleted. Preserve immutable content and activation history. |
| Platform override/revert | Platform Super Administrator can lock, suspend pending activation, reject, manage entitlement and revert. Revert creates a new audited activation/version referencing the last approved content; it never rewrites past versions or document snapshots. |

**Concurrency and fail-closed requirements:**

- Serialize activation per licensed tenant with a database row lock and expected-current-version/revision check. Two parallel approvals cannot leave two active brands or silently overwrite each other.
- Maintain one tenant-state row with one active-version pointer, a same-tenant composite foreign key and database-enforced lifecycle consistency. Enforce at most one current activation and non-overlapping effective activation intervals. UI-only checks are insufficient.
- Supersede the old active version, activate the new version and append the audit event in one transaction. Failure rolls back all three; an onboarded tenant must not be left with zero active brands.
- Reject stale approval/retry payloads; use idempotency keys so network retries do not activate twice. A scheduled action whose expected prior version changed requires review rather than overwriting a newer decision.
- Tenant identity-defining fields remain locked even when no request is pending. Restrict legacy direct organization/branding writes and any identity-editing RPC bypass through a future forward-only migration. Non-brand operational contact changes require an explicit field classification; they cannot silently change approved branded contacts.
- An administrative lock freezes active branding and pending activation. It does not unlock direct tenant writes, rewrite historical output or change tenant business data.

## 5. Authorization and governance

| Proposed permission | Intended boundary |
| --- | --- |
| `branding.view` | Read only the approved brand allowed by active membership/authorized business-object context; no draft or cross-tenant access implied. |
| `branding.request_change` | Create/submit own-tenant requests if explicitly assigned; never approve or activate. |
| `branding.preview` | Preview authorized own-tenant requests or platform review subjects; no arbitrary tenant/version selection. |
| `branding.admin_review` | Platform-authorized review, comparison, revision requests and suspension controls. |
| `branding.approve` | Platform-authorized approval/activation/revert controls subject to immutable safeguards and explicit review scope. |
| `branding.reject` | Platform-authorized rejection and separate-business disposition. |
| `branding.manage_entitlements` | Platform Owner-authorized branding/white-label entitlement changes, with audit. |

Use server-side role-aware checks, audited RPCs, RLS and storage policies. Possessing an arbitrary permission string, service key, client-supplied organization ID or UI button is not sufficient authority. Tenant administrators are not automatically Platform Administrators.

Reconcile the existing `branding.read` permission with `branding.view` via an explicit forward-only compatibility migration and route/RPC tests. Do not automatically grant the new mutation permissions to existing readers. Current client role restrictions remain intact unless a separately approved future permission assignment explicitly permits an own-tenant request; viewing correctly branded content does not require access to branding administration.

Default policy: tenant roles receive no `branding.approve` and cannot self-activate. Any exception requires a separate explicit Platform Owner delegation policy with scoped platform approval authority and audit; it must never arise from buying white-label entitlement or assigning a tenant role. Such delegation is not enabled by this backlog item. No approver, including Super Administrator, may bypass one-active-brand, tenant isolation, immutable history or mandatory audit constraints.

**Kale Meyer:** governance designation remains **Secondary Reviewer**; intended platform authorization remains **full platform administrative access**, corresponding to the authorization model's highest operational/platform role (`SUPER_ADMIN`), subject to immutable safeguards. Reviewer designation must not downgrade that authority. This records an architectural requirement only: no user, invitation, credential or permission is created/changed here. Preserve immutable `SUPER_ADMIN` permission-management safeguards; future seeded permissions require the normal reviewed migration process, not a UI override of immutable rules.

## 6. Proposed persistence and service components

Names are illustrative; use existing organization, entitlement, audit, financial and library models where appropriate rather than creating competing sources of truth.

| Component | Proposed records and invariants |
| --- | --- |
| Approved-brand store | `tenant_brand_versions` contains immutable profile payloads, asset references, version/digest and approval provenance. `tenant_brand_state` contains the one active pointer and lock/scheduling coordination. Composite tenant foreign keys prohibit cross-tenant version attachment. |
| Requests/assets/entitlements | `brand_change_requests` plus immutable submitted revisions and decisions; versioned tenant asset records; verified domain mappings; reference to the future license/branding entitlement model. Separate business and licensing decisions cannot be encoded as free-form client-controlled JSON authority. |
| History and output snapshots | Append-only brand review/activation events integrated with `audit_logs`; immutable brand snapshot references/payloads on finalized documents and outbound content; asset/template digests and archival object references. |

Proposed service operations: get approved brand, save draft, submit request, preview revision, review/request revisions, reject, approve/schedule, activate due version, lock/suspend, revert and manage entitlement. Every operation has a server-derived actor, target authorization, validated revision and audit result. Workers have restricted operations; they cannot act as unrestricted cross-tenant brand administrators.

Database enforcement must cover direct SQL/RPC attempts as well as routes. A future migration must inventory existing organization/profile mutation functions, revoke identity-field bypasses, seed permissions safely, enable RLS and add constraints. Historical migrations remain untouched. Do not backfill unapproved legacy JSON as if an administrator approved it; require explicit onboarding review and preserve its provenance.

## 7. One authoritative brand resolver

Use a shared server resolver for the authenticated application, output generators and jobs. Never fetch all brands and let the browser choose one.

1. **Authenticated interactive context:** validate active user and organization membership, then resolve the licensed tenant through explicit authorized relationships. A requested object ID is only a lookup input; ownership/RLS determines the issuer tenant. Revalidate after organization changes. Parent/provider relationships are not blanket authority over other organizations.
2. **Client/customer/salesperson view:** derive branding from the authorized workspace or the document's licensed issuer, never a per-person brand override. A buyer reading an authorized seller invoice must see the seller's immutable identity as document content; that does not rebrand the buyer's dashboard. Do not use branding relationships to broaden client or salesperson scope.
3. **Background job:** derive tenant and finalized brand version from the persisted, authorized business event/document, not mutable browser parameters or a worker-global cached tenant. Validate job/object/tenant consistency before rendering or sending.
4. **Pre-authentication login/portal:** no authenticated tenant exists yet. Only an ownership-verified, uniquely mapped exact hostname may serve a minimal public approved logo/display theme. Generic `/login` remains platform-neutral. Query parameters, untrusted forwarded-host headers and arbitrary domains do not select a tenant. After authentication, enforce membership before any private content; mismatch fails closed or returns to the neutral entry point.
5. **Finalized documents:** resolve the document's immutable branding snapshot, not today's active profile or the viewer's brand. Historical version access remains authorized to the document's tenant/audience.

No Strada-specific values in tenant renderers. Platform legal identity, required attribution and entitlement-limited white-label footers are separate platform policy; tenant settings cannot suppress mandatory content.

Cache keys must include licensed tenant, brand version, authorization audience and relevant template/entitlement version. Request-local context must not leak into module-global caches. Activation invalidates current-brand caches without replacing historical snapshot caches. Responses, assets, download URLs and worker retries must preserve the same boundary under concurrent Tenant A/Tenant B traffic.

Serve draft assets privately. Published branding assets expose only deliberately approved public content; private metadata and historical documents require authorization. Use immutable storage keys, tenant-bound policies and authorized delivery, not client-provided remote image URLs. Domain revalidation/revocation and exact-host collision checks are mandatory. Do not fetch an expired/reassigned custom domain to reproduce an old document.

## 8. Propagation and generator inventory

All surfaces consume the resolver; none may introduce a second brand registry. “Snapshot” below means immutable finalized output. Presenting counterparty/carrier/source-document identity remains factual content, not an alternative tenant brand.

| # | Surface | Integration requirement |
| --- | --- | --- |
| 1 | Tenant dashboard | Shared shell/theme uses current approved workspace brand. |
| 2 | Tenant login/portal | Only the verified public-host mapping exception above; neutral fallback. |
| 3 | Client/customer-facing portal | Authorized tenant context plus existing client-safe data projection. |
| 4 | Salesperson dashboard | Tenant brand with existing personal attribution and assigned-client restrictions. |
| 5 | Customer records/views | Tenant UI brand; customer business/name remains authorized record content. |
| 6 | Orders | Current UI brand; document/transaction branding is snapshotted at defined finalization. |
| 7 | Order verification documents | Integrate existing verification snapshots and future print/download rendering. |
| 8 | Reports | Brand server-produced report output; freeze brand/template for saved final reports. Preserve salesperson report restrictions. |
| 9 | Invoices | Capture approved issuer identity at issuance; never restyle issued history. |
| 10 | Statements | Capture brand at statement finalization; later reproductions use that snapshot. |
| 11 | Packing slips | Capture brand at slip finalization, including retained assets/template. |
| 12 | Shipping documents | Brand permitted platform-generated wrappers/slips only. Preserve carrier-required labels, sender facts and irreversible shipment locks. |
| 13 | Transaction documents | Shared finalization contract for other auditable generated records. |
| 14 | Downloadable PDFs | Future PDF renderers share authorized immutable snapshot inputs and retained artifacts. Existing library JSON delivery is not a PDF renderer. |
| 15 | Email templates | Tenant-approved display/footer/content identity within verified sender/domain policy; no arbitrary From/domain selection. |
| 16 | Customer notifications | Persist authorized recipient, tenant and brand context with the outbox event; retry without switching brand. |
| 17 | Sales literature | Approved tenant wrapper/template; preserve content permissions and salesperson confidentiality. |
| 18 | Approved protocols/materials | Brand only allowed wrappers/tenant-authored content; do not rewrite third-party attribution, approved source versions or licensing notices. |
| 19 | Tenant-facing Knowledge Library | Integrate existing print/delivery endpoints and client-safe projection; no provider-confidential fields in client output. |
| 20 | Other tenant-generated outputs | New generators must adopt the shared resolver/snapshot contract and cross-tenant test suite before release. |

Implementation inventory must cover the existing order/verification, billing, reports, shipping, notifications and library service paths. Add adapters to existing renderers; design invoice/statement/packing-slip/PDF/email integrations where final generators are not yet present. Do not claim these generators already exist or build unrelated commercial features as part of Phase 7.

## 9. Historical document reproducibility

- At each auditable finalization/issuance transaction, atomically capture issuer tenant, approved brand version, materialized approved identity fields, immutable asset references/digests, template/renderer version, effective time and final artifact reference/checksum where rendered. Do not rely only on a mutable profile ID or external logo URL.
- Serialize document finalization with brand activation or read a consistent approved-version snapshot. Concurrent rebrand/finalization must choose one valid version, never mixed Version 1 text and Version 2 assets.
- An invoice finalized under Version 1 remains Version 1 after Version 2 approval, scheduled activation, entitlement downgrade or revert. Corrections/reissues create separately auditable new documents, not silent changes to the old artifact.
- Store the rendered immutable artifact when byte-for-byte retrieval is required. Retain template/assets and snapshot inputs for reproduction; renderer version alone is not a guarantee of byte-identical PDF regeneration.
- New unfinalized output uses the effective approved brand. Queued transactional email/notifications bind the snapshot at their business finalization; other outbound content binds it at approved send preparation. Retries use the same snapshot and must not mix tenant/recipient context. Draft previews remain visibly non-final.
- Existing historical records lacking brand provenance must not receive invented approval timestamps or the current brand as a false historical snapshot. Preserve any original artifact and mark unsupported legacy provenance explicitly; backfill only when contemporaneous evidence supports it.
- Prevent deleting/overwriting an asset or template referenced by retained documents. Separate audit retention from contractual/legal financial-document retention; resolve the latter before implementing archival deletion. Do not infer that the approved 12-month audit target permits deleting invoices at 12 months.

## 10. Entitlements, oversight and audit

Monthly subscription tenants receive approved tenant-branded workspace/customer materials within Platform Owner-defined capabilities. Full white-label/platform licenses may expand theme, domain, footer and surface controls. Neither mode grants multiple active brands, tenant approval authority or weaker isolation.

Integrate with the roadmap's configurable commercial/entitlement model; organization type alone is not proof of a purchased plan. Verify entitlement at request review and activation as well as rendering. A downgrade must preserve immutable historical documents and follow an explicit policy for future branding/domain features, not erase old assets or silently alter issuer identity. Paid features remain disabled until entitlement is verified. No plan prices, billing integration or external service purchases are approved here.

Record append-only events for draft submission/revision, submitted asset references, requested field diff, review/rejection/revisions, separate-business classification, approval, scheduled activation/suspension, lock, revert, domain mapping and entitlement changes. Required evidence includes requester/time, reviewer/time, decision, reason/notes, effective time and prior/new versions. Privileged state changes and required audit records commit together; audit failure aborts the change.

Use existing audited RPC patterns and preserve audit RLS. Tenant users see only the request history permitted for their tenant; platform oversight uses validated platform authority. Audit records reference immutable asset/diff objects with appropriate access, not raw uploaded binaries, passwords, tokens, private contact channels or sensitive authorization headers. Public approved business contacts may render on branded documents; operational logs must redact unnecessary personal data.

Brand audit history must integrate with the separately approved 12-month audit-retention requirement and its verification work. This specification does not claim that retention implementation is already verified, close P7-OBS-01, or overwrite its readiness evidence. No administrator, including the Platform Owner, can erase required audit events through branding UI/RPC controls.

## 11. Anticipated routes and user experience

| Route family (proposed) | Scope |
| --- | --- |
| `/branding` | Replace the placeholder in the future feature release with the authorized approved-profile/locked-state view, entitlement summary and request history. |
| `/branding/requests/new`, `/branding/requests/[id]`, `/branding/preview/[id]` | Permission-controlled draft, asset submission, request status and watermarked preview; no activation button for tenant roles. |
| `/administration/branding` and tenant/request detail views | Platform-only onboarding/review queue, current/proposed comparison, approve/reject/revisions, business classification, lock/revert/schedule and entitlement administration. |

URLs identify a resource, not authority. Server services/RLS must reject unauthorized identifiers and direct route/RPC access. Do not add a brand switcher. Historic version inspection is read-only and visually distinct from selecting an active business identity.

## 12. Required automated acceptance tests

Use synthetic separately licensed Tenant A and Tenant B with visibly different names/assets, authorized/unauthorized memberships, assigned salespeople and current/historical documents. Tests must verify persisted state and rendered output, not just navigation visibility.

| ID | Required acceptance result |
| --- | --- |
| BRAND-01 | Tenant A and Tenant B receive only their correct brand across all 20 surfaces. Test parallel requests, organization switches, server rendering, cache reuse and worker batches. |
| BRAND-02 | Tampered tenant, version, asset, request, document and job IDs fail closed at server/RPC/RLS/storage boundaries. A permitted membership in one tenant never authorizes another. |
| BRAND-03 | Only verified exact-host mappings expose minimal public login branding. Arbitrary query/host/forwarded-host input, domain collisions and post-login membership mismatches do not leak private data or select another tenant. |
| BRAND-04 | Onboarding yields one approved active brand; missing approval cannot fall back to another tenant. Direct second-active insertion and mismatched tenant/version references fail in the database. |
| BRAND-05 | Concurrent approvals, scheduler races, retries and reverts cannot create two active brands, overwrite stale review decisions or leave an onboarded tenant without an active version. |
| BRAND-06 | Tenant edits change draft only. Submission, revisions, rejection and suspension leave active branding and live output unchanged. Preview never activates/sends/issues anything. |
| BRAND-07 | Legacy organization JSON/name/contact update routes and direct DML cannot bypass the new identity lock. Unsupported JSON identity fields do not override the resolver. |
| BRAND-08 | Exactly scoped platform approvals succeed and audit atomically; tenant self-approval, forged permission strings and entitlement-based escalation fail. An audit-write failure rolls back approval. |
| BRAND-09 | A proposed independent business is rejected with separate-tenant disposition; no alternate brand selector exists for clients, customers, salespeople, departments or orders. Separate licensed membership switching remains valid. |
| BRAND-10 | Future-effective approval remains inactive until eligible. Activation checks lock/suspension/current-version/entitlement again, uses UTC and does not backdate historical documents. |
| BRAND-11 | Version 1 invoice, statement, packing slip and verification output remain historically reproducible after Version 2 activation/revert. Stored artifact checksums remain unchanged. |
| BRAND-12 | Concurrent finalization/rebrand produces one internally consistent brand snapshot. Outbox retries, delayed workers and recipient reauthorization never switch tenant or brand version. |
| BRAND-13 | Cross-tenant asset substitution, mutable asset overwrite, unauthorized download, active-content upload and untrusted external asset fetch are refused. Retained document assets cannot be deleted. |
| BRAND-14 | Client-safe catalog/library redaction, assigned-client scope, cross-salesperson commission privacy, supplier/cost privacy and provider/platform administration denial remain unchanged. |
| BRAND-15 | Monthly/white-label plan limits apply on the server. Downgrade preserves historical artifacts; no entitlement grants multi-brand operation or approval authority. |
| BRAND-16 | Secondary Reviewer governance designation does not restrict a properly assigned full Platform Administrator; that administrator still cannot bypass immutable safeguards. No hardcoded personal identity is used for authorization. |
| BRAND-17 | Brand events are complete, append-only, tenant-authorized and safely redacted. Snapshot/asset retention and archived-version access comply with the approved retention policy. |
| BRAND-18 | Legacy records without evidence remain explicitly unproven, not retroactively branded as approved. Third-party/carrier/legal identities and source-document approvals are preserved. |

Run unit/resolver, database/RPC/RLS, concurrency, storage, renderer/snapshot, role/security regression and isolated non-production end-to-end coverage for the future implementation. Include typecheck/lint/build and normal release-identity/migration-manifest gates then. This specification does not report these future tests as executed or passing.

## 13. Implementation backlog and completion criteria

1. **BRAND-DATA:** finalize licensed-tenant mapping, approved profile schema, locked version/request lifecycle, composite ownership constraints and forward-only migration/legacy-write plan.
2. **BRAND-APPROVAL:** build permission-controlled onboarding, tenant requests/preview, platform review, separate-business disposition, scheduling and audited overrides. Preserve governance/authorization separation.
3. **BRAND-RESOLUTION:** implement the single server resolver, verified public-host exception, safe asset delivery, cache isolation and shell/portal/salesperson propagation.
4. **BRAND-DOCUMENTS:** integrate generators with immutable issuer snapshots and retained artifacts; cover existing order/billing/report/library/shipping/notification foundations and explicitly schedule missing generators with their owning roadmap items.
5. **BRAND-COMMERCIAL-ASSURANCE:** connect plan entitlements, audit/retention and all acceptance tests; document operator review/revert/onboarding procedures and prove tenant isolation before commercialization.

Definition of done: all in-scope existing surfaces use the resolver; new output generators cannot ship without it; the required isolation, concurrency, approval and immutable-history tests pass; the admin lock is enforced beyond UI; one active brand is database-enforced; a second business requires separately licensed onboarding; operator guidance and release evidence are reviewed. A partial foundation must not be represented as complete coverage of an unimplemented PDF/email generator.

### Decisions to settle before implementation, not before current Phase 7 launch

- Exact license-to-organization mapping, including client-company treatment and document issuer versus recipient/wrapper rules. These must preserve existing client/provider data boundaries and the one-brand business invariant.
- Platform approval assignment/delegation policy, separate-business classification checklist and onboarding/entitlement checks. No tenant delegation is assumed.
- Supported asset formats/limits, theme/font presets, accessibility requirements, public-domain ownership/revalidation and verified email-sender policies.
- Monthly versus full white-label capabilities and downgrade behavior, including mandatory platform/legal attribution. No costs or purchased capabilities are invented here.
- Finalization points per document family, legacy provenance handling, artifact storage capacity and document retention beyond the separate audit requirement.

No application source, schema, historical migration, Phase 7 evidence, hosted data, credentials or deployment is changed by recording this item.
