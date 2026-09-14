# Phase 7 observability evidence and remaining operator decisions

Evidence reference: `P7-OBS-READINESS-20260912`. Collected 2026-09-12.
Gate: **BLOCKED**, not a claim of operational alert readiness.

Current external dependency classification: **EXTERNAL_PROVIDER_BLOCKED** for
the unresolved Supabase-dependent portion only. See
`P7-OBS-SUPABASE-PROVIDER-BLOCK-20260912` below. Existing passing evidence and
all other incomplete configuration/review requirements remain unchanged.

Policy update: `P7-OBS-POLICY-OWNER-20260912`, recorded
`2026-09-12T18:26:55Z` from the Release Owner's explicit instruction in this task.
This timestamp records receipt into the evidence, not an invented operational
review/notification approval time. Policy/documentation is approved; implementation,
unknown expenditure, provider configuration and a readiness PASS are not approved.

Subsequent staffing/configuration direction: `P7-OBS-STAFFING-OWNER-20260912`,
recorded `2026-09-12T18:43:26Z`. The owner has now designated the primary and
independent secondary people and authorized existing, approved, cost-bounded
non-production observability configuration/verification. This supersedes the
earlier policy-only limit only within that specific scope. It does not authorize
unknown costs, new services, Production changes, application deployment, or a
readiness PASS without evidence. Missing private destinations still prevent
notification configuration/testing; no provider configuration was changed.

Machine-readable record: `docs/phase7-observability-evidence.json`.
The collector used read-only non-production APIs and existing local logs; the
evidence validator itself is local-only (`networkRequired: false`). No hosted
business-data writes, configuration changes, notification sends, deployments,
credential changes, or Production requests were made. Raw logs and record contents
were inspected only in memory, not saved into evidence or returned to the operator.

## Release and fixture reconciliation

The current target remains
`https://fulfillment-management-platform-j4ntvrkrz.vercel.app`, deployment
`dpl_HNwQgTJB7oupc81kWJ197RY3o7jt`, application commit
`213a2cea3ebf2435d138b201de0a5883e8d8d4e0`. Staging project:
`nftufhffzlokryafcbku`. Existing accepted deployment/release identity is referenced
from `config/phase7-acceptance.json`; this review does not re-run those gates or
change the deployed artifact.

`tests/phase7/observability-evidence.mjs` retained schema `schema-phase7-23` and
digest `20e3b42fa2ff449f6155bfc43b64f3fa80ab7d8037f6b1da19176204af39804a`.
Its in-process policy used those same stale literals, but its CLI child loaded
the current repository policy, causing the CLI success assertion to fail.
This is stale fixture metadata after manifest reconciliation, not a reason to
relax hashing or change historical SQL.

The fixture now uses existing `readLocalMigrationIdentity` from the migration
recovery validator. That process hashes actual SQL bytes, verifies every sorted
manifest entry, and hashes sorted canonical manifest lines joined with LF.
It independently requires the computed digest to equal the acceptance metadata
and the schema suffix to equal the actual migration count. Current result:
25 migrations, matching manifest, schema `schema-phase7-25`, digest
`ed8e928bccf6afbc6a7ac8558674874eb54fb6af017d12a5e56dac291d26a2ff`.
The expected digest is not patched into the test. Added negative cases still
reject a mismatched digest and a stale schema. The evidence validator, manifests,
historical migrations, and runtime application code were not edited in this review.

## Collected source evidence

### P7-OBS-VERCEL-20260912

- Existing authenticated Vercel CLI 59.11.2 access to project
  `prj_DSxru65flK5vNipHMtAms9EJ8roT`, team `team_zhXZVZz3PeYoRzbIRuDSMyA4`.
  Account role reported `OWNER`. No authentication values were recorded.
- A deployment-ID-pinned, `preview`-filtered, bounded 24-hour log query returned
  100 HTTP 200 records with timestamps, paths and request IDs; zero records had
  another deployment/environment. Routes included `/dashboard`, `/library`,
  `/reports`, `/salespeople`, and `/shipping`. Trace IDs were absent in this sample;
  do not confuse request-ID availability with end-to-end distributed tracing.
- One GET to `/api/library/delivery` without query parameters returned HTTP 400.
  Source review verified this missing-identifier path returns before creating a
  Supabase client or recording a library-delivery event. The matching runtime
  record has timestamp `2026-09-12T18:11:34.634Z`, Preview environment, the exact
  deployment ID, route, status 400 and a request ID. No repeated/error-load test
  was performed. This proves safe request-failure visibility, not 5xx alert delivery.
