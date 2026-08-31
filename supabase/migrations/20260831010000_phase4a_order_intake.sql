begin;

insert into public.permissions(code,name,description) values
 ('orders.view','View orders','View authorized client order records and verification snapshots'),
 ('orders.create','Create orders','Submit orders for an explicitly authorized client'),
 ('orders.manage','Manage orders','Accept or cancel authorized submitted orders') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code='SUPER_ADMIN' and p.code in('orders.view','orders.create','orders.manage')) or
 (r.code='ADMIN' and p.code in('orders.view','orders.create','orders.manage')) or
 (r.code in('CLIENT_ADMIN','CLIENT_USER') and p.code in('orders.view','orders.create')) on conflict do nothing;

alter table public.client_service_relationships add column order_access text not null default 'none' check(order_access in('none','read','manage'));

create type public.order_status as enum('draft','submitted','accepted','processing','partially_fulfilled','fulfilled','cancelled','exception');
create table public.order_number_counters(
 organization_id uuid not null references public.organizations(id) on delete restrict,
 order_year integer not null check(order_year between 2020 and 9999),next_number bigint not null default 1 check(next_number between 1 and 999999),
 primary key(organization_id,order_year)
);
create table public.verification_number_counters(
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 next_number bigint not null default 1 check(next_number between 1 and 999999)
);
create table public.orders(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,
 customer_id uuid not null,address_id uuid not null,order_number text not null unique,
 status public.order_status not null default 'submitted',currency text not null check(currency~'^[A-Z]{3}$'),
 customer_snapshot jsonb not null,address_snapshot jsonb not null,client_snapshot jsonb not null,
 subtotal numeric(20,4) not null check(subtotal>=0),total numeric(20,4) not null check(total>=0),
 submitted_at timestamptz not null,submitted_by_user_id uuid not null references auth.users(id),
 idempotency_key text not null,request_hash text not null,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(client_organization_id,idempotency_key),unique(client_organization_id,id),
 foreign key(client_organization_id,customer_id) references public.customers(organization_id,id) on delete restrict,
 foreign key(client_organization_id,address_id) references public.customer_addresses(organization_id,id) on delete restrict
);
create table public.order_lines(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,client_organization_id uuid not null,
 order_id uuid not null,entry_id uuid not null references public.client_catalog_entries(id) on delete restrict,
 product_id uuid not null,variant_id uuid,sku text,display_name text not null,description text not null default '',
 quantity numeric(20,6) not null check(quantity>0 and quantity<'Infinity'::numeric),unit_price numeric(20,4) not null check(unit_price>=0),
 currency text not null check(currency~'^[A-Z]{3}$'),line_total numeric(20,4) not null check(line_total>=0),
 pricing_snapshot jsonb not null,line_status text not null default 'submitted' check(line_status in('submitted','cancelled')),
 created_at timestamptz not null default now(),
 foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id) on delete restrict,
 unique(order_id,entry_id)
);
create table public.order_verifications(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,client_organization_id uuid not null,
 order_id uuid not null,verification_number text not null unique,verification_sequence integer not null check(verification_sequence>0),
 shipment_sequence integer,fulfillment_status text not null default 'submitted',snapshot jsonb not null,
 created_by_user_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id) on delete restrict,
 unique(order_id,verification_sequence)
);
create table public.order_lifecycle_events(
 id bigint generated always as identity primary key,organization_id uuid not null,client_organization_id uuid not null,
 order_id uuid not null,action text not null,old_status text,new_status text,actor_user_id uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id) on delete restrict
);

