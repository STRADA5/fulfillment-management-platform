-- Phase 5C: configurable multi-role client organizations and referral relationships.
-- Forward-only additive migration. Existing organization types and Phase 1-5B
-- salesperson/commission tables remain unchanged and separate.
begin;

insert into public.permissions(code,name,description) values
 ('client_capabilities.view','View client capabilities','View effective client service capabilities.'),
 ('client_capabilities.manage','Manage client capabilities','Configure effective-dated client capabilities.'),
 ('client_ownership.view','View client ownership','View client-owned product and inventory relationships.'),
 ('client_ownership.manage','Manage client ownership','Manage client-owned product and inventory relationships.'),
 ('client_referrals.view','View client referrals','View client affiliate/referral relationships.'),
 ('client_referrals.manage','Manage client referrals','Manage client affiliate/referral relationships.'),
 ('referral_commissions.view','View referral commissions','View confidential referral commissions.'),
 ('referral_commissions.manage','Manage referral commissions','Configure and transition referral commissions.'),
 ('referral_payouts.manage','Manage referral payouts','Create and settle referral payouts.')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in('SUPER_ADMIN','ADMIN') and p.code in(
 'client_capabilities.view','client_capabilities.manage','client_ownership.view','client_ownership.manage',
 'client_referrals.view','client_referrals.manage','referral_commissions.view','referral_commissions.manage','referral_payouts.manage')
on conflict do nothing;

create table public.client_capability_definitions(
 code text primary key check(code~'^[a-z][a-z0-9_]{2,79}$'),
 name text not null check(length(trim(name)) between 1 and 160),
 description text not null default '',
 status text not null default 'active' check(status in('active','inactive')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

insert into public.client_capability_definitions(code,name,description) values
 ('purchasing_enabled','Wholesale purchasing','Client may purchase eligible distributor catalog inventory.'),
 ('fulfillment_enabled','Provider fulfillment','Provider may warehouse, pick, pack, and dispatch client orders.'),
 ('self_fulfillment','Self fulfillment','Client fulfills its own wholesale purchases.'),
 ('direct_to_customer_fulfillment','Direct-to-customer fulfillment','Provider may fulfill orders directly to the client customer.'),
 ('affiliate_referral','Affiliate/referral partner','Client may receive referral attribution and referral commissions.'),
 ('supplier_brand_partner','Supplier/brand partner','Client may participate as a brand or supplier partner.'),
 ('client_owned_products','Client-owned products','Client may own products or inventory held by the provider.'),
 ('distributor_owned_products','Distributor-owned products','Provider-owned inventory may be sold or fulfilled for the client.'),
 ('branding_label_services','Branding/label services','Provider branding or label services are enabled for the client.')
on conflict(code) do nothing;

create table public.client_capability_assignments(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete cascade,
 capability_code text not null references public.client_capability_definitions(code) on delete restrict,
 status text not null default 'active' check(status in('active','inactive','suspended')),
 effective_from timestamptz not null default now(),effective_to timestamptz,
 configuration jsonb not null default '{}' check(jsonb_typeof(configuration)='object'),
 version integer not null default 1 check(version>0),
 created_by_user_id uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>effective_from),
 unique(organization_id,id),unique(organization_id,client_organization_id,capability_code,effective_from)
);

create index client_capability_lookup on public.client_capability_assignments(organization_id,client_organization_id,capability_code,status,effective_from);

create table public.client_capability_events(
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete cascade,
 capability_assignment_id uuid not null references public.client_capability_assignments(id) on delete restrict,
 action text not null,old_status text,new_status text,details jsonb not null default '{}',
 actor_user_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);

-- Product catalog rows remain provider-owned records. This relationship carries
-- the commercial owner and client service mode without creating a second product
-- namespace or changing the meaning of existing product organization_id values.
create table public.client_product_ownership_relationships(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,
 product_id uuid not null,variant_id uuid,
 ownership_type text not null check(ownership_type in('client_owned','distributor_owned')),
 fulfillment_mode text not null default 'none' check(fulfillment_mode in('none','self','provider','direct_to_customer')),
 status text not null default 'active' check(status in('active','inactive')),
 effective_from timestamptz not null default now(),effective_to timestamptz,
 version integer not null default 1 check(version>0),created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>effective_from),
 foreign key(organization_id,product_id) references public.products(organization_id,id) on delete restrict,
 foreign key(organization_id,variant_id) references public.product_variants(organization_id,id) on delete restrict,
 unique(organization_id,id)
);

create index client_product_owner_lookup on public.client_product_ownership_relationships(organization_id,client_organization_id,product_id,variant_id,status,effective_from);
alter table public.inventory_lots add column if not exists ownership_relationship_id uuid references public.client_product_ownership_relationships(id) on delete restrict;
create index inventory_lot_ownership_lookup on public.inventory_lots(ownership_relationship_id);

-- Referral accounting is intentionally separate from Phase 5B salesperson
-- attribution, rules, snapshots, lifecycle, and payout history.
create table public.client_referral_relationships(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 affiliate_client_organization_id uuid not null references public.organizations(id) on delete restrict,
 referred_client_organization_id uuid not null references public.organizations(id) on delete restrict,
 referral_code text not null default '',status text not null default 'active' check(status in('active','inactive')),
 effective_from timestamptz not null default now(),effective_to timestamptz,
 version integer not null default 1 check(version>0),created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(affiliate_client_organization_id<>referred_client_organization_id),
 check(effective_to is null or effective_to>effective_from),unique(organization_id,id)
);
create index client_referral_lookup on public.client_referral_relationships(organization_id,referred_client_organization_id,status,effective_from);

