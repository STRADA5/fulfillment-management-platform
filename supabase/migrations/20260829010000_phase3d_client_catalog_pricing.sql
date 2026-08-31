begin;

insert into public.permissions(code,name,description) values
 ('client_catalog.manage','Manage client catalogs','Manage explicitly connected client catalog grants'),
 ('client_pricing.manage','Manage client selling prices','Manage selling-price rules; no supplier-cost authority'),
 ('client_catalog.view','View own client catalog','Read the explicitly published catalog for an active client membership')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='SUPER_ADMIN' or (r.code='ADMIN' and p.code in('client_catalog.manage','client_pricing.manage'))
 or (r.code in('CLIENT_ADMIN','CLIENT_USER') and p.code='client_catalog.view') on conflict do nothing;

create function private.can_manage_client_catalog(org uuid,permission_code text default 'client_catalog.manage') returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_permission(org,permission_code) and exists(select 1 from public.organizations where id=org and status='active' and organization_type in('fulfillment_company','white_label'));
$$;
revoke all on function private.can_manage_client_catalog(uuid,text) from public,anon,authenticated;
-- RLS evaluates this predicate as the caller; it remains outside the exposed API schema.
grant execute on function private.can_manage_client_catalog(uuid,text) to authenticated;

create table public.client_catalog_connections(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 client_organization_id uuid not null references public.organizations(id),
 status public.catalog_status not null default 'inactive',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(organization_id<>client_organization_id),unique(organization_id,client_organization_id),
 unique(organization_id,client_organization_id,id)
);
create table public.client_catalog_entries(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,
 client_organization_id uuid not null,connection_id uuid not null,
 product_id uuid not null,variant_id uuid,
 public_name text not null check(length(trim(public_name)) between 1 and 200),
 public_description text not null default '' check(length(public_description)<=5000),
 status public.catalog_status not null default 'inactive',
 starts_at timestamptz not null default now(),ends_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,client_organization_id,connection_id) references public.client_catalog_connections(organization_id,client_organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id),
 foreign key(organization_id,variant_id) references public.product_variants(organization_id,id),
 check(ends_at is null or ends_at>starts_at),
 unique nulls not distinct(organization_id,client_organization_id,product_id,variant_id)
);
create table public.client_selling_prices(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 client_organization_id uuid,product_id uuid not null,variant_id uuid,
 price_kind text not null check(price_kind in('base','client','override')),
 currency text not null check(currency~'^[A-Z]{3}$'),
 unit_price numeric(18,4) not null check(unit_price>=0 and unit_price<'Infinity'::numeric),
 minimum_quantity integer not null default 1 check(minimum_quantity>0),
 maximum_quantity integer check(maximum_quantity>=minimum_quantity),
 starts_at timestamptz not null default now(),ends_at timestamptz,
 status public.catalog_status not null default 'inactive',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,client_organization_id) references public.client_catalog_connections(organization_id,client_organization_id),
 foreign key(organization_id,product_id) references public.products(organization_id,id),
 foreign key(organization_id,variant_id) references public.product_variants(organization_id,id),
 check((price_kind='base' and client_organization_id is null) or (price_kind in('client','override') and client_organization_id is not null)),
 check(ends_at is null or ends_at>starts_at),check(price_kind<>'override' or ends_at is not null)
);
create index client_entries_lookup on public.client_catalog_entries(client_organization_id,status,starts_at);
create index client_price_lookup on public.client_selling_prices(organization_id,product_id,client_organization_id,currency,status);

