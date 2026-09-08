-- Phase 7: restrict STAFF salesperson data to the signed-in salesperson and
-- explicitly assigned clients. Provider administrators retain provider scope.
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
        and (
          r.code not in ('CLIENT_USER', 'CLIENT_ADMIN', 'STAFF')
          or (
            r.code = 'CLIENT_USER'
            and p.code in (
              'orders.read','orders.view','orders.create',
              'inventory.read','inventory.view',
              'products.read','products.view',
              'customers.read','customers.view','customer_addresses.view',
              'shipping.read','shipping.view','messages.read','reports.read',
              'billing.view','client_catalog.view',
              'cases.view','cases.acknowledge','replacements.view','returns.view',
              'library.view','library.download','library.print'
            )
          )
          or (
            r.code = 'CLIENT_ADMIN'
            and p.code in (
              'orders.read','orders.view','orders.create',
              'inventory.read','inventory.view',
              'products.read','products.view',
              'customers.read','customers.view','customer_addresses.view',
              'shipping.read','shipping.view','messages.read','reports.read',
              'billing.view','client_catalog.view',
              'cases.view','cases.acknowledge','replacements.view','returns.view',
              'library.view','library.download','library.print',
              'organizations.read','memberships.read','memberships.manage','roles.read',
              'customers.manage','customers.lifecycle','customers.history','customer_addresses.manage'
            )
          )
          or (
            r.code = 'STAFF'
            and p.code not in (
              'salespeople.manage','salesperson.assign','commissions.view',
              'commissions.manage','payouts.manage','pricing_tiers.manage','reporting.view'
            )
          )
        )
    )
  );
$$;

create or replace function public.get_phase5b_admin_context(target_provider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  provider_admin boolean;
  own_salesperson_id uuid;
  result jsonb;
begin
  if not private.is_active_profile() or not (
    private.has_permission(target_provider_id,'salespeople.view')
    or private.has_permission(target_provider_id,'pricing_tiers.view')
    or private.has_permission(target_provider_id,'commissions.view')
  ) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  provider_admin := private.is_super_admin()
    or private.has_permission(target_provider_id,'salespeople.manage')
    or private.has_permission(target_provider_id,'commissions.view')
    or private.has_permission(target_provider_id,'pricing_tiers.manage');

  select s.id into own_salesperson_id
  from public.salespeople s
  where s.organization_id=target_provider_id
    and s.user_id=auth.uid()
    and s.status='active'
  order by s.id
  limit 1;

  select jsonb_build_object(
    'salespeople', coalesce((select jsonb_agg(to_jsonb(s) order by s.display_name)
      from public.salespeople s
      where s.organization_id=target_provider_id
        and (provider_admin or s.id=own_salesperson_id)),'[]'),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object(
        'id',a.id,'client_organization_id',a.client_organization_id,
        'salesperson_id',a.salesperson_id,'effective_from',a.effective_from,'status',a.status)
      order by a.created_at desc)
      from public.client_salesperson_assignments a
      where a.organization_id=target_provider_id
        and (provider_admin or a.salesperson_id=own_salesperson_id)),'[]'),
    'pricing_tiers', coalesce((select jsonb_agg(to_jsonb(t) order by t.priority desc,t.name)
      from public.pricing_tiers t
      where t.organization_id=target_provider_id
        and private.has_permission(target_provider_id,'pricing_tiers.view')),'[]'),
    'tier_assignments', case when provider_admin then coalesce((select jsonb_agg(jsonb_build_object(
        'id',a.id,'client_organization_id',a.client_organization_id,
        'pricing_tier_id',a.pricing_tier_id,'effective_from',a.effective_from,'status',a.status)
      order by a.created_at desc)
      from public.client_pricing_tier_assignments a
      where a.organization_id=target_provider_id),'[]') else '[]'::jsonb end,
    'commission_rules', case when private.can_view_phase5b_commissions(target_provider_id)
      then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc)
        from public.commission_rules r where r.organization_id=target_provider_id),'[]')
      else '[]'::jsonb end
  ) into result;
  return result;
end $$;

commit;