create table public.order_referral_attributions(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 affiliate_client_organization_id uuid not null references public.organizations(id) on delete restrict,
 referred_client_organization_id uuid not null references public.organizations(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,relationship_id uuid references public.client_referral_relationships(id) on delete restrict,
 relationship_snapshot jsonb not null,attributed_at timestamptz not null default now(),created_by_user_id uuid references auth.users(id),
 unique(organization_id,order_id)
);

create table public.referral_commission_rules(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 relationship_id uuid not null references public.client_referral_relationships(id) on delete restrict,
 name text not null check(length(trim(name)) between 1 and 160),basis text not null check(basis in('order_subtotal','order_total')),
 rate_type text not null check(rate_type in('percentage','fixed')),rate numeric(18,6) not null check(rate>=0 and rate<'Infinity'::numeric),
 currency text not null default 'USD' check(currency~'^[A-Z]{3}$'),priority integer not null default 100 check(priority between 1 and 100000),
 effective_from timestamptz not null default now(),effective_to timestamptz,status text not null default 'active' check(status in('active','inactive')),
 version integer not null default 1 check(version>0),created_by_user_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>effective_from),unique(organization_id,id)
);

create table public.referral_commission_snapshots(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 affiliate_client_organization_id uuid not null references public.organizations(id) on delete restrict,referred_client_organization_id uuid not null references public.organizations(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,relationship_id uuid references public.client_referral_relationships(id) on delete restrict,rule_id uuid references public.referral_commission_rules(id) on delete restrict,
 rule_snapshot jsonb not null,basis text not null check(basis in('order_subtotal','order_total')),sales_amount numeric(20,4) not null check(sales_amount>=0),
 rate_snapshot numeric(18,6) not null check(rate_snapshot>=0),rate_type text not null check(rate_type in('percentage','fixed')),commission_amount numeric(20,4) not null check(commission_amount>=0),currency text not null check(currency~'^[A-Z]{3}$'),
 status text not null default 'pending' check(status in('pending','earned','payable','paid','voided')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,order_id)
);

create table public.referral_commission_lifecycle_events(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete restrict,
 commission_snapshot_id uuid not null references public.referral_commission_snapshots(id) on delete restrict,old_status text,new_status text not null,action text not null,metadata jsonb not null default '{}',actor_user_id uuid references auth.users(id),created_at timestamptz not null default now()
);
create table public.referral_payouts(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,affiliate_client_organization_id uuid not null references public.organizations(id) on delete restrict,
 payout_number text not null,currency text not null check(currency~'^[A-Z]{3}$'),total_amount numeric(20,4) not null check(total_amount>=0),status text not null default 'pending' check(status in('pending','paid','voided')),paid_at timestamptz,external_reference text not null default '',idempotency_key text not null unique,created_by_user_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,payout_number)
);
create table public.referral_payout_lines(
 id uuid primary key default extensions.gen_random_uuid(),payout_id uuid not null references public.referral_payouts(id) on delete restrict,commission_snapshot_id uuid not null unique references public.referral_commission_snapshots(id) on delete restrict,amount numeric(20,4) not null check(amount>=0),created_at timestamptz not null default now()
);
create table public.referral_payout_events(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete restrict,payout_id uuid not null references public.referral_payouts(id) on delete restrict,old_status text,new_status text not null,action text not null,metadata jsonb not null default '{}',actor_user_id uuid references auth.users(id),created_at timestamptz not null default now()
);
create table public.referral_payout_counters(
 organization_id uuid primary key references public.organizations(id) on delete restrict,next_number bigint not null default 1 check(next_number>0)
);

