begin;

create function private.write_audit_event(
  event_actor_user_id uuid,
  event_organization_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id text,
  event_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare audit_id bigint;
begin
  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    event_actor_user_id,
    event_organization_id,
    event_action,
    event_entity_type,
    event_entity_id,
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create function private.assign_fallback_primary(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare fallback_membership_id uuid;
begin
  if exists (
    select 1
    from public.organization_memberships
    where user_id = target_user_id and is_primary
  ) then
    return;
  end if;

  select m.id into fallback_membership_id
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = target_user_id
    and m.status = 'active'
    and o.status = 'active'
  order by m.created_at, m.id
  limit 1;

  if fallback_membership_id is not null then
    update public.organization_memberships
    set is_primary = true
    where id = fallback_membership_id;
  end if;
end;
$$;

create function public.admin_invite_organization_member(
  target_organization_id uuid,
  target_user_id uuid,
  target_role_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  membership_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.has_permission(target_organization_id, 'memberships.manage', actor_user_id)
    or not private.can_assign_role(target_organization_id, target_role_id, actor_user_id) then
    raise exception 'Not authorized to invite this role' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = target_user_id and status = 'active'
  ) then
    raise exception 'The invited user is not active' using errcode = '22023';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role_id,
    status,
    is_primary
  ) values (
    target_organization_id,
    target_user_id,
    target_role_id,
    'invited',
    false
  )
  returning id into membership_id;

  perform private.write_audit_event(
    actor_user_id,
    target_organization_id,
    'membership.invited',
    'organization_membership',
    membership_id::text,
    jsonb_build_object('target_user_id', target_user_id, 'role_id', target_role_id)
  );

  return membership_id;
end;
$$;

create function public.accept_my_organization_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  invited_membership record;
  accepted_count integer := 0;
begin
  if actor_user_id is null or not private.is_active_profile(actor_user_id) then
    raise exception 'Active authentication required' using errcode = '42501';
  end if;

  for invited_membership in
    select m.id, m.organization_id, m.role_id
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = actor_user_id
      and m.status = 'invited'
      and o.status = 'active'
    for update of m
  loop
    update public.organization_memberships
    set status = 'active'
    where id = invited_membership.id;

    perform private.write_audit_event(
      actor_user_id,
      invited_membership.organization_id,
      'membership.invitation_accepted',
      'organization_membership',
      invited_membership.id::text,
      jsonb_build_object('role_id', invited_membership.role_id)
    );

    accepted_count := accepted_count + 1;
  end loop;

  perform private.assign_fallback_primary(actor_user_id);
  return accepted_count;
end;
$$;

create function public.set_my_primary_organization(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target_organization_id uuid;
begin
  if actor_user_id is null or not private.is_active_profile(actor_user_id) then
    raise exception 'Active authentication required' using errcode = '42501';
  end if;

  select m.organization_id into target_organization_id
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.id = target_membership_id
    and m.user_id = actor_user_id
    and m.status = 'active'
    and o.status = 'active'
  for update of m;

  if target_organization_id is null then
    raise exception 'Active membership not found' using errcode = '42501';
  end if;

  update public.organization_memberships
  set is_primary = false
  where user_id = actor_user_id and is_primary;

  update public.organization_memberships
  set is_primary = true
  where id = target_membership_id;

  perform private.write_audit_event(
    actor_user_id,
    target_organization_id,
    'membership.primary_changed',
    'organization_membership',
    target_membership_id::text,
    '{}'::jsonb
  );
end;
$$;

create function public.admin_update_organization_membership(
  target_membership_id uuid,
  target_role_id uuid,
  target_status public.membership_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_membership public.organization_memberships%rowtype;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into existing_membership
  from public.organization_memberships
  where id = target_membership_id
  for update;

  if existing_membership.id is null then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  if existing_membership.user_id = actor_user_id then
    raise exception 'Administrators cannot modify their own membership' using errcode = '42501';
  end if;

  if target_status = 'invited' then
    raise exception 'Existing memberships cannot be returned to invited status' using errcode = '22023';
  end if;

  if not private.has_permission(existing_membership.organization_id, 'memberships.manage', actor_user_id)
    or not private.can_assign_role(existing_membership.organization_id, existing_membership.role_id, actor_user_id)
    or not private.can_assign_role(existing_membership.organization_id, target_role_id, actor_user_id) then
    raise exception 'Not authorized to update this membership' using errcode = '42501';
  end if;

  if target_status = 'active' and not exists (
    select 1 from public.profiles
    where id = existing_membership.user_id and status = 'active'
  ) then
    raise exception 'A suspended profile cannot receive an active membership' using errcode = '22023';
  end if;

  update public.organization_memberships
  set
    role_id = target_role_id,
    status = target_status,
    is_primary = case when target_status = 'active' then is_primary else false end
  where id = target_membership_id;

  if target_status <> 'active' then
    perform private.assign_fallback_primary(existing_membership.user_id);
  else
    perform private.assign_fallback_primary(existing_membership.user_id);
  end if;

  perform private.write_audit_event(
    actor_user_id,
    existing_membership.organization_id,
    'membership.updated',
    'organization_membership',
    target_membership_id::text,
    jsonb_build_object(
      'target_user_id', existing_membership.user_id,
      'previous_role_id', existing_membership.role_id,
      'role_id', target_role_id,
      'previous_status', existing_membership.status,
      'status', target_status
    )
  );
end;
$$;

create function public.admin_remove_organization_membership(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_membership public.organization_memberships%rowtype;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into existing_membership
  from public.organization_memberships
  where id = target_membership_id
  for update;

  if existing_membership.id is null then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  if existing_membership.user_id = actor_user_id then
    raise exception 'Administrators cannot remove their own membership' using errcode = '42501';
  end if;

  if not private.has_permission(existing_membership.organization_id, 'memberships.manage', actor_user_id)
    or not private.can_assign_role(existing_membership.organization_id, existing_membership.role_id, actor_user_id) then
    raise exception 'Not authorized to remove this membership' using errcode = '42501';
  end if;

  delete from public.organization_memberships where id = target_membership_id;
  perform private.assign_fallback_primary(existing_membership.user_id);

  perform private.write_audit_event(
    actor_user_id,
    existing_membership.organization_id,
    'membership.removed',
    'organization_membership',
    target_membership_id::text,
    jsonb_build_object(
      'target_user_id', existing_membership.user_id,
      'role_id', existing_membership.role_id,
      'status', existing_membership.status
    )
  );
end;
$$;

create function public.admin_set_profile_status(
  target_user_id uuid,
  target_status public.profile_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_organization_id uuid;
  previous_status public.profile_status;
begin
  if actor_user_id is null or not private.is_super_admin(actor_user_id) then
    raise exception 'Super-admin authorization required' using errcode = '42501';
  end if;

  if target_user_id = actor_user_id then
    raise exception 'Super administrators cannot change their own profile status' using errcode = '42501';
  end if;

  select status into previous_status
  from public.profiles
  where id = target_user_id
  for update;

  if previous_status is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  select organization_id into actor_organization_id
  from public.organization_memberships
  where user_id = actor_user_id and status = 'active'
  order by is_primary desc, created_at
  limit 1;

  update public.profiles
  set status = target_status
  where id = target_user_id;

  if target_status <> 'active' then
    update public.organization_memberships
    set is_primary = false
    where user_id = target_user_id and is_primary;
  else
    perform private.assign_fallback_primary(target_user_id);
  end if;

  perform private.write_audit_event(
    actor_user_id,
    actor_organization_id,
    'profile.status_changed',
    'profile',
    target_user_id::text,
    jsonb_build_object('previous_status', previous_status, 'status', target_status)
  );
end;
$$;

revoke all on function private.write_audit_event(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.assign_fallback_primary(uuid)
  from public, anon, authenticated;

revoke all on function public.admin_invite_organization_member(uuid, uuid, uuid) from public, anon;
revoke all on function public.accept_my_organization_invitations() from public, anon;
revoke all on function public.set_my_primary_organization(uuid) from public, anon;
revoke all on function public.admin_update_organization_membership(uuid, uuid, public.membership_status) from public, anon;
revoke all on function public.admin_remove_organization_membership(uuid) from public, anon;
revoke all on function public.admin_set_profile_status(uuid, public.profile_status) from public, anon;

grant execute on function public.admin_invite_organization_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.accept_my_organization_invitations() to authenticated;
grant execute on function public.set_my_primary_organization(uuid) to authenticated;
grant execute on function public.admin_update_organization_membership(uuid, uuid, public.membership_status) to authenticated;
grant execute on function public.admin_remove_organization_membership(uuid) to authenticated;
grant execute on function public.admin_set_profile_status(uuid, public.profile_status) to authenticated;

commit;
