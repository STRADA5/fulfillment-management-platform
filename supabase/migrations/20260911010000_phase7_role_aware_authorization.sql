-- Phase 7: fail closed when a CLIENT_USER role has stale or drifted privileged permissions.
-- Forward-only additive correction; existing migration files remain immutable.
begin;

create or replace function private.has_permission(check_organization_id uuid, permission_code text, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile(check_user_id) and (
    private.is_super_admin(check_user_id) or exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      join public.roles r on r.id = m.role_id
      join public.role_permissions rp on rp.role_id = m.role_id
      join public.permissions p on p.id = rp.permission_id
      where m.user_id = check_user_id
        and m.organization_id = check_organization_id
        and m.status = 'active'
        and o.status = 'active'
        and p.code = permission_code
        and (r.code <> 'CLIENT_USER' or p.code in (
          'orders.read','orders.view','orders.create',
          'inventory.read','inventory.view',
          'products.read','products.view',
          'customers.read','customers.view','customer_addresses.view',
          'shipping.read','shipping.view','messages.read','reports.read',
          'billing.view','client_catalog.view',
          'cases.view','cases.acknowledge','replacements.view','returns.view',
          'library.view','library.download','library.print'
        ))
    )
  );
$$;

commit;