do $$declare t text;begin foreach t in array array['client_capability_definitions','client_capability_assignments','client_capability_events','client_product_ownership_relationships','client_referral_relationships','order_referral_attributions','referral_commission_rules','referral_commission_snapshots','referral_commission_lifecycle_events','referral_payouts','referral_payout_lines','referral_payout_events','referral_payout_counters'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
revoke all on sequence public.client_capability_events_id_seq,public.referral_commission_lifecycle_events_id_seq,public.referral_payout_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.client_capability_events_id_seq,public.referral_commission_lifecycle_events_id_seq,public.referral_payout_events_id_seq to service_role;

create or replace function private.phase5c_provider_client(provider_id uuid,client_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1
   from public.organizations p
   join public.organizations c on c.id=client_id
   where p.id=provider_id
     and p.status='active'
     and p.organization_type in('fulfillment_company','white_label')
     and c.status='active'
     and c.organization_type='client_company'
     and (
       c.parent_organization_id=p.id
       or exists(
         select 1
         from public.client_service_relationships sr
         where sr.organization_id=p.id
           and sr.client_organization_id=c.id
           and sr.status='active'
       )
     )
 );
$$;
revoke all on function private.phase5c_provider_client(uuid,uuid) from public,anon,authenticated;grant execute on function private.phase5c_provider_client(uuid,uuid) to authenticated;

create or replace function private.phase5c_has_capability(provider_id uuid,client_id uuid,capability text,at_time timestamptz default statement_timestamp()) returns boolean language sql stable security definer set search_path='' as $$
 select private.phase5c_provider_client(provider_id,client_id) and exists(select 1 from public.client_capability_assignments a where a.organization_id=provider_id and a.client_organization_id=client_id and a.capability_code=capability and a.status='active' and a.effective_from<=at_time and (a.effective_to is null or at_time<a.effective_to));
$$;
revoke all on function private.phase5c_has_capability(uuid,uuid,text,timestamptz) from public,anon,authenticated;grant execute on function private.phase5c_has_capability(uuid,uuid,text,timestamptz) to authenticated;

-- Compatibility rows preserve all existing order/fulfillment behavior. New
-- service relationships with no order authority do not receive purchasing.
insert into public.client_capability_assignments(organization_id,client_organization_id,capability_code,status,created_by_user_id)
select s.organization_id,s.client_organization_id,v.code,'active',null
from public.client_service_relationships s
cross join lateral(values
 ('purchasing_enabled',s.order_access='manage'),
 ('fulfillment_enabled',s.order_access in('read','manage')),
 ('direct_to_customer_fulfillment',s.order_access='manage'),
 ('distributor_owned_products',s.order_access in('read','manage'))
) v(code,enabled)
where s.status='active' and v.enabled
on conflict do nothing;

-- Existing client organizations already had the ability to buy through their
-- own order permission. Preserve that legacy purchasing boundary while making
-- provider fulfillment an explicit separate capability.
insert into public.client_capability_assignments(organization_id,client_organization_id,capability_code,status,created_by_user_id)
select o.parent_organization_id,o.id,x.code,case when o.status='active' then 'active' else 'inactive' end,null
from public.organizations o cross join (values('purchasing_enabled'),('distributor_owned_products')) x(code)
where o.organization_type='client_company' and o.parent_organization_id is not null
on conflict do nothing;

create or replace function private.phase5c_seed_client_capabilities() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.organization_type='client_company' and new.parent_organization_id is not null then
  if new.status='active' then
   insert into public.client_capability_assignments(organization_id,client_organization_id,capability_code,status,created_by_user_id)
   select new.parent_organization_id,new.id,x.code,'active',null
   from (values('purchasing_enabled'),('distributor_owned_products')) x(code)
   where not exists(select 1 from public.client_capability_assignments a where a.organization_id=new.parent_organization_id and a.client_organization_id=new.id and a.capability_code=x.code)
   on conflict do nothing;
   update public.client_capability_assignments set status='active',updated_at=now()
   where organization_id=new.parent_organization_id and client_organization_id=new.id and capability_code in('purchasing_enabled','distributor_owned_products') and created_by_user_id is null and effective_to is null;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.phase5c_seed_client_capabilities() from public,anon,authenticated;
create trigger organization_phase5c_seed after insert or update of status,parent_organization_id on public.organizations for each row execute function private.phase5c_seed_client_capabilities();

-- Phase 1-5B service RPCs predate this capability layer. Keep their legacy
-- order_access changes compatible without overwriting explicit Phase 5C rows.
create or replace function private.phase5c_sync_legacy_service_capabilities() returns trigger language plpgsql security definer set search_path='' as $$declare service_enabled boolean;begin
 service_enabled:=new.status='active';
 insert into public.client_capability_assignments(organization_id,client_organization_id,capability_code,status,created_by_user_id)
 select new.organization_id,new.client_organization_id,x.code,case when service_enabled and x.cap_enabled then 'active' else 'inactive' end,null
 from (values
  ('purchasing_enabled',new.order_access='manage'),
  ('fulfillment_enabled',new.order_access in('read','manage')),
  ('direct_to_customer_fulfillment',new.order_access='manage'),
  ('distributor_owned_products',new.order_access in('read','manage'))
 ) x(code,cap_enabled)
 where not exists(select 1 from public.client_capability_assignments a where a.organization_id=new.organization_id and a.client_organization_id=new.client_organization_id and a.capability_code=x.code and a.created_by_user_id is not distinct from null and a.effective_from<=statement_timestamp() and (a.effective_to is null or statement_timestamp()<a.effective_to))
 on conflict do nothing;
 update public.client_capability_assignments a set status=case when service_enabled and x.cap_enabled then 'active' else 'inactive' end,updated_at=now()
 from (values
  ('purchasing_enabled',new.order_access='manage'),
  ('fulfillment_enabled',new.order_access in('read','manage')),
  ('direct_to_customer_fulfillment',new.order_access='manage'),
  ('distributor_owned_products',new.order_access in('read','manage'))
 ) x(code,cap_enabled)
 where a.organization_id=new.organization_id and a.client_organization_id=new.client_organization_id and a.capability_code=x.code and a.created_by_user_id is null and a.effective_to is null;
 return new;
end $$;
revoke all on function private.phase5c_sync_legacy_service_capabilities() from public,anon,authenticated;
create trigger client_service_phase5c_sync after insert or update of status,order_access on public.client_service_relationships for each row execute function private.phase5c_sync_legacy_service_capabilities();

create or replace function private.validate_phase5c_capability() returns trigger language plpgsql security definer set search_path='' as $$
declare rec jsonb:=to_jsonb(new); provider public.organizations;client public.organizations;cap text;from_at timestamptz;to_at timestamptz;rid uuid;
begin
 select * into provider from public.organizations where id=(rec->>'organization_id')::uuid;
 select * into client from public.organizations where id=(rec->>'client_organization_id')::uuid;
 if provider.id is null or client.id is null or not private.phase5c_provider_client(provider.id,client.id) then raise exception 'Valid active provider client required' using errcode='22023';end if;
 cap=rec->>'capability_code';if not exists(select 1 from public.client_capability_definitions where code=cap and status='active') then raise exception 'Unknown capability' using errcode='22023';end if;
 from_at=(rec->>'effective_from')::timestamptz;to_at=(rec->>'effective_to')::timestamptz;rid=(rec->>'id')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(provider.id::text||client.id::text||cap,5201));
 if exists(select 1 from public.client_capability_assignments a where a.organization_id=provider.id and a.client_organization_id=client.id and a.capability_code=cap and a.id<>rid and a.effective_from<coalesce(to_at,'infinity'::timestamptz) and coalesce(a.effective_to,'infinity'::timestamptz)>from_at) then raise exception 'Overlapping capability interval' using errcode='23P01';end if;
 return new;
end $$;
revoke all on function private.validate_phase5c_capability() from public,anon,authenticated;
create trigger client_capability_validate before insert or update on public.client_capability_assignments for each row execute function private.validate_phase5c_capability();