create function private.can_access_orders(client uuid,permission_code text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_profile() and exists(select 1 from public.organizations where id=client and organization_type='client_company' and status='active') and (
  private.is_super_admin() or private.has_permission(client,permission_code) or exists(
   select 1 from public.client_service_relationships s join public.organizations p on p.id=s.organization_id
   where s.client_organization_id=client and s.status='active' and s.order_access in('read','manage') and p.status='active'
    and p.organization_type in('fulfillment_company','white_label') and private.has_permission(p.id,permission_code)
    and (permission_code='orders.view' or s.order_access='manage')));
$$;
revoke all on function private.can_access_orders(uuid,text) from public,anon;
grant execute on function private.can_access_orders(uuid,text) to authenticated;
create function private.can_access_order(client uuid,seller uuid,permission_code text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_profile() and exists(select 1 from public.organizations where id=client and organization_type='client_company' and status='active') and (
  private.is_super_admin() or private.has_permission(client,permission_code) or exists(select 1 from public.client_service_relationships s join public.organizations p on p.id=s.organization_id
   where s.client_organization_id=client and s.organization_id=seller and s.status='active' and s.order_access in('read','manage') and p.status='active'
    and private.has_permission(seller,permission_code) and (permission_code='orders.view' or s.order_access='manage')));
$$;
revoke all on function private.can_access_order(uuid,uuid,text) from public,anon;grant execute on function private.can_access_order(uuid,uuid,text) to authenticated;

do $$declare t text;begin foreach t in array array['orders','order_lines','order_verifications','order_lifecycle_events'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
alter table public.order_number_counters enable row level security;alter table public.verification_number_counters enable row level security;
revoke all on public.order_number_counters,public.verification_number_counters from public,anon,authenticated;grant all on public.order_number_counters,public.verification_number_counters to service_role;
grant usage,select on sequence public.order_lifecycle_events_id_seq to service_role;
create policy order_read on public.orders for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.view'));
create policy order_line_read on public.order_lines for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.view'));
create policy order_verification_read on public.order_verifications for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.view'));
create policy order_event_read on public.order_lifecycle_events for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.view'));

create function private.money_scale(code text) returns integer language sql immutable set search_path='' as $$select case when code in('JPY','KRW') then 0 when code in('BHD','JOD','KWD','OMR','TND') then 3 else 2 end$$;
revoke all on function private.money_scale(text) from public,anon,authenticated;

create function public.get_order_contexts() returns table(id uuid,name text,can_create boolean,can_manage boolean)
language sql stable security definer set search_path='' as $$
 select o.id,o.name,private.can_access_orders(o.id,'orders.create'),private.can_access_orders(o.id,'orders.manage') from public.organizations o
 where private.can_access_orders(o.id,'orders.view') order by o.name,o.id;
$$;
create function public.get_order_intake_options(target_client_organization_id uuid,target_currency text default 'USD') returns jsonb
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
   join lateral(select r.unit_price from public.client_selling_prices r where r.organization_id=e.organization_id and r.product_id=e.product_id
    and (r.variant_id is null or r.variant_id=e.variant_id) and (r.client_organization_id is null or r.client_organization_id=e.client_organization_id)
    and r.currency=target_currency and r.status='active' and r.starts_at<=statement_timestamp() and (r.ends_at is null or statement_timestamp()<r.ends_at)
    and r.minimum_quantity<=1 and (r.maximum_quantity is null or 1<=r.maximum_quantity)
    order by case r.price_kind when 'override' then 3 when 'client' then 2 else 1 end desc,(r.variant_id is not null) desc,r.minimum_quantity desc,r.starts_at desc,r.id limit 1) price on true
   where e.client_organization_id=target_client_organization_id and e.status='active' and e.starts_at<=statement_timestamp() and (e.ends_at is null or statement_timestamp()<e.ends_at)
   order by e.public_name,e.id limit 100) x),'[]')) into result;
 return result;
end $$;
create function public.get_order_service_admin() returns table(id uuid,provider_id uuid,client_id uuid,provider_name text,client_name text,status public.organization_status,order_access text,version integer)
language sql stable security definer set search_path='' as $$select s.id,s.organization_id,s.client_organization_id,p.name,c.name,s.status,s.order_access,s.version from public.client_service_relationships s join public.organizations p on p.id=s.organization_id join public.organizations c on c.id=s.client_organization_id where private.is_super_admin() order by p.name,c.name$$;

