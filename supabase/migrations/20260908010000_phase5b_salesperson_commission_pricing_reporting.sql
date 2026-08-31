-- Phase 5B: salesperson attribution, commission accounting, pricing tiers, and reporting.
-- Forward-only additive migration. Commission data is provider-owned and separate
-- from client-visible order tables.

insert into public.permissions(code,name,description) values
 ('salespeople.view','View salespeople','View salesperson records and assignments.'),
 ('salespeople.manage','Manage salespeople','Create and maintain salesperson records.'),
 ('salesperson.dashboard','Salesperson dashboard','View the signed-in salesperson dashboard.'),
 ('salesperson.assign','Assign salespeople','Assign salespeople to client organizations.'),
 ('commissions.view','View commissions','View confidential commission information.'),
 ('commissions.manage','Manage commissions','Configure commission rules and lifecycle.'),
 ('payouts.manage','Manage payouts','Create and settle salesperson commission payouts.'),
 ('pricing_tiers.view','View pricing tiers','View provider pricing tiers.'),
 ('pricing_tiers.manage','Manage pricing tiers','Configure pricing tiers and tier prices.'),
 ('reporting.view','View sales reporting','View provider sales and commission reports.')
on conflict(code) do nothing;

-- Phase 4A allocates order numbers per provider organization. The historical
-- global unique constraint made independent tenants collide at 000001.
alter table public.orders drop constraint orders_order_number_key;
alter table public.orders add constraint orders_organization_order_number_key unique(organization_id,order_number);
alter table public.order_verifications drop constraint order_verifications_verification_number_key;
alter table public.order_verifications add constraint order_verifications_organization_verification_number_key unique(organization_id,verification_number);

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='SUPER_ADMIN' and p.code in('salespeople.view','salespeople.manage','salesperson.dashboard','salesperson.assign','commissions.view','commissions.manage','payouts.manage','pricing_tiers.view','pricing_tiers.manage','reporting.view'))
   or (r.code='ADMIN' and p.code in('salespeople.view','salespeople.manage','salesperson.dashboard','salesperson.assign','commissions.view','commissions.manage','payouts.manage','pricing_tiers.view','pricing_tiers.manage','reporting.view'))
   or (r.code='STAFF' and p.code in('salespeople.view','salesperson.dashboard','pricing_tiers.view'))
on conflict do nothing;

create table public.salespeople(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 user_id uuid references auth.users(id) on delete restrict, code text not null check(code~'^[A-Z0-9][A-Z0-9_-]{1,39}$'),
 display_name text not null check(length(trim(display_name)) between 1 and 160), email text not null default '' check(length(email)<=254),
 status text not null default 'active' check(status in('active','inactive','suspended')),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,code),unique nulls not distinct(organization_id,user_id)
);

create table public.client_salesperson_assignments(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,salesperson_id uuid not null references public.salespeople(id) on delete restrict,
 effective_from timestamptz not null default now(),effective_to timestamptz,status text not null default 'active' check(status in('active','inactive')),
 assigned_by_user_id uuid references auth.users(id) on delete restrict,version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(effective_to is null or effective_to>effective_from),
 foreign key(organization_id,client_organization_id) references public.client_service_relationships(organization_id,client_organization_id)
);

create table public.pricing_tiers(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 code text not null check(code~'^[A-Z0-9][A-Z0-9_-]{1,39}$'),name text not null check(length(trim(name)) between 1 and 120),
 description text not null default '',priority integer not null default 100 check(priority between 1 and 100000),
 status text not null default 'active' check(status in('active','inactive')),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,code)
);

create table public.client_pricing_tier_assignments(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,pricing_tier_id uuid not null references public.pricing_tiers(id) on delete restrict,
 effective_from timestamptz not null default now(),effective_to timestamptz,status text not null default 'active' check(status in('active','inactive')),
 assigned_by_user_id uuid references auth.users(id) on delete restrict,version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(effective_to is null or effective_to>effective_from),
 foreign key(organization_id,client_organization_id) references public.client_service_relationships(organization_id,client_organization_id)
);

create table public.pricing_tier_prices(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 pricing_tier_id uuid not null references public.pricing_tiers(id) on delete restrict,product_id uuid not null,variant_id uuid,
 currency text not null check(currency~'^[A-Z]{3}$'),unit_price numeric(18,4) not null check(unit_price>=0 and unit_price<'Infinity'::numeric),
 minimum_quantity integer not null default 1 check(minimum_quantity>0),maximum_quantity integer check(maximum_quantity>=minimum_quantity),
 starts_at timestamptz not null default now(),ends_at timestamptz,status text not null default 'active' check(status in('active','inactive')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(ends_at is null or ends_at>starts_at),
 foreign key(organization_id,product_id) references public.products(organization_id,id),
 foreign key(organization_id,variant_id) references public.product_variants(organization_id,id),
 foreign key(pricing_tier_id) references public.pricing_tiers(id)
);

create table public.order_salesperson_attributions(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,order_id uuid not null references public.orders(id) on delete restrict,
 salesperson_id uuid not null references public.salespeople(id) on delete restrict,assignment_id uuid references public.client_salesperson_assignments(id) on delete restrict,
 assignment_snapshot jsonb not null,attributed_at timestamptz not null default now(),created_by_user_id uuid references auth.users(id),
 unique(organization_id,order_id),foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id) on delete restrict
);

create table public.commission_rules(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 salesperson_id uuid not null references public.salespeople(id) on delete restrict,client_organization_id uuid references public.organizations(id) on delete restrict,
 name text not null check(length(trim(name)) between 1 and 160),basis text not null check(basis in('order_subtotal','order_total')),
 rate_type text not null check(rate_type in('percentage','fixed')),rate numeric(18,6) not null check(rate>=0 and rate<'Infinity'::numeric),
 currency text not null default 'USD' check(currency~'^[A-Z]{3}$'),priority integer not null default 100 check(priority between 1 and 100000),
 effective_from timestamptz not null default now(),effective_to timestamptz,status text not null default 'active' check(status in('active','inactive')),
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>effective_from)
);

create table public.commission_snapshots(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,order_id uuid not null references public.orders(id) on delete restrict,
 salesperson_id uuid not null references public.salespeople(id) on delete restrict,commission_rule_id uuid references public.commission_rules(id) on delete restrict,
 rule_snapshot jsonb not null,commission_basis text not null check(commission_basis in('order_subtotal','order_total')),
 sales_amount numeric(20,4) not null check(sales_amount>=0),quantity numeric(20,6) not null check(quantity>=0),
 rate_snapshot numeric(18,6) not null check(rate_snapshot>=0),rate_type text not null check(rate_type in('percentage','fixed')),
 commission_amount numeric(20,4) not null check(commission_amount>=0),currency text not null check(currency~'^[A-Z]{3}$'),
 status text not null default 'pending' check(status in('pending','earned','payable','paid','voided')),idempotency_key text not null unique,
 earned_at timestamptz,payable_at timestamptz,paid_at timestamptz,voided_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,order_id,salesperson_id),foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id) on delete restrict
);

create table public.commission_lifecycle_events(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete restrict,
 commission_snapshot_id uuid not null references public.commission_snapshots(id) on delete restrict,old_status text,new_status text not null,action text not null,
 actor_user_id uuid references auth.users(id),metadata jsonb not null default '{}',created_at timestamptz not null default now()
);