do $$declare t text;begin foreach t in array array['client_catalog_connections','client_catalog_entries','client_selling_prices'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create trigger %I_updated before update on public.%I for each row execute function private.set_updated_at()',t,t);
end loop;end $$;
create policy connections_admin_read on public.client_catalog_connections for select to authenticated using(private.can_manage_client_catalog(organization_id));
create policy entries_admin_read on public.client_catalog_entries for select to authenticated using(private.can_manage_client_catalog(organization_id));
create policy prices_admin_read on public.client_selling_prices for select to authenticated using(private.can_manage_client_catalog(organization_id,'client_pricing.manage'));

-- Validate both FKs and business relationships, including service-side writes. Serialize
-- price-rule writes per seller so concurrent overlapping rules cannot both be accepted.
create function private.validate_client_catalog_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.organization_id::text,3104));
 if not exists(select 1 from public.organizations where id=new.organization_id and organization_type in('fulfillment_company','white_label')) then raise exception 'Invalid fulfillment company' using errcode='22023';end if;
 if new.client_organization_id is not null and not exists(select 1 from public.organizations where id=new.client_organization_id and organization_type='client_company') then raise exception 'Invalid client organization' using errcode='22023';end if;
 if tg_op='UPDATE' and (new.organization_id is distinct from old.organization_id or new.client_organization_id is distinct from old.client_organization_id) then raise exception 'Organization ownership is immutable' using errcode='22023';end if;
 if tg_table_name<>'client_catalog_connections' then
  if new.variant_id is not null and not exists(select 1 from public.product_variants where id=new.variant_id and organization_id=new.organization_id and product_id=new.product_id) then raise exception 'Variant does not belong to product' using errcode='22023';end if;
  if tg_op='UPDATE' and (new.product_id is distinct from old.product_id or new.variant_id is distinct from old.variant_id) then raise exception 'Catalog target is immutable; deactivate and create a new record' using errcode='22023';end if;
  if not isfinite(new.starts_at) or (new.ends_at is not null and not isfinite(new.ends_at)) then raise exception 'Finite effective dates required' using errcode='22023';end if;
 end if;
 if tg_table_name='client_selling_prices' then
 if new.status='active' and exists(
  select 1 from public.client_selling_prices p where p.id<>new.id and p.organization_id=new.organization_id
   and p.client_organization_id is not distinct from new.client_organization_id
   and p.product_id=new.product_id and p.variant_id is not distinct from new.variant_id
   and p.price_kind=new.price_kind and p.currency=new.currency and p.minimum_quantity=new.minimum_quantity and p.status='active'
   and tstzrange(p.starts_at,p.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
 ) then raise exception 'Overlapping price rule at the same priority and tier' using errcode='23505';end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_client_catalog_record() from public,anon,authenticated;
create trigger validate_connection before insert or update on public.client_catalog_connections for each row execute function private.validate_client_catalog_record();
create trigger validate_entry before insert or update on public.client_catalog_entries for each row execute function private.validate_client_catalog_record();
create trigger validate_selling_price before insert or update on public.client_selling_prices for each row execute function private.validate_client_catalog_record();

create function public.get_client_catalog_admin_companies() returns table(id uuid,name text,can_price boolean,can_connect boolean) language sql stable security definer set search_path='' as $$
 select o.id,o.name,private.can_manage_client_catalog(o.id,'client_pricing.manage'),private.is_super_admin() from public.organizations o where private.can_manage_client_catalog(o.id) order by o.name,o.id;
$$;
create function public.admin_save_client_catalog_connection(target_organization_id uuid,target_client_organization_id uuid,target_status public.catalog_status) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not private.is_super_admin() or not private.can_manage_client_catalog(target_organization_id) then raise exception 'Active super-admin required to establish client access' using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=target_client_organization_id and status='active' and organization_type='client_company') then raise exception 'Active client required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization_id::text,3104));
 insert into public.client_catalog_connections(organization_id,client_organization_id,status) values(target_organization_id,target_client_organization_id,target_status)
 on conflict(organization_id,client_organization_id) do update set status=excluded.status returning id into rid;
 perform private.write_audit_event(auth.uid(),target_organization_id,'client_catalog.connection_saved','client_catalog_connection',rid::text,jsonb_build_object('status',target_status));return rid;
end $$;

