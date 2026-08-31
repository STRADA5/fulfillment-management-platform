begin;

-- Phase 4G: post-delivery discrepancy resolution, recipient acknowledgments,
-- replacement shipments, returns/RMAs, receiving, disposition, and reconciliation.

insert into public.permissions(code,name,description) values
 ('cases.view','View discrepancy cases','View authorized discrepancy status'),
 ('cases.acknowledge','Acknowledge discrepancies','Acknowledge a shipment discrepancy as an authorized recipient'),
 ('discrepancies.manage','Manage discrepancy cases','Create, assign, resolve, and reconcile discrepancy cases'),
 ('replacements.view','View replacement shipments','View authorized replacement status'),
 ('replacements.manage','Manage replacement shipments','Reserve inventory and create replacement shipments'),
 ('returns.view','View returns and RMAs','View authorized return status'),
 ('returns.manage','Manage return authorizations','Authorize and manage RMAs'),
 ('returns.receive','Receive returned inventory','Record physical returned quantities into quarantine'),
 ('returns.disposition','Dispose returned inventory','Release, quarantine, damage, reject, or expire returned stock')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in('SUPER_ADMIN','ADMIN') and p.code in('cases.view','cases.acknowledge','discrepancies.manage','replacements.view','replacements.manage','returns.view','returns.manage','returns.receive','returns.disposition')) or
 (r.code in('CLIENT_ADMIN','CLIENT_USER') and p.code in('cases.view','cases.acknowledge','replacements.view','returns.view'))
on conflict do nothing;