create table public.commission_payout_counters(
 organization_id uuid primary key references public.organizations(id) on delete restrict,next_number bigint not null default 1 check(next_number between 1 and 999999999)
);

create table public.commission_payouts(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 salesperson_id uuid not null references public.salespeople(id) on delete restrict,payout_number text not null,currency text not null check(currency~'^[A-Z]{3}$'),
 total_amount numeric(20,4) not null check(total_amount>=0),status text not null default 'pending' check(status in('pending','paid','voided')),
 paid_at timestamptz,external_reference text not null default '',idempotency_key text not null unique,created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,payout_number)
);

create table public.commission_payout_lines(
 id uuid primary key default extensions.gen_random_uuid(),payout_id uuid not null references public.commission_payouts(id) on delete restrict,
 commission_snapshot_id uuid not null unique references public.commission_snapshots(id) on delete restrict,amount numeric(20,4) not null check(amount>=0),created_at timestamptz not null default now()
);

create table public.commission_payout_events(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete restrict,
 payout_id uuid not null references public.commission_payouts(id) on delete restrict,old_status text,new_status text not null,action text not null,
 actor_user_id uuid references auth.users(id),metadata jsonb not null default '{}',created_at timestamptz not null default now()
);

create index client_salesperson_lookup on public.client_salesperson_assignments(organization_id,client_organization_id,status,effective_from);
create index pricing_tier_assignment_lookup on public.client_pricing_tier_assignments(organization_id,client_organization_id,status,effective_from);
create index tier_price_lookup on public.pricing_tier_prices(organization_id,pricing_tier_id,product_id,variant_id,currency,status);
create index commission_reporting_lookup on public.commission_snapshots(organization_id,salesperson_id,status,created_at);
create index attribution_reporting_lookup on public.order_salesperson_attributions(organization_id,salesperson_id,attributed_at);

do $$declare t text;begin foreach t in array array['salespeople','client_salesperson_assignments','pricing_tiers','client_pricing_tier_assignments','pricing_tier_prices','order_salesperson_attributions','commission_rules','commission_snapshots','commission_lifecycle_events','commission_payout_counters','commission_payouts','commission_payout_lines','commission_payout_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t not in('commission_snapshots','commission_lifecycle_events','commission_payout_lines','commission_payout_events') then execute format('create trigger %I_updated before update on public.%I for each row execute function private.set_updated_at()',t,t);end if;
 end loop;end $$;
revoke all on sequence public.commission_lifecycle_events_id_seq,public.commission_payout_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.commission_lifecycle_events_id_seq,public.commission_payout_events_id_seq to service_role;

create function private.can_view_phase5b_commissions(provider_id uuid,target_salesperson_id uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_profile() and exists(select 1 from public.organizations o where o.id=provider_id and o.status='active' and o.organization_type in('fulfillment_company','white_label')) and (
  private.is_super_admin() or private.has_permission(provider_id,'commissions.view') or private.has_permission(provider_id,'reporting.view') or
  (target_salesperson_id is not null and exists(select 1 from public.salespeople s where s.id=target_salesperson_id and s.organization_id=provider_id and s.user_id=auth.uid()) and private.has_permission(provider_id,'salesperson.dashboard')));
$$;
revoke all on function private.can_view_phase5b_commissions(uuid,uuid) from public,anon;
grant execute on function private.can_view_phase5b_commissions(uuid,uuid) to authenticated;

create function private.validate_phase5b_record() returns trigger language plpgsql security definer set search_path='' as $$
declare provider public.organizations;client public.organizations;tier public.pricing_tiers;seller public.salespeople;rec jsonb;org_id uuid;client_id uuid;new_salesperson_id uuid;new_tier_id uuid;new_product_id uuid;new_variant_id uuid;record_status text;new_effective_from timestamptz;new_effective_to timestamptz;record_id uuid;
begin
 rec:=to_jsonb(new);org_id:=(rec->>'organization_id')::uuid;record_id:=(rec->>'id')::uuid;record_status:=rec->>'status';new_effective_from:=(rec->>'effective_from')::timestamptz;new_effective_to:=(rec->>'effective_to')::timestamptz;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(org_id::text,'')||tg_table_name,5105));
 select * into provider from public.organizations where id=org_id;
 if provider.id is null or provider.status<>'active' or provider.organization_type not in('fulfillment_company','white_label') then raise exception 'Active fulfillment organization required' using errcode='22023';end if;
 if tg_table_name in('client_salesperson_assignments','client_pricing_tier_assignments','commission_rules') then
 client_id:=(rec->>'client_organization_id')::uuid;select * into client from public.organizations where id=client_id and organization_type='client_company' and status='active';
  if client_id is not null and (client.id is null or client.parent_organization_id<>org_id) then raise exception 'Client is not owned by provider' using errcode='22023';end if;
 end if;
 if tg_table_name='salespeople' then
  if record_status='active' and (rec->>'user_id') is not null and not exists(select 1 from public.organization_memberships m join public.profiles p on p.id=m.user_id where m.organization_id=org_id and m.user_id=(rec->>'user_id')::uuid and m.status='active' and p.status='active') then raise exception 'User must be an active provider member' using errcode='22023';end if;
 elsif tg_table_name in('client_salesperson_assignments','commission_rules','commission_payouts') then
  new_salesperson_id:=(rec->>'salesperson_id')::uuid;select * into seller from public.salespeople where id=new_salesperson_id and organization_id=org_id;
  if seller.id is null or seller.status<>'active' then raise exception 'Active salesperson required' using errcode='22023';end if;
 end if;
 if tg_table_name='client_salesperson_assignments' and record_status='active' and exists(select 1 from public.client_salesperson_assignments a where a.organization_id=org_id and a.client_organization_id=client_id and a.status='active' and a.effective_from<coalesce(new_effective_to,'infinity'::timestamptz) and coalesce(a.effective_to,'infinity'::timestamptz)>new_effective_from and (tg_op='INSERT' or a.id<>record_id)) then raise exception 'Overlapping salesperson assignment' using errcode='23P01';end if;
 if tg_table_name='client_pricing_tier_assignments' and record_status='active' then
  new_tier_id:=(rec->>'pricing_tier_id')::uuid;select * into tier from public.pricing_tiers where id=new_tier_id and organization_id=org_id and status='active';
  if tier.id is null then raise exception 'Active pricing tier required' using errcode='22023';end if;
  if exists(select 1 from public.client_pricing_tier_assignments a where a.organization_id=org_id and a.client_organization_id=client_id and a.status='active' and a.effective_from<coalesce(new_effective_to,'infinity'::timestamptz) and coalesce(a.effective_to,'infinity'::timestamptz)>new_effective_from and (tg_op='INSERT' or a.id<>record_id)) then raise exception 'Overlapping pricing tier assignment' using errcode='23P01';end if;
 end if;
 if tg_table_name='pricing_tier_prices' and record_status='active' then
  new_tier_id:=(rec->>'pricing_tier_id')::uuid;new_product_id:=(rec->>'product_id')::uuid;new_variant_id:=(rec->>'variant_id')::uuid;
  if not exists(select 1 from public.pricing_tiers where id=new_tier_id and organization_id=org_id) then raise exception 'Pricing tier ownership mismatch' using errcode='22023';end if;
  if new_variant_id is not null and not exists(select 1 from public.product_variants where id=new_variant_id and organization_id=org_id and product_id=new_product_id) then raise exception 'Variant does not belong to product' using errcode='22023';end if;
  if exists(select 1 from public.pricing_tier_prices p where p.organization_id=org_id and p.pricing_tier_id=new_tier_id and p.product_id=new_product_id and p.variant_id is not distinct from new_variant_id and p.currency=rec->>'currency' and p.status='active' and p.minimum_quantity=(rec->>'minimum_quantity')::integer and p.starts_at<coalesce(new_effective_to,'infinity'::timestamptz) and coalesce(p.ends_at,'infinity'::timestamptz)>new_effective_from and (tg_op='INSERT' or p.id<>record_id)) then raise exception 'Overlapping pricing tier price' using errcode='23P01';end if;
 end if;
 if tg_table_name='commission_rules' and record_status='active' and exists(select 1 from public.commission_rules r where r.organization_id=org_id and r.salesperson_id=new_salesperson_id and r.client_organization_id is not distinct from client_id and r.basis=rec->>'basis' and r.priority=(rec->>'priority')::integer and r.status='active' and r.effective_from<coalesce(new_effective_to,'infinity'::timestamptz) and coalesce(r.effective_to,'infinity'::timestamptz)>new_effective_from and (tg_op='INSERT' or r.id<>record_id)) then raise exception 'Overlapping commission rule' using errcode='23P01';end if;
 return new;
