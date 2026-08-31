# Phase 1 security model

## Trust boundaries

The publishable Supabase key is intentionally available to browser code. It identifies the project; it does not grant tenant access. PostgreSQL Row Level Security (RLS), authenticated user identity, active organization membership, and role permissions form the authorization boundary.

The service-role key is used only by a `server-only` Supabase Auth administration client for trusted invitation and account lookup operations. It never uses a `NEXT_PUBLIC_` name and must never enter a browser bundle. Organization membership changes still execute with the administrator's authenticated JWT through guarded database functions, so the privileged key is not a substitute for actor authorization.

## Tenant isolation

- Every organization-scoped access check starts with an active `organization_memberships` row.
- Client-company users receive membership only in their client organization and cannot infer access through the parent relationship.
- A fulfillment-company membership does not automatically grant access to child client organizations. Access must be represented explicitly by a membership or introduced later through carefully reviewed policies.
- RLS helper functions are `SECURITY DEFINER`, use an empty `search_path`, accept the authenticated user identity by default, and are the only bypass used to avoid recursive membership-policy evaluation.
- Application routes independently enforce permissions on the server. Navigation visibility is a usability feature, not the security boundary.

## Roles and permission escalation

Permissions are records joined to roles through `role_permissions`, allowing the model to become configurable without changing application code. Initial system roles are seeded by migration.

- `SUPER_ADMIN` has every seeded permission and is the only role allowed to change global role/permission definitions.
- `ADMIN` can assign only `ADMIN`, `STAFF`, or `WAREHOUSE` within the same fulfillment or white-label organization.
- `CLIENT_ADMIN` can assign only `CLIENT_ADMIN` or `CLIENT_USER` within the same client organization.
- Non-super administrators cannot modify or remove a membership whose role they are not permitted to assign. This prevents demoting or deleting a super-admin membership.
- `STAFF` and `WAREHOUSE` do not receive supplier, acquisition-cost, margin, system-setting, security, membership-management, or role-management permissions by default.
- Global role-permission assignments are mutable only through an audited `SUPER_ADMIN` database function. Direct authenticated DML is revoked, `SUPER_ADMIN` assignments are immutable, and possessing `roles.manage` alone cannot invoke the mutation function.

## Authentication

Supabase Auth owns password hashes and session tokens. The public `profiles` table contains display information only. Server-rendered protected routes validate the user with Supabase, while `proxy.ts` refreshes sessions and redirects unauthenticated requests. Password-reset callbacks accept only same-origin relative redirect paths.

Public registration is not implemented. Users must be created or invited by an authorized administrator through a trusted process.

## Audit logs

`audit_logs` is append-oriented. Authenticated browser clients have no insert, update, or delete grant. Authorized users may read organization events when their role has `audit.read`; trusted future server processes or database triggers can append events. Ordinary users cannot rewrite or delete audit history through the Data API.

Phase 2A membership functions append invitation, acceptance, role/status, primary-organization, removal, and global profile-status events in the same transaction as the protected mutation. Private audit helpers are not executable by anonymous or authenticated API roles.

Phase 2B role-permission grants and removals use the same transactional audit boundary. Audit rows remain read-only to authenticated users and are filtered by organization RLS; active super-admins retain platform-wide visibility for organization-associated events.

## Future schema requirements

Every future tenant-sensitive table must include an unambiguous organization ownership key, enable RLS, and receive explicit policies before application use. Sensitive financial, supplier, customer, inventory, and fulfillment operations should also perform server-side authorization and create audit events where appropriate.