create function private.require_client_catalog_connection(seller uuid,client uuid,permission_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not private.can_manage_client_catalog(seller,permission_code) then raise exception 'Not authorized' using errcode='42501';end if;
 select c.id into rid from public.client_catalog_connections c join public.organizations o on o.id=c.client_organization_id
 where c.organization_id=seller and c.client_organization_id=client and c.status='active' and o.status='active';
 if rid is null then raise exception 'Explicit active client connection required' using errcode='42501';end if;return rid;
end $$;
revoke all on function private.require_client_catalog_connection(uuid,uuid,text) from public,anon,authenticated;

create function public.admin_save_client_catalog_entry(target_id uuid,target_organization_id uuid,target_client_organization_id uuid,target_product_id uuid,target_variant_id uuid,target_name text,target_description text,target_status public.catalog_status,target_starts_at timestamptz,target_ends_at timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare connection uuid;rid uuid;begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization_id::text,3104));
 connection:=private.require_client_catalog_connection(target_organization_id,target_client_organization_id,'client_catalog.manage');
 if target_id is null then
  insert into public.client_catalog_entries(organization_id,client_organization_id,connection_id,product_id,variant_id,public_name,public_description,status,starts_at,ends_at)
  values(target_organization_id,target_client_organization_id,connection,target_product_id,target_variant_id,trim(target_name),coalesce(target_description,''),target_status,target_starts_at,target_ends_at) returning id into rid;
 else
  update public.client_catalog_entries set public_name=trim(target_name),public_description=coalesce(target_description,''),status=target_status,starts_at=target_starts_at,ends_at=target_ends_at
  where id=target_id and organization_id=target_organization_id and client_organization_id=target_client_organization_id and product_id=target_product_id and variant_id is not distinct from target_variant_id returning id into rid;
  if rid is null then raise exception 'Catalog entry not found' using errcode='P0002';end if;
 end if;
 perform private.write_audit_event(auth.uid(),target_organization_id,'client_catalog.entry_saved','client_catalog_entry',rid::text,jsonb_build_object('status',target_status));return rid;
end $$;

create function public.admin_save_client_selling_price(target_id uuid,target_organization_id uuid,target_client_organization_id uuid,target_product_id uuid,target_variant_id uuid,target_kind text,target_currency text,target_price numeric,target_minimum integer,target_maximum integer,target_starts_at timestamptz,target_ends_at timestamptz,target_status public.catalog_status) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization_id::text,3104));
 if not private.can_manage_client_catalog(target_organization_id,'client_pricing.manage') then raise exception 'Not authorized' using errcode='42501';end if;
 if target_client_organization_id is not null then perform private.require_client_catalog_connection(target_organization_id,target_client_organization_id,'client_pricing.manage');end if;
 if target_id is null then
  insert into public.client_selling_prices(organization_id,client_organization_id,product_id,variant_id,price_kind,currency,unit_price,minimum_quantity,maximum_quantity,starts_at,ends_at,status)
  values(target_organization_id,target_client_organization_id,target_product_id,target_variant_id,target_kind,upper(target_currency),target_price,target_minimum,target_maximum,target_starts_at,target_ends_at,target_status) returning id into rid;
 else
  update public.client_selling_prices set price_kind=target_kind,currency=upper(target_currency),unit_price=target_price,minimum_quantity=target_minimum,maximum_quantity=target_maximum,starts_at=target_starts_at,ends_at=target_ends_at,status=target_status
  where id=target_id and organization_id=target_organization_id and client_organization_id is not distinct from target_client_organization_id and product_id=target_product_id and variant_id is not distinct from target_variant_id returning id into rid;
  if rid is null then raise exception 'Selling price not found' using errcode='P0002';end if;
 end if;
 -- Never place amounts, internal pricing schedules or customer identities in audit metadata.
 perform private.write_audit_event(auth.uid(),target_organization_id,'client_pricing.rule_saved','client_selling_price',rid::text,jsonb_build_object('status',target_status));return rid;
end $$;

