begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.organization_type as enum ('platform_owner', 'fulfillment_company', 'client_company', 'white_label');
create type public.organization_status as enum ('active', 'inactive', 'suspended');
create type public.profile_status as enum ('active', 'inactive', 'suspended');
create type public.membership_status as enum ('invited', 'active', 'inactive', 'suspended');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  organization_type public.organization_type not null,
  parent_organization_id uuid references public.organizations(id) on delete restrict,
  status public.organization_status not null default 'active',
  contact_email text,
  contact_phone text,
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  branding jsonb not null default '{}'::jsonb check (jsonb_typeof(branding) = 'object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_organization_id is null or parent_organization_id <> id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) <= 80),
  last_name text check (last_name is null or char_length(last_name) <= 80),
  display_name text check (display_name is null or char_length(display_name) <= 160),
  phone text check (phone is null or char_length(phone) <= 40),
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null unique,
  description text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.organization_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status public.membership_status not null default 'invited',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create unique index organization_memberships_one_primary_per_user
  on public.organization_memberships (user_id) where is_primary;
create index organization_memberships_user_active
  on public.organization_memberships (user_id, organization_id) where status = 'active';
create index organizations_parent_id_idx on public.organizations (parent_organization_id);
create unique index organizations_single_platform_owner
  on public.organizations (organization_type) where organization_type = 'platform_owner';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  ip_address inet,
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  created_at timestamptz not null default now()
);

create index audit_logs_organization_created_at_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_created_at_idx on public.audit_logs (actor_user_id, created_at desc);

create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger roles_set_updated_at before update on public.roles
for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.organization_memberships
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, first_name, last_name, display_name)
select
  id,
  nullif(raw_user_meta_data ->> 'first_name', ''),
  nullif(raw_user_meta_data ->> 'last_name', ''),
  nullif(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do nothing;

create function private.validate_organization_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_type public.organization_type;
begin
  if new.organization_type = 'platform_owner' and new.parent_organization_id is not null then
    raise exception 'Platform owner organizations cannot have a parent';
  end if;
  if new.organization_type = 'client_company' and new.parent_organization_id is null then
    raise exception 'Client organizations require a parent fulfillment company';
  end if;
  if new.parent_organization_id is not null then
    select organization_type into parent_type from public.organizations where id = new.parent_organization_id;
    if parent_type is null then raise exception 'Parent organization does not exist'; end if;
    if new.organization_type = 'client_company' and parent_type not in ('fulfillment_company', 'white_label') then
      raise exception 'Client organizations must belong to a fulfillment or white-label organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_validate_parent before insert or update of organization_type, parent_organization_id
on public.organizations for each row execute function private.validate_organization_parent();

create function private.is_super_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = check_user_id and m.status = 'active' and r.code = 'SUPER_ADMIN'
  );
$$;