- Team API reported Pro and an enabled observability entitlement. Read-only
  `/v1/observability/manage/configuration/projects` returned `disabledProjects: []`.
  Thus this project is included in Plus. The available runtime-log retention is
  **30 days**, with at most 14 consecutive days per query window, according to
  [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime) and
  [Observability Plus project inclusion](https://vercel.com/docs/observability/observability-plus).
  This is verified entitlement/retention availability, not an assertion that this
  recently deployed artifact already has 30 days of historical events.

### P7-OBS-LOCAL-DB-AUTH-20260912

- Docker `desktop-linux` endpoint was the local Windows named pipe. Exact database
  container `supabase_db_fulfillment-management-platform` had matching Supabase
  project/workdir labels for this repository and published PostgreSQL port 54322.
  Queries used `docker exec` inside this container, not a remote database URL.
  Docker publishes this port on wildcard interfaces; this review does not claim
  loopback-only exposure or authorize any reset/recovery operation.
- Existing database stderr logs had timestamped errors, including 52
  permission-denial/authorization-denial matches in a bounded 10,000-line sample.
  Example timestamp: `2026-09-12T07:57:13.667Z`. No SQL statements or object payloads
  are retained here. These are database authorization denials, not proof of a
  new failed browser login or of any particular role-denial test.
- Existing local Auth logs included HTTP 200 and 500 events and fields for time,
  component, method/path, result/status and request ID. No invalid-login 401/403
  sample was found in the bounded inspection. Auth audit storage contained 298
  existing entries. No login attempts or new Auth failures were generated.
- Local PostgREST logs exposed structured diagnostic categories. Local DB and Auth
  containers were healthy when inspected. Database catalog reads used a read-only
  transaction. These observations do not establish hosted Supabase log permissions.
- Docker logging is `json-file` with no per-container rotation options. PostgreSQL
  sends logs to stderr with `logging_collector=off`; its inactive file rotation
  settings are not a retention guarantee. No durable local retention period is
  established. Hosted staging plan/retention was not obtainable from the approved
  data API and remains **unverified**, not assumed absent. Supabase explicitly
  makes retention plan-dependent: [Supabase Logs](https://supabase.com/docs/guides/observability/logs).

### P7-OBS-AUDIT-20260912

- Read-only local SQL found 203 audit events, all with category/action/timestamp;
  63 retained a non-null actor. Null/system/deleted-user actor references must not
  be represented as always populated. Existing operational actions included
  `shipping.labels_created`, `notification.internal_alert_created`, and
  `invoice.created`. Existing outbox state included pending and sent records;
  three existing dashboard alerts were present. None were created or processed here.
- A GET-only staging audit query, pinned to project `nftufhffzlokryafcbku`, returned
  ten existing records. Only action, category, timestamp and actor-presence booleans
  were retained. Examples include `library.download` and calculator lifecycle
  actions; latest timestamp `2026-09-12T04:48:12.839Z`. No actor identifiers, entity
  values, business contents, or audit metadata contents are published here.
- Current repository code gates `/administration/audit-log` on `audit.read` and
  uses the authenticated user's client. Local schema inspection confirmed RLS,
  organization-scoped `audit.read`, no authenticated direct INSERT/UPDATE/DELETE,
  and no anonymous/authenticated execution of the private audit writer. This is
  consistent with the accepted six-role isolation evidence. The administrative
  staging GET is not itself a hosted tenant-isolation test; no cross-tenant attempt
  was made and the hosted policy catalog was not separately queried in this review.
- Audit storage is append-only to application roles. No duration, scheduled purge,
  or archive mechanism was found during the original inspection. No local pg_cron
  extension was present. The subsequent approved retention target is **12 months**;
  implementation remains unverified. Append-only access is not a durable-retention
  policy or a promise of indefinite retention.

Redaction review found no high-confidence sensitive-value patterns in the bounded
captured samples or inspected local audit metadata. This does not certify every
past/future log entry. Saved evidence excludes raw records, field values, headers,
sessions, business amounts, identities and authentication material. Automated
redaction validation applies to the saved evidence record, not to all provider logs.

## Exact framework requirements and existing alert capability

The validator requires all eight signals: authentication failures, server errors,
database errors, audit-write failures, migration failures, backup failures, queue
failures and security events. It additionally requires verified routing, redaction,
suppressed test notification, bounded source access, reviewed retention, defined
incident escalation, and distinct named operator/approver with approval timestamp.
The framework does **not** specify numeric retention days, response/acknowledgement
deadlines, severity mappings or duplicate windows. Those are owner decisions;
the approved decisions below supply policy without claiming implementation.

Read-only `alerts rules ls` found one default Vercel trigger rule:
owners and project admins automatically subscribed, severity filter medium/high,
zero explicitly listed additional destinations. Therefore routing exists; the
gate is not blocked because Vercel has no alerts at all. Delivery receipt,
acknowledgement, dedicated Preview scope, and coverage of all eight signals remain
unverified. The observed filter did not specify an environment. No team-wide
rule was changed and no Production telemetry was queried.

Vercel provides [built-in alert notifications](https://vercel.com/docs/alerts/configure-alerts).
Its [error/usage anomaly detection](https://vercel.com/docs/alerts) is not proof
that database, audit, backup, migration and application-outbox failures are routed.
Do not flood a Preview to cross anomaly thresholds merely to obtain evidence.

Application business notifications already have organization-scoped deduplication,
preferences/suppression, and acknowledgement/resolution fields. Dashboard alerts
have info/warning/critical severity. `process_local_notification_outbox` is a local
delivery mechanism, not a verified external incident-paging system. These existing
features do not establish P7-OBS-01 test-notification suppression or escalation.

| Required signal | Mapping to approved impact-based severity | Existing surface / implementation evidence still required |
| --- | --- | --- |
| Authentication failures | CRITICAL for authentication/security infrastructure or boundary failure; HIGH for major operational impact; MEDIUM for an isolated actionable failure; expected non-actionable denial remains LOW | Auth logs / staging access, detection and routed notification proof |
| Server errors | CRITICAL for application-wide outage; HIGH for persistent elevated errors; MEDIUM for isolated degradation | Vercel request logs / full routing proof; observed 400 is not proof of 5xx alert delivery |
| Database errors | CRITICAL for material integrity failure or broad outage; HIGH for major operational failure; MEDIUM for isolated failure | PostgreSQL diagnostics / staging log access and routed notification proof |
| Audit-write failures | CRITICAL when security boundaries or material integrity fail; HIGH when audit failure causes major operational failure; MEDIUM for isolated actionable failure | Transactional writer/database errors / detection and routing; success audit events are insufficient |
| Migration failures | CRITICAL when failed recovery threatens service integrity; HIGH for major operational failure; MEDIUM for isolated failure that stops safely without broader impact | Migration/recovery result / failure routed to the approved operator channel |
| Backup failures | CRITICAL when failed recovery threatens service integrity; HIGH for critical background-process failure; MEDIUM for isolated non-critical failure | Backup/recovery result / failure routed to the approved operator channel |
| Queue failures | CRITICAL if security/integrity or application-wide availability fails; HIGH for repeated order/fulfillment or critical background-process failure; MEDIUM for isolated processing failure | Outbox status/attempts/errors / verified detector and routing |
| Security events | CRITICAL for boundary failure, cross-tenant exposure or security infrastructure failure; otherwise classify actual operational impact under HIGH/MEDIUM; non-actionable diagnostics remain LOW | Auth/audit records / detection, safe routing and protected suppression behavior |

This maps all eight categories to the owner's severity definitions; it does not
configure providers, change existing application severity enums, or turn any
unverified signal into PASS. Vercel's automatic severity must be mapped to this
operational model using impact evidence, not assumed equivalent by label alone.

No new third-party service is shown to be mandatory. Existing Vercel notifications,
Supabase log inspection and repository recovery results provide the components for
an operator-owned workflow. They do not, by themselves, prove autonomous delivery
for all signals. If the owner requires automated delivery beyond existing native
capabilities, that configuration/integration must be proposed and authorized
separately, not silently added or replaced with manual evidence.

## Release-owner-approved policy

### Retention and access

- Vercel/application: accept the verified **30-day** provider retention.
- Supabase: record **actual connected staging-plan retention only after positive
  verification**. The earlier proposed seven-day minimum is not approved or adopted.
- Application audit: **12-month retention target**, tenant-scoped, access-controlled
  and appropriately redacted. The earlier 90-day proposal is superseded, not adopted.
- Existing `audit.read`/tenant boundaries remain unchanged. Policy approval does
  not authorize a purge, archive job, permission change, storage purchase or backup
  operation. A durable mechanism satisfying the target still needs evidence.

### Severity, acknowledgement and escalation

| Severity | Approved definition | Acknowledgement | Escalation / handling |
| --- | --- | --- | --- |
| CRITICAL | Security boundary failure; cross-tenant exposure; authentication/security infrastructure failure; material data-integrity failure; application-wide outage; failed recovery/rollback threatening service integrity | 15 minutes | Escalate if unacknowledged after 15 minutes; actionable alert |
| HIGH | Major operational failure; repeated order/fulfillment processing failure; significant shipping/integration failure; persistent elevated application errors; critical background-process failure | 30 minutes | Escalate if unacknowledged after 30 minutes; actionable alert |
| MEDIUM | Isolated operational failure; non-critical integration problem; degradation without broad outage; actionable warning | 4 business hours | Operator notification, no emergency paging; no separate numeric escalation deadline was approved |
| LOW / INFORMATIONAL | Routine informational events; expected notices; non-actionable diagnostics | No immediate acknowledgement | Logs/dashboard primarily; review by next business day where applicable |

The Primary Operations Administrator investigates and acknowledges. The Secondary
Reviewer is the independent reviewer and escalation backup. The Release Owner is
the final escalation and release/promotion authority. No extra second-stage timer,
business-hours calendar or numerical detector threshold is invented here.

### Routing and suppression

- CRITICAL/HIGH generate actionable alerts; MEDIUM generates operator notifications
  without emergency paging; LOW stays primarily in logs/dashboard unless explicitly
  configured otherwise.
- Group/suppress duplicate repetitions of the same underlying incident to prevent
  flooding. **Never suppress a new Critical security, tenant-isolation or integrity
  event.** A numeric grouping window was not approved; the earlier 10-minute
  recommendation is not adopted.
- Preview/non-production notifications must remain distinguishable and separate
  from Production; test alerts must be clearly marked non-production/test.
- The acceptance requirement for safe test-notification suppression and redacted
  routing evidence remains intact. Marking a test message is not proof that the
  suppression or delivery mechanism works.

### Ownership, private contacts and independent review

Use these governance designations independently of platform permissions:

- **Release Owner**: authorized policy approver and final escalation/release authority.
- **Primary Operations Administrator**: first-line investigation and acknowledgement.
- **Secondary Reviewer**: independent review, escalation backup and verification.

The Release Owner's subsequent private message explicitly designates the people.
The owner subsequently permitted the designated names in readiness evidence.
Public evidence uses these names and redacted references, never private contact
destinations or provider account identifiers:

| Governance designation | Redacted person reference | Designation status |
| --- | --- | --- |
| Release Owner | `P7-OBS-PERSON-001` | Shane Holmes |
| Primary Operations Administrator | `P7-OBS-PERSON-001` | Shane Holmes |
| Secondary Reviewer / Full Platform Administrator | `P7-OBS-PERSON-002` | Kale Meyer |

The named staffing decision is complete and must not be requested again. These
references attest the owner's designations, not provider-account access, receipt
of alerts, or performance of an independent review. The validator's operator and
approver references now use these distinct references; operational review status
remains pending and its approval timestamp remains unset.

For each role's private notification/escalation destination:
**PRIVATE CONTACT CHANNEL TO BE CONFIGURED OUTSIDE PUBLIC REPOSITORY EVIDENCE.**

No private phone numbers, personal email addresses or contact destinations are
published here. Only the owner-approved names, governance roles and platform
authorization requirement are recorded. Actual account/destination binding and
delivery still require verification, not another staffing designation.

The three outstanding destinations are: primary actionable-alert/notification
channel; secondary escalation/review channel; Release Owner final-escalation
channel. Release Owner and primary are the same designated person, so their
destinations may be shared if explicitly confirmed; the secondary must remain
independent. Three separate people are not required.

### Secondary Reviewer platform-authorization requirement

Governance and platform authorization are separate. `P7-OBS-PERSON-002` is the
Secondary Reviewer for independent observability/release review and is authorized
for **complete full platform administration**, at the highest level supported by
the existing model, subject to immutable system safeguards. The current model's
highest application role is `SUPER_ADMIN`, not `ADMIN` or a reviewer-only role
(`docs/security-model.md` and the committed identity/role migrations).

Do not reduce this person's platform permissions because of the governance label.
Independent review requires different people, not artificially restricted platform
permissions. Preserve immutable SUPER_ADMIN permissions, audit protections and all
authorization-model invariants. This requirement is recorded; no existing platform
account has been positively bound to the private designation in this step, and no
membership or permission was changed or claimed verified. A name alone must not
be used to select an account for privileged changes. Application SUPER_ADMIN does
not automatically grant Vercel/Supabase infrastructure access or database-owner
privileges.

### Preview coverage and manual review

- 24/7 staffing is **not required** for Preview/non-production.
- Cover active testing, release validation and planned operational testing.
- Critical Preview alerts discovered outside active coverage must be reviewed
  before any release/promotion decision. Do not claim a staffed out-of-hours SLA.
- Review monitoring/logging evidence before **every release-candidate approval**.
- Review unresolved High/Critical incidents before **any promotion**.
- Periodically review noise/suppression effectiveness and audit-log access.
- Record material monitoring-policy changes in auditable release documentation.

No fixed weekday schedule, daily/weekly interval, or periodic-review interval was
approved. The earlier suggested schedules are not adopted. A business-hours
calendar and periodic-review scheduling remain operational details to document;
they must not be silently presented as additional release-owner approvals.

## Staging Supabase verification attempt after policy approval

Read-only prerequisite discovery confirmed the local link reference remains
`nftufhffzlokryafcbku`. The repository provisioning helpers use the staging data/
Auth administration API, not a verified Management API log/plan inspection path.
In this execution context no management authorization was present in the process
or staging configuration, the default CLI authorization file was absent, and a
readable Windows credential-name inventory showed no Supabase entry. No values
from credentials or configuration were returned. This establishes inability to
verify through these mechanisms here, not absence of an authenticated operator
browser session, log entitlement, or logs in the hosted project.

The installed CLI help attempt failed before help output because its telemetry
temporary file under the user's Supabase home was not writable. No login, token
creation, configuration change or permission workaround was attempted. The data
API administrator key was not substituted for Management API access.

Staging log access and actual retention remain **UNABLE TO VERIFY**. The owner can
use an already authenticated approved-project dashboard to verify plan/retention
and bounded Auth/Postgres log access, sharing only redacted metadata. Provider
documentation makes retention plan-dependent. Its
[log-query usage page](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query)
also describes a pricing rollout with unpublished final quotas; this is not proof
of billing on this project. Verify the actual included allowance/cost boundary
before any potentially billable query. No hosted management log query or plan
change was executed in this policy-update step, and no retention days were inferred.

## Incident workflow -- policy approved, implementation unverified

1. Confirm the evidence's exact Preview deployment and staging project before
   opening logs. Use the Vercel project Logs view filtered to this deployment and
   `preview`; use Supabase Logs for **only** `nftufhffzlokryafcbku`. If using local
   logs, verify the named-pipe Docker context and repository container labels.
   Do not expand queries to other projects or Production.
2. Triage only safe timestamp/environment/route/status/request-ID metadata.
   Correlate within the request and deployment; do not assert cross-service trace
   correlation when trace IDs are absent. For audit evidence, use the permitted
   `/administration/audit-log` view and preserve organization/permission boundaries.
3. Apply the approved severity, acknowledgement and escalation rules above.
   Record incident ownership through the privately designated non-production
   destination. Group duplicates only for the same underlying incident, preserving
   new Critical security, tenant-isolation and integrity events. Actual delivery,
   suppression, recipient access and any chosen grouping window require verification.
4. Investigate read-only first. Escalate on the approved deadline to the named
   backup owner. Credential/role/data changes, recovery and deployments still
   require separate authority. Close only with outcome and reviewer evidence.

The policy portion is approved. The operational runbook is not complete until
private channel/account bindings, covered testing arrangements, actual log retention
and notification/suppression behavior are verified. Do not request reapproval of
the same policy merely because implementation remains blocked.

## Configuration and retention verification after staffing designation

### Existing non-production alert configuration

A fresh authenticated read of the approved Vercel project's rule configuration
completed with exit 0. It still returned one default `trigger` rule with automatic
owner/project-admin subscriptions, `severity in ('medium', 'high')`, and no explicit
additional notification destinations. The observed filter does not establish
Preview-only scope. This is existing partial infrastructure, not proof of the
eight-category operational mapping, the designated people's subscriptions, the
approved CRITICAL tier, timers, escalation or test/duplicate behavior.

No known-cost, destination-verified, Preview-isolated configuration operation can
be completed from this rule alone. Do not guess which infrastructure account is
either designated person, route messages to a role label as though it were an
address, or edit a shared rule that might affect Production. No notifications
were sent and no acknowledgement, escalation, suppression or Critical/test-event
behavior is reported verified. Local synthetic validator tests cannot substitute
for actual notification implementation evidence.

### Twelve-month audit retention capability

A new local read-only transaction was executed after verifying the Docker named
pipe and exact repository container. It confirmed `public.audit_logs`, RLS,
authenticated SELECT and denied direct INSERT/UPDATE/DELETE. There are 203 local
test rows, earliest `2026-09-12T07:50:37.732Z`, total relation size 221184 bytes,
and no local pg_cron extension. Repository inspection found no audit age limit or
audit purge job. Existing PostgreSQL timestamped storage has no identified schema
barrier to keeping records for 12 months.

This establishes **supportability in principle**, not a verified hosted retention
implementation. The local rows are recent and synthetic; zero 12-month-old rows
is not a failure condition and waiting a year is not required. What remains is
evidence that the actual hosted storage/preservation configuration, capacity and
privileged operational procedures preserve audit records for the approved target,
with the required access boundaries and redaction. An archive service or scheduled
purge is not intrinsically required: existing database storage may satisfy the
policy if these controls are verified. Neither a successful short recovery
rehearsal nor the absence of application delete grants alone proves this duration.
No hosted retention setting, backup, data, permission or schema was changed.

## Three remaining operator actions

1. Provide/confirm private existing notification/escalation channels and their
   infrastructure-account bindings for the already-designated primary, secondary
   and Release Owner. Record safe references, testing coverage and the business-hours
   calendar without publishing private contact information. Do not ask for another
   staffing or policy approval.
2. Verify staging Supabase Auth/Postgres log access, actual plan retention and the
   applicable included-cost boundary using existing authorized access. Provide
   evidence of a tenant-scoped, access-controlled, redacted **12-month audit
   retention mechanism**; if implementation is missing, propose a scoped,
   cost-bounded implementation for separate authorization. Do not purge or purchase.
3. Once destinations and cost/target boundaries are verified, carry out the already
   authorized non-production configuration/verification for the eight-category
   mapping: prove delivery, acknowledgement/escalation, duplicate suppression,
   protection of new Critical events and marked/suppressed test behavior. Record the
   actual independent review and rerun the gate. If the existing services cannot
   implement a requirement, propose a specific scoped remedy rather than purchasing,
   deploying application code, or claiming the policy alone is implementation.

## Revalidation and scope

Run from the repository:

```powershell
npm.cmd run test:phase7:observability
npm.cmd run evidence:phase7:observability -- --evidence docs/phase7-observability-evidence.json
npm.cmd run validate:phase7
```

The focused test validates the validator using synthetic evidence; its PASS is
not a hosted readiness PASS. The collected evidence deliberately remains BLOCKED
until the operator actions above are verified. `false` alert-signal booleans mean
end-to-end readiness has not been verified, not that no source signal exists.
The framework definition validator likewise does not execute operational gates.

Recorded rerun results on 2026-09-12:

- Focused observability tests: PASS.
- P7-OBS-01 evidence validator: BLOCKED, reason `observability-blocked`, exit 1.
- Phase 7 acceptance definition: PASS (local/no-network definition check only).
- ESLint for the changed focused test: PASS.
- Independent saved-evidence/config/manifest identity comparison: PASS, 25 entries.
- `git diff --check`: PASS. Existing unrelated changes and temporary helpers remain
  untouched; no commit was created.

After recording `P7-OBS-POLICY-OWNER-20260912`, the focused observability test and
acceptance-definition validator were rerun and passed. The supplied P7-OBS-01
record was rerun through the unchanged validator and remains BLOCKED
(`observability-blocked`, exit 1). A local consistency check verified all eight
category mappings, the exact 12-month/30-day policy values, the approved 15/30-minute
and four-business-hour targets, unchanged release identity, unset Supabase retention,
and unset independent-review identities. No implementation evidence was promoted
to PASS. Only this readiness document and its JSON evidence were edited in the
policy-update step.

After the subsequent staffing designation, the focused test and acceptance
definition were rerun: PASS. The unchanged P7-OBS-01 validator returned BLOCKED
(`observability-blocked`, exit 1). A local consistency/privacy check verified
that the owner and primary share the designated reference, the secondary is
distinct, the full SUPER_ADMIN requirement is separate from governance duties,
no permission change or completed review is claimed, and no supplied person names
or private email addresses appear in the two public evidence files. Routing/timer/
suppression verification booleans remain false. Only these two evidence files were
edited; existing unrelated work and local helpers remain preserved.

## Approved persistent Alert Center architecture (planning only)

Owner direction: `P7-OBS-ALERT-CENTER-OWNER-20260912`. This records approval for
implementation planning, not implementation, provider configuration, delivery,
independent review or readiness PASS. The current step is capability discovery
only. No account, runtime, schema, environment or provider settings were changed.
The earlier eight signal categories, retention policy and safeguards remain in
force. The following more specific dashboard/delivery requirements supersede
any interpretation that logs or provider-native notifications alone are enough.

### Persistent record, lifecycle and visibility

Every operational alert must first be a persistent in-platform Alert Center
record. Dashboard delivery is mandatory. Email is mandatory for Critical/High;
SMS is desired for those severities only when an existing approved provider and
acceptable known cost are verified. SMS is optional for initial Preview.

Required lifecycle:
`NEW -> DELIVERED -> VIEWED -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED`.
Record auditable timestamps and actor identity for each applicable transition.
Keep per-recipient/channel delivery history: a provider accepting a message,
a recipient viewing an alert and a human acknowledging responsibility are
different events. Failed/unconfigured channels cannot be marked delivered and
cannot remove the persistent alert. Detailed transition semantics remain an
implementation design task; opening a dashboard must not cancel mandatory email.

Required views: Active alerts, My alerts, Unacknowledged, Critical, High,
Investigating, Resolved. Include search, tenant/component/severity filtering,
acknowledgement, investigation assignment, resolution and complete history/audit
trail. Kale retains full platform-admin visibility and capabilities under
`SUPER_ADMIN`, separately from his Secondary Reviewer governance designation.
Neither account access nor a role assignment is claimed newly verified.

### Severity workflows

- **Critical:** immediately persist/show the dashboard alert and send Shane's
  email; send SMS when configured. Require acknowledgement within 15 minutes.
  If Shane has not acknowledged after 15 minutes, notify Kale through dashboard
  and email, plus SMS when configured. Preserve Shane's alert and both full
  administrators' visibility. Keep the alert prominently active until resolved;
  resolution requires actor, timestamp and resolution note. Never silently
  suppress Critical isolation, security or data-integrity events.
- **High:** immediately persist/show the dashboard alert; send Shane's email
  and SMS when configured. Require acknowledgement within 30 minutes and
  escalate unacknowledged incidents to Kale after 30 minutes, retaining complete
  acknowledgement/escalation history and the primary's alert. Keep active until
  resolved; escalation uses dashboard/email and configured SMS.
- **Medium:** persistent dashboard notification, operator email/notification
  according to approved routing, four-business-hour acknowledgement target;
  no emergency SMS by default. Business-hours calendar remains to be configured;
  no additional numeric escalation deadline is invented.
- **Low/informational:** dashboard/log visibility; no immediate email/SMS unless
  specifically configured, and no emergency acknowledgement requirement.

The previously approved Preview coverage rules remain: cover active testing,
release validation and planned operational testing; no 24/7 staffing claim.
Out-of-coverage Critical events require review before release/promotion.

### Duplicate/noise suppression and test controls

Group repetitions of the same underlying incident while retaining first/latest
occurrence, count, severity and affected component/tenant. Suppression must not
hide a new Critical condition, a different affected tenant, a severity increase,
a new security-boundary failure or a new data-integrity failure. No numerical
grouping window is approved by this architecture record.

Plan administrator-only TEST DASHBOARD ALERT, TEST EMAIL ALERT and TEST SMS ALERT
controls. Label every test TEST / NON-PRODUCTION, verify and record the actual
delivery result, refuse Production and avoid unnecessary emergency escalation.
An unavailable SMS provider must yield not-configured/not-run, never false
success. Keep intentional suppressed-test evidence separate from channel delivery
tests. Timer/escalation proof must be a controlled, clearly marked non-production
rehearsal; no test alert was sent during discovery.

### Tenant and failure boundaries

Tenant administrators see only alerts explicitly intended for their tenant.
Platform administrators see platform-wide alerts according to existing
authorization; this does not grant ordinary tenants cross-tenant visibility.
Keep sensitive operational/security information out of tenant-facing payloads and
preserve immutable system safeguards. A governance role must not reduce Kale's
full platform permissions.

Implementation must resolve durable ingestion during database/audit failures:
the failing database transaction cannot be the sole incident store or sole
notification path. Do not silently bypass the mandatory persistent-record-first
rule. Verify an independent durable mechanism in existing approved infrastructure
before claiming coverage of a database outage; no such mechanism is newly
configured or proven here.

## Provider capability discovery for the approved architecture

Evidence reference: `P7-OBS-PROVIDER-DISCOVERY-20260912`.
Inspection used repository files, previously collected redacted provider evidence
and current official provider documentation. It did not access a live private
provider account, change settings, send messages, read/display sender values, or
contact Production. Repository absence is not proof of hosted account absence.

| Surface | Observed capability | Limit / required private verification |
| --- | --- | --- |
| Application notifications | Organization-scoped outbox/preferences and local processor | `src/components/notifications/notification-controls.tsx` explicitly says external providers are disabled. `process_local_notification_outbox` changes status to sent without a network send. Not operational email delivery. |
| Local Supabase email | `[local_smtp] enabled = true` in `supabase/config.toml` | Local capture only; messages are not delivered to operator mailboxes. |
| Repository SMTP/API sender | Custom SMTP stanza is commented out; no sender adapter/dependency found | Matching sender setting names were absent from checked local environment files and the current process. Hosted SMTP/API configuration remains UNABLE TO VERIFY. No values were printed. |
| Repository SMS | Phone signup disabled; Twilio configuration disabled | Placeholder configuration is not an approved provider/account or proof of SMS capability. Hosted SMS configuration remains UNABLE TO VERIFY. |
| Vercel | Existing native email/dashboard notifications and previously observed default alert rule | Provider-event capability only; Preview-only scope and each person's binding remain unverified. Native web viewing may prevent an email. SMS is documented for spend-management notifications only. |
| Supabase hosted | Auth email/custom SMTP and phone-provider integration points exist | Auth transport is not a general operational-alert API. Existing custom sender/provider/account and operational-use permission must be verified privately; never send auth messages as substitute alerts. |

Primary sources: [Vercel notifications](https://vercel.com/docs/notifications),
[Vercel alert rules](https://vercel.com/docs/alerts/configure-alerts),
[Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and
[Supabase phone providers](https://supabase.com/docs/guides/auth/phone-login).
The default Supabase email transport is for limited Auth testing, has no delivery
SLA and is not a Critical/High operational alert sender. Selecting/configuring an
Auth provider does not implement the Alert Center lifecycle or escalation engine.

### Exact private operator discovery and later binding steps

1. Each designated person signs into their own existing provider account. In
   Vercel select the approved team, then Settings > Account > My Notifications;
   privately verify the existing email/account binding and authorized project
   access. Inspect only now. Any future subscription change must preserve
   Production isolation. Record only name/role, channel type and binding status.
2. In Vercel Settings > Alerts inspect existing rules, personal subscriptions and
   project scope. Do not create a rule, integration or webhook now. Establish
   Preview/deployment filtering before any later change: shared project scope is
   not sufficient. Native notifications are supplemental and cannot substitute
   for persistent in-platform alerts, required email or explicit acknowledgement.
3. Select only the approved staging Supabase project, matched privately against
   release evidence. Inspect Authentication email/SMTP and Phone provider settings
   without revealing stored values or saving changes. Report configured/unconfigured
   and provider name only. Do not enable Phone auth or alter working Auth SMTP to
   deliver operational alerts. An already configured underlying provider may be
   reused only if its account permits that use within approved costs.
4. If an existing email/SMS provider is identified, privately inspect its account's
   sender verification, operational sending permission, destination verification,
   rates/allowances and delivery-result support. Check sender/domain, SMS number
   and registration charges, per-message/segment/carrier costs and any seat or
   worker charges where applicable. Do not acquire numbers, create accounts,
   reveal/copy values, send verification messages, or change settings in this step.
   If no existing sender is available, report that finding for a separate decision;
   do not silently connect a new service. SMS stays optional.
5. After sender/cost/private binding capability is known, seek the separate scoped
   implementation/configuration authorization. Later bindings must map Shane's
   and Kale's exact privately verified accounts to independent recipient references
   in protected provider/application configuration, never public repository data.
   The future administrator-only test controls must prove dashboard/email delivery,
   acknowledgement, escalation and suppression. Disabled SMS remains not-run.
   Public evidence contains only approved names/roles, channel types, verified
   status and redacted references; keep all destinations/account identifiers private.

Read-only account discovery requires no purchase or new service. Existing Vercel
notification capability does not imply arbitrary operational email is free or
configured. Actual SMTP/API delivery and SMS costs are not verified; no unknown
cost is authorized. No new SMS service is required for initial Preview because
SMS is optional. A missing mandatory email sender remains a blocker, not an
authorization to purchase one.

The database migration, application implementation and eventual authorized
non-production deployment remain required for the approved Alert Center and
previously identified audit-preservation gaps. Private setup alone does not
constitute readiness PASS. Sender feasibility/cost, durable failure-path design,
business-hours calendar and a scoped implementation plan must be established
before a complete implementation authorization can be recommended.

Local verification after recording this architecture: focused observability tests
PASS; acceptance-definition validation PASS; unchanged P7-OBS-01 evidence validator
BLOCKED (`observability-blocked`, exit 1). A local consistency check confirmed the
six lifecycle states, approved acknowledgement timings, independent escalation
reference, all eight unverified signals, unchanged release identity, privacy and
full-admin safeguards. No email destination appears in the two evidence files.
No runtime/schema change, provider request to the application infrastructure,
configuration write, message send, account change, commit or deployment occurred.
Only these two evidence documents were updated; existing unrelated work remains.

Outstanding launch work remains P7-OBS-01, current release-candidate/CI aggregation
P7-CI-01, and closure of the recorded automated-browser/Deployment-Protection access
blocker without weakening safeguards. Previously accepted recovery and six-role
evidence is not invalidated or rerun by this review.

## External Supabase availability blocker

Evidence reference: `P7-OBS-SUPABASE-PROVIDER-BLOCK-20260912`.
Public status checked on 2026-09-12, observation recorded at `23:44:09Z`.
Gate remains **BLOCKED**; dependency classification is
**EXTERNAL_PROVIDER_BLOCKED**, not an application defect or a readiness waiver.

### Separate provider and operator evidence

- The public [Supabase incident report](https://status.supabase.com/incidents/6q5902p2xd9f)
  titled "401 errors due to JWT rejections" remains active. Its latest published
  update, `2026-09-11T23:41:00Z`, reports continuing regional remediation and
  monitoring. The incident identifies API Gateway as the affected component.
- The Release Owner independently reports that the approved
  `fulfillment-management-platform` staging project dashboard remains in
  **Coming up...** state and required configuration controls are unavailable or
  disabled. This is operator-observed evidence, not a new agent login or project
  API inspection.
- The public status page separately lists Dashboard as operational. The exact
  causal link between the JWT incident and this project's dashboard condition
  has **not** been independently established. Record both facts without claiming
  a global dashboard outage, inventing a project-level diagnosis or treating this
  observation as an application/credential defect.

The Release Owner cannot currently complete staging Supabase log-access checks,
actual staging-plan retention verification, private provider-account/email/phone
configuration inspection, or remaining Supabase-dependent P7-OBS-01 operational
verification. Those checks are **EXTERNAL_PROVIDER_BLOCKED** until the approved
project controls can be safely accessed and their results positively verified.
Unavailable inspection does not prove a setting is absent or incorrectly configured.

### Evidence preservation and safety

Keep the existing Vercel/application request evidence, local database/Auth evidence,
audit-event observations, release/target identity, redaction evidence and accepted
policy/staffing records unchanged. Prior successful access is historical evidence,
not proof that the provider is currently accessible. No previously unverified
retention, routing, delivery, acknowledgement, suppression or independent-review
field is promoted to PASS.

This provider classification does not erase the separate Alert Center, mandatory
email/sender, audit-retention implementation, private binding and review gaps.
Provider recovery alone cannot close P7-OBS-01. All original acceptance requirements
still apply, including the approved 12-month audit target and protected alert rules.

No project restart, pause, reset, restore, upgrade, recovery attempt, configuration
change or safeguard bypass is authorized or performed. Older provider incident
updates suggesting project actions do not override this task's prohibition.
No hosted data, private configuration values, credentials or Production resources
were accessed/changed in this update; only the public status site was queried.

Resume Supabase-dependent work only after read-only verification that provider
availability and the exact approved project's required controls are restored.
Then collect the missing redacted access/retention/configuration evidence and
complete remaining authorized operational checks and independent review. Do not
infer readiness from an incident resolution notice alone or weaken the validator.

### Independent next gate: P7-CI-01

**CI and release-candidate validation can advance independently.** The acceptance
framework documents `tools/run-phase7-local-ci.mjs` as the local CI aggregator.
Its observability subcheck runs synthetic validator tests, not hosted Supabase
operator controls. A CI PASS would not close the separately BLOCKED P7-OBS-01.

Start with local candidate-safety preflight and
`npm.cmd run test:phase7:ci`. That focused test checks aggregation, dirty-worktree
and identity refusal, and target/secret-scanning safeguards without running a
build, contacting a provider, or requiring the hosted dashboard.

Before a full `ci:phase7:release` run, identify the exact candidate commit and its
evidence identity; use a clean isolated candidate context, preserving unrelated
operator work and excluding temporary helpers. The current operator working tree
is dirty and must not be represented as a clean candidate. Review the inherited
child-process environment and command chain to exclude hosted/Production targets;
verify local Docker/Supabase before database regression tests. Never substitute
staging for an unavailable local stack. Retain manifest, worktree, fixture and
identity refusals rather than patching expected results to obtain PASS.

This update only selects the next independent gate; it does not start full CI,
dispatch a GitHub workflow, create a commit, push, deploy or repeat hosted tests.

Local verification after recording this blocker: the unchanged P7-OBS-01 evidence
validator returned **BLOCKED** (`observability-blocked`, exit 1); the acceptance
definition check passed. A before/after field-digest comparison confirmed every
pre-existing evidence field unchanged, with prior references and blocker reasons
preserved. Validator, acceptance configuration, manifest, test and unrelated
documentation hashes were unchanged. No operational readiness result was promoted.