create or replace function private.validate_phase5c_product_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare rec jsonb:=to_jsonb(new);rel public.client_product_ownership_relationships;provider public.organizations;client public.organizations;product public.products;variant public.product_variants;owner_type text;client_id uuid;new_variant_id uuid;
begin
 select * into provider from public.organizations where id=(rec->>'organization_id')::uuid;
 client_id=(rec->>'client_organization_id')::uuid;select * into client from public.organizations where id=client_id and organization_type='client_company' and status='active';
 select * into product from public.products where id=(rec->>'product_id')::uuid and organization_id=provider.id;
 new_variant_id=(rec->>'variant_id')::uuid;if new_variant_id is not null then select * into variant from public.product_variants where id=new_variant_id and organization_id=provider.id and product_id=product.id;end if;
 owner_type=rec->>'ownership_type';
 if provider.id is null or product.id is null or (new_variant_id is not null and variant.id is null) or client.id is null or not private.phase5c_provider_client(provider.id,client.id) then raise exception 'Invalid product ownership parties' using errcode='22023';end if;
 if owner_type='client_owned' and not private.phase5c_has_capability(provider.id,client.id,'client_owned_products') then raise exception 'Client-owned-products capability required' using errcode='42501';end if;
 if owner_type='distributor_owned' and not private.phase5c_has_capability(provider.id,client.id,'distributor_owned_products') then raise exception 'Distributor-owned-products capability required' using errcode='42501';end if;
 if rec->>'fulfillment_mode'='provider' and not private.phase5c_has_capability(provider.id,client.id,'fulfillment_enabled') then raise exception 'Provider fulfillment capability required' using errcode='42501';end if;
 if rec->>'fulfillment_mode'='direct_to_customer' and not private.phase5c_has_capability(provider.id,client.id,'direct_to_customer_fulfillment') then raise exception 'Direct-to-customer capability required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(provider.id::text||client.id::text||(rec->>'product_id')||coalesce(rec->>'variant_id',''),5202));
 if exists(select 1 from public.client_product_ownership_relationships x where x.organization_id=provider.id and x.client_organization_id=client.id and x.product_id=(rec->>'product_id')::uuid and x.variant_id is not distinct from new_variant_id and x.id<>(rec->>'id')::uuid and x.effective_from<coalesce((rec->>'effective_to')::timestamptz,'infinity'::timestamptz) and coalesce(x.effective_to,'infinity'::timestamptz)>(rec->>'effective_from')::timestamptz) then raise exception 'Overlapping product ownership interval' using errcode='23P01';end if;
 return new;
end $$;
revoke all on function private.validate_phase5c_product_owner() from public,anon,authenticated;
create trigger client_product_owner_validate before insert or update on public.client_product_ownership_relationships for each row execute function private.validate_phase5c_product_owner();

create or replace function private.validate_phase5c_referral() returns trigger language plpgsql security definer set search_path='' as $$
declare rec jsonb:=to_jsonb(new);provider public.organizations;affiliate public.organizations;referred public.organizations;from_at timestamptz;to_at timestamptz;rid uuid;
begin
 select * into provider from public.organizations where id=(rec->>'organization_id')::uuid;
 select * into affiliate from public.organizations where id=(rec->>'affiliate_client_organization_id')::uuid and organization_type='client_company' and status='active';
 select * into referred from public.organizations where id=(rec->>'referred_client_organization_id')::uuid and organization_type='client_company' and status='active';
 if provider.id is null or affiliate.id is null or referred.id is null or affiliate.id=referred.id or not private.phase5c_provider_client(provider.id,affiliate.id) or not private.phase5c_provider_client(provider.id,referred.id) or not private.phase5c_has_capability(provider.id,affiliate.id,'affiliate_referral') then raise exception 'Invalid referral parties or capability' using errcode='22023';end if;
 from_at=(rec->>'effective_from')::timestamptz;to_at=(rec->>'effective_to')::timestamptz;rid=(rec->>'id')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(provider.id::text||referred.id::text,5203));
 if exists(select 1 from public.client_referral_relationships x where x.organization_id=provider.id and x.referred_client_organization_id=referred.id and x.id<>rid and x.status='active' and x.effective_from<coalesce(to_at,'infinity'::timestamptz) and coalesce(x.effective_to,'infinity'::timestamptz)>from_at) then raise exception 'Overlapping referral relationship' using errcode='23P01';end if;
 return new;
end $$;
revoke all on function private.validate_phase5c_referral() from public,anon,authenticated;
create trigger client_referral_validate before insert or update on public.client_referral_relationships for each row execute function private.validate_phase5c_referral();

create or replace function private.validate_phase5c_referral_rule() returns trigger language plpgsql security definer set search_path='' as $$declare rec jsonb:=to_jsonb(new);rel public.client_referral_relationships;from_at timestamptz;to_at timestamptz;rid uuid;begin select * into rel from public.client_referral_relationships where id=(rec->>'relationship_id')::uuid and organization_id=(rec->>'organization_id')::uuid and status='active';if rel.id is null then raise exception 'Active referral relationship required' using errcode='22023';end if;from_at=(rec->>'effective_from')::timestamptz;to_at=(rec->>'effective_to')::timestamptz;rid=(rec->>'id')::uuid;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rel.organization_id::text||rel.id::text,5205));if exists(select 1 from public.referral_commission_rules x where x.organization_id=rel.organization_id and x.relationship_id=rel.id and x.id<>rid and x.status='active' and x.effective_from<coalesce(to_at,'infinity'::timestamptz) and coalesce(x.effective_to,'infinity'::timestamptz)>from_at) then raise exception 'Overlapping referral commission interval' using errcode='23P01';end if;return new;end $$;
revoke all on function private.validate_phase5c_referral_rule() from public,anon,authenticated;
create trigger referral_rule_validate before insert or update on public.referral_commission_rules for each row execute function private.validate_phase5c_referral_rule();

