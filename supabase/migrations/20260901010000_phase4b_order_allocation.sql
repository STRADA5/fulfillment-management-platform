begin;

insert into public.permissions(code,name,description) values
 ('order_allocation.view','View order allocations','View internal reservation and demand queues'),
 ('order_allocation.manage','Manage order allocations','Allocate, release, and process order demand') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code in('SUPER_ADMIN','ADMIN') and p.code in('order_allocation.view','order_allocation.manage') on conflict do nothing;

alter table public.orders add column allocation_status text not null default 'pending' check(allocation_status in('pending','partially_available','backordered','preorder','ready','cancelled'));
alter table public.order_lines add column allocated_quantity numeric(20,6) not null default 0 check(allocated_quantity>=0 and allocated_quantity<=quantity),
 add column pending_quantity numeric(20,6) generated always as(quantity-allocated_quantity) stored,
 add column minimum_shelf_life_days integer not null default 0 check(minimum_shelf_life_days between 0 and 3650),
 add column allocation_status text not null default 'pending' check(allocation_status in('pending','partially_available','backordered','preorder','ready','cancelled'));

create table public.order_allocation_runs(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,order_id uuid not null,
 idempotency_key text not null,request_hash text not null,created_by_user_id uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(organization_id,idempotency_key),foreign key(order_id) references public.orders(id) on delete restrict
);
create table public.order_allocations(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,client_organization_id uuid not null,
 order_id uuid not null,order_line_id uuid not null,product_variant_id uuid not null,warehouse_id uuid not null,location_id uuid not null,lot_id uuid not null,
 reservation_id uuid unique references public.inventory_reservations(id) on delete restrict,quantity numeric(20,6) not null check(quantity>0),
 status text not null default 'reserved' check(status in('reserved','released','cancelled')),source text not null check(source in('manual','automatic')),
 created_by_user_id uuid references auth.users(id),created_at timestamptz not null default now(),released_at timestamptz,
 foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id),foreign key(order_line_id) references public.order_lines(id),
 foreign key(organization_id,warehouse_id,location_id) references public.warehouse_locations(organization_id,warehouse_id,id),
 foreign key(organization_id,product_variant_id,lot_id) references public.inventory_lots(organization_id,product_variant_id,id)
);
create table public.order_demands(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,client_organization_id uuid not null,order_id uuid not null,order_line_id uuid not null,
 product_variant_id uuid not null,demand_type text not null check(demand_type in('backorder','preorder')),quantity_initial numeric(20,6) not null check(quantity_initial>0),
 quantity_remaining numeric(20,6) not null check(quantity_remaining>=0),quantity_later_allocated numeric(20,6) not null default 0 check(quantity_later_allocated>=0),
 status text not null default 'open' check(status in('open','partial','ready','cancelled')),priority integer not null default 100,
 expected_available_at timestamptz,warehouse_id uuid,reasons text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(client_organization_id,order_id) references public.orders(client_organization_id,id),foreign key(order_line_id) references public.order_lines(id),
 unique(order_line_id,demand_type)
);