end $$;
revoke all on function private.validate_phase5b_record() from public,anon,authenticated;
create trigger salesperson_validate before insert or update on public.salespeople for each row execute function private.validate_phase5b_record();
create trigger salesperson_assignment_validate before insert or update on public.client_salesperson_assignments for each row execute function private.validate_phase5b_record();
create trigger pricing_tier_assignment_validate before insert or update on public.client_pricing_tier_assignments for each row execute function private.validate_phase5b_record();
create trigger pricing_tier_price_validate before insert or update on public.pricing_tier_prices for each row execute function private.validate_phase5b_record();
create trigger commission_rule_validate before insert or update on public.commission_rules for each row execute function private.validate_phase5b_record();
create trigger commission_payout_validate before insert or update on public.commission_payouts for each row execute function private.validate_phase5b_record();

create function private.prevent_phase5b_snapshot_mutation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or (tg_op='UPDATE' and current_setting('app.phase5b_internal',true)<>'true') then raise exception 'Commission history is immutable' using errcode='42501';end if;
 return coalesce(new,old);
end $$;
revoke all on function private.prevent_phase5b_snapshot_mutation() from public,anon,authenticated;
create trigger commission_snapshot_immutable before update or delete on public.commission_snapshots for each row execute function private.prevent_phase5b_snapshot_mutation();
create trigger commission_event_immutable before update or delete on public.commission_lifecycle_events for each row execute function private.prevent_phase5b_snapshot_mutation();
create trigger payout_event_immutable before update or delete on public.commission_payout_events for each row execute function private.prevent_phase5b_snapshot_mutation();

create function private.resolve_order_price(provider_id uuid,client_id uuid,target_product_id uuid,target_variant_id uuid,target_currency text,target_quantity numeric)
returns table(unit_price numeric,source_kind text,pricing_tier_id uuid,pricing_tier_code text)
language sql stable security definer set search_path='' as $$
 with tier as (
  select a.pricing_tier_id,t.code from public.client_pricing_tier_assignments a join public.pricing_tiers t on t.id=a.pricing_tier_id and t.organization_id=a.organization_id and t.status='active'
  where a.organization_id=provider_id and a.client_organization_id=client_id and a.status='active' and a.effective_from<=statement_timestamp() and (a.effective_to is null or statement_timestamp()<a.effective_to)
  order by t.priority desc,a.effective_from desc limit 1
 ), candidates as (
  select r.unit_price,r.price_kind source_kind,null::uuid pricing_tier_id,null::text pricing_tier_code,
   case r.price_kind when 'override' then 4 when 'client' then 3 else 1 end rank,r.variant_id is not null exact_variant,r.minimum_quantity,r.starts_at,r.id::text tie
   from public.client_selling_prices r where r.organization_id=provider_id and r.product_id=target_product_id and (r.variant_id is null or r.variant_id=target_variant_id)
   and (r.client_organization_id is null or r.client_organization_id=client_id) and r.currency=target_currency and r.status='active' and r.starts_at<=statement_timestamp()
   and (r.ends_at is null or statement_timestamp()<r.ends_at) and r.minimum_quantity<=target_quantity and (r.maximum_quantity is null or target_quantity<=r.maximum_quantity)
  union all
  select p.unit_price,'tier',t.pricing_tier_id,t.code,2,p.variant_id is not null,p.minimum_quantity,p.starts_at,p.id::text
   from public.pricing_tier_prices p join tier t on true where p.organization_id=provider_id and p.pricing_tier_id=t.pricing_tier_id and p.product_id=target_product_id
   and (p.variant_id is null or p.variant_id=target_variant_id) and p.currency=target_currency and p.status='active' and p.starts_at<=statement_timestamp()
   and (p.ends_at is null or statement_timestamp()<p.ends_at) and p.minimum_quantity<=target_quantity and (p.maximum_quantity is null or target_quantity<=p.maximum_quantity)
 )
 select c.unit_price,c.source_kind,c.pricing_tier_id,c.pricing_tier_code from candidates c order by c.rank desc,c.exact_variant desc,c.minimum_quantity desc,c.starts_at desc,c.tie limit 1;
$$;
revoke all on function private.resolve_order_price(uuid,uuid,uuid,uuid,text,numeric) from public,anon,authenticated;

create function private.capture_phase5b_order_attribution() returns trigger language plpgsql security definer set search_path='' as $$
declare assignment public.client_salesperson_assignments;s public.salespeople;
begin
 select ca.* into assignment from public.client_salesperson_assignments ca where ca.organization_id=new.organization_id and ca.client_organization_id=new.client_organization_id and ca.status='active' and ca.effective_from<=new.submitted_at and (ca.effective_to is null or new.submitted_at<ca.effective_to) order by ca.effective_from desc,ca.id limit 1;
 if assignment.id is null then return new;end if;
 select * into s from public.salespeople where id=assignment.salesperson_id and organization_id=new.organization_id and status='active';
 if s.id is null then return new;end if;
 insert into public.order_salesperson_attributions(organization_id,client_organization_id,order_id,salesperson_id,assignment_id,assignment_snapshot,created_by_user_id)
 values(new.organization_id,new.client_organization_id,new.id,s.id,assignment.id,jsonb_build_object('salesperson_id',s.id,'code',s.code,'display_name',s.display_name,'assigned_at',assignment.effective_from),auth.uid()) on conflict(organization_id,order_id) do nothing;
 return new;
end $$;
revoke all on function private.capture_phase5b_order_attribution() from public,anon,authenticated;
create trigger order_phase5b_attribution after insert on public.orders for each row execute function private.capture_phase5b_order_attribution();