-- Clients have no direct master-table grants or pricing-rule visibility. Product-level
-- grants do NOT implicitly publish present or future variants. Price lookup cannot
-- disclose prices for an ungranted item or accept a client-selected time in the future.
create function public.get_my_client_catalog(target_client_organization_id uuid,target_currency text default 'USD',target_quantity integer default 1,target_search text default '',target_offset integer default 0,target_limit integer default 50)
returns table(entry_id uuid,product_id uuid,variant_id uuid,display_name text,description text,sku text,unit_price numeric,currency text,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission(target_client_organization_id,'client_catalog.view') or not exists(select 1 from public.organizations where id=target_client_organization_id and status='active' and organization_type='client_company') then raise exception 'Not authorized' using errcode='42501';end if;
 if target_currency is null or target_currency!~'^[A-Z]{3}$' or target_quantity is null or target_quantity<1 or target_quantity>1000000 or target_offset is null or target_offset<0 or target_limit is null or target_limit<1 or target_limit>100 or target_search is null or length(target_search)>200 then raise exception 'Invalid catalog query' using errcode='22023';end if;
 return query
 select e.id,e.product_id,e.variant_id,e.public_name,e.public_description,v.sku,price.unit_price,target_currency,count(*) over()
 from public.client_catalog_entries e
 join public.client_catalog_connections c on c.id=e.connection_id and c.status='active'
 join public.organizations seller on seller.id=e.organization_id and seller.status='active'
 join public.products p on p.id=e.product_id and p.organization_id=e.organization_id and p.status='active'
 join public.product_categories cat on cat.id=p.category_id and cat.status='active'
 left join public.product_variants v on v.id=e.variant_id and v.product_id=p.id and v.organization_id=e.organization_id
 left join lateral (
  select r.unit_price from public.client_selling_prices r
  where r.organization_id=e.organization_id and r.product_id=e.product_id and (r.variant_id is null or r.variant_id=e.variant_id)
   and (r.client_organization_id is null or r.client_organization_id=e.client_organization_id)
   and r.currency=target_currency and r.status='active' and r.starts_at<=statement_timestamp() and (r.ends_at is null or statement_timestamp()<r.ends_at)
   and r.minimum_quantity<=target_quantity and (r.maximum_quantity is null or target_quantity<=r.maximum_quantity)
  order by case r.price_kind when 'override' then 3 when 'client' then 2 else 1 end desc,
   (r.variant_id is not null) desc,r.minimum_quantity desc,r.starts_at desc,r.id limit 1
 ) price on true
 where e.client_organization_id=target_client_organization_id and e.status='active'
  and e.starts_at<=statement_timestamp() and (e.ends_at is null or statement_timestamp()<e.ends_at)
  and (e.variant_id is null or v.status='active')
  and (target_search='' or e.public_name ilike '%'||target_search||'%' or v.sku ilike '%'||target_search||'%')
 order by e.public_name,e.id offset target_offset limit target_limit;
end $$;

revoke all on function public.get_client_catalog_admin_companies(),public.admin_save_client_catalog_connection(uuid,uuid,public.catalog_status),public.admin_save_client_catalog_entry(uuid,uuid,uuid,uuid,uuid,text,text,public.catalog_status,timestamptz,timestamptz),public.admin_save_client_selling_price(uuid,uuid,uuid,uuid,uuid,text,text,numeric,integer,integer,timestamptz,timestamptz,public.catalog_status),public.get_my_client_catalog(uuid,text,integer,text,integer,integer) from public,anon;
grant execute on function public.get_client_catalog_admin_companies(),public.admin_save_client_catalog_connection(uuid,uuid,public.catalog_status),public.admin_save_client_catalog_entry(uuid,uuid,uuid,uuid,uuid,text,text,public.catalog_status,timestamptz,timestamptz),public.admin_save_client_selling_price(uuid,uuid,uuid,uuid,uuid,text,text,numeric,integer,integer,timestamptz,timestamptz,public.catalog_status),public.get_my_client_catalog(uuid,text,integer,text,integer,integer) to authenticated;
commit;
