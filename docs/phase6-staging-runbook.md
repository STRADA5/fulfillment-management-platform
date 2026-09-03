# Phase 6 hosted staging runbook

This runbook is a controlled non-production procedure. It must not be used with a production project, production credentials, or production data.

## Before any hosted access

- A clean tagged release-baseline commit exists.
- The migration manifest and release evidence are approved.
- The local database has been rebuilt from zero and the full Phase 1–5D suite passes.
- The staging data policy is approved: synthetic fixtures only.
- The Supabase project owner, migration approver, deployment approver, and restore approver are named.
- A backup/PITR and restore destination have been selected.

## Project requirements

- Separate Supabase project and project reference from local and production.
- PostgreSQL major version aligned with local configuration, currently 17.
- Clearly non-production project name, region, access list, and retention policy.
- Auth site URL and redirect allow-list limited to the staging application URL.
- Sandbox email delivery; no real customer email delivery.
- Private storage buckets where storage is tested.
- No live payment, carrier, notification, webhook, OAuth, or production API credentials.

## Hosted authenticated smoke runner

The Phase 6 hosted browser runner is development-only verification tooling. It is not part of the production runtime.

- `npm run test:hosted:phase6` must be launched from the same protected PowerShell process that owns `PHASE6_PREVIEW_URL` and `VERCEL_AUTOMATION_BYPASS_SECRET`.
- `PHASE6_PREVIEW_URL` is rejected unless it is exactly `https://fulfillment-management-platform-b9d85avh4.vercel.app`.
- The bypass secret is read only from the inherited process environment and sent only as the `x-vercel-protection-bypass` request header.
- The PowerShell launcher reads the six existing synthetic credentials from Windows Credential Manager and pipes them to the runner without printing, persisting, or passing them as command-line arguments.
- Credential Manager target names are non-secret process configuration for Client B, Client A, Salesperson A, Salesperson B, Fulfillment Operator, and Super-Admin.
- Each role runs in a new browser context; storage state, cookies, traces, screenshots, videos, and downloads are not persisted.
- The runner allows requests only to the approved Preview host and `nftufhffzlokryafcbku.supabase.co`; unexpected hosts fail the run.
- `npm run test:hosted:phase6 -- -ConfigOnly` validates process configuration without launching a browser or contacting staging.
- The full command is separately authorization-gated and must not be run against a production URL.

## First connection procedure

1. Project owner creates the empty staging project after explicit approval.
2. Record the project reference, region, database version, and owner/access list.
3. Store staging URL, publishable key, and server-only service-role key in the protected staging secret manager.
4. Confirm the checked-out release SHA before any database command.
5. Connect the CLI only to the approved staging project.
6. Compare the hosted migration list with the repository manifest.
7. Capture the pre-change backup/snapshot.
8. Apply the committed migrations using the approved migration procedure.
9. Verify the resulting schema, Auth settings, RLS behavior, and audit path.
10. Load only synthetic staging fixtures and run the hosted smoke suite.

The first hosted migration is an approval-gated event. Pulling a hosted schema over the repository, editing applied migration files, or using a linked command without the project reference review is prohibited.

## Synthetic fixture policy

Use deterministic identifiers such as `P6S-*`, synthetic users, synthetic organizations, synthetic products, and clearly fake email domains. Fixtures must be disposable and removable. Never import production dumps or real customer, health, payment, commission, supplier, or document data.

## Restore and rollback rehearsal

- Take a pre-migration backup.
- Restore it into a disposable non-production target.
- Verify Auth, RLS, audit history, and representative Phase 1–5D workflows.
- Application rollback uses a previous tagged commit.
- Database rollback uses restoration or a new compensating forward migration; migration files are never edited or deleted.
- Record start/end times, release SHA, migration hashes, approvers, result, and any discrepancy.

## Monitoring and logging checks

Confirm access to Vercel/application logs, Supabase database/Auth logs, migration history, audit logs, and error alerts. Logs must not contain service-role keys, tokens, payment data, customer PII, commission amounts outside authorized audit policy, or document contents. Establish alerts for authentication failures, elevated 5xx responses, database errors, failed background/outbox processing, migration failures, and backup failures.