create or replace function private.phase5c_audit_capability() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.client_capability_events(organization_id,client_organization_id,capability_assignment_id,action,old_status,new_status,details,actor_user_id) values(new.organization_id,new.client_organization_id,new.id,case when tg_op='INSERT' then 'capability.created' else 'capability.updated' end,case when tg_op='UPDATE' then old.status else null end,new.status,jsonb_build_object('capability_code',new.capability_code,'effective_from',new.effective_from,'effective_to',new.effective_to,'configuration',new.configuration),auth.uid());perform private.write_audit_event(auth.uid(),new.organization_id,case when tg_op='INSERT' then 'client.capability_created' else 'client.capability_updated' end,'client_capability_assignment',new.id::text,jsonb_build_object('client_organization_id',new.client_organization_id,'capability_code',new.capability_code,'status',new.status));return new;end $$;
revoke all on function private.phase5c_audit_capability() from public,anon,authenticated;
create trigger client_capability_audit after insert or update on public.client_capability_assignments for each row execute function private.phase5c_audit_capability();

-- Existing order submission remains compatible but now requires an explicit
-- purchasing capability. Provider fulfillment rows use the captured/current
-- provider-fulfillment capability once that Phase 5C control is configured.
-- Legacy Phase 1-5B catalog/order fixtures have no Phase 5C fulfillment rows;
-- those paths remain governed by their existing provider permissions until an
-- administrator explicitly establishes the new fulfillment controls.
create or replace function private.phase5c_validate_order() returns trigger language plpgsql security definer set search_path='' as $$begin if private.phase5c_capability_controlled(new.organization_id,new.client_organization_id,'purchasing_enabled') and not private.phase5c_has_capability(new.organization_id,new.client_organization_id,'purchasing_enabled',coalesce(new.submitted_at,statement_timestamp())) then raise exception 'Client purchasing capability required' using errcode='42501';end if;return new;end $$;
revoke all on function private.phase5c_validate_order() from public,anon,authenticated;
create trigger order_phase5c_capability_validate before insert on public.orders for each row execute function private.phase5c_validate_order();

create or replace function private.phase5c_capability_controlled(provider_id uuid,client_id uuid,capability text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_capability_assignments a where a.organization_id=provider_id and a.client_organization_id=client_id and a.capability_code=capability and a.created_by_user_id is not null);
$$;
revoke all on function private.phase5c_capability_controlled(uuid,uuid,text) from public,anon,authenticated;grant execute on function private.phase5c_capability_controlled(uuid,uuid,text) to authenticated;

create or replace function private.phase5c_validate_provider_fulfillment() returns trigger language plpgsql security definer set search_path='' as $$declare oid uuid;o public.orders;at_time timestamptz;fulfillment_controlled boolean;direct_controlled boolean;begin oid=(to_jsonb(new)->>'order_id')::uuid;select * into o from public.orders where id=oid;at_time=coalesce(o.submitted_at,statement_timestamp());fulfillment_controlled:=private.phase5c_capability_controlled(o.organization_id,o.client_organization_id,'fulfillment_enabled');direct_controlled:=private.phase5c_capability_controlled(o.organization_id,o.client_organization_id,'direct_to_customer_fulfillment');if o.id is null or (TG_TABLE_NAME='order_allocations' and fulfillment_controlled and not private.phase5c_has_capability(o.organization_id,o.client_organization_id,'fulfillment_enabled',at_time)) or (TG_TABLE_NAME<>'order_allocations' and (fulfillment_controlled or direct_controlled) and (not private.phase5c_has_capability(o.organization_id,o.client_organization_id,'fulfillment_enabled',at_time) or not private.phase5c_has_capability(o.organization_id,o.client_organization_id,'direct_to_customer_fulfillment',at_time))) then raise exception 'Provider fulfillment capability required' using errcode='42501';end if;return new;end $$;
revoke all on function private.phase5c_validate_provider_fulfillment() from public,anon,authenticated;
create trigger order_allocation_phase5c_capability before insert on public.order_allocations for each row execute function private.phase5c_validate_provider_fulfillment();
create trigger pick_list_phase5c_capability before insert on public.pick_lists for each row execute function private.phase5c_validate_provider_fulfillment();
create trigger shipment_phase5c_capability before insert on public.shipments for each row execute function private.phase5c_validate_provider_fulfillment();

-- Add referral attribution after the existing salesperson attribution trigger.
create or replace function private.phase5c_attribute_referral() returns trigger language plpgsql security definer set search_path='' as $$declare rel public.client_referral_relationships;begin select * into rel from public.client_referral_relationships r where r.organization_id=new.organization_id and r.referred_client_organization_id=new.client_organization_id and r.status='active' and private.phase5c_has_capability(r.organization_id,r.affiliate_client_organization_id,'affiliate_referral',coalesce(new.submitted_at,statement_timestamp())) and r.effective_from<=coalesce(new.submitted_at,statement_timestamp()) and (r.effective_to is null or coalesce(new.submitted_at,statement_timestamp())<r.effective_to) order by r.effective_from desc,r.id desc limit 1;if rel.id is not null then insert into public.order_referral_attributions(organization_id,affiliate_client_organization_id,referred_client_organization_id,order_id,relationship_id,relationship_snapshot,created_by_user_id) values(new.organization_id,rel.affiliate_client_organization_id,rel.referred_client_organization_id,new.id,rel.id,to_jsonb(rel),new.submitted_by_user_id) on conflict(organization_id,order_id) do nothing;end if;return new;end $$;
revoke all on function private.phase5c_attribute_referral() from public,anon,authenticated;
create trigger order_phase5c_referral_attribution after insert on public.orders for each row execute function private.phase5c_attribute_referral();