do $$declare t text;begin foreach t in array array['order_allocation_runs','order_allocations','order_demands'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create policy allocation_internal_read on public.order_allocations for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.view') and private.has_permission(organization_id,'order_allocation.view'));
create policy demand_internal_read on public.order_demands for select to authenticated using(private.can_access_order(client_organization_id,organization_id,'orders.view') and private.has_permission(organization_id,'order_allocation.view'));
create policy allocation_run_internal_read on public.order_allocation_runs for select to authenticated using(private.has_permission(organization_id,'order_allocation.view'));
grant select on public.order_allocations,public.order_demands,public.order_allocation_runs to authenticated;

create function private.refresh_order_allocation_state(target_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare total numeric;pending numeric;has_pre boolean;new_state text;o public.orders;begin
 select * into o from public.orders where id=target_order for update;if o.id is null then return;end if;
 select coalesce(sum(quantity),0),coalesce(sum(pending_quantity),0) into total,pending from public.order_lines where order_id=target_order;
 select exists(select 1 from public.order_demands where order_id=target_order and demand_type='preorder' and status in('open','partial')) into has_pre;
 new_state:=case when o.status='cancelled' then 'cancelled' when pending=0 then 'ready' when total=pending then case when has_pre then 'preorder' else 'backordered' end else 'partially_available' end;
 update public.orders set allocation_status=new_state,updated_at=now(),version=version+1 where id=target_order;
 update public.order_verifications v set fulfillment_status=new_state,snapshot=jsonb_set(jsonb_set(v.snapshot,'{fulfillment_status}',to_jsonb(new_state)), '{lines}',
  (select coalesce(jsonb_agg(jsonb_build_object('sku',l.sku,'product',l.display_name,'quantity_ordered',l.quantity,'allocated_quantity',l.allocated_quantity,'pending_quantity',l.pending_quantity,'shipment_assignment',null,'line_status',l.allocation_status) order by l.id),'[]') from public.order_lines l where l.order_id=target_order)) where v.order_id=target_order and v.verification_sequence=1;
end $$;
revoke all on function private.refresh_order_allocation_state(uuid) from public,anon,authenticated;

create function private.allocate_order_line(line_id uuid,warehouse_filter uuid,source_kind text,actor uuid) returns numeric language plpgsql security definer set search_path='' as $$
declare l public.order_lines;b record;needed numeric;take numeric;aid uuid;rid uuid;seq integer:=0;begin
 select * into l from public.order_lines where id=line_id for update;if l.id is null or l.variant_id is null then return 0;end if;needed:=l.quantity-l.allocated_quantity;if needed<=0 then return 0;end if;
 for b in select ib.*,lot.expiration_date,lot.bud_date from public.inventory_balances ib join public.inventory_lots lot on lot.id=ib.lot_id and lot.organization_id=ib.organization_id
  join public.warehouses w on w.id=ib.warehouse_id and w.status='active' join public.warehouse_locations loc on loc.id=ib.location_id and loc.status='active'
  where ib.organization_id=l.organization_id and ib.product_variant_id=l.variant_id and ib.available_quantity>0 and (warehouse_filter is null or ib.warehouse_id=warehouse_filter)
   and lot.status='available' and (lot.expiration_date is null or lot.expiration_date>=current_date+l.minimum_shelf_life_days) and (lot.bud_date is null or lot.bud_date>=current_date+l.minimum_shelf_life_days)
  order by least(coalesce(lot.expiration_date,'infinity'::date),coalesce(lot.bud_date,'infinity'::date)),lot.received_date nulls last,lot.id,ib.warehouse_id,ib.location_id for update of ib loop
  exit when needed<=0;take:=least(needed,b.available_quantity);seq:=seq+1;aid:=extensions.gen_random_uuid();
  insert into public.inventory_reservations(organization_id,warehouse_id,location_id,product_variant_id,lot_id,quantity,source_type,source_id,created_by_user_id)
   values(l.organization_id,b.warehouse_id,b.location_id,l.variant_id,b.lot_id,take,'order_allocation',aid::text,actor) returning id into rid;
  perform private.apply_inventory_delta(l.organization_id,b.warehouse_id,b.location_id,l.variant_id,b.lot_id,'reserve',0,-take,take,0,0,'order_allocation',aid::text,actor,'Order allocation','p4b-reserve-'||aid::text,1);
  insert into public.order_allocations(id,organization_id,client_organization_id,order_id,order_line_id,product_variant_id,warehouse_id,location_id,lot_id,reservation_id,quantity,source,created_by_user_id)
   values(aid,l.organization_id,l.client_organization_id,l.order_id,l.id,l.variant_id,b.warehouse_id,b.location_id,b.lot_id,rid,take,source_kind,actor);
  update public.order_lines set allocated_quantity=allocated_quantity+take where id=l.id;needed:=needed-take;
 end loop;return l.quantity-needed-l.allocated_quantity;
end $$;
revoke all on function private.allocate_order_line(uuid,uuid,text,uuid) from public,anon,authenticated;

create function private.create_or_update_demand(line_id uuid,demand_kind text,eta timestamptz,warehouse uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare l public.order_lines;remaining numeric;begin select * into l from public.order_lines where id=line_id for update;remaining:=l.quantity-l.allocated_quantity;
 if remaining<=0 then update public.order_demands set quantity_remaining=0,status='ready',updated_at=now() where order_line_id=line_id and status in('open','partial');return;end if;
 insert into public.order_demands(organization_id,client_organization_id,order_id,order_line_id,product_variant_id,demand_type,quantity_initial,quantity_remaining,expected_available_at,warehouse_id,reasons)
 values(l.organization_id,l.client_organization_id,l.order_id,l.id,l.variant_id,demand_kind,remaining,remaining,eta,warehouse,coalesce(reason,''))
 on conflict(order_line_id,demand_type) do update set quantity_remaining=excluded.quantity_remaining,status=case when public.order_demands.quantity_later_allocated>0 then'partial'else'open'end,expected_available_at=excluded.expected_available_at,warehouse_id=excluded.warehouse_id,reasons=excluded.reasons,updated_at=now();
 update public.order_lines set allocation_status=case when allocated_quantity>0 then'partially_available'when demand_kind='backorder'then'backordered'else'preorder'end where id=line_id;end $$;
revoke all on function private.create_or_update_demand(uuid,text,timestamptz,uuid,text) from public,anon,authenticated;

create function public.admin_allocate_order(target_order_id uuid,target_warehouse_id uuid,target_demand_type text,target_expected_available_at timestamptz,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders;r public.order_allocation_runs;digest text;l record;allocated numeric;begin select * into o from public.orders where id=target_order_id for update;
 if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.manage') or not private.has_permission(o.organization_id,'order_allocation.manage') then raise exception'Not authorized'using errcode='42501';end if;
 if o.status not in('submitted','accepted') or target_demand_type not in('backorder','preorder') or length(trim(target_idempotency_key))<8 then raise exception'Invalid allocation request'using errcode='22023';end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_object('order',target_order_id,'warehouse',target_warehouse_id,'type',target_demand_type,'eta',target_expected_available_at,'reason',target_reason)::text,'UTF8'),'sha256'),'hex');
 select * into r from public.order_allocation_runs where organization_id=o.organization_id and idempotency_key=target_idempotency_key for update;if r.id is not null then if r.request_hash<>digest then raise exception'Idempotency key reused'using errcode='22023';end if;return o.id;end if;
 insert into public.order_allocation_runs(organization_id,order_id,idempotency_key,request_hash,created_by_user_id)values(o.organization_id,o.id,target_idempotency_key,digest,auth.uid());
 for l in select id from public.order_lines where order_id=o.id order by created_at,id for update loop allocated:=private.allocate_order_line(l.id,target_warehouse_id,'manual',auth.uid());perform private.create_or_update_demand(l.id,target_demand_type,target_expected_available_at,target_warehouse_id,target_reason);if allocated>0 then perform private.write_audit_event(auth.uid(),o.organization_id,'order_allocation.reserved','order_line',l.id::text,jsonb_build_object('quantity',allocated));end if;if(select pending_quantity>0 from public.order_lines where id=l.id)then perform private.write_audit_event(auth.uid(),o.organization_id,case when target_demand_type='preorder'then'order_allocation.preorder_created'else'order_allocation.backorder_created'end,'order_line',l.id::text,jsonb_build_object('quantity',(select pending_quantity from public.order_lines where id=l.id),'expected_available_at',target_expected_available_at));if allocated>0 then perform private.write_audit_event(auth.uid(),o.organization_id,'order_allocation.partial','order_line',l.id::text,jsonb_build_object('allocated_quantity',allocated,'pending_quantity',(select pending_quantity from public.order_lines where id=l.id)));end if;end if;end loop;
 perform private.refresh_order_allocation_state(o.id);perform private.write_audit_event(auth.uid(),o.organization_id,'order_allocation.completed','order',o.id::text,jsonb_build_object('allocation_status',(select allocation_status from public.orders where id=o.id)));return o.id;end $$;

create function public.admin_cancel_order_allocations(target_order_id uuid,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders;a record;begin select * into o from public.orders where id=target_order_id for update;if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.manage') or not private.has_permission(o.organization_id,'order_allocation.manage') then raise exception'Not authorized'using errcode='42501';end if;
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception'Invalid cancellation request'using errcode='22023';end if;
 if o.allocation_status='cancelled' then return o.id;end if;
 update public.orders set status='cancelled',allocation_status='cancelled',version=version+1,updated_at=now()where id=o.id;
 update public.order_demands set status='cancelled',quantity_remaining=0,updated_at=now()where order_id=o.id;
 for a in select x.*,r.status reservation_status from public.order_allocations x join public.inventory_reservations r on r.id=x.reservation_id where x.order_id=o.id and x.status='reserved' order by x.id for update of x,r loop
  perform private.apply_inventory_delta(a.organization_id,a.warehouse_id,a.location_id,a.product_variant_id,a.lot_id,'release_reservation',0,a.quantity,-a.quantity,0,0,'reservation',a.reservation_id::text,auth.uid(),'Order cancelled',target_idempotency_key||'-'||a.id::text,1);
  update public.inventory_reservations set status='released',released_at=now()where id=a.reservation_id;update public.order_allocations set status='cancelled',released_at=now()where id=a.id;end loop;
 update public.order_lines set allocated_quantity=0,allocation_status='cancelled'where order_id=o.id;
 perform private.refresh_order_allocation_state(o.id);perform private.write_audit_event(auth.uid(),o.organization_id,'order_allocation.cancelled','order',o.id::text,jsonb_build_object('status','cancelled'));return o.id;end $$;

create function private.process_order_demands(target_organization_id uuid,target_variant_id uuid,target_actor_id uuid) returns integer language plpgsql security definer set search_path='' as $$declare d record;n integer:=0;allocated numeric;begin
 perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text||target_variant_id::text,0));
 for d in select dem.*,o.submitted_at from public.order_demands dem join public.orders o on o.id=dem.order_id join public.organizations seller on seller.id=o.organization_id and seller.status='active' join public.organizations client on client.id=o.client_organization_id and client.status='active' where dem.organization_id=target_organization_id and dem.product_variant_id=target_variant_id and dem.status in('open','partial') and o.status in('submitted','accepted') and(dem.demand_type='backorder'or dem.expected_available_at is null or dem.expected_available_at<=now())order by dem.priority,o.submitted_at,dem.created_at,dem.id for update of dem loop
  allocated:=private.allocate_order_line(d.order_line_id,d.warehouse_id,'automatic',target_actor_id);if allocated>0 then update public.order_demands set quantity_remaining=greatest(0,quantity_remaining-allocated),quantity_later_allocated=quantity_later_allocated+allocated,status=case when quantity_remaining-allocated<=0 then'ready'else'partial'end,updated_at=now()where id=d.id;update public.order_lines set allocation_status=case when pending_quantity=0 then'ready'else'partially_available'end where id=d.order_line_id;perform private.refresh_order_allocation_state(d.order_id);perform private.write_audit_event(target_actor_id,target_organization_id,case when d.demand_type='preorder'then'order_allocation.preorder_allocated'else'order_allocation.backorder_allocated'end,'order_demand',d.id::text,jsonb_build_object('quantity',allocated));n:=n+1;end if;end loop;return n;end $$;
