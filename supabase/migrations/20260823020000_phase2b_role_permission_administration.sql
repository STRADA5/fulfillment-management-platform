begin;

-- Global definitions are read-only through the Data API. All mutations flow
-- through the guarded function below so authorization and auditing cannot be skipped.
revoke insert, update, delete on public.roles from authenticated;
revoke insert, update, delete on public.permissions from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;

create function public.admin_set_role_permission(
  target_role_id uuid,
  target_permission_id uuid,
  should_grant boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_organization_id uuid;
  target_role_code text;
  target_permission_code text;
  changed boolean := false;
begin
  if actor_user_id is null or not private.is_super_admin(actor_user_id) then
    raise exception 'Super-admin authorization required' using errcode = '42501';
  end if;

  select code into target_role_code
  from public.roles
  where id = target_role_id
  for update;

  if target_role_code is null then
    raise exception 'Role not found' using errcode = 'P0002';
  end if;

  if target_role_code = 'SUPER_ADMIN' then
    raise exception 'SUPER_ADMIN permissions are immutable' using errcode = '42501';
  end if;

  select code into target_permission_code
  from public.permissions
  where id = target_permission_id;

  if target_permission_code is null then
    raise exception 'Permission not found' using errcode = 'P0002';
  end if;

  select m.organization_id into actor_organization_id
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = actor_user_id
    and m.status = 'active'
    and o.status = 'active'
  order by m.is_primary desc, m.created_at
  limit 1;

  if actor_organization_id is null then
    raise exception 'Active organization required' using errcode = '42501';
  end if;

  if should_grant then
    insert into public.role_permissions (role_id, permission_id)
    values (target_role_id, target_permission_id)
    on conflict do nothing;
    changed := found;
  else
    delete from public.role_permissions
    where role_id = target_role_id and permission_id = target_permission_id;
    changed := found;
  end if;

  if changed then
    perform private.write_audit_event(
      actor_user_id,
      actor_organization_id,
      case when should_grant then 'role.permission_granted' else 'role.permission_removed' end,
      'role_permission',
      target_role_id::text || ':' || target_permission_id::text,
      jsonb_build_object(
        'role_id', target_role_id,
        'role_code', target_role_code,
        'permission_id', target_permission_id,
        'permission_code', target_permission_code
      )
    );
  end if;

  return changed;
end;
$$;

revoke all on function public.admin_set_role_permission(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.admin_set_role_permission(uuid, uuid, boolean)
  to authenticated;

commit;