create or replace function private.phase5c_create_referral_commission() returns trigger language plpgsql security definer set search_path='' as $$declare a public.order_referral_attributions;r public.referral_commission_rules;o public.orders;s numeric;amount numeric;cid uuid;begin if new.action<>'submitted' then return new;end if;select * into a from public.order_referral_attributions where order_id=new.order_id;select * into o from public.orders where id=new.order_id;if a.id is null or o.id is null then return new;end if;select * into r from public.referral_commission_rules x where x.organization_id=o.organization_id and x.relationship_id=a.relationship_id and x.status='active' and x.effective_from<=coalesce(o.submitted_at,statement_timestamp()) and (x.effective_to is null or coalesce(o.submitted_at,statement_timestamp())<x.effective_to) and x.currency=o.currency order by x.priority desc,x.effective_from desc,x.id desc limit 1;if r.id is null then return new;end if;s:=case when r.basis='order_subtotal' then o.subtotal else o.total end;amount:=case when r.rate_type='percentage' then round(s*r.rate/100,private.money_scale(o.currency)) else round(r.rate,private.money_scale(o.currency)) end;insert into public.referral_commission_snapshots(organization_id,affiliate_client_organization_id,referred_client_organization_id,order_id,relationship_id,rule_id,rule_snapshot,basis,sales_amount,rate_snapshot,rate_type,commission_amount,currency) values(o.organization_id,a.affiliate_client_organization_id,a.referred_client_organization_id,o.id,a.relationship_id,r.id,to_jsonb(r),r.basis,s,r.rate,r.rate_type,amount,o.currency) on conflict(organization_id,order_id) do nothing returning id into cid;if cid is not null then insert into public.referral_commission_lifecycle_events(organization_id,commission_snapshot_id,old_status,new_status,action,metadata,actor_user_id) values(o.organization_id,cid,null,'pending','commission.created',jsonb_build_object('order_id',o.id,'sales_amount',s),new.actor_user_id);perform private.write_audit_event(new.actor_user_id,o.organization_id,'referral_commission.created','referral_commission_snapshot',cid::text,jsonb_build_object('order_id',o.id,'affiliate_client_organization_id',a.affiliate_client_organization_id));end if;return new;end $$;
revoke all on function private.phase5c_create_referral_commission() from public,anon,authenticated;
create trigger order_phase5c_referral_commission after insert on public.order_lifecycle_events for each row execute function private.phase5c_create_referral_commission();

create or replace function private.can_view_phase5c_referrals(provider_id uuid,affiliate_id uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_profile() and exists(select 1 from public.organizations where id=provider_id and status='active' and organization_type in('fulfillment_company','white_label')) and (private.is_super_admin() or private.has_permission(provider_id,'client_referrals.view') or private.has_permission(provider_id,'referral_commissions.view') or (affiliate_id is not null and private.has_permission(affiliate_id,'referral_commissions.view') and exists(select 1 from public.organization_memberships m where m.organization_id=affiliate_id and m.user_id=auth.uid() and m.status='active')));
$$;
revoke all on function private.can_view_phase5c_referrals(uuid,uuid) from public,anon,authenticated;grant execute on function private.can_view_phase5c_referrals(uuid,uuid) to authenticated;

create or replace function public.admin_save_client_capability(target_id uuid,target_provider_id uuid,target_client_id uuid,target_capability_code text,target_status text,target_effective_from timestamptz,target_effective_to timestamptz,target_configuration jsonb,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin if not private.has_permission(target_provider_id,'client_capabilities.manage') then raise exception 'Capability management permission required' using errcode='42501';end if;if target_effective_from is null or target_effective_to is not null and target_effective_to<=target_effective_from then raise exception 'Invalid capability interval' using errcode='22023';end if;if target_id is null then insert into public.client_capability_assignments(organization_id,client_organization_id,capability_code,status,effective_from,effective_to,configuration,created_by_user_id) values(target_provider_id,target_client_id,target_capability_code,target_status,target_effective_from,target_effective_to,coalesce(target_configuration,'{}'),auth.uid()) returning id into rid;else update public.client_capability_assignments set status=target_status,effective_from=target_effective_from,effective_to=target_effective_to,configuration=coalesce(target_configuration,'{}'),version=version+1,updated_at=now() where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Capability not found or stale' using errcode='40001';end if;end if;return rid;end $$;
create or replace function public.get_phase5c_context(target_provider_id uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('capabilities',coalesce((select jsonb_agg(to_jsonb(d) order by d.name) from public.client_capability_definitions d where d.status='active'),'[]'),'clients',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'status',o.status) order by o.name) from public.organizations o where o.parent_organization_id=target_provider_id and o.organization_type='client_company'),'[]'),'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.client_organization_id,a.capability_code,a.effective_from desc) from public.client_capability_assignments a where a.organization_id=target_provider_id),'[]'),'product_ownership',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.client_product_ownership_relationships x where x.organization_id=target_provider_id),'[]'),'referrals',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.client_referral_relationships x where x.organization_id=target_provider_id),'[]'),'referral_rules',case when private.can_view_phase5c_referrals(target_provider_id) then coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.referral_commission_rules x where x.organization_id=target_provider_id),'[]') else '[]' end) where private.has_permission(target_provider_id,'client_capabilities.view') or private.has_permission(target_provider_id,'client_referrals.view') or private.is_super_admin();$$;