create function private.has_organization_access(check_organization_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin(check_user_id) or exists (
    select 1 from public.organization_memberships m
    where m.user_id = check_user_id and m.organization_id = check_organization_id and m.status = 'active'
  );
$$;

create function private.has_permission(check_organization_id uuid, permission_code text, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin(check_user_id) or exists (
    select 1 from public.organization_memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.user_id = check_user_id
      and m.organization_id = check_organization_id
      and m.status = 'active'
      and p.code = permission_code
  );
$$;

create function private.can_view_profile(target_user_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user_id = check_user_id or private.is_super_admin(check_user_id) or exists (
    select 1
    from public.organization_memberships viewer
    join public.organization_memberships target on target.organization_id = viewer.organization_id
    join public.role_permissions rp on rp.role_id = viewer.role_id
    join public.permissions p on p.id = rp.permission_id and p.code = 'memberships.read'
    where viewer.user_id = check_user_id and viewer.status = 'active' and target.user_id = target_user_id
  );
$$;

create function private.can_assign_role(check_organization_id uuid, check_role_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin(check_user_id) or exists (
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
      and (
        (actor_role.code = 'ADMIN' and o.organization_type in ('fulfillment_company', 'white_label') and assigned_role.code in ('ADMIN', 'STAFF', 'WAREHOUSE'))
        or (actor_role.code = 'CLIENT_ADMIN' and o.organization_type = 'client_company' and assigned_role.code in ('CLIENT_ADMIN', 'CLIENT_USER'))
      )
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.is_super_admin(uuid) to authenticated;
grant execute on function private.has_organization_access(uuid, uuid) to authenticated;
grant execute on function private.has_permission(uuid, text, uuid) to authenticated;
grant execute on function private.can_view_profile(uuid, uuid) to authenticated;
grant execute on function private.can_assign_role(uuid, uuid, uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select on public.organizations for select to authenticated
using (private.has_organization_access(id));
create policy organizations_insert on public.organizations for insert to authenticated
with check (private.is_super_admin());
create policy organizations_update on public.organizations for update to authenticated
using (private.has_permission(id, 'organizations.manage'))
with check (private.has_permission(id, 'organizations.manage'));

create policy profiles_select on public.profiles for select to authenticated
using (private.can_view_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_manage on public.roles for all to authenticated
using (private.is_super_admin()) with check (private.is_super_admin());
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy permissions_manage on public.permissions for all to authenticated
using (private.is_super_admin()) with check (private.is_super_admin());
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_manage on public.role_permissions for all to authenticated
using (private.is_super_admin()) with check (private.is_super_admin());

create policy memberships_select on public.organization_memberships for select to authenticated
using (user_id = auth.uid() or private.has_permission(organization_id, 'memberships.read'));
create policy memberships_insert on public.organization_memberships for insert to authenticated
with check (
  private.has_permission(organization_id, 'memberships.manage')
  and private.can_assign_role(organization_id, role_id)
);
create policy memberships_update on public.organization_memberships for update to authenticated
using (
  private.has_permission(organization_id, 'memberships.manage')
  and private.can_assign_role(organization_id, role_id)
)
with check (
  private.has_permission(organization_id, 'memberships.manage')
  and private.can_assign_role(organization_id, role_id)
);
create policy memberships_delete on public.organization_memberships for delete to authenticated
using (
  private.has_permission(organization_id, 'memberships.manage')
  and private.can_assign_role(organization_id, role_id)
);

create policy audit_logs_select on public.audit_logs for select to authenticated
using (organization_id is not null and private.has_permission(organization_id, 'audit.read'));

revoke all on public.organizations, public.profiles, public.roles, public.permissions,
  public.role_permissions, public.organization_memberships, public.audit_logs from anon;
grant select, insert, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.roles, public.permissions, public.role_permissions to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select on public.audit_logs to authenticated;

insert into public.roles (code, name, description) values
  ('SUPER_ADMIN', 'Super Admin', 'Full platform administration across organizations and sensitive settings.'),
  ('ADMIN', 'Admin', 'Fulfillment-company administration within an authorized organization.'),
  ('STAFF', 'Staff', 'Configurable operational access without implicit supplier, cost, margin, or system access.'),
  ('WAREHOUSE', 'Warehouse', 'Warehouse, inventory, receiving, and fulfillment operations.'),
  ('CLIENT_ADMIN', 'Client Admin', 'Administration and permitted functions for a client organization.'),
  ('CLIENT_USER', 'Client User', 'Standard restricted access within a client organization.');

insert into public.permissions (code, name, description) values
  ('administration.access', 'Access administration', 'Open the administration workspace.'),
  ('organizations.read', 'Read organizations', 'View authorized organization records.'),
  ('organizations.manage', 'Manage organizations', 'Create or update authorized organizations.'),
  ('memberships.read', 'Read memberships', 'View users and memberships in an authorized organization.'),
  ('memberships.manage', 'Manage memberships', 'Create, update, and remove permitted memberships.'),
  ('roles.read', 'Read roles', 'View role and permission definitions.'),
  ('roles.manage', 'Manage roles', 'Change platform role and permission definitions.'),
  ('settings.manage', 'Manage system settings', 'Change platform-level system configuration.'),
  ('security.manage', 'Manage security', 'Manage platform security controls.'),
  ('audit.read', 'Read audit log', 'View audit events for an authorized organization.'),
  ('audit.write', 'Write audit log', 'Record trusted system audit events.'),
  ('orders.read', 'Read orders', 'View authorized order information.'),
  ('inventory.read', 'Read inventory', 'View authorized inventory information.'),
  ('products.read', 'Read products', 'View authorized product information.'),
  ('clients.read', 'Read clients', 'View authorized client organizations.'),
  ('customers.read', 'Read customers', 'View authorized client customer information.'),
  ('shipping.read', 'Read shipping', 'View authorized shipping information.'),
  ('receiving.read', 'Read receiving', 'View authorized receiving information.'),
  ('qc.read', 'Read QC', 'View authorized quality-control information.'),
  ('branding.read', 'Read branding', 'View authorized branding information.'),
  ('messages.read', 'Read messages', 'View authorized internal messages.'),
  ('reports.read', 'Read reports', 'View authorized reports.'),
  ('suppliers.read', 'Read suppliers', 'View sensitive supplier information.'),
  ('product_costs.read', 'Read product costs', 'View acquisition costs.'),
  ('financial_margins.read', 'Read financial margins', 'View financial margin information.');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'SUPER_ADMIN'
   or (r.code = 'ADMIN' and p.code in (
     'administration.access', 'organizations.read', 'organizations.manage', 'memberships.read', 'memberships.manage',
     'roles.read', 'audit.read', 'orders.read', 'inventory.read', 'products.read', 'clients.read', 'customers.read',
     'shipping.read', 'receiving.read', 'qc.read', 'branding.read', 'messages.read', 'reports.read',
     'suppliers.read', 'product_costs.read', 'financial_margins.read'
   ))
   or (r.code = 'STAFF' and p.code in (
     'orders.read', 'inventory.read', 'products.read', 'clients.read', 'customers.read', 'shipping.read',
     'receiving.read', 'qc.read', 'branding.read', 'messages.read', 'reports.read'
   ))
   or (r.code = 'WAREHOUSE' and p.code in (
     'orders.read', 'inventory.read', 'products.read', 'shipping.read', 'receiving.read', 'qc.read', 'messages.read'
   ))
   or (r.code = 'CLIENT_ADMIN' and p.code in (
     'administration.access', 'organizations.read', 'memberships.read', 'memberships.manage', 'roles.read',
     'orders.read', 'inventory.read', 'products.read', 'customers.read', 'shipping.read', 'branding.read',
     'messages.read', 'reports.read'
   ))
   or (r.code = 'CLIENT_USER' and p.code in (
     'orders.read', 'inventory.read', 'products.read', 'customers.read', 'shipping.read', 'messages.read', 'reports.read'
   ));

commit;
