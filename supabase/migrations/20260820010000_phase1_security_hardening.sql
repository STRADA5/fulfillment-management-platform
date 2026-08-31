-- Phase 1 security hardening.
--
-- This migration deliberately follows the immutable Phase 1 foundation. It
-- formalizes the later security correction that had previously been folded
-- into the original Phase 1 migration in the working tree.

create function private.is_active_profile(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = check_user_id and p.status = 'active'
  );
$$;

create or replace function private.is_super_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile(check_user_id) and exists (
    select 1 from public.organization_memberships m
    join public.roles r on r.id = m.role_id
    join public.organizations o on o.id = m.organization_id
    where m.user_id = check_user_id
      and m.status = 'active'
      and o.status = 'active'
      and r.code = 'SUPER_ADMIN'
  );
$$;

create or replace function private.has_organization_access(check_organization_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile(check_user_id) and (
    private.is_super_admin(check_user_id) or exists (
      select 1 from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = check_user_id
        and m.organization_id = check_organization_id
        and m.status = 'active'
        and o.status = 'active'
    )
  );
$$;

create or replace function private.has_permission(check_organization_id uuid, permission_code text, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile(check_user_id) and (
    private.is_super_admin(check_user_id) or exists (
      select 1 from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      join public.role_permissions rp on rp.role_id = m.role_id
      join public.permissions p on p.id = rp.permission_id
      where m.user_id = check_user_id
        and m.organization_id = check_organization_id
        and m.status = 'active'
        and o.status = 'active'
        and p.code = permission_code
    )
  );
$$;

create or replace function private.can_view_profile(target_user_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile(check_user_id) and (
    target_user_id = check_user_id or private.is_super_admin(check_user_id) or exists (
      select 1
      from public.organization_memberships viewer
      join public.organization_memberships target on target.organization_id = viewer.organization_id
      join public.organizations o on o.id = viewer.organization_id
      join public.role_permissions rp on rp.role_id = viewer.role_id
      join public.permissions p on p.id = rp.permission_id and p.code = 'memberships.read'
      where viewer.user_id = check_user_id
        and viewer.status = 'active'
        and o.status = 'active'
        and target.user_id = target_user_id
    )
  );
$$;

create or replace function private.can_assign_role(check_organization_id uuid, check_role_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile(check_user_id) and (
    private.is_super_admin(check_user_id) or exists (
      select 1
      from public.organization_memberships actor
      join public.roles actor_role on actor_role.id = actor.role_id
      join public.roles assigned_role on assigned_role.id = check_role_id
      join public.organizations o on o.id = check_organization_id
      join public.role_permissions rp on rp.role_id = actor.role_id
      join public.permissions p on p.id = rp.permission_id and p.code = 'memberships.manage'
      where actor.user_id = check_user_id
        and actor.organization_id = check_organization_id
        and actor.status = 'active'
        and o.status = 'active'
        and (
          (actor_role.code = 'ADMIN' and o.organization_type in ('fulfillment_company', 'white_label') and assigned_role.code in ('ADMIN', 'STAFF', 'WAREHOUSE'))
          or (actor_role.code = 'CLIENT_ADMIN' and o.organization_type = 'client_company' and assigned_role.code in ('CLIENT_ADMIN', 'CLIENT_USER'))
        )
    )
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.is_active_profile(uuid) to authenticated;
grant execute on function private.is_super_admin(uuid) to authenticated;
grant execute on function private.has_organization_access(uuid, uuid) to authenticated;
grant execute on function private.has_permission(uuid, text, uuid) to authenticated;
grant execute on function private.can_view_profile(uuid, uuid) to authenticated;
grant execute on function private.can_assign_role(uuid, uuid, uuid) to authenticated;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and private.is_active_profile())
with check (id = auth.uid() and private.is_active_profile());

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
using (private.is_active_profile());

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select to authenticated
using (private.is_active_profile());

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated
using (private.is_active_profile());

drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select on public.organization_memberships for select to authenticated
using (
  private.is_active_profile()
  and (user_id = auth.uid() or private.has_permission(organization_id, 'memberships.read'))
);

revoke update on public.organizations from authenticated;
grant update (name, slug, contact_email, contact_phone, address, branding, settings)
  on public.organizations to authenticated;
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, display_name, phone) on public.profiles to authenticated;

grant select, insert, update, delete on public.organizations, public.profiles,
  public.roles, public.permissions, public.role_permissions,
  public.organization_memberships, public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;