create table public.recipient_discrepancy_acknowledgments(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 client_organization_id uuid not null references public.organizations(id) on delete cascade,
 discrepancy_case_id uuid not null references public.discrepancy_cases(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,
 shipment_id uuid references public.shipments(id) on delete restrict,
 acknowledged_by_user_id uuid not null references auth.users(id) on delete restrict,
 acknowledgment text not null default 'acknowledged' check(acknowledgment in('acknowledged','disputed','withdrawn')),
 note text not null default '', idempotency_key text not null,
 created_at timestamptz not null default now(),
 unique(discrepancy_case_id,acknowledged_by_user_id),
 unique(organization_id,idempotency_key)
);

create table public.replacement_requests(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 client_organization_id uuid not null references public.organizations(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete restrict,
 discrepancy_case_id uuid references public.discrepancy_cases(id) on delete restrict,
 original_shipment_id uuid references public.shipments(id) on delete restrict,
 status text not null default 'approved' check(status in('requested','approved','reserved','shipped','delivered','cancelled','rejected')),
 reason text not null default '', idempotency_key text not null,
 created_by_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);
create trigger replacement_requests_set_updated_at before update on public.replacement_requests for each row execute function private.set_updated_at();

create table public.replacement_request_lines(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 replacement_request_id uuid not null references public.replacement_requests(id) on delete restrict,
 order_line_id uuid not null references public.order_lines(id) on delete restrict,
 product_variant_id uuid not null references public.product_variants(id) on delete restrict,
 lot_id uuid not null references public.inventory_lots(id) on delete restrict,
 warehouse_id uuid not null references public.warehouses(id) on delete restrict,
 location_id uuid not null references public.warehouse_locations(id) on delete restrict,
 reservation_id uuid not null references public.inventory_reservations(id) on delete restrict,
 quantity numeric(20,6) not null check(quantity>0), created_at timestamptz not null default now()
);

create table public.replacement_shipments(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 replacement_request_id uuid not null references public.replacement_requests(id) on delete restrict,
 original_shipment_id uuid references public.shipments(id) on delete restrict,
 replacement_shipment_id uuid not null references public.shipments(id) on delete restrict,
 created_at timestamptz not null default now(), unique(replacement_request_id), unique(replacement_shipment_id)
);

create table public.return_authorizations(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 client_organization_id uuid not null references public.organizations(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete restrict,
 original_shipment_id uuid not null references public.shipments(id) on delete restrict,
 discrepancy_case_id uuid references public.discrepancy_cases(id) on delete restrict,
 rma_number text not null, status text not null default 'authorized' check(status in('requested','authorized','in_transit','received','dispositioned','closed','rejected','cancelled')),
 reason text not null default '', idempotency_key text not null,
 created_by_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,idempotency_key), unique(organization_id,rma_number)
);
create trigger return_authorizations_set_updated_at before update on public.return_authorizations for each row execute function private.set_updated_at();

create table public.return_authorization_lines(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 return_authorization_id uuid not null references public.return_authorizations(id) on delete restrict,
 shipment_line_id uuid not null references public.shipment_lines(id) on delete restrict,
 product_variant_id uuid not null references public.product_variants(id) on delete restrict,
 lot_id uuid not null references public.inventory_lots(id) on delete restrict,
 quantity_requested numeric(20,6) not null check(quantity_requested>0), quantity_received numeric(20,6) not null default 0 check(quantity_received>=0), quantity_dispositioned numeric(20,6) not null default 0 check(quantity_dispositioned>=0),
 created_at timestamptz not null default now()
);

create table public.return_receipts(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 return_authorization_id uuid not null references public.return_authorizations(id) on delete restrict,
 warehouse_id uuid not null references public.warehouses(id) on delete restrict, location_id uuid not null references public.warehouse_locations(id) on delete restrict,
 received_by_user_id uuid not null references auth.users(id), idempotency_key text not null, received_at timestamptz not null default now(), notes text not null default '',
 unique(organization_id,idempotency_key), unique(return_authorization_id)
);
create table public.return_receipt_lines(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 return_receipt_id uuid not null references public.return_receipts(id) on delete restrict, return_authorization_line_id uuid not null references public.return_authorization_lines(id) on delete restrict,
 lot_id uuid not null references public.inventory_lots(id) on delete restrict, quantity numeric(20,6) not null check(quantity>0), created_at timestamptz not null default now(), unique(return_receipt_id,return_authorization_line_id)
);

create table public.return_dispositions(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 return_authorization_id uuid not null references public.return_authorizations(id) on delete restrict,
 return_authorization_line_id uuid not null references public.return_authorization_lines(id) on delete restrict,
 lot_id uuid not null references public.inventory_lots(id) on delete restrict,
 disposition text not null check(disposition in('restock','quarantine','damaged','rejected','expired','recalled','unusable')),
 quantity numeric(20,6) not null check(quantity>0), reason text not null default '', idempotency_key text not null,
 created_by_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,idempotency_key)
);

create table public.post_delivery_reconciliations(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 client_organization_id uuid not null references public.organizations(id) on delete cascade, order_id uuid not null references public.orders(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict, discrepancy_case_id uuid references public.discrepancy_cases(id) on delete restrict,
 result text not null check(result in('matched','discrepancy')), summary text not null default '', idempotency_key text not null,
 reconciled_by_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,idempotency_key), unique(shipment_id)
);

do $$declare t text;begin foreach t in array array['recipient_discrepancy_acknowledgments','replacement_requests','replacement_request_lines','replacement_shipments','return_authorizations','return_authorization_lines','return_receipts','return_receipt_lines','return_dispositions','post_delivery_reconciliations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;

create policy recipient_ack_read on public.recipient_discrepancy_acknowledgments for select to authenticated using(
 acknowledged_by_user_id=auth.uid() or private.has_permission(organization_id,'discrepancies.manage')
);
create policy replacement_read on public.replacement_requests for select to authenticated using(private.has_permission(organization_id,'replacements.manage'));
create policy replacement_line_read on public.replacement_request_lines for select to authenticated using(private.has_permission(organization_id,'replacements.manage'));
create policy replacement_shipment_read on public.replacement_shipments for select to authenticated using(private.has_permission(organization_id,'replacements.manage'));
create policy return_read on public.return_authorizations for select to authenticated using(private.has_permission(organization_id,'returns.manage'));
create policy return_line_read on public.return_authorization_lines for select to authenticated using(private.has_permission(organization_id,'returns.manage'));
create policy return_receipt_read on public.return_receipts for select to authenticated using(private.has_permission(organization_id,'returns.receive'));
create policy return_receipt_line_read on public.return_receipt_lines for select to authenticated using(private.has_permission(organization_id,'returns.receive'));
create policy return_disposition_read on public.return_dispositions for select to authenticated using(private.has_permission(organization_id,'returns.disposition'));
create policy reconciliation_read on public.post_delivery_reconciliations for select to authenticated using(private.has_permission(organization_id,'discrepancies.manage'));
grant select on public.recipient_discrepancy_acknowledgments,public.replacement_requests,public.replacement_request_lines,public.replacement_shipments,public.return_authorizations,public.return_authorization_lines,public.return_receipts,public.return_receipt_lines,public.return_dispositions,public.post_delivery_reconciliations to authenticated;

create or replace function public.acknowledge_discrepancy_case(target_case_id uuid,target_acknowledgment text,target_note text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.discrepancy_cases; rid uuid;
begin
 if target_acknowledgment not in('acknowledged','disputed') or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid acknowledgment' using errcode='22023'; end if;
 select * into c from public.discrepancy_cases where id=target_case_id for update;
 if c.id is null or c.order_id is null or not private.can_access_order(c.client_organization_id,c.organization_id,'orders.view') then raise exception 'Not authorized' using errcode='42501'; end if;
 select id into rid from public.recipient_discrepancy_acknowledgments where discrepancy_case_id=c.id and acknowledged_by_user_id=actor; if rid is not null then return rid; end if;
 insert into public.recipient_discrepancy_acknowledgments(organization_id,client_organization_id,discrepancy_case_id,order_id,shipment_id,acknowledged_by_user_id,acknowledgment,note,idempotency_key) values(c.organization_id,c.client_organization_id,c.id,c.order_id,c.shipment_id,actor,target_acknowledgment,left(coalesce(target_note,''),2000),trim(target_idempotency_key)) returning id into rid;
 insert into public.discrepancy_case_events(organization_id,discrepancy_case_id,event_type,after_state,actor_user_id) values(c.organization_id,c.id,'recipient_'||target_acknowledgment,jsonb_build_object('acknowledgment',target_acknowledgment),actor);
 perform private.write_audit_event(actor,c.organization_id,'discrepancy.recipient_acknowledged','discrepancy_case',c.id::text,jsonb_build_object('acknowledgment',target_acknowledgment));
 perform private.enqueue_notification_event(c.order_id,'case.recipient_'||target_acknowledgment,'case-ack-'||rid::text,jsonb_build_object('case_id',c.id,'acknowledgment',target_acknowledgment),'internal','recipient_discrepancy_acknowledgments',rid::text,c.shipment_id);
 return rid;
end$$;
revoke all on function public.acknowledge_discrepancy_case(uuid,text,text,text) from public,anon;grant execute on function public.acknowledge_discrepancy_case(uuid,text,text,text) to authenticated;

create or replace function public.create_replacement_request(target_organization_id uuid,target_client_organization_id uuid,target_order_id uuid,target_discrepancy_case_id uuid,target_original_shipment_id uuid,target_lines jsonb,target_reason text,target_warehouse_id uuid,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); o public.orders; s public.shipments; req public.replacement_requests; rs public.shipments; item jsonb; ol public.order_lines; b record; remaining numeric; take numeric; seq integer; rid uuid; reservation uuid; allocation uuid; shipment_line uuid; digest text;
begin
 if not private.has_permission(target_organization_id,'replacements.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if length(trim(coalesce(target_idempotency_key,'')))<8 or jsonb_typeof(target_lines)<>'array' or jsonb_array_length(target_lines)<1 then raise exception 'Invalid replacement request' using errcode='22023'; end if;
 select * into o from public.orders where id=target_order_id and organization_id=target_organization_id and client_organization_id=target_client_organization_id for update; if o.id is null then raise exception 'Order not found' using errcode='P0002'; end if;
 select * into s from public.shipments where id=target_original_shipment_id and order_id=o.id and status='dispatched'; if s.id is null then raise exception 'Original shipment must be dispatched' using errcode='42501'; end if;
 select * into req from public.replacement_requests where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key) for update; if req.id is not null then return req.id; end if;
 if not exists(select 1 from public.warehouses where id=target_warehouse_id and organization_id=target_organization_id and status='active') then raise exception 'Invalid warehouse' using errcode='22023'; end if;
 insert into public.replacement_requests(organization_id,client_organization_id,order_id,discrepancy_case_id,original_shipment_id,reason,idempotency_key,created_by_user_id,status) values(target_organization_id,target_client_organization_id,target_order_id,target_discrepancy_case_id,target_original_shipment_id,left(coalesce(target_reason,''),2000),trim(target_idempotency_key),actor,'reserved') returning * into req;
 select coalesce(max(shipment_sequence),0)+1 into seq from public.shipments where order_id=o.id;
 insert into public.shipments(organization_id,client_organization_id,order_id,shipment_sequence,status,created_by_user_id) values(o.organization_id,o.client_organization_id,o.id,seq,'planned',actor) returning * into rs;
 insert into public.replacement_shipments(organization_id,replacement_request_id,original_shipment_id,replacement_shipment_id) values(target_organization_id,req.id,target_original_shipment_id,rs.id);
 for item in select value from jsonb_array_elements(target_lines) loop
   if not (item ? 'order_line_id') or not (item ? 'quantity') then raise exception 'Invalid replacement line' using errcode='22023'; end if;
   select * into ol from public.order_lines where id=(item->>'order_line_id')::uuid and order_id=o.id for share; if ol.id is null or ol.variant_id is null then raise exception 'Invalid order line' using errcode='22023'; end if;
   remaining:=(item->>'quantity')::numeric; if remaining<=0 or remaining<>trunc(remaining) then raise exception 'Invalid replacement quantity' using errcode='22023'; end if;
   for b in select ib.* from public.inventory_balances ib join public.inventory_lots lot on lot.id=ib.lot_id and lot.organization_id=ib.organization_id and lot.product_variant_id=ol.variant_id and lot.status='available' and (lot.expiration_date is null or lot.expiration_date>=current_date) and (lot.bud_date is null or lot.bud_date>=current_date) join public.warehouses w on w.id=ib.warehouse_id and w.organization_id=ib.organization_id and w.status='active' where ib.organization_id=target_organization_id and ib.warehouse_id=target_warehouse_id and ib.available_quantity>0 order by lot.expiration_date nulls last,lot.bud_date nulls last,ib.updated_at,ib.id for update of ib loop
     exit when remaining<=0; take:=least(remaining,b.available_quantity);
     insert into public.inventory_reservations(organization_id,warehouse_id,location_id,product_variant_id,lot_id,quantity,status,source_type,source_id,created_by_user_id) values(target_organization_id,b.warehouse_id,b.location_id,ol.variant_id,b.lot_id,take,'active','replacement_request',req.id::text||':'||ol.id::text||':'||b.lot_id::text,actor) returning id into reservation;
     perform private.apply_inventory_delta(target_organization_id,b.warehouse_id,b.location_id,ol.variant_id,b.lot_id,'reserve',0,-take,take,0,0,'replacement_request',req.id::text,actor,'Replacement reservation','p4g-reserve-'||reservation::text,1);
     insert into public.order_allocations(organization_id,client_organization_id,order_id,order_line_id,product_variant_id,warehouse_id,location_id,lot_id,reservation_id,quantity,status,source,created_by_user_id) values(target_organization_id,target_client_organization_id,o.id,ol.id,ol.variant_id,b.warehouse_id,b.location_id,b.lot_id,reservation,take,'reserved','manual',actor) returning id into allocation;
     insert into public.replacement_request_lines(organization_id,replacement_request_id,order_line_id,product_variant_id,lot_id,warehouse_id,location_id,reservation_id,quantity) values(target_organization_id,req.id,ol.id,ol.variant_id,b.lot_id,b.warehouse_id,b.location_id,reservation,take);
     insert into public.shipment_lines(organization_id,shipment_id,order_id,order_line_id,allocation_id,product_variant_id,lot_id,warehouse_id,location_id,quantity) values(target_organization_id,rs.id,o.id,ol.id,allocation,ol.variant_id,b.lot_id,b.warehouse_id,b.location_id,take) returning id into shipment_line;
     remaining:=remaining-take;
   end loop;
   if remaining>0 then raise exception 'Insufficient eligible replacement inventory' using errcode='22023'; end if;
 end loop;
 perform private.write_audit_event(actor,target_organization_id,'replacement.request_created','replacement_request',req.id::text,jsonb_build_object('order_id',o.id,'shipment_id',rs.id));
 perform private.enqueue_notification_event(o.id,'replacement.created','replacement-'||req.id::text,jsonb_build_object('replacement_request_id',req.id,'shipment_sequence',rs.shipment_sequence),'client','replacement_requests',req.id::text,rs.id);
 return req.id;
end$$;
revoke all on function public.create_replacement_request(uuid,uuid,uuid,uuid,uuid,jsonb,text,uuid,text) from public,anon;grant execute on function public.create_replacement_request(uuid,uuid,uuid,uuid,uuid,jsonb,text,uuid,text) to authenticated;

create or replace function public.create_return_authorization(target_organization_id uuid,target_client_organization_id uuid,target_order_id uuid,target_original_shipment_id uuid,target_discrepancy_case_id uuid,target_lines jsonb,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); o public.orders; s public.shipments; rma public.return_authorizations; item jsonb; sl public.shipment_lines; seq integer; rid uuid;
begin
 if not private.has_permission(target_organization_id,'returns.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if length(trim(coalesce(target_idempotency_key,'')))<8 or jsonb_typeof(target_lines)<>'array' or jsonb_array_length(target_lines)<1 then raise exception 'Invalid return request' using errcode='22023'; end if;
 select * into o from public.orders where id=target_order_id and organization_id=target_organization_id and client_organization_id=target_client_organization_id; select * into s from public.shipments where id=target_original_shipment_id and order_id=target_order_id and status='dispatched'; if o.id is null or s.id is null then raise exception 'Dispatched shipment required' using errcode='42501'; end if;
 select * into rma from public.return_authorizations where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key); if rma.id is not null then return rma.id; end if;
 select coalesce(max((regexp_match(rma_number,'([0-9]+)$'))[1]::integer),0)+1 into seq from public.return_authorizations where organization_id=target_organization_id;
 insert into public.return_authorizations(organization_id,client_organization_id,order_id,original_shipment_id,discrepancy_case_id,rma_number,reason,idempotency_key,created_by_user_id) values(target_organization_id,target_client_organization_id,target_order_id,target_original_shipment_id,target_discrepancy_case_id,'RMA-'||to_char(now(),'YYYYMMDD')||'-'||lpad(seq::text,4,'0'),left(coalesce(target_reason,''),2000),trim(target_idempotency_key),actor) returning * into rma;
 for item in select value from jsonb_array_elements(target_lines) loop
  select * into sl from public.shipment_lines where id=(item->>'shipment_line_id')::uuid and shipment_id=s.id; if sl.id is null then raise exception 'Invalid shipment line' using errcode='22023'; end if;
  if (item->>'quantity')::numeric<=0 or (item->>'quantity')::numeric>sl.quantity then raise exception 'Invalid return quantity' using errcode='22023'; end if;
  insert into public.return_authorization_lines(organization_id,return_authorization_id,shipment_line_id,product_variant_id,lot_id,quantity_requested) values(target_organization_id,rma.id,sl.id,sl.product_variant_id,sl.lot_id,(item->>'quantity')::numeric);
 end loop;
 perform private.write_audit_event(actor,target_organization_id,'return.authorized','return_authorization',rma.id::text,jsonb_build_object('order_id',target_order_id,'shipment_id',target_original_shipment_id));
 perform private.enqueue_notification_event(target_order_id,'return.authorized','return-'||rma.id::text,jsonb_build_object('rma_number',rma.rma_number,'status',rma.status),'client','return_authorizations',rma.id::text,target_original_shipment_id);
 return rma.id;
end$$;
revoke all on function public.create_return_authorization(uuid,uuid,uuid,uuid,uuid,jsonb,text,text) from public,anon;grant execute on function public.create_return_authorization(uuid,uuid,uuid,uuid,uuid,jsonb,text,text) to authenticated;

create or replace function public.receive_return(target_organization_id uuid,target_return_authorization_id uuid,target_warehouse_id uuid,target_location_id uuid,target_idempotency_key text,target_notes text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rma public.return_authorizations; rec public.return_receipts; l public.return_authorization_lines%rowtype; qty numeric; variant_id uuid;
begin
 if not private.has_permission(target_organization_id,'returns.receive',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid return receipt' using errcode='22023'; end if;
 select * into rma from public.return_authorizations where id=target_return_authorization_id and organization_id=target_organization_id for update;
 select * into rec from public.return_receipts where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key); if rec.id is not null then return rec.id; end if;
 if rma.id is null or rma.status not in('authorized','in_transit') then raise exception 'Return is not receivable' using errcode='42501'; end if;
 if not exists(select 1 from public.warehouses w where w.id=target_warehouse_id and w.organization_id=target_organization_id and w.status='active') or not exists(select 1 from public.warehouse_locations wl where wl.id=target_location_id and wl.warehouse_id=target_warehouse_id and wl.organization_id=target_organization_id and wl.status='active') then raise exception 'Invalid return location' using errcode='22023'; end if;
 insert into public.return_receipts(organization_id,return_authorization_id,warehouse_id,location_id,received_by_user_id,idempotency_key,notes) values(target_organization_id,rma.id,target_warehouse_id,target_location_id,actor,trim(target_idempotency_key),left(coalesce(target_notes,''),2000)) returning * into rec;
 for l in select * from public.return_authorization_lines where return_authorization_id=rma.id for update loop
  select ol.variant_id into variant_id from public.shipment_lines sl join public.order_lines ol on ol.id=sl.order_line_id where sl.id=(l).shipment_line_id;
  qty:=(l).quantity_requested-(l).quantity_received; if qty<=0 then continue; end if;
  perform private.apply_inventory_delta(target_organization_id,target_warehouse_id,target_location_id,variant_id,(l).lot_id,'return',qty,0,0,qty,0,'return_receipt',rec.id::text,actor,'Returned inventory held pending disposition','p4g-return-'||rec.id::text||'-'||(l).id::text,1);
  insert into public.return_receipt_lines(organization_id,return_receipt_id,return_authorization_line_id,lot_id,quantity) values(target_organization_id,rec.id,(l).id,(l).lot_id,qty);
  update public.return_authorization_lines set quantity_received=quantity_received+qty where id=(l).id;
 end loop;
 update public.return_authorizations set status='received',updated_at=now() where id=rma.id;
 perform private.write_audit_event(actor,target_organization_id,'return.received','return_receipt',rec.id::text,jsonb_build_object('rma_id',rma.id,'warehouse_id',target_warehouse_id,'location_id',target_location_id));
 perform private.enqueue_notification_event(rma.order_id,'return.received','return-received-'||rec.id::text,jsonb_build_object('rma_number',rma.rma_number,'status','received'),'client','return_receipts',rec.id::text,null);
 return rec.id;
end$$;
revoke all on function public.receive_return(uuid,uuid,uuid,uuid,text,text) from public,anon;grant execute on function public.receive_return(uuid,uuid,uuid,uuid,text,text) to authenticated;

create or replace function public.dispose_return(target_organization_id uuid,target_return_authorization_id uuid,target_line_id uuid,target_disposition text,target_quantity numeric,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rma public.return_authorizations; l public.return_authorization_lines%rowtype; lot public.inventory_lots; rid uuid; remaining numeric; warehouse_id uuid; location_id uuid;
begin
 if not private.has_permission(target_organization_id,'returns.disposition',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_disposition not in('restock','quarantine','damaged','rejected','expired','recalled','unusable') or target_quantity<=0 or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid disposition' using errcode='22023'; end if;
 select id into rid from public.return_dispositions where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key); if rid is not null then return rid; end if;
 select * into rma from public.return_authorizations where id=target_return_authorization_id and organization_id=target_organization_id for update;
 select ral.* into l from public.return_authorization_lines ral join public.return_receipt_lines rrl on rrl.return_authorization_line_id=ral.id where ral.id=target_line_id and ral.return_authorization_id=target_return_authorization_id limit 1;
 if not found or rma.id is null then raise exception 'Return line not received' using errcode='42501'; end if;
 select rr.warehouse_id,rr.location_id into warehouse_id,location_id from public.return_receipt_lines rrl join public.return_receipts rr on rr.id=rrl.return_receipt_id where rrl.return_authorization_line_id=(l).id order by rr.received_at desc limit 1;
 if target_quantity>(l).quantity_received-(l).quantity_dispositioned then raise exception 'Disposition exceeds received quantity' using errcode='22023'; end if;
 select * into lot from public.inventory_lots where id=(l).lot_id and organization_id=target_organization_id;
 if target_disposition='restock' and (lot.status not in('available','received') or (lot.expiration_date is not null and lot.expiration_date<current_date) or (lot.bud_date is not null and lot.bud_date<current_date)) then raise exception 'Ineligible return cannot be restocked' using errcode='42501'; end if;
 insert into public.return_dispositions(organization_id,return_authorization_id,return_authorization_line_id,lot_id,disposition,quantity,reason,idempotency_key,created_by_user_id) values(target_organization_id,rma.id,(l).id,(l).lot_id,target_disposition,target_quantity,left(coalesce(target_reason,''),2000),trim(target_idempotency_key),actor) returning id into rid;
 if target_disposition='restock' then perform private.apply_inventory_delta(target_organization_id,warehouse_id,location_id,(l).product_variant_id,(l).lot_id,'release_quarantine',0,target_quantity,0,-target_quantity,0,'return_disposition',rid::text,actor,'Eligible return restocked','p4g-disposition-'||rid::text,1);
 elsif target_disposition in('damaged','unusable') then perform private.apply_inventory_delta(target_organization_id,warehouse_id,location_id,(l).product_variant_id,(l).lot_id,'damage',0,0,0,-target_quantity,target_quantity,'return_disposition',rid::text,actor,'Returned inventory marked damaged','p4g-disposition-'||rid::text,1);
 end if;
 update public.return_authorization_lines set quantity_dispositioned=quantity_dispositioned+target_quantity where id=(l).id;
 update public.return_authorizations set status=case when not exists(select 1 from public.return_authorization_lines x where x.return_authorization_id=rma.id and x.quantity_dispositioned<x.quantity_received) then 'dispositioned' else 'received' end,updated_at=now() where id=rma.id;
 perform private.write_audit_event(actor,target_organization_id,'return.dispositioned','return_disposition',rid::text,jsonb_build_object('rma_id',rma.id,'disposition',target_disposition,'quantity',target_quantity));
 perform private.enqueue_notification_event(rma.order_id,'return.disposition.'||target_disposition,'return-disposition-'||rid::text,jsonb_build_object('rma_number',rma.rma_number,'disposition',target_disposition,'quantity',target_quantity),'client','return_dispositions',rid::text,null);
 return rid;
end$$;
revoke all on function public.dispose_return(uuid,uuid,uuid,text,numeric,text,text) from public,anon;grant execute on function public.dispose_return(uuid,uuid,uuid,text,numeric,text,text) to authenticated;

create or replace function public.create_post_delivery_reconciliation(target_organization_id uuid,target_client_organization_id uuid,target_order_id uuid,target_shipment_id uuid,target_discrepancy_case_id uuid,target_result text,target_summary text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); s public.shipments; rid uuid;
begin
 if not private.has_permission(target_organization_id,'discrepancies.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_result not in('matched','discrepancy') or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid reconciliation' using errcode='22023'; end if;
 select * into s from public.shipments where id=target_shipment_id and order_id=target_order_id and organization_id=target_organization_id and status='dispatched'; if s.id is null then raise exception 'Dispatched shipment required' using errcode='42501'; end if;
 select id into rid from public.post_delivery_reconciliations where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key); if rid is not null then return rid; end if;
 if target_result='discrepancy' and target_discrepancy_case_id is null then raise exception 'Discrepancy case required' using errcode='22023'; end if;
 insert into public.post_delivery_reconciliations(organization_id,client_organization_id,order_id,shipment_id,discrepancy_case_id,result,summary,idempotency_key,reconciled_by_user_id) values(target_organization_id,target_client_organization_id,target_order_id,target_shipment_id,target_discrepancy_case_id,target_result,left(coalesce(target_summary,''),4000),trim(target_idempotency_key),actor) returning id into rid;
 perform private.write_audit_event(actor,target_organization_id,'delivery.reconciled','post_delivery_reconciliation',rid::text,jsonb_build_object('shipment_id',target_shipment_id,'result',target_result));
 perform private.enqueue_notification_event(target_order_id,'delivery.reconciled','delivery-reconciled-'||rid::text,jsonb_build_object('shipment_id',target_shipment_id,'result',target_result),'client','post_delivery_reconciliations',rid::text,target_shipment_id);
 return rid;
end$$;
revoke all on function public.create_post_delivery_reconciliation(uuid,uuid,uuid,uuid,uuid,text,text,text) from public,anon;grant execute on function public.create_post_delivery_reconciliation(uuid,uuid,uuid,uuid,uuid,text,text,text) to authenticated;

create or replace function public.get_client_case_feed(target_limit integer default 50) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('case_number',c.case_number,'case_type',c.case_type,'severity',c.severity,'status',c.status,'title',c.title,'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb)
 from public.discrepancy_cases c where c.client_organization_id is not null and private.can_access_order(c.client_organization_id,c.organization_id,'orders.view') limit greatest(1,least(coalesce(target_limit,50),200));
$$;
revoke all on function public.get_client_case_feed(integer) from public,anon;grant execute on function public.get_client_case_feed(integer) to authenticated;

create or replace function public.get_client_replacement_status(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('status',r.status,'shipment_sequence',s.shipment_sequence,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb)
 from public.replacement_requests r join public.replacement_shipments rs on rs.replacement_request_id=r.id join public.shipments s on s.id=rs.replacement_shipment_id
 where r.order_id=target_order_id and private.can_access_order(r.client_organization_id,r.organization_id,'orders.view');
$$;
revoke all on function public.get_client_replacement_status(uuid) from public,anon;grant execute on function public.get_client_replacement_status(uuid) to authenticated;

create or replace function public.get_client_return_status(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('rma_number',r.rma_number,'status',r.status,'reason',r.reason,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb)
 from public.return_authorizations r where r.order_id=target_order_id and private.can_access_order(r.client_organization_id,r.organization_id,'orders.view');
$$;
revoke all on function public.get_client_return_status(uuid) from public,anon;grant execute on function public.get_client_return_status(uuid) to authenticated;

commit;
