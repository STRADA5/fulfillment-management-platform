begin;

-- Phase 4E: immutable order addendums, continuation shipments, and notification outbox.
insert into public.permissions(code,name,description) values
 ('orders.addendum.view','View order addendums','View amendment and continuation history'),
 ('orders.addendum.manage','Manage order addendums','Create authorized order amendments'),
 ('notifications.view','View notifications','View client-safe status notifications'),
 ('notifications.manage','Manage notifications','Manage internal alerts and notification delivery state')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code in('SUPER_ADMIN','ADMIN') and p.code in('orders.addendum.view','orders.addendum.manage','notifications.view','notifications.manage') on conflict do nothing;

create table public.order_addendums(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict, order_id uuid not null references public.orders(id) on delete restrict,
 addendum_number text not null, status text not null default 'applied' check(status in('applied','rejected','cancelled')),
 reason text not null default '', request_hash text not null, idempotency_key text not null, created_by_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(organization_id,idempotency_key), unique(order_id,addendum_number)
);
create table public.order_addendum_lines(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 addendum_id uuid not null references public.order_addendums(id) on delete restrict, entry_id uuid not null references public.client_catalog_entries(id) on delete restrict,
 product_id uuid not null, variant_id uuid, quantity_delta numeric(20,6) not null check(quantity_delta>0), unit_price numeric(20,4) not null check(unit_price>=0),
 line_total numeric(20,4) not null check(line_total>=0), pricing_snapshot jsonb not null, created_at timestamptz not null default now()
);
create table public.order_addendum_events(
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
 addendum_id uuid not null references public.order_addendums(id) on delete restrict, order_id uuid not null references public.orders(id) on delete restrict,
 event_type text not null check(event_type in('created','applied','continuation_created','rejected')), locked_shipment_exists boolean not null default false,
 snapshot jsonb not null default '{}'::jsonb, actor_user_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.notification_outbox(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid references public.organizations(id) on delete restrict, order_id uuid references public.orders(id) on delete cascade, shipment_id uuid references public.shipments(id) on delete cascade,
 event_type text not null, dedupe_key text not null, payload jsonb not null, status text not null default 'pending' check(status in('pending','processing','sent','failed','suppressed')),
 attempts integer not null default 0, available_at timestamptz not null default now(), last_error text, created_at timestamptz not null default now(), processed_at timestamptz, unique(organization_id,dedupe_key)
);
create table public.dashboard_alerts(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid references public.organizations(id) on delete restrict, order_id uuid references public.orders(id) on delete cascade, shipment_id uuid references public.shipments(id) on delete cascade,
 alert_type text not null, severity text not null check(severity in('info','warning','critical')), title text not null, message text not null, metadata jsonb not null default '{}', status text not null default 'open' check(status in('open','acknowledged','resolved')),
 created_at timestamptz not null default now(), acknowledged_at timestamptz, resolved_at timestamptz
);

do $$declare t text;begin foreach t in array array['order_addendums','order_addendum_lines','order_addendum_events','notification_outbox','dashboard_alerts'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
create policy addendum_read on public.order_addendums for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.addendum.view'));
create policy addendum_line_read on public.order_addendum_lines for select to authenticated using(exists(select 1 from public.order_addendums a where a.id=addendum_id and private.can_access_order(a.client_organization_id,a.organization_id,'orders.addendum.view')));
create policy addendum_event_read on public.order_addendum_events for select to authenticated using(private.has_permission(organization_id,'orders.addendum.view'));
create policy notification_read on public.notification_outbox for select to authenticated using((client_organization_id is not null and private.can_access_order(client_organization_id,organization_id,'orders.view')) or private.has_permission(organization_id,'notifications.manage'));
create policy alert_read on public.dashboard_alerts for select to authenticated using((client_organization_id is not null and private.can_access_order(client_organization_id,organization_id,'orders.view')) or private.has_permission(organization_id,'notifications.manage'));
grant select on public.order_addendums,public.order_addendum_lines,public.order_addendum_events,public.notification_outbox,public.dashboard_alerts to authenticated;

create or replace function private.enqueue_order_notification(target_order uuid,target_event text,target_dedupe text,target_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare o public.orders;rid uuid;begin select * into o from public.orders where id=target_order; if o.id is null then return null; end if; insert into public.notification_outbox(organization_id,client_organization_id,order_id,event_type,dedupe_key,payload) values(o.organization_id,o.client_organization_id,o.id,target_event,target_dedupe,target_payload) on conflict(organization_id,dedupe_key) do nothing returning id into rid; return rid;end$$;
revoke all on function private.enqueue_order_notification(uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function public.submit_order_addendum(target_client_organization_id uuid,target_order_id uuid,target_lines jsonb,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); o public.orders; a public.order_addendums; item jsonb; entry public.client_catalog_entries; qty numeric; price numeric; seller uuid; digest text; locked boolean; seq integer; add_no text; rid uuid; line_id uuid; order_line_ref uuid; existing_line public.order_lines; amount numeric; total_added numeric:=0; line_snapshot jsonb:='[]'::jsonb; continuation uuid;
begin
 if not private.can_access_orders(target_client_organization_id,'orders.create') and not private.can_access_orders(target_client_organization_id,'orders.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into o from public.orders where id=target_order_id and client_organization_id=target_client_organization_id for update; if o.id is null or o.status in('cancelled','fulfilled') then raise exception 'Order is not amendable' using errcode='42501'; end if;
 if jsonb_typeof(target_lines)<>'array' or jsonb_array_length(target_lines) not between 1 and 100 or length(trim(coalesce(target_idempotency_key,''))) not between 8 and 120 then raise exception 'Invalid addendum request' using errcode='22023'; end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_object('order',target_order_id,'lines',target_lines,'reason',coalesce(target_reason,''))::text,'UTF8'),'sha256'),'hex');
 select * into a from public.order_addendums where organization_id=o.organization_id and idempotency_key=trim(target_idempotency_key) for update; if a.id is not null then if a.request_hash<>digest then raise exception 'Idempotency key reused for different addendum' using errcode='22023'; end if; return a.id; end if;
 locked:=exists(select 1 from public.shipments where order_id=o.id and locked_at is not null and status<>'cancelled');
 select coalesce(max((regexp_match(addendum_number,'([0-9]+)$'))[1]::integer),0)+1 into seq from public.order_addendums where order_id=o.id; add_no:='ADD-'||lpad(seq::text,3,'0');
 insert into public.order_addendums(organization_id,client_organization_id,order_id,addendum_number,reason,request_hash,idempotency_key,created_by_user_id) values(o.organization_id,o.client_organization_id,o.id,add_no,coalesce(target_reason,''),digest,trim(target_idempotency_key),actor) returning * into a;
 for item in select value from jsonb_array_elements(target_lines) loop
   if exists(select 1 from jsonb_object_keys(item) k where k not in('entry_id','quantity')) then raise exception 'Invalid addendum line fields' using errcode='22023'; end if;
   qty:=(item->>'quantity')::numeric; if qty is null or qty<=0 or qty<>trunc(qty) then raise exception 'Invalid addendum quantity' using errcode='22023'; end if;
   select e.* into entry from public.client_catalog_entries e join public.client_catalog_connections c on c.id=e.connection_id and c.status='active' join public.products p on p.id=e.product_id and p.status='active' where e.id=(item->>'entry_id')::uuid and e.client_organization_id=o.client_organization_id and e.status='active' and e.starts_at<=statement_timestamp() and (e.ends_at is null or statement_timestamp()<e.ends_at);
   if entry.id is null or entry.variant_id is null then raise exception 'A sellable variant is required for an addendum' using errcode='42501'; end if; seller:=entry.organization_id;
   select r.unit_price into price from public.client_selling_prices r where r.organization_id=seller and r.product_id=entry.product_id and (r.variant_id is null or r.variant_id=entry.variant_id) and (r.client_organization_id is null or r.client_organization_id=o.client_organization_id) and r.currency=o.currency and r.status='active' and r.starts_at<=statement_timestamp() and (r.ends_at is null or statement_timestamp()<r.ends_at) and r.minimum_quantity<=qty and (r.maximum_quantity is null or qty<=r.maximum_quantity) order by case r.price_kind when 'override' then 3 when 'client' then 2 else 1 end desc,(r.variant_id is not null) desc,r.minimum_quantity desc,r.starts_at desc,r.id limit 1;
   if price is null then raise exception 'Authorized current price required' using errcode='42501'; end if; amount:=round(price*qty,private.money_scale(o.currency)); total_added:=total_added+amount;
   insert into public.order_addendum_lines(organization_id,addendum_id,entry_id,product_id,variant_id,quantity_delta,unit_price,line_total,pricing_snapshot) values(o.organization_id,a.id,entry.id,entry.product_id,entry.variant_id,qty,price,amount,jsonb_build_object('unit_price',price,'currency',o.currency,'quantity',qty,'resolved_at',statement_timestamp())) returning id into line_id;
   select * into existing_line from public.order_lines where order_id=o.id and entry_id=entry.id for update;
   if existing_line.id is null then insert into public.order_lines(organization_id,client_organization_id,order_id,entry_id,product_id,variant_id,sku,display_name,description,quantity,unit_price,currency,line_total,pricing_snapshot) select o.organization_id,o.client_organization_id,o.id,entry.id,entry.product_id,entry.variant_id,v.sku,entry.public_name,entry.public_description,qty,price,o.currency,amount,jsonb_build_object('addendum_id',a.id,'unit_price',price,'currency',o.currency) from public.client_catalog_entries e left join public.product_variants v on v.id=e.variant_id where e.id=entry.id returning id into order_line_ref; else order_line_ref:=existing_line.id; update public.order_lines set quantity=quantity+qty,line_total=line_total+amount where id=existing_line.id; end if;
   if locked then insert into public.order_demands(organization_id,client_organization_id,order_id,order_line_id,product_variant_id,demand_type,quantity_initial,quantity_remaining,reasons) values(o.organization_id,o.client_organization_id,o.id,order_line_ref,entry.variant_id,'backorder',qty,qty,'Post-lock order addendum') on conflict(order_line_id,demand_type) do update set quantity_remaining=public.order_demands.quantity_remaining+excluded.quantity_remaining,quantity_initial=public.order_demands.quantity_initial+excluded.quantity_initial,status='open',updated_at=now(); end if;
   line_snapshot:=line_snapshot||jsonb_build_object('entry_id',entry.id,'quantity',qty,'unit_price',price);
 end loop;
 update public.orders set subtotal=subtotal+total_added,total=total+total_added,version=version+1,updated_at=now() where id=o.id;
 insert into public.order_addendum_events(organization_id,addendum_id,order_id,event_type,locked_shipment_exists,snapshot,actor_user_id) values(o.organization_id,a.id,o.id,'applied',locked,jsonb_build_object('addendum_number',add_no,'lines',line_snapshot,'total_added',total_added),actor);
 if locked then select coalesce(max(shipment_sequence),0)+1 into seq from public.shipments where order_id=o.id; insert into public.shipments(organization_id,client_organization_id,order_id,shipment_sequence,status,created_by_user_id) values(o.organization_id,o.client_organization_id,o.id,seq,'planned',actor) returning id into continuation; insert into public.order_addendum_events(organization_id,addendum_id,order_id,event_type,locked_shipment_exists,snapshot,actor_user_id) values(o.organization_id,a.id,o.id,'continuation_created',true,jsonb_build_object('shipment_id',continuation,'shipment_sequence',seq),actor); end if;
 perform private.enqueue_order_notification(o.id,'order.addendum.applied','addendum-'||a.id::text,jsonb_build_object('order_number',o.order_number,'addendum_number',add_no,'continuation_shipment',continuation)); perform private.write_audit_event(actor,o.organization_id,'order.addendum_applied','order_addendum',a.id::text,jsonb_build_object('addendum_number',add_no,'locked_shipment',locked,'total_added',total_added)); return a.id;
end$$;

create or replace function public.get_client_order_notifications(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare o public.orders;begin select * into o from public.orders where id=target_order_id;if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.view') then raise exception 'Not authorized' using errcode='42501';end if;return coalesce((select jsonb_agg(jsonb_build_object('event_type',n.event_type,'payload',n.payload,'created_at',n.created_at) order by n.created_at) from public.notification_outbox n where n.order_id=o.id and n.status<>'suppressed'),'[]'::jsonb);end$$;
revoke all on function public.submit_order_addendum(uuid,uuid,jsonb,text,text),public.get_client_order_notifications(uuid) from public,anon;grant execute on function public.submit_order_addendum(uuid,uuid,jsonb,text,text),public.get_client_order_notifications(uuid) to authenticated;

create or replace function private.enqueue_lifecycle_notification() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.enqueue_order_notification(new.order_id,'order.'||new.action,'lifecycle-'||new.id::text,jsonb_build_object('status',new.new_status)); return new; end$$;
drop trigger if exists order_lifecycle_notification on public.order_lifecycle_events; create trigger order_lifecycle_notification after insert on public.order_lifecycle_events for each row execute function private.enqueue_lifecycle_notification();
create or replace function private.enqueue_tracking_notification() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.enqueue_order_notification((select order_id from public.shipments where id=new.shipment_id),'shipment.'||new.normalized_status,'tracking-'||new.id::text,jsonb_build_object('status',new.normalized_status,'shipment_id',new.shipment_id,'package_id',new.package_id)); return new; end$$;
drop trigger if exists tracking_notification on public.shipping_tracking_events; create trigger tracking_notification after insert on public.shipping_tracking_events for each row execute function private.enqueue_tracking_notification();

revoke all on function private.enqueue_lifecycle_notification(),private.enqueue_tracking_notification() from public,anon,authenticated;
commit;