create function private.create_phase5b_commission_snapshot_for_order(target_order_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;a public.order_salesperson_attributions;rule_record public.commission_rules;qty numeric;basis numeric;amount numeric;rid uuid;
begin
 select * into o from public.orders where id=target_order_id;if o.id is null then return;end if;
 select * into a from public.order_salesperson_attributions where organization_id=o.organization_id and order_id=o.id;if a.id is null then return;end if;
 select cr.* into rule_record from public.commission_rules cr where cr.organization_id=o.organization_id and cr.salesperson_id=a.salesperson_id and (cr.client_organization_id is null or cr.client_organization_id=o.client_organization_id) and cr.status='active' and cr.effective_from<=o.submitted_at and (cr.effective_to is null or o.submitted_at<cr.effective_to)
  order by (cr.client_organization_id is not null) desc,cr.priority desc,cr.effective_from desc,cr.id limit 1;
 if rule_record.id is null then return;end if;
 qty:=coalesce((select sum(l.quantity) from public.order_lines l where l.order_id=o.id),0);basis:=case rule_record.basis when 'order_total' then o.total else o.subtotal end;
 amount:=case when rule_record.rate_type='percentage' then round(basis*rule_record.rate/100,private.money_scale(o.currency)) else round(rule_record.rate,private.money_scale(o.currency)) end;
 insert into public.commission_snapshots(organization_id,client_organization_id,order_id,salesperson_id,commission_rule_id,rule_snapshot,commission_basis,sales_amount,quantity,rate_snapshot,rate_type,commission_amount,currency,idempotency_key)
 values(o.organization_id,o.client_organization_id,o.id,a.salesperson_id,rule_record.id,jsonb_build_object('id',rule_record.id,'name',rule_record.name,'basis',rule_record.basis,'rate_type',rule_record.rate_type,'rate',rule_record.rate,'currency',rule_record.currency,'priority',rule_record.priority,'effective_from',rule_record.effective_from,'effective_to',rule_record.effective_to),rule_record.basis,basis,qty,rule_record.rate,rule_record.rate_type,amount,o.currency,'order:'||o.id::text)
 on conflict(organization_id,order_id,salesperson_id) do nothing returning id into rid;
 if rid is not null then
  insert into public.commission_lifecycle_events(organization_id,commission_snapshot_id,new_status,action,metadata) values(o.organization_id,rid,'pending','created',jsonb_build_object('order_id',o.id,'salesperson_id',a.salesperson_id));
  perform private.write_audit_event(null,o.organization_id,'commission.snapshot_created','commission_snapshot',rid::text,jsonb_build_object('order_id',o.id,'salesperson_id',a.salesperson_id));
 end if;
end $$;
revoke all on function private.create_phase5b_commission_snapshot_for_order(uuid) from public,anon,authenticated;
create function private.capture_phase5b_order_event() returns trigger language plpgsql security definer set search_path='' as $$begin if new.action='submitted' then perform private.create_phase5b_commission_snapshot_for_order(new.order_id);end if;return new;end $$;
revoke all on function private.capture_phase5b_order_event() from public,anon,authenticated;
create trigger order_phase5b_commission after insert on public.order_lifecycle_events for each row execute function private.capture_phase5b_order_event();

create function public.admin_save_salesperson(target_id uuid,target_provider_id uuid,target_user_id uuid,target_code text,target_name text,target_email text,target_status text,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not private.has_permission(target_provider_id,'salespeople.manage') then raise exception 'Salesperson management permission required' using errcode='42501';end if;
 if target_code is null or upper(target_code)<>target_code or target_code!~'^[A-Z0-9][A-Z0-9_-]{1,39}$' or target_name is null or length(trim(target_name)) not between 1 and 160 or length(coalesce(target_email,''))>254 or target_status not in('active','inactive','suspended') then raise exception 'Invalid salesperson details' using errcode='22023';end if;
 if target_user_id is not null and not exists(select 1 from public.organization_memberships m join public.profiles p on p.id=m.user_id where m.organization_id=target_provider_id and m.user_id=target_user_id and m.status='active' and p.status='active') then raise exception 'User must be an active provider member' using errcode='22023';end if;
 if target_id is null then insert into public.salespeople(organization_id,user_id,code,display_name,email,status) values(target_provider_id,target_user_id,target_code,trim(target_name),coalesce(target_email,''),target_status) returning id into rid;
 else update public.salespeople set user_id=target_user_id,code=target_code,display_name=trim(target_name),email=coalesce(target_email,''),status=target_status,version=version+1 where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Salesperson not found or stale version' using errcode='40001';end if;end if;
 perform private.write_audit_event(auth.uid(),target_provider_id,'salesperson.saved','salesperson',rid::text,jsonb_build_object('status',target_status));return rid;
end $$;

create function public.admin_assign_client_salesperson(target_provider_id uuid,target_client_id uuid,target_salesperson_id uuid,target_effective_from timestamptz default now()) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not(private.has_permission(target_provider_id,'salesperson.assign') or private.has_permission(target_provider_id,'salespeople.manage')) then raise exception 'Salesperson assignment permission required' using errcode='42501';end if;
 if not exists(select 1 from public.client_service_relationships s where s.organization_id=target_provider_id and s.client_organization_id=target_client_id and s.status='active') then raise exception 'Active client service relationship required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_provider_id::text||target_client_id::text,5106));
 update public.client_salesperson_assignments set status='inactive',effective_to=least(coalesce(effective_to,target_effective_from),target_effective_from),updated_at=now() where organization_id=target_provider_id and client_organization_id=target_client_id and status='active' and effective_from<target_effective_from and (effective_to is null or effective_to>target_effective_from);
 insert into public.client_salesperson_assignments(organization_id,client_organization_id,salesperson_id,effective_from,assigned_by_user_id) values(target_provider_id,target_client_id,target_salesperson_id,target_effective_from,auth.uid()) returning id into rid;
 perform private.write_audit_event(auth.uid(),target_provider_id,'salesperson.assigned','client_salesperson_assignment',rid::text,jsonb_build_object('client_organization_id',target_client_id,'salesperson_id',target_salesperson_id));return rid;
end $$;

create function public.admin_onboard_client_with_salesperson(target_provider_id uuid,target_client_id uuid,target_name text,target_slug text,target_email text,target_phone text,target_status public.organization_status,target_salesperson_id uuid,target_pricing_tier_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not private.is_super_admin() then raise exception 'Active super-admin required' using errcode='42501';end if;
 cid:=public.admin_save_client_account(target_client_id,target_provider_id,target_name,target_slug,target_email,target_phone,target_status);
 perform public.admin_assign_client_salesperson(target_provider_id,cid,target_salesperson_id,now());
 if target_pricing_tier_id is not null then perform public.admin_assign_client_pricing_tier(target_provider_id,cid,target_pricing_tier_id,now());end if;
 return cid;
end $$;

create function public.admin_save_pricing_tier(target_id uuid,target_provider_id uuid,target_code text,target_name text,target_description text,target_priority integer,target_status text,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not private.has_permission(target_provider_id,'pricing_tiers.manage') then raise exception 'Pricing tier management permission required' using errcode='42501';end if;
 if target_code is null or upper(target_code)<>target_code or target_code!~'^[A-Z0-9][A-Z0-9_-]{1,39}$' or target_name is null or length(trim(target_name)) not between 1 and 120 or target_priority not between 1 and 100000 or target_status not in('active','inactive') then raise exception 'Invalid pricing tier' using errcode='22023';end if;
 if target_id is null then insert into public.pricing_tiers(organization_id,code,name,description,priority,status) values(target_provider_id,target_code,trim(target_name),coalesce(target_description,''),target_priority,target_status) returning id into rid;
 else update public.pricing_tiers set code=target_code,name=trim(target_name),description=coalesce(target_description,''),priority=target_priority,status=target_status,version=version+1 where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Pricing tier not found or stale version' using errcode='40001';end if;end if;
 perform private.write_audit_event(auth.uid(),target_provider_id,'pricing_tier.saved','pricing_tier',rid::text,jsonb_build_object('code',target_code));return rid;
end $$;

create function public.admin_assign_client_pricing_tier(target_provider_id uuid,target_client_id uuid,target_pricing_tier_id uuid,target_effective_from timestamptz default now()) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not private.has_permission(target_provider_id,'pricing_tiers.manage') then raise exception 'Pricing tier management permission required' using errcode='42501';end if;
 if not exists(select 1 from public.client_service_relationships s where s.organization_id=target_provider_id and s.client_organization_id=target_client_id and s.status='active') then raise exception 'Active client service relationship required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_provider_id::text||target_client_id::text,5107));
 update public.client_pricing_tier_assignments set status='inactive',effective_to=least(coalesce(effective_to,target_effective_from),target_effective_from),updated_at=now() where organization_id=target_provider_id and client_organization_id=target_client_id and status='active' and effective_from<target_effective_from and (effective_to is null or effective_to>target_effective_from);
 insert into public.client_pricing_tier_assignments(organization_id,client_organization_id,pricing_tier_id,effective_from,assigned_by_user_id) values(target_provider_id,target_client_id,target_pricing_tier_id,target_effective_from,auth.uid()) returning id into rid;
 perform private.write_audit_event(auth.uid(),target_provider_id,'pricing_tier.assigned','client_pricing_tier_assignment',rid::text,jsonb_build_object('client_organization_id',target_client_id,'pricing_tier_id',target_pricing_tier_id));return rid;
end $$;

create function public.admin_save_pricing_tier_price(target_id uuid,target_provider_id uuid,target_pricing_tier_id uuid,target_product_id uuid,target_variant_id uuid,target_currency text,target_unit_price numeric,target_minimum_quantity integer,target_maximum_quantity integer,target_starts_at timestamptz,target_ends_at timestamptz,target_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not private.has_permission(target_provider_id,'pricing_tiers.manage') then raise exception 'Pricing tier management permission required' using errcode='42501';end if;
 if target_currency!~'^[A-Z]{3}$' or target_unit_price<0 or target_minimum_quantity<1 or(target_maximum_quantity is not null and target_maximum_quantity<target_minimum_quantity) or target_status not in('active','inactive') then raise exception 'Invalid pricing tier price' using errcode='22023';end if;
 if target_id is null then insert into public.pricing_tier_prices(organization_id,pricing_tier_id,product_id,variant_id,currency,unit_price,minimum_quantity,maximum_quantity,starts_at,ends_at,status) values(target_provider_id,target_pricing_tier_id,target_product_id,target_variant_id,target_currency,target_unit_price,target_minimum_quantity,target_maximum_quantity,coalesce(target_starts_at,now()),target_ends_at,target_status) returning id into rid;
 else update public.pricing_tier_prices set unit_price=target_unit_price,minimum_quantity=target_minimum_quantity,maximum_quantity=target_maximum_quantity,starts_at=coalesce(target_starts_at,starts_at),ends_at=target_ends_at,status=target_status,updated_at=now() where id=target_id and organization_id=target_provider_id returning id into rid;if rid is null then raise exception 'Pricing tier price not found' using errcode='P0002';end if;end if;
 return rid;end $$;

create function public.admin_save_commission_rule(target_id uuid,target_provider_id uuid,target_salesperson_id uuid,target_client_id uuid,target_name text,target_basis text,target_rate_type text,target_rate numeric,target_currency text,target_priority integer,target_effective_from timestamptz,target_effective_to timestamptz,target_status text,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not private.has_permission(target_provider_id,'commissions.manage') then raise exception 'Commission management permission required' using errcode='42501';end if;
 if target_name is null or length(trim(target_name)) not between 1 and 160 or target_basis not in('order_subtotal','order_total') or target_rate_type not in('percentage','fixed') or target_rate<0 or target_currency!~'^[A-Z]{3}$' or target_priority not between 1 and 100000 or target_status not in('active','inactive') then raise exception 'Invalid commission rule' using errcode='22023';end if;
 if target_id is null then insert into public.commission_rules(organization_id,salesperson_id,client_organization_id,name,basis,rate_type,rate,currency,priority,effective_from,effective_to,status) values(target_provider_id,target_salesperson_id,target_client_id,trim(target_name),target_basis,target_rate_type,target_rate,target_currency,target_priority,coalesce(target_effective_from,now()),target_effective_to,target_status) returning id into rid;
 else update public.commission_rules set name=trim(target_name),client_organization_id=target_client_id,basis=target_basis,rate_type=target_rate_type,rate=target_rate,currency=target_currency,priority=target_priority,effective_from=coalesce(target_effective_from,effective_from),effective_to=target_effective_to,status=target_status,version=version+1 where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Commission rule not found or stale version' using errcode='40001';end if;end if;
 perform private.write_audit_event(auth.uid(),target_provider_id,'commission_rule.saved','commission_rule',rid::text,jsonb_build_object('salesperson_id',target_salesperson_id,'client_organization_id',target_client_id));return rid;
end $$;

create function public.transition_commission(target_commission_id uuid,target_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.commission_snapshots;begin
 select * into c from public.commission_snapshots where id=target_commission_id for update;
 if c.id is null or not private.can_view_phase5b_commissions(c.organization_id,c.salesperson_id) or not(private.has_permission(c.organization_id,'commissions.manage') or private.has_permission(c.organization_id,'payouts.manage')) then raise exception 'Not authorized' using errcode='42501';end if;
 if target_status not in('earned','payable','voided') or not((c.status='pending' and target_status in('earned','voided')) or(c.status='earned' and target_status in('payable','voided')) or(c.status='payable' and target_status='voided')) then raise exception 'Invalid commission transition' using errcode='22023';end if;
 perform set_config('app.phase5b_internal','true',true);update public.commission_snapshots set status=target_status,earned_at=case when target_status='earned' then coalesce(earned_at,now()) else earned_at end,payable_at=case when target_status='payable' then coalesce(payable_at,now()) else payable_at end,voided_at=case when target_status='voided' then coalesce(voided_at,now()) else voided_at end,updated_at=now() where id=c.id;perform set_config('app.phase5b_internal','',true);
 insert into public.commission_lifecycle_events(organization_id,commission_snapshot_id,old_status,new_status,action,actor_user_id) values(c.organization_id,c.id,c.status,target_status,'status_changed',auth.uid());perform private.write_audit_event(auth.uid(),c.organization_id,'commission.status_changed','commission_snapshot',c.id::text,jsonb_build_object('old_status',c.status,'status',target_status));return c.id;
end $$;

create function public.admin_create_commission_payout(target_provider_id uuid,target_salesperson_id uuid,target_currency text,target_commission_ids jsonb,target_external_reference text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.commission_payouts;cid uuid;item jsonb;total numeric;seq bigint;rid uuid;count_ids integer:=0;
begin
 if not private.has_permission(target_provider_id,'payouts.manage') then raise exception 'Payout management permission required' using errcode='42501';end if;
 if target_currency!~'^[A-Z]{3}$' or jsonb_typeof(target_commission_ids)<>'array' or jsonb_array_length(target_commission_ids) not between 1 and 1000 or target_idempotency_key is null then raise exception 'Invalid payout request' using errcode='22023';end if;
 select * into existing from public.commission_payouts where organization_id=target_provider_id and idempotency_key=target_idempotency_key for update;if existing.id is not null then return existing.id;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_provider_id::text||target_salesperson_id::text||target_currency,5108));
 select * into existing from public.commission_payouts where organization_id=target_provider_id and idempotency_key=target_idempotency_key for update;if existing.id is not null then return existing.id;end if;
 for item in select value from jsonb_array_elements(target_commission_ids) loop
  begin cid:=(item #>> '{}')::uuid;exception when others then raise exception 'Invalid commission id' using errcode='22023';end;
  perform 1 from public.commission_snapshots where id=cid and organization_id=target_provider_id and salesperson_id=target_salesperson_id and currency=target_currency and status='payable' for update;
  if not found then raise exception 'Commission is not payable, same salesperson, or same currency' using errcode='42501';end if;
  count_ids:=count_ids+1;
 end loop;
 select coalesce(sum(c.commission_amount),0) into total from public.commission_snapshots c where c.id in(select (value #>> '{}')::uuid from jsonb_array_elements(target_commission_ids)) and c.organization_id=target_provider_id and c.salesperson_id=target_salesperson_id and c.currency=target_currency and c.status='payable';
 insert into public.commission_payout_counters(organization_id,next_number) values(target_provider_id,2) on conflict(organization_id) do update set next_number=public.commission_payout_counters.next_number+1 returning next_number-1 into seq;
 insert into public.commission_payouts(organization_id,salesperson_id,payout_number,currency,total_amount,status,paid_at,external_reference,idempotency_key,created_by_user_id) values(target_provider_id,target_salesperson_id,'SVFC-PAY-'||to_char(current_date,'YYYY')||'-'||lpad(seq::text,8,'0'),target_currency,total,'paid',now(),coalesce(target_external_reference,''),target_idempotency_key,auth.uid()) returning id into rid;
 for item in select value from jsonb_array_elements(target_commission_ids) loop
  cid:=(item #>> '{}')::uuid;insert into public.commission_payout_lines(payout_id,commission_snapshot_id,amount) select rid,id,commission_amount from public.commission_snapshots where id=cid;
  perform set_config('app.phase5b_internal','true',true);update public.commission_snapshots set status='paid',paid_at=now(),updated_at=now() where id=cid;perform set_config('app.phase5b_internal','',true);
  insert into public.commission_lifecycle_events(organization_id,commission_snapshot_id,old_status,new_status,action,actor_user_id) values(target_provider_id,cid,'payable','paid','payout_created',auth.uid());
 end loop;
 insert into public.commission_payout_events(organization_id,payout_id,new_status,action,actor_user_id,metadata) values(target_provider_id,rid,'paid','created_and_paid',auth.uid(),jsonb_build_object('commission_count',count_ids,'total_amount',total));
 perform private.write_audit_event(auth.uid(),target_provider_id,'commission.payout_created','commission_payout',rid::text,jsonb_build_object('salesperson_id',target_salesperson_id,'total_amount',total));return rid;
end $$;

create function public.get_salesperson_dashboard(target_provider_id uuid,target_salesperson_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid;result jsonb;
begin
 sid:=coalesce(target_salesperson_id,(select s.id from public.salespeople s where s.organization_id=target_provider_id and s.user_id=auth.uid() and s.status='active' limit 1));
 if sid is null or not private.can_view_phase5b_commissions(target_provider_id,sid) then raise exception 'Not authorized' using errcode='42501';end if;
 select jsonb_build_object('salesperson',(select jsonb_build_object('id',s.id,'code',s.code,'display_name',s.display_name,'email',s.email) from public.salespeople s where s.id=sid),
  'assigned_clients',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.client_salesperson_assignments a join public.organizations o on o.id=a.client_organization_id where a.organization_id=target_provider_id and a.salesperson_id=sid and a.status='active'),'[]'),
  'sales_activity',coalesce((select jsonb_agg(jsonb_build_object('order_id',o.id,'order_number',o.order_number,'client_organization_id',o.client_organization_id,'submitted_at',o.submitted_at,'quantity',coalesce((select sum(l.quantity) from public.order_lines l where l.order_id=o.id),0),'sales_amount',o.total) order by o.submitted_at desc) from public.order_salesperson_attributions a join public.orders o on o.id=a.order_id where a.organization_id=target_provider_id and a.salesperson_id=sid),'[]'),
  'commissions',coalesce((select jsonb_object_agg(x.status,x.amount) from(select c.status,sum(c.commission_amount) amount from public.commission_snapshots c where c.organization_id=target_provider_id and c.salesperson_id=sid group by c.status)x),'{}'),
  'payouts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'payout_number',p.payout_number,'amount',p.total_amount,'status',p.status,'created_at',p.created_at) order by p.created_at desc) from public.commission_payouts p where p.organization_id=target_provider_id and p.salesperson_id=sid),'[]')) into result;return result;
end $$;

create function public.get_salesperson_report(target_provider_id uuid,target_salesperson_id uuid,target_start timestamptz,target_end timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_view_phase5b_commissions(target_provider_id,target_salesperson_id) then raise exception 'Not authorized' using errcode='42501';end if;
 select jsonb_build_object('scope','salesperson','start',target_start,'end',target_end,'order_count',(select count(*) from public.orders o where o.organization_id=target_provider_id and o.submitted_at>=target_start and o.submitted_at<target_end and exists(select 1 from public.order_salesperson_attributions a where a.order_id=o.id and a.salesperson_id=target_salesperson_id)),
 'client_count',(select count(distinct o.client_organization_id) from public.orders o where o.organization_id=target_provider_id and o.submitted_at>=target_start and o.submitted_at<target_end and exists(select 1 from public.order_salesperson_attributions a where a.order_id=o.id and a.salesperson_id=target_salesperson_id)),
 'quantity',coalesce((select sum(l.quantity) from public.order_lines l join public.orders o on o.id=l.order_id where o.organization_id=target_provider_id and o.submitted_at>=target_start and o.submitted_at<target_end and exists(select 1 from public.order_salesperson_attributions a where a.order_id=o.id and a.salesperson_id=target_salesperson_id)),0),
 'sales_amount',coalesce((select sum(o.total) from public.orders o where o.organization_id=target_provider_id and o.submitted_at>=target_start and o.submitted_at<target_end and exists(select 1 from public.order_salesperson_attributions a where a.order_id=o.id and a.salesperson_id=target_salesperson_id)),0),
 'commissions',coalesce((select jsonb_object_agg(x.status,x.amount) from(select c.status,sum(c.commission_amount) amount from public.commission_snapshots c where c.organization_id=target_provider_id and c.salesperson_id=target_salesperson_id and c.created_at>=target_start and c.created_at<target_end group by c.status)x),'{}')) into result;return result;
end $$;

create function public.get_client_sales_report(target_provider_id uuid,target_client_id uuid,target_start timestamptz,target_end timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_view_phase5b_commissions(target_provider_id) then raise exception 'Not authorized' using errcode='42501';end if;
 select jsonb_build_object('scope','client','start',target_start,'end',target_end,'order_count',count(distinct o.id),'salesperson_count',count(distinct a.salesperson_id),'quantity',coalesce(sum(l.quantity),0),'sales_amount',coalesce(sum(distinct o.total),0)) into result from public.order_salesperson_attributions a join public.orders o on o.id=a.order_id left join public.order_lines l on l.order_id=o.id where a.organization_id=target_provider_id and o.client_organization_id=target_client_id and o.submitted_at>=target_start and o.submitted_at<target_end;return result;
end $$;

create function public.get_company_sales_report(target_provider_id uuid,target_start timestamptz,target_end timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_view_phase5b_commissions(target_provider_id) then raise exception 'Not authorized' using errcode='42501';end if;
 select jsonb_build_object('scope','company','start',target_start,'end',target_end,'order_count',count(distinct o.id),'client_count',count(distinct o.client_organization_id),'salesperson_count',count(distinct a.salesperson_id),'quantity',coalesce(sum(l.quantity),0),'sales_amount',coalesce(sum(distinct o.total),0),'commission_amount',coalesce((select sum(c.commission_amount) from public.commission_snapshots c where c.organization_id=target_provider_id and c.created_at>=target_start and c.created_at<target_end),0)) into result from public.order_salesperson_attributions a join public.orders o on o.id=a.order_id left join public.order_lines l on l.order_id=o.id where a.organization_id=target_provider_id and o.submitted_at>=target_start and o.submitted_at<target_end;return result;
end $$;

create function public.get_phase5b_admin_context(target_provider_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active_profile() or not(private.has_permission(target_provider_id,'salespeople.view') or private.has_permission(target_provider_id,'pricing_tiers.view') or private.has_permission(target_provider_id,'commissions.view')) then raise exception 'Not authorized' using errcode='42501';end if;
 select jsonb_build_object('salespeople',coalesce((select jsonb_agg(to_jsonb(s) order by s.display_name) from public.salespeople s where s.organization_id=target_provider_id),'[]'),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'client_organization_id',a.client_organization_id,'salesperson_id',a.salesperson_id,'effective_from',a.effective_from,'status',a.status) order by a.created_at desc) from public.client_salesperson_assignments a where a.organization_id=target_provider_id),'[]'),
 'pricing_tiers',coalesce((select jsonb_agg(to_jsonb(t) order by t.priority desc,t.name) from public.pricing_tiers t where t.organization_id=target_provider_id),'[]'),
 'tier_assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'client_organization_id',a.client_organization_id,'pricing_tier_id',a.pricing_tier_id,'effective_from',a.effective_from,'status',a.status) order by a.created_at desc) from public.client_pricing_tier_assignments a where a.organization_id=target_provider_id),'[]'),
 'commission_rules',case when private.can_view_phase5b_commissions(target_provider_id) then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.commission_rules r where r.organization_id=target_provider_id),'[]') else '[]' end) into result;return result;
end $$;

do $$declare f text;begin foreach f in array array['public.admin_save_salesperson(uuid,uuid,uuid,text,text,text,text,integer)','public.admin_assign_client_salesperson(uuid,uuid,uuid,timestamptz)','public.admin_onboard_client_with_salesperson(uuid,uuid,text,text,text,text,public.organization_status,uuid,uuid)','public.admin_save_pricing_tier(uuid,uuid,text,text,text,integer,text,integer)','public.admin_assign_client_pricing_tier(uuid,uuid,uuid,timestamptz)','public.admin_save_pricing_tier_price(uuid,uuid,uuid,uuid,uuid,text,numeric,integer,integer,timestamptz,timestamptz,text)','public.admin_save_commission_rule(uuid,uuid,uuid,uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer)','public.transition_commission(uuid,text)','public.admin_create_commission_payout(uuid,uuid,text,jsonb,text,text)','public.get_salesperson_dashboard(uuid,uuid)','public.get_salesperson_report(uuid,uuid,timestamptz,timestamptz)','public.get_client_sales_report(uuid,uuid,timestamptz,timestamptz)','public.get_company_sales_report(uuid,timestamptz,timestamptz)','public.get_phase5b_admin_context(uuid)'] loop execute 'revoke all on function '||f||' from public,anon';execute 'grant execute on function '||f||' to authenticated';end loop;end $$;


create or replace function public.get_order_intake_options(target_client_organization_id uuid,target_currency text default 'USD') returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not private.can_access_orders(target_client_organization_id,'orders.create') then raise exception 'Not authorized' using errcode='42501';end if;
 if target_currency!~'^[A-Z]{3}$' then raise exception 'Invalid currency' using errcode='22023';end if;
 select jsonb_build_object(
  'customers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name,'number',c.customer_number) order by c.display_name) from public.customers c where c.organization_id=target_client_organization_id and c.status='active'),'[]'),
  'addresses',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'customer_id',a.customer_id,'label',a.label,'recipient',a.recipient,'line1',a.line1,'line2',a.line2,'city',a.city,'region',a.region,'postal_code',a.postal_code,'country_code',a.country_code) order by a.label) from public.customer_addresses a join public.customers c on c.id=a.customer_id and c.organization_id=a.organization_id and c.status='active' where a.organization_id=target_client_organization_id and a.status='active'),'[]'),
  'catalog',coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name,x.entry_id) from (
   select e.id entry_id,e.product_id,e.variant_id,e.public_name display_name,e.public_description description,v.sku,price.unit_price,target_currency currency
   from public.client_catalog_entries e join public.client_catalog_connections connection on connection.id=e.connection_id and connection.status='active'
   join public.organizations seller on seller.id=e.organization_id and seller.status='active'
   join public.products p on p.id=e.product_id and p.organization_id=e.organization_id and p.status='active'
   join public.product_categories cat on cat.id=p.category_id and cat.status='active'
   left join public.product_variants v on v.id=e.variant_id and v.product_id=p.id and v.status='active'
   join lateral(select p.unit_price from private.resolve_order_price(e.organization_id,e.client_organization_id,e.product_id,e.variant_id,target_currency,1) p) price on true
   where e.client_organization_id=target_client_organization_id and e.status='active' and e.starts_at<=statement_timestamp() and (e.ends_at is null or statement_timestamp()<e.ends_at)
   order by e.public_name,e.id limit 100) x),'[]')) into result;
 return result;
end $$;
create or replace function public.submit_order(target_client_organization_id uuid,target_customer_id uuid,target_address_id uuid,target_currency text,target_lines jsonb,target_idempotency_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.orders;customer public.customers;address public.customer_addresses;client public.organizations;seller uuid;entry public.client_catalog_entries;
 item jsonb;qty numeric;price numeric;line_amount numeric;subtotal_amount numeric:=0;request_digest text;seq bigint;verification_seq bigint;yr integer;rid uuid;number text;verification text;scale integer;
begin
 if not private.can_access_orders(target_client_organization_id,'orders.create') then raise exception 'Not authorized' using errcode='42501';end if;
 if target_currency!~'^[A-Z]{3}$' or target_idempotency_key is null or length(trim(target_idempotency_key)) not between 8 and 120 or jsonb_typeof(target_lines)<>'array' or jsonb_array_length(target_lines) not between 1 and 100 then raise exception 'Invalid order request' using errcode='22023';end if;
 request_digest:=encode(extensions.digest(convert_to(jsonb_build_object('client',target_client_organization_id,'customer',target_customer_id,'address',target_address_id,'currency',target_currency,'lines',target_lines)::text,'UTF8'),'sha256'),'hex');
 select * into existing from public.orders where client_organization_id=target_client_organization_id and idempotency_key=trim(target_idempotency_key) for update;
 if existing.id is not null then if existing.request_hash<>request_digest then raise exception 'Idempotency key reused for different order' using errcode='22023';end if;return existing.id;end if;
 select * into customer from public.customers where id=target_customer_id and organization_id=target_client_organization_id and status='active' for share;
 select * into address from public.customer_addresses where id=target_address_id and organization_id=target_client_organization_id and customer_id=target_customer_id and status='active' for share;
 select * into client from public.organizations where id=target_client_organization_id and status='active' and organization_type='client_company' for share;
 if customer.id is null or address.id is null or client.id is null then raise exception 'Invalid active customer or address' using errcode='42501';end if;
 for item in select value from jsonb_array_elements(target_lines) loop
  if exists(select 1 from jsonb_object_keys(item) k where k not in('entry_id','quantity')) then raise exception 'Invalid line fields' using errcode='22023';end if;
  begin qty:=(item->>'quantity')::numeric;exception when others then raise exception 'Invalid quantity' using errcode='22023';end;
  if qty is null or qty<=0 or qty>1000000 or qty<>trunc(qty) then raise exception 'Invalid quantity' using errcode='22023';end if;
  select e.* into entry from public.client_catalog_entries e join public.client_catalog_connections c on c.id=e.connection_id and c.status='active'
   join public.products p on p.id=e.product_id and p.status='active' join public.product_categories cat on cat.id=p.category_id and cat.status='active'
   left join public.product_variants v on v.id=e.variant_id
   where e.id=(item->>'entry_id')::uuid and (seller is null or e.organization_id=seller) and e.client_organization_id=target_client_organization_id and e.status='active'
    and e.starts_at<=statement_timestamp() and (e.ends_at is null or statement_timestamp()<e.ends_at) and (e.variant_id is null or v.status='active');
  if entry.id is null then raise exception 'Catalog item unavailable' using errcode='42501';end if;
  seller:=coalesce(seller,entry.organization_id);
  if not private.can_access_order(target_client_organization_id,seller,'orders.create') then raise exception 'Order service not authorized' using errcode='42501';end if;
  select p.unit_price into price from private.resolve_order_price(seller,target_client_organization_id,entry.product_id,entry.variant_id,target_currency,qty) p;
  if price is null then raise exception 'Authorized current price required' using errcode='42501';end if;
  subtotal_amount:=subtotal_amount+round(price*qty,private.money_scale(target_currency));
 end loop;
 yr:=extract(year from statement_timestamp() at time zone 'UTC');
 insert into public.order_number_counters(organization_id,order_year,next_number) values(seller,yr,2)
 on conflict(organization_id,order_year) do update set next_number=public.order_number_counters.next_number+1 returning next_number-1 into seq;
 if seq>999999 then raise exception 'Annual order number capacity exhausted' using errcode='22003';end if;
 insert into public.verification_number_counters(organization_id,next_number) values(seller,2)
 on conflict(organization_id) do update set next_number=public.verification_number_counters.next_number+1 returning next_number-1 into verification_seq;
 number:='SVFC-ORD-'||yr::text||'-'||lpad(seq::text,6,'0');verification:='SVFC-'||lpad(verification_seq::text,6,'0')||'-01';scale:=private.money_scale(target_currency);
 insert into public.orders(organization_id,client_organization_id,customer_id,address_id,order_number,status,currency,customer_snapshot,address_snapshot,client_snapshot,subtotal,total,submitted_at,submitted_by_user_id,idempotency_key,request_hash)
 values(seller,target_client_organization_id,customer.id,address.id,number,'submitted',target_currency,
  jsonb_build_object('customer_number',customer.customer_number,'display_name',customer.display_name,'email',customer.email,'phone',customer.phone),
  jsonb_build_object('label',address.label,'recipient',address.recipient,'line1',address.line1,'line2',address.line2,'city',address.city,'region',address.region,'postal_code',address.postal_code,'country_code',address.country_code),
  jsonb_build_object('name',client.name,'contact_email',client.contact_email,'contact_phone',client.contact_phone),round(subtotal_amount,scale),round(subtotal_amount,scale),statement_timestamp(),auth.uid(),trim(target_idempotency_key),request_digest) returning id into rid;
 for item in select value from jsonb_array_elements(target_lines) loop
  qty:=(item->>'quantity')::numeric;select e.* into entry from public.client_catalog_entries e where e.id=(item->>'entry_id')::uuid;
  select p.unit_price into price from private.resolve_order_price(seller,target_client_organization_id,entry.product_id,entry.variant_id,target_currency,qty) p;
  line_amount:=round(price*qty,scale);
  insert into public.order_lines(organization_id,client_organization_id,order_id,entry_id,product_id,variant_id,sku,display_name,description,quantity,unit_price,currency,line_total,pricing_snapshot)
  select seller,target_client_organization_id,rid,entry.id,entry.product_id,entry.variant_id,v.sku,entry.public_name,entry.public_description,qty,price,target_currency,line_amount,
   jsonb_build_object('unit_price',price,'currency',target_currency,'quantity',qty,'line_total',line_amount,'resolved_at',statement_timestamp()) from public.client_catalog_entries e left join public.product_variants v on v.id=e.variant_id where e.id=entry.id;
 end loop;
 insert into public.order_verifications(organization_id,client_organization_id,order_id,verification_number,verification_sequence,fulfillment_status,snapshot,created_by_user_id)
 select seller,target_client_organization_id,rid,verification,1,'submitted',jsonb_build_object('client',o.client_snapshot,'contact',o.customer_snapshot,'ship_to',o.address_snapshot,'order_number',number,'order_date',o.submitted_at,'verification_number',verification,'fulfillment_status','submitted','shipment_number',null,'lines',(select jsonb_agg(jsonb_build_object('sku',l.sku,'product',l.display_name,'quantity_ordered',l.quantity,'shipment_assignment',null,'line_status',l.line_status) order by l.id) from public.order_lines l where l.order_id=rid),'current_shipment_contents','[]'::jsonb,'carrier',null,'service',null,'tracking_number',null,'cartons','[]'::jsonb,'total_units',(select sum(quantity) from public.order_lines where order_id=rid),'warehouse_verification',null,'client_safe_qc_status',null,'special_handling',null,'estimated_delivery',null,'remaining_lines','[]'::jsonb),auth.uid() from public.orders o where o.id=rid;
 insert into public.order_lifecycle_events(organization_id,client_organization_id,order_id,action,new_status,actor_user_id) values(seller,target_client_organization_id,rid,'submitted','submitted',auth.uid());
 perform private.write_audit_event(auth.uid(),seller,'order.submitted','order',rid::text,jsonb_build_object('status','submitted','client_organization_id',target_client_organization_id,'order_number',number));
 perform private.write_audit_event(auth.uid(),seller,'order.verification_created','order_verification',rid::text,jsonb_build_object('verification_number',verification));
 return rid;
end $$;
commit;