create function public.admin_save_order_service_access(target_service_id uuid,target_access text,target_expected_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin if not private.is_super_admin() then raise exception 'Active super-admin required' using errcode='42501';end if;
 if target_access not in('none','read','manage') then raise exception 'Invalid order access' using errcode='22023';end if;
 update public.client_service_relationships set order_access=target_access where id=target_service_id and version=target_expected_version returning id into rid;
 if rid is null then raise exception 'Service relationship not found or stale' using errcode='40001';end if;
 perform private.write_audit_event(auth.uid(),(select organization_id from public.client_service_relationships where id=rid),'order.service_access_changed','client_service_relationship',rid::text,jsonb_build_object('order_access',target_access));return rid;end $$;

create function public.submit_order(target_client_organization_id uuid,target_customer_id uuid,target_address_id uuid,target_currency text,target_lines jsonb,target_idempotency_key text) returns uuid
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
  select r.unit_price into price from public.client_selling_prices r where r.organization_id=seller and r.product_id=entry.product_id and (r.variant_id is null or r.variant_id=entry.variant_id)
   and (r.client_organization_id is null or r.client_organization_id=target_client_organization_id) and r.currency=target_currency and r.status='active'
   and r.starts_at<=statement_timestamp() and (r.ends_at is null or statement_timestamp()<r.ends_at) and r.minimum_quantity<=qty and (r.maximum_quantity is null or qty<=r.maximum_quantity)
   order by case r.price_kind when 'override' then 3 when 'client' then 2 else 1 end desc,(r.variant_id is not null) desc,r.minimum_quantity desc,r.starts_at desc,r.id limit 1;
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
  select r.unit_price into price from public.client_selling_prices r where r.organization_id=seller and r.product_id=entry.product_id and (r.variant_id is null or r.variant_id=entry.variant_id)
   and (r.client_organization_id is null or r.client_organization_id=target_client_organization_id) and r.currency=target_currency and r.status='active' and r.starts_at<=statement_timestamp() and (r.ends_at is null or statement_timestamp()<r.ends_at) and r.minimum_quantity<=qty and (r.maximum_quantity is null or qty<=r.maximum_quantity)
   order by case r.price_kind when 'override' then 3 when 'client' then 2 else 1 end desc,(r.variant_id is not null) desc,r.minimum_quantity desc,r.starts_at desc,r.id limit 1;
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

create function public.transition_order_status(target_order_id uuid,target_status public.order_status) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders;begin select * into o from public.orders where id=target_order_id for update;
 if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.manage') then raise exception 'Not authorized' using errcode='42501';end if;
 if not ((o.status='submitted' and target_status in('accepted','cancelled')) or (o.status='accepted' and target_status='cancelled')) then raise exception 'Transition not available in Phase 4A' using errcode='22023';end if;
 update public.orders set status=target_status,version=version+1,updated_at=now() where id=o.id;
 insert into public.order_lifecycle_events(organization_id,client_organization_id,order_id,action,old_status,new_status,actor_user_id) values(o.organization_id,o.client_organization_id,o.id,'status_changed',o.status::text,target_status::text,auth.uid());
 perform private.write_audit_event(auth.uid(),o.organization_id,'order.status_changed','order',o.id::text,jsonb_build_object('old_status',o.status,'status',target_status));return o.id;end $$;

revoke all on function public.get_order_contexts(),public.get_order_intake_options(uuid,text),public.get_order_service_admin(),public.admin_save_order_service_access(uuid,text,integer),public.submit_order(uuid,uuid,uuid,text,jsonb,text),public.transition_order_status(uuid,public.order_status) from public,anon;
grant execute on function public.get_order_contexts(),public.get_order_intake_options(uuid,text),public.get_order_service_admin(),public.admin_save_order_service_access(uuid,text,integer),public.submit_order(uuid,uuid,uuid,text,jsonb,text),public.transition_order_status(uuid,public.order_status) to authenticated;
commit;
