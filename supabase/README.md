# Supabase migrations

SQL migrations in `migrations/` are the version-controlled source of truth. The original Phase 1 migration is immutable; its later security correction is formalized in `20260820010000_phase1_security_hardening.sql`. Creating a file does not change any Supabase project.

The completed Phase 1–5D chain contains 21 migrations. Review `docs/migration-manifest.sha256` before applying any hosted non-production migration. The local test runner refuses non-loopback Supabase URLs and must never be pointed at a hosted project.

## Apply safely

1. Create or select the intended Supabase project and record a backup before changing an existing database.
2. Install and authenticate the Supabase CLI using the official Supabase instructions.
3. Link this repository to the correct project and confirm the project reference before proceeding:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase migration list
   ```

4. Review the SQL and preview pending changes in a non-production project first.
5. Apply the committed migrations:

   ```bash
   npx supabase db push
   ```

6. Confirm all tenant-sensitive tables have RLS enabled and test access with accounts from unrelated organizations before production rollout.

The local `seed.sql` file is intentionally empty. Phase-specific security suites create and remove disposable local fixtures; bootstrap data is created only through the trusted process below. Phase 5B keeps salesperson commission tables provider-only and uses provider-scoped order and verification-number uniqueness so independent tenants cannot collide. Phase 5C adds composable client capabilities and keeps affiliate/referral commissions in a separate provider-scoped ledger with direct table access revoked. Phase 5D adds provider-owned Knowledge Library & Tools tables with direct authenticated access revoked, guarded version/approval/share/delivery RPCs, and a metadata-only calculator plugin framework; it does not execute calculators or prescribe dosing.

## Initial bootstrap

The migration deliberately does not create users, organizations, or memberships. After applying it:

1. In Supabase Auth administration, create or invite the first trusted platform owner user with email confirmation handled according to your project policy.
2. Run the following once in the Supabase SQL editor, replacing both values. Confirm the target user before execution.

   ```sql
   do $$
   declare
     bootstrap_user_id uuid := 'REPLACE_WITH_AUTH_USER_UUID';
     platform_organization_id uuid;
     super_admin_role_id uuid;
   begin
     insert into public.organizations (name, slug, organization_type)
     values ('REPLACE_WITH_PLATFORM_OWNER_NAME', 'platform-owner', 'platform_owner')
     returning id into platform_organization_id;

     select id into strict super_admin_role_id
     from public.roles where code = 'SUPER_ADMIN';

     insert into public.organization_memberships
       (organization_id, user_id, role_id, status, is_primary)
     values
       (platform_organization_id, bootstrap_user_id, super_admin_role_id, 'active', true);
   end $$;
   ```

3. Verify the bootstrap user can sign in and that unrelated test users cannot read the platform organization.
4. Remove any copied bootstrap identifiers from local notes or query history where practical.

Also configure the Auth site URL and allowed redirect URLs for each deployment. The password recovery callback is `/auth/callback?next=/reset-password`.