create or replace function public.admin_save_client_product_ownership(target_id uuid,target_provider_id uuid,target_client_id uuid,target_product_id uuid,target_variant_id uuid,target_ownership_type text,target_fulfillment_mode text,target_status text,target_effective_from timestamptz,target_effective_to timestamptz,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin if not private.has_permission(target_provider_id,'client_ownership.manage') then raise exception 'Ownership management permission required' using errcode='42501';end if;if target_id is null then insert into public.client_product_ownership_relationships(organization_id,client_organization_id,product_id,variant_id,ownership_type,fulfillment_mode,status,effective_from,effective_to,created_by_user_id) values(target_provider_id,target_client_id,target_product_id,target_variant_id,target_ownership_type,target_fulfillment_mode,target_status,target_effective_from,target_effective_to,auth.uid()) returning id into rid;else update public.client_product_ownership_relationships set ownership_type=target_ownership_type,fulfillment_mode=target_fulfillment_mode,status=target_status,effective_from=target_effective_from,effective_to=target_effective_to,version=version+1,updated_at=now() where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Ownership relationship not found or stale' using errcode='40001';end if;end if;perform private.write_audit_event(auth.uid(),target_provider_id,case when target_id is null then 'client.product_ownership_created' else 'client.product_ownership_updated' end,'client_product_ownership_relationship',rid::text,jsonb_build_object('client_organization_id',target_client_id,'product_id',target_product_id,'ownership_type',target_ownership_type,'fulfillment_mode',target_fulfillment_mode));return rid;end $$;
create or replace function public.admin_assign_inventory_lot_ownership(target_provider_id uuid,target_lot_id uuid,target_relationship_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;rel public.client_product_ownership_relationships;lot public.inventory_lots;variant_product uuid;begin if not private.has_permission(target_provider_id,'client_ownership.manage') then raise exception 'Ownership management permission required' using errcode='42501';end if;select * into lot from public.inventory_lots where id=target_lot_id and organization_id=target_provider_id for update;select * into rel from public.client_product_ownership_relationships where id=target_relationship_id and organization_id=target_provider_id and status='active' and effective_from<=statement_timestamp() and (effective_to is null or statement_timestamp()<effective_to);select product_id into variant_product from public.product_variants where id=lot.product_variant_id and organization_id=target_provider_id;if lot.id is null or rel.id is null or variant_product is null or (rel.variant_id is not null and rel.variant_id<>lot.product_variant_id) or variant_product<>rel.product_id then raise exception 'Lot and ownership relationship do not match' using errcode='22023';end if;update public.inventory_lots set ownership_relationship_id=rel.id,updated_at=now() where id=lot.id returning id into rid;perform private.write_audit_event(auth.uid(),target_provider_id,'inventory.lot_ownership_assigned','inventory_lot',rid::text,jsonb_build_object('ownership_relationship_id',rel.id,'ownership_type',rel.ownership_type));return rid;end $$;

create or replace function public.admin_save_client_referral_relationship(target_id uuid,target_provider_id uuid,target_affiliate_client_id uuid,target_referred_client_id uuid,target_referral_code text,target_status text,target_effective_from timestamptz,target_effective_to timestamptz,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin if not private.has_permission(target_provider_id,'client_referrals.manage') then raise exception 'Referral management permission required' using errcode='42501';end if;if target_id is null then insert into public.client_referral_relationships(organization_id,affiliate_client_organization_id,referred_client_organization_id,referral_code,status,effective_from,effective_to,created_by_user_id) values(target_provider_id,target_affiliate_client_id,target_referred_client_id,coalesce(target_referral_code,''),target_status,target_effective_from,target_effective_to,auth.uid()) returning id into rid;else update public.client_referral_relationships set referral_code=coalesce(target_referral_code,''),status=target_status,effective_from=target_effective_from,effective_to=target_effective_to,version=version+1,updated_at=now() where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Referral relationship not found or stale' using errcode='40001';end if;end if;perform private.write_audit_event(auth.uid(),target_provider_id,case when target_id is null then 'client.referral_created' else 'client.referral_updated' end,'client_referral_relationship',rid::text,jsonb_build_object('affiliate_client_organization_id',target_affiliate_client_id,'referred_client_organization_id',target_referred_client_id,'status',target_status));return rid;end $$;

create or replace function public.admin_save_referral_commission_rule(target_id uuid,target_provider_id uuid,target_relationship_id uuid,target_name text,target_basis text,target_rate_type text,target_rate numeric,target_currency text,target_priority integer,target_effective_from timestamptz,target_effective_to timestamptz,target_status text,target_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin if not private.has_permission(target_provider_id,'referral_commissions.manage') then raise exception 'Referral commission management permission required' using errcode='42501';end if;if target_id is null then insert into public.referral_commission_rules(organization_id,relationship_id,name,basis,rate_type,rate,currency,priority,effective_from,effective_to,status,created_by_user_id) values(target_provider_id,target_relationship_id,trim(target_name),target_basis,target_rate_type,target_rate,upper(target_currency),target_priority,target_effective_from,target_effective_to,target_status,auth.uid()) returning id into rid;else update public.referral_commission_rules set name=trim(target_name),basis=target_basis,rate_type=target_rate_type,rate=target_rate,currency=upper(target_currency),priority=target_priority,effective_from=target_effective_from,effective_to=target_effective_to,status=target_status,version=version+1,updated_at=now() where id=target_id and organization_id=target_provider_id and version=target_expected_version returning id into rid;if rid is null then raise exception 'Referral rule not found or stale' using errcode='40001';end if;end if;return rid;end $$;

create or replace function public.transition_referral_commission(target_commission_id uuid,target_status text) returns uuid language plpgsql security definer set search_path='' as $$declare c public.referral_commission_snapshots;allowed boolean;begin select * into c from public.referral_commission_snapshots where id=target_commission_id for update;if c.id is null or not private.has_permission(c.organization_id,'referral_commissions.manage') then raise exception 'Not authorized' using errcode='42501';end if;allowed:=(c.status,target_status) in (('pending','earned'),('earned','payable'),('payable','paid'),('pending','voided'),('earned','voided'),('payable','voided'));if not allowed then raise exception 'Invalid referral commission transition' using errcode='22023';end if;update public.referral_commission_snapshots set status=target_status,updated_at=now() where id=c.id;insert into public.referral_commission_lifecycle_events(organization_id,commission_snapshot_id,old_status,new_status,action,actor_user_id) values(c.organization_id,c.id,c.status,target_status,'commission.transition',auth.uid());perform private.write_audit_event(auth.uid(),c.organization_id,'referral_commission.transition','referral_commission_snapshot',c.id::text,jsonb_build_object('old_status',c.status,'new_status',target_status));return c.id;end $$;

create or replace function public.get_client_referral_dashboard(target_provider_id uuid,target_affiliate_client_id uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('relationships',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.client_referral_relationships r where r.organization_id=target_provider_id and r.affiliate_client_organization_id=target_affiliate_client_id),'[]'),'commissions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'referred_client_organization_id',c.referred_client_organization_id,'order_id',c.order_id,'status',c.status,'sales_amount',c.sales_amount,'commission_amount',c.commission_amount,'currency',c.currency,'created_at',c.created_at) order by c.created_at desc) from public.referral_commission_snapshots c where c.organization_id=target_provider_id and c.affiliate_client_organization_id=target_affiliate_client_id),'[]'),'payouts',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.referral_payouts p where p.organization_id=target_provider_id and p.affiliate_client_organization_id=target_affiliate_client_id),'[]')) where private.can_view_phase5c_referrals(target_provider_id,target_affiliate_client_id);$$;

create or replace function public.admin_create_referral_payout(target_provider_id uuid,target_affiliate_client_id uuid,target_currency text,target_commission_ids jsonb,target_external_reference text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$declare existing uuid;pid uuid;seq bigint;total numeric:=0;c uuid;amount numeric;begin if not private.has_permission(target_provider_id,'referral_payouts.manage') then raise exception 'Referral payout permission required' using errcode='42501';end if;if jsonb_typeof(target_commission_ids)<>'array' or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid payout request' using errcode='22023';end if;select id into existing from public.referral_payouts where idempotency_key=trim(target_idempotency_key) for update;if existing is not null then return existing;end if;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_provider_id::text||target_affiliate_client_id::text||upper(target_currency),5204));select id into existing from public.referral_payouts where idempotency_key=trim(target_idempotency_key) for update;if existing is not null then return existing;end if;for c in select value::text::uuid from jsonb_array_elements_text(target_commission_ids) loop select commission_amount into amount from public.referral_commission_snapshots where id=c and organization_id=target_provider_id and affiliate_client_organization_id=target_affiliate_client_id and currency=upper(target_currency) and status='payable' for update;if amount is null then raise exception 'Referral commission is not payable' using errcode='42501';end if;total:=total+amount;end loop;insert into public.referral_payout_counters(organization_id) values(target_provider_id) on conflict do nothing;update public.referral_payout_counters set next_number=next_number+1 where organization_id=target_provider_id returning next_number-1 into seq;insert into public.referral_payouts(organization_id,affiliate_client_organization_id,payout_number,currency,total_amount,status,paid_at,external_reference,idempotency_key,created_by_user_id) values(target_provider_id,target_affiliate_client_id,'REF-'||lpad(seq::text,6,'0'),upper(target_currency),total,'paid',now(),coalesce(target_external_reference,''),trim(target_idempotency_key),auth.uid()) returning id into pid;for c in select value::text::uuid from jsonb_array_elements_text(target_commission_ids) loop select commission_amount into amount from public.referral_commission_snapshots where id=c for update;insert into public.referral_payout_lines(payout_id,commission_snapshot_id,amount) values(pid,c,amount);update public.referral_commission_snapshots set status='paid',updated_at=now() where id=c;insert into public.referral_commission_lifecycle_events(organization_id,commission_snapshot_id,old_status,new_status,action,actor_user_id) values(target_provider_id,c,'payable','paid','commission.paid',auth.uid());end loop;insert into public.referral_payout_events(organization_id,payout_id,old_status,new_status,action,metadata,actor_user_id) values(target_provider_id,pid,null,'paid','payout.created',jsonb_build_object('affiliate_client_organization_id',target_affiliate_client_id,'total_amount',total),auth.uid());perform private.write_audit_event(auth.uid(),target_provider_id,'referral_payout.created','referral_payout',pid::text,jsonb_build_object('affiliate_client_organization_id',target_affiliate_client_id,'total_amount',total));return pid;end $$;

-- Explicit client capability checks are added to Phase 5B pricing assignment
-- without changing the locked Phase 5B migration.
create or replace function public.admin_assign_client_pricing_tier(target_provider_id uuid,target_client_id uuid,target_pricing_tier_id uuid,target_effective_from timestamptz default statement_timestamp()) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin if not private.has_permission(target_provider_id,'pricing_tiers.manage') or not private.phase5c_has_capability(target_provider_id,target_client_id,'purchasing_enabled') then raise exception 'Purchasing capability and pricing permission required' using errcode='42501';end if;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_provider_id::text||target_client_id::text,5107));update public.client_pricing_tier_assignments set status='inactive',effective_to=least(coalesce(effective_to,target_effective_from),target_effective_from),updated_at=now() where organization_id=target_provider_id and client_organization_id=target_client_id and status='active' and effective_from<target_effective_from and (effective_to is null or target_effective_from<effective_to);insert into public.client_pricing_tier_assignments(organization_id,client_organization_id,pricing_tier_id,effective_from,assigned_by_user_id) values(target_provider_id,target_client_id,target_pricing_tier_id,target_effective_from,auth.uid()) returning id into rid;perform private.write_audit_event(auth.uid(),target_provider_id,'pricing_tier.client_assigned','client_pricing_tier_assignment',rid::text,jsonb_build_object('client_organization_id',target_client_id,'pricing_tier_id',target_pricing_tier_id));return rid;end $$;

do $$declare f text;begin foreach f in array array[
 'public.admin_save_client_capability(uuid,uuid,uuid,text,text,timestamptz,timestamptz,jsonb,integer)',
 'public.get_phase5c_context(uuid)',
 'public.admin_save_client_product_ownership(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,integer)',
 'public.admin_assign_inventory_lot_ownership(uuid,uuid,uuid)',
 'public.admin_save_client_referral_relationship(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer)',
 'public.admin_save_referral_commission_rule(uuid,uuid,uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer)',
 'public.transition_referral_commission(uuid,text)',
 'public.get_client_referral_dashboard(uuid,uuid)',
 'public.admin_create_referral_payout(uuid,uuid,text,jsonb,text,text)',
 'public.admin_assign_client_pricing_tier(uuid,uuid,uuid,timestamptz)'
 ] loop execute 'revoke all on function '||f||' from public,anon';execute 'grant execute on function '||f||' to authenticated';end loop;end $$;

commit;