revoke all on function private.process_order_demands(uuid,uuid,uuid) from public,anon,authenticated;

create function public.admin_process_order_demands(target_organization_id uuid,target_variant_id uuid,target_idempotency_key text) returns integer language plpgsql security definer set search_path='' as $$begin
 if not private.has_permission(target_organization_id,'order_allocation.manage') then raise exception'Not authorized'using errcode='42501';end if;
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception'Invalid allocation request'using errcode='22023';end if;
 return private.process_order_demands(target_organization_id,target_variant_id,auth.uid());end $$;

create function private.allocate_newly_available_inventory() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.available_quantity>old.available_quantity and auth.uid() is not null and private.has_permission(new.organization_id,'inventory.view') then
  perform private.process_order_demands(new.organization_id,new.product_variant_id,auth.uid());
 end if;return new;end $$;
revoke all on function private.allocate_newly_available_inventory() from public,anon,authenticated;
create trigger inventory_available_allocate_backorders after update of available_quantity on public.inventory_balances for each row when(new.available_quantity>old.available_quantity)execute function private.allocate_newly_available_inventory();

create function public.get_order_allocation_summary(target_order_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare o public.orders;begin select * into o from public.orders where id=target_order_id;if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.view') then raise exception'Not authorized'using errcode='42501';end if;return jsonb_build_object('status',o.allocation_status,'lines',(select coalesce(jsonb_agg(jsonb_build_object('line_id',l.id,'sku',l.sku,'product',l.display_name,'ordered',l.quantity,'allocated',l.allocated_quantity,'pending',l.pending_quantity,'status',l.allocation_status,'expected_available_at',(select max(d.expected_available_at)from public.order_demands d where d.order_line_id=l.id and d.status in('open','partial')))),'[]')from public.order_lines l where l.order_id=o.id));end $$;

revoke all on function public.admin_allocate_order(uuid,uuid,text,timestamptz,text,text),public.admin_cancel_order_allocations(uuid,text),public.admin_process_order_demands(uuid,uuid,text),public.get_order_allocation_summary(uuid) from public,anon;
grant execute on function public.admin_allocate_order(uuid,uuid,text,timestamptz,text,text),public.admin_cancel_order_allocations(uuid,text),public.admin_process_order_demands(uuid,uuid,text),public.get_order_allocation_summary(uuid) to authenticated;
commit;
