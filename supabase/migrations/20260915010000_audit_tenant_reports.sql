-- Forward-only audit corrections. The filename follows the existing future-dated
-- Phase 7 chain so hosted databases can apply it without replaying old migrations.
begin;

create or replace function private.can_view_phase5b_commissions(
  provider_id uuid, target_salesperson_id uuid default null
) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_profile()
    and exists (
      select 1 from public.organizations o
      where o.id = provider_id and o.status = 'active'
        and o.organization_type in ('fulfillment_company', 'white_label')
    )
    -- Provider-wide reports pass NULL. Every explicit salesperson must belong
    -- to this provider, including requests by provider and platform admins.
    and (target_salesperson_id is null or exists (
      select 1 from public.salespeople s
      where s.id = target_salesperson_id and s.organization_id = provider_id
    ))
    and (
      private.is_super_admin()
      or private.has_permission(provider_id, 'commissions.view')
      or private.has_permission(provider_id, 'reporting.view')
      or (target_salesperson_id is not null and exists (
        select 1 from public.salespeople s
        where s.id = target_salesperson_id and s.organization_id = provider_id
          and s.user_id = auth.uid()
      ) and private.has_permission(provider_id, 'salesperson.dashboard'))
    );
$$;

create or replace function public.get_client_sales_report(
  target_provider_id uuid, target_client_id uuid,
  target_start timestamptz, target_end timestamptz
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.can_view_phase5b_commissions(target_provider_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  -- Attribution is unique per order. Aggregate each order once; line counts
  -- must not multiply its total, and equal totals must not collapse together.
  with report_orders as (
    select o.id, o.total, a.salesperson_id
    from public.order_salesperson_attributions a
    join public.orders o on o.id = a.order_id
    where a.organization_id = target_provider_id
      and o.client_organization_id = target_client_id
      and o.submitted_at >= target_start and o.submitted_at < target_end
  )
  select jsonb_build_object(
    'scope', 'client', 'start', target_start, 'end', target_end,
    'order_count', count(*), 'salesperson_count', count(distinct r.salesperson_id),
    'quantity', coalesce((select sum(l.quantity) from public.order_lines l
      join report_orders ro on ro.id = l.order_id), 0),
    'sales_amount', coalesce(sum(r.total), 0)
  ) into result from report_orders r;
  return result;
end;
$$;

create or replace function public.get_company_sales_report(
  target_provider_id uuid, target_start timestamptz, target_end timestamptz
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.can_view_phase5b_commissions(target_provider_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  with report_orders as (
    select o.id, o.total, o.client_organization_id, a.salesperson_id
    from public.order_salesperson_attributions a
    join public.orders o on o.id = a.order_id
    where a.organization_id = target_provider_id
      and o.submitted_at >= target_start and o.submitted_at < target_end
  )
  select jsonb_build_object(
    'scope', 'company', 'start', target_start, 'end', target_end,
    'order_count', count(*), 'client_count', count(distinct r.client_organization_id),
    'salesperson_count', count(distinct r.salesperson_id),
    'quantity', coalesce((select sum(l.quantity) from public.order_lines l
      join report_orders ro on ro.id = l.order_id), 0),
    'sales_amount', coalesce(sum(r.total), 0),
    'commission_amount', coalesce((select sum(c.commission_amount)
      from public.commission_snapshots c where c.organization_id = target_provider_id
        and c.created_at >= target_start and c.created_at < target_end), 0)
  ) into result from report_orders r;
  return result;
end;
$$;

revoke all on function private.can_view_phase5b_commissions(uuid, uuid) from public, anon;
revoke all on function public.get_client_sales_report(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.get_company_sales_report(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function private.can_view_phase5b_commissions(uuid, uuid) to authenticated;
grant execute on function public.get_client_sales_report(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_company_sales_report(uuid, timestamptz, timestamptz) to authenticated;

commit;
