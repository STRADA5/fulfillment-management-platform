begin;

-- All procurement lots are QC controlled until a future configured waiver policy exists.
alter table public.inventory_lots add column qc_controlled boolean not null default false;
update public.inventory_lots l set qc_controlled=true where exists(select 1 from public.receiving_lines r where r.lot_id=l.id and r.purchase_order_line_id is not null);
create function private.mark_qc_controlled_lot() returns trigger language plpgsql set search_path='' as $$begin
 if new.status='pending_qc' or (tg_op='UPDATE' and old.qc_controlled) then new.qc_controlled:=true;end if;return new;
end $$;
revoke all on function private.mark_qc_controlled_lot() from public,anon,authenticated;
create trigger lot_qc_control before insert or update on public.inventory_lots for each row execute function private.mark_qc_controlled_lot();

create table public.qc_hold_decisions (
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 quarantine_transaction_id bigint not null references public.inventory_transactions(id),
 approved_quantity numeric(20,6) not null check(approved_quantity>=0 and approved_quantity<'Infinity'::numeric),
 rejected_quantity numeric(20,6) not null check(rejected_quantity>=0 and rejected_quantity<'Infinity'::numeric),
 reason text not null check(length(trim(reason))>=3),actor_user_id uuid not null references auth.users(id),
 idempotency_key text not null,created_at timestamptz not null default now(),
 check(approved_quantity+rejected_quantity>0),unique(organization_id,idempotency_key)
);
alter table public.qc_hold_decisions enable row level security;
create policy qc_hold_read on public.qc_hold_decisions for select to authenticated using(private.has_permission(organization_id,'qc.view'));
grant select on public.qc_hold_decisions to authenticated;
grant select,insert,delete on public.qc_hold_decisions to service_role;

create table public.qc_release_events (
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null,
 inspection_id uuid not null, warehouse_id uuid not null, location_id uuid not null,
 quantity numeric(20,6) not null check(quantity>0 and quantity<'Infinity'::numeric),
 actor_user_id uuid not null references auth.users(id), idempotency_key text not null,
 created_at timestamptz not null default now(),
 foreign key(organization_id,inspection_id) references public.qc_inspections(organization_id,id),
 foreign key(organization_id,warehouse_id,location_id) references public.warehouse_locations(organization_id,warehouse_id,id),
 unique(organization_id,idempotency_key)
);
alter table public.qc_release_events enable row level security;
create policy qc_release_read on public.qc_release_events for select to authenticated using(private.has_permission(organization_id,'qc.view'));
grant select on public.qc_release_events to authenticated;
grant select,insert,delete on public.qc_release_events to service_role;

create function private.protect_operational_history() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null then raise exception 'Operational history is append-only' using errcode='42501';end if;
 if tg_op='UPDATE' then return new;end if;return old;
end $$;
revoke all on function private.protect_operational_history() from public,anon,authenticated;
create trigger receiving_history_immutable before update or delete on public.receivings for each row execute function private.protect_operational_history();
create trigger receiving_line_history_immutable before update or delete on public.receiving_lines for each row execute function private.protect_operational_history();
create trigger qc_history_immutable before update or delete on public.qc_inspections for each row execute function private.protect_operational_history();
create trigger qc_release_history_immutable before update or delete on public.qc_release_events for each row execute function private.protect_operational_history();
create trigger qc_hold_history_immutable before update or delete on public.qc_hold_decisions for each row execute function private.protect_operational_history();

create function private.validate_procurement_receipt() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.purchase_order_lines%rowtype; h public.receivings%rowtype; l public.inventory_lots%rowtype;
begin
 if new.purchase_order_line_id is null then return new;end if;
 if new.qc_required is distinct from true then raise exception 'Procurement receipts require QC' using errcode='42501';end if;
 select * into p from public.purchase_order_lines where id=new.purchase_order_line_id and organization_id=new.organization_id for update;
 select * into h from public.receivings where id=new.receiving_id and organization_id=new.organization_id;
 select * into l from public.inventory_lots where id=new.lot_id and organization_id=new.organization_id for update;
 if p.id is null or h.purchase_order_id is distinct from p.purchase_order_id or p.product_variant_id is distinct from new.product_variant_id or l.product_variant_id is distinct from new.product_variant_id then raise exception 'Invalid receipt relationship' using errcode='22023';end if;
 if exists(select 1 from public.purchase_orders where id=p.purchase_order_id and status in('draft','cancelled','closed')) or p.status in('cancelled','closed') then raise exception 'Purchase order is not receivable' using errcode='22023';end if;
 if new.expiration_date is distinct from l.expiration_date or new.bud_date is distinct from l.bud_date then raise exception 'Existing lot dates cannot be replaced by receipt input' using errcode='22023';end if;
 if new.quantity_received is null or new.quantity_received>='Infinity'::numeric or new.quantity_accepted+new.quantity_damaged+new.quantity_rejected is distinct from new.quantity_received then raise exception 'Invalid receipt quantities' using errcode='22023';end if;
 if (new.discrepancy_quantity<>0 or new.quantity_damaged>0 or new.quantity_rejected>0) and nullif(trim(new.discrepancy_reason),'') is null then raise exception 'Discrepancy reason required' using errcode='22023';end if;
 if h.inbound_shipment_id is not null and not exists(select 1 from public.inbound_shipments s where s.id=h.inbound_shipment_id and s.organization_id=new.organization_id and s.warehouse_id=h.warehouse_id) then raise exception 'Shipment warehouse mismatch' using errcode='22023';end if;
 update public.inventory_lots set qc_controlled=true where id=l.id;
 return new;
end $$;
revoke all on function private.validate_procurement_receipt() from public,anon,authenticated;
create trigger procurement_receipt_integrity before insert on public.receiving_lines for each row execute function private.validate_procurement_receipt();

-- Preserve the original balance arithmetic, but put every caller behind a shared guard.
alter function private.apply_inventory_delta(uuid,uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text,text,integer) rename to apply_inventory_delta_phase3b;
create function private.apply_inventory_delta(org_id uuid,warehouse uuid,location uuid,variant uuid,lot uuid,tx text,pd numeric,ad numeric,rd numeric,qd numeric,dd numeric,ref_type text,ref_id text,actor uuid,why text,request_key text,seq integer) returns bigint language plpgsql security definer set search_path='' as $$
declare l public.inventory_lots%rowtype; prior public.inventory_transactions%rowtype; q public.qc_inspections%rowtype; released numeric;
begin
 perform private.require_inventory_org(org_id,'inventory.view',actor);
 if actor is distinct from auth.uid() or request_key is null or length(trim(request_key))<8 or pd is null or ad is null or rd is null or qd is null or dd is null or greatest(abs(pd),abs(ad),abs(rd),abs(qd),abs(dd))>='Infinity'::numeric then raise exception 'Invalid ledger operation' using errcode='22023';end if;
 select * into l from public.inventory_lots where id=lot and organization_id=org_id for update;
 if l.id is null or l.product_variant_id<>variant then raise exception 'Invalid lot' using errcode='22023';end if;
 select * into prior from public.inventory_transactions where organization_id=org_id and idempotency_key=request_key and sequence_number=seq;
 if prior.id is not null then
  if (prior.warehouse_id,prior.location_id,prior.lot_id,prior.transaction_type::text,prior.physical_delta,prior.available_delta,prior.reserved_delta,prior.quarantined_delta,prior.damaged_delta,prior.reference_type,prior.reference_id) is distinct from (warehouse,location,lot,tx,pd,ad,rd,qd,dd,ref_type,ref_id) then raise exception 'Idempotency key reused for different operation' using errcode='22023';end if;
  return prior.id;
 end if;
 if ad>0 and (l.status in('rejected','recalled','expired') or l.expiration_date<current_date or l.bud_date<current_date) then raise exception 'Ineligible inventory cannot become available' using errcode='42501';end if;
 if l.qc_controlled then
  if tx='receipt' and (ref_type<>'po_receiving' or ad<>0) then raise exception 'QC-controlled receipts must remain held' using errcode='42501';end if;
  if pd>0 and tx not in('receipt','transfer_in') then raise exception 'QC-controlled stock increases require receiving' using errcode='42501';end if;
  if ad>0 then
   if ref_type='qc_release' and tx='release_quarantine' then
    perform private.require_inventory_org(org_id,'qc.release',actor);
    select * into q from public.qc_inspections where id::text=ref_id and organization_id=org_id;
    select coalesce(sum(quantity),0) into released from public.qc_release_events where inspection_id=q.id;
    if q.id is null or q.lot_id<>lot or q.status not in('passed','partial_pass') or ad>released or not exists(select 1 from public.qc_release_events e where e.inspection_id=q.id and e.idempotency_key=request_key and e.quantity=ad and e.location_id=location and e.warehouse_id=warehouse and e.actor_user_id=actor) then raise exception 'Trusted QC release event required' using errcode='42501';end if;
   elsif tx='release_quarantine' and ref_type='qc_hold_decision' then
    perform private.require_inventory_org(org_id,'qc.release',actor);
    if not exists(select 1 from public.qc_hold_decisions d join public.inventory_transactions t on t.id=d.quarantine_transaction_id where d.id::text=ref_id and d.organization_id=org_id and d.approved_quantity=ad and d.idempotency_key=request_key and d.actor_user_id=actor and t.lot_id=lot and t.location_id=location and t.warehouse_id=warehouse) then raise exception 'Trusted hold decision required' using errcode='42501';end if;
   elsif tx='transfer_in' and ref_type='transfer' then
    if not exists(select 1 from public.inventory_transactions t where t.organization_id=org_id and t.idempotency_key=request_key and t.transaction_type='transfer_out' and t.lot_id=lot and t.available_delta=-ad and t.physical_delta=-pd) then raise exception 'Paired approved-stock transfer required' using errcode='42501';end if;
   elsif tx='release_reservation' and ref_type='reservation' then
    if not exists(select 1 from public.inventory_reservations r where r.id::text=ref_id and r.organization_id=org_id and r.lot_id=lot and r.location_id=location and r.status='active' and r.quantity=ad and rd=-ad) then raise exception 'Matching approved-stock reservation required' using errcode='42501';end if;
   else raise exception 'QC approval cannot be bypassed by an inventory mutation' using errcode='42501';
   end if;
  end if;
 end if;
 return private.apply_inventory_delta_phase3b(org_id,warehouse,location,variant,lot,tx,pd,ad,rd,qd,dd,ref_type,ref_id,actor,why,request_key,seq);
end $$;
revoke all on function private.apply_inventory_delta(uuid,uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text,text,integer),private.apply_inventory_delta_phase3b(uuid,uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text,text,integer) from public,anon,authenticated;

-- Public lot editing cannot clear QC control, rewrite expiry, or promote a QC-held lot.
alter function public.admin_save_inventory_lot(uuid,uuid,uuid,text,text,date,date,date,date,text,public.lot_status,text,uuid,uuid) set schema private;
alter function private.admin_save_inventory_lot(uuid,uuid,uuid,text,text,date,date,date,date,text,public.lot_status,text,uuid,uuid) rename to save_inventory_lot_phase3b;
revoke all on function private.save_inventory_lot_phase3b(uuid,uuid,uuid,text,text,date,date,date,date,text,public.lot_status,text,uuid,uuid) from public,anon,authenticated;
create function public.admin_save_inventory_lot(target_id uuid,target_organization_id uuid,target_variant_id uuid,target_lot_number text,target_manufacturer_lot text,target_manufactured date,target_received date,target_expiration date,target_bud date,target_uom text,target_status public.lot_status,target_notes text,target_supplier_id uuid,target_supplier_relationship_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.inventory_lots%rowtype;
begin
 perform private.require_inventory_org(target_organization_id,'inventory.manage_lots',auth.uid());
 select * into l from public.inventory_lots where id=target_id and organization_id=target_organization_id for update;
 if l.qc_controlled and (target_expiration is distinct from l.expiration_date or target_bud is distinct from l.bud_date or target_manufactured is distinct from l.manufactured_date or target_uom is distinct from l.unit_of_measure or (target_status is distinct from l.status and target_status not in('recalled','rejected','expired'))) then raise exception 'QC lot eligibility is controlled by the quality workflow' using errcode='42501';end if;
 return private.save_inventory_lot_phase3b(target_id,target_organization_id,target_variant_id,target_lot_number,target_manufacturer_lot,target_manufactured,target_received,target_expiration,target_bud,target_uom,target_status,target_notes,target_supplier_id,target_supplier_relationship_id);
end $$;
revoke all on function public.admin_save_inventory_lot(uuid,uuid,uuid,text,text,date,date,date,date,text,public.lot_status,text,uuid,uuid) from public,anon;
grant execute on function public.admin_save_inventory_lot(uuid,uuid,uuid,text,text,date,date,date,date,text,public.lot_status,text,uuid,uuid) to authenticated;

create or replace function public.admin_record_qc_inspection(target_organization_id uuid,target_receiving_line_id uuid,target_lot_id uuid,target_warehouse_id uuid,target_location_id uuid,target_status public.qc_status,target_inspected numeric,target_approved numeric,target_quarantined numeric,target_rejected numeric,target_reason_code text,target_notes text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_phase3c_org(target_organization_id,'qc.inspect');r public.receiving_lines%rowtype;l public.inventory_lots%rowtype;prior public.qc_inspections%rowtype;rid uuid;decided numeric;held numeric;
begin
 select * into r from public.receiving_lines where id=target_receiving_line_id and organization_id=target_organization_id and lot_id=target_lot_id for update;
 select * into l from public.inventory_lots where id=target_lot_id and organization_id=target_organization_id for update;
 if r.id is null or not l.qc_controlled or not r.qc_required or r.destination_location_id<>target_location_id or not exists(select 1 from public.receivings h where h.id=r.receiving_id and h.warehouse_id=target_warehouse_id) then raise exception 'Invalid inspection location/receipt' using errcode='22023';end if;
 select * into prior from public.qc_inspections where organization_id=target_organization_id and idempotency_key=target_idempotency_key;
 if prior.id is not null then
  if (prior.receiving_line_id,prior.status,prior.quantity_inspected,prior.quantity_approved,prior.quantity_quarantined,prior.quantity_rejected) is distinct from (r.id,target_status,target_inspected,target_approved,target_quarantined,target_rejected) then raise exception 'Conflicting inspection retry' using errcode='22023';end if;
  return prior.id;
 end if;
 if target_idempotency_key is null or length(trim(target_idempotency_key))<8 or target_inspected is null or target_approved is null or target_quarantined is null or target_rejected is null or target_inspected<=0 or least(target_approved,target_quarantined,target_rejected)<0 or greatest(target_inspected,target_approved,target_quarantined,target_rejected)>='Infinity'::numeric or target_approved+target_quarantined+target_rejected<>target_inspected then raise exception 'Invalid inspection quantities' using errcode='22023';end if;
 if target_status not in('pending','passed','partial_pass','failed','quarantined','rejected') or (target_status='passed' and target_approved<>target_inspected) or (target_status='partial_pass' and (target_approved<=0 or target_approved>=target_inspected)) or (target_status in('pending','quarantined','failed','rejected') and target_approved<>0) then raise exception 'Inspection decision conflicts with quantities' using errcode='22023';end if;
 select coalesce(sum(quantity_approved+quantity_rejected),0) into decided from public.qc_inspections where receiving_line_id=r.id;
 select quarantined_quantity into held from public.inventory_balances where lot_id=l.id and location_id=target_location_id;
 if target_inspected>r.quantity_accepted-decided or target_inspected>coalesce(held,0) then raise exception 'Quantity already inspected or no longer held' using errcode='23514';end if;
 insert into public.qc_inspections(organization_id,receiving_id,receiving_line_id,lot_id,inbound_shipment_id,inspector_user_id,status,quantity_inspected,quantity_approved,quantity_quarantined,quantity_rejected,reason_code,notes,idempotency_key)
 select target_organization_id,r.receiving_id,r.id,l.id,h.inbound_shipment_id,actor,target_status,target_inspected,target_approved,target_quarantined,target_rejected,nullif(trim(target_reason_code),''),nullif(trim(target_notes),''),target_idempotency_key from public.receivings h where h.id=r.receiving_id returning id into rid;
 if target_rejected>0 then perform private.apply_inventory_delta(target_organization_id,target_warehouse_id,target_location_id,l.product_variant_id,l.id,'damage',0,0,0,-target_rejected,target_rejected,'qc_inspection',rid::text,actor,'QC rejected',target_idempotency_key,1);end if;
 if target_status in('failed','rejected') and l.status not in('expired','recalled') then update public.inventory_lots set status='rejected' where id=l.id;end if;
 perform private.write_audit_event(actor,target_organization_id,'qc.inspected','qc_inspection',rid::text,jsonb_build_object('status',target_status,'approved',target_approved,'rejected',target_rejected));return rid;
end $$;

create or replace function public.admin_release_qc_inventory(target_organization_id uuid,target_qc_inspection_id uuid,target_warehouse_id uuid,target_location_id uuid,target_quantity numeric,target_idempotency_key text) returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_phase3c_org(target_organization_id,'qc.release');q public.qc_inspections%rowtype;l public.inventory_lots%rowtype;r public.receiving_lines%rowtype;e public.qc_release_events%rowtype;already numeric;tx bigint;
begin
 select * into q from public.qc_inspections where id=target_qc_inspection_id and organization_id=target_organization_id for update;
 select * into l from public.inventory_lots where id=q.lot_id for update;
 select * into r from public.receiving_lines where id=q.receiving_line_id;
 if q.id is null or q.status not in('passed','partial_pass') or l.status in('rejected','expired','recalled') or l.expiration_date<current_date or l.bud_date<current_date then raise exception 'QC approval and eligible lot required' using errcode='42501';end if;
 if r.destination_location_id<>target_location_id or not exists(select 1 from public.receivings h where h.id=r.receiving_id and h.warehouse_id=target_warehouse_id) then raise exception 'Inspection release location mismatch' using errcode='22023';end if;
 select * into e from public.qc_release_events where organization_id=target_organization_id and idempotency_key=target_idempotency_key;
 if e.id is not null then
  if (e.inspection_id,e.warehouse_id,e.location_id,e.quantity) is distinct from (q.id,target_warehouse_id,target_location_id,target_quantity) then raise exception 'Conflicting release retry' using errcode='22023';end if;
  select id into tx from public.inventory_transactions where organization_id=target_organization_id and idempotency_key=target_idempotency_key and sequence_number=1;return tx;
 end if;
 select coalesce(sum(quantity),0) into already from public.qc_release_events where inspection_id=q.id;
 if target_quantity is null or target_quantity<=0 or target_quantity>='Infinity'::numeric or target_quantity>q.quantity_approved-already then raise exception 'Release exceeds remaining approval' using errcode='23514';end if;
 insert into public.qc_release_events(organization_id,inspection_id,warehouse_id,location_id,quantity,actor_user_id,idempotency_key) values(target_organization_id,q.id,target_warehouse_id,target_location_id,target_quantity,actor,target_idempotency_key);
 tx:=private.apply_inventory_delta(target_organization_id,target_warehouse_id,target_location_id,l.product_variant_id,l.id,'release_quarantine',0,target_quantity,0,-target_quantity,0,'qc_release',q.id::text,actor,'QC release',target_idempotency_key,1);
 update public.inventory_lots set status='available' where id=l.id;
 perform private.write_audit_event(actor,target_organization_id,'qc.inventory_released','qc_inspection',q.id::text,jsonb_build_object('quantity',target_quantity,'transaction_id',tx));return tx;
end $$;

-- Supplier-sensitive procurement records require both the feature and supplier permission.
alter policy po_read on public.purchase_orders using(private.has_permission(organization_id,'purchasing.view') and private.has_permission(organization_id,'suppliers.view'));
alter policy po_lines_read on public.purchase_order_lines using(private.has_permission(organization_id,'purchasing.view') and private.has_permission(organization_id,'suppliers.view'));
alter policy inbound_read on public.inbound_shipments using(private.has_permission(organization_id,'purchasing.view') and private.has_permission(organization_id,'suppliers.view'));
alter policy supplier_issue_read on public.supplier_issues using(private.has_permission(organization_id,'supplier_issues.view') and private.has_permission(organization_id,'suppliers.view'));

create function public.get_receiving_work_items(target_organization_id uuid) returns table(id uuid,product_variant_id uuid,quantity_ordered numeric,quantity_received numeric,status text) language plpgsql security definer set search_path='' as $$
begin perform private.require_phase3c_org(target_organization_id,'receiving.view');return query select l.id,l.product_variant_id,l.quantity_ordered,l.quantity_received,l.status::text from public.purchase_order_lines l join public.purchase_orders p on p.id=l.purchase_order_id where l.organization_id=target_organization_id and p.status not in('draft','cancelled','closed') and l.status not in('cancelled','closed');end $$;
revoke all on function public.get_receiving_work_items(uuid) from public,anon;
grant execute on function public.get_receiving_work_items(uuid) to authenticated;

-- Expiration is always enforced at reads and mutations; this explicit local job reconciles buckets.
create function public.admin_process_inventory_expiration(target_organization_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_phase3c_org(target_organization_id,'qc.release');l record;b record;processed integer:=0;
begin
 for l in select * from public.inventory_lots where organization_id=target_organization_id and (expiration_date<current_date or bud_date<current_date) order by id for update loop
  for b in select * from public.inventory_balances where lot_id=l.id and available_quantity>0 order by id for update loop
   perform private.apply_inventory_delta(target_organization_id,b.warehouse_id,b.location_id,l.product_variant_id,l.id,'expiration',0,-b.available_quantity,0,b.available_quantity,0,'expiration',l.id::text,actor,'Expiration/BUD hold','expiry-'||b.id::text||'-'||b.updated_at::text,1);
  end loop;
  if l.status<>'expired' then update public.inventory_lots set status='expired' where id=l.id;perform private.write_audit_event(actor,target_organization_id,'inventory.expired','inventory_lot',l.id::text,'{}');processed:=processed+1;end if;
 end loop;return processed;
end $$;
revoke all on function public.admin_process_inventory_expiration(uuid) from public,anon;
grant execute on function public.admin_process_inventory_expiration(uuid) to authenticated;
create or replace function public.admin_save_inbound_shipment(target_id uuid,target_organization_id uuid,target_supplier_id uuid,target_purchase_order_id uuid,target_reference text,target_carrier text,target_tracking text,target_expected date,target_actual timestamptz,target_status public.inbound_shipment_status,target_packages integer,target_warehouse_id uuid,target_notes text) returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=private.require_phase3c_org(target_organization_id,'purchasing.manage');rid uuid;begin
 if not exists(select 1 from public.suppliers s where s.id=target_supplier_id and s.organization_id=target_organization_id) or (target_purchase_order_id is not null and not exists(select 1 from public.purchase_orders where id=target_purchase_order_id and organization_id=target_organization_id and supplier_id=target_supplier_id)) then raise exception'Invalid procurement relationship' using errcode='22023';end if;
 if target_id is null then insert into public.inbound_shipments(organization_id,supplier_id,purchase_order_id,shipment_reference,carrier,tracking_number,expected_arrival_date,actual_arrival_at,status,package_count,warehouse_id,notes,created_by) values(target_organization_id,target_supplier_id,target_purchase_order_id,trim(target_reference),nullif(trim(target_carrier),''),nullif(trim(target_tracking),''),target_expected,target_actual,target_status,target_packages,target_warehouse_id,nullif(trim(target_notes),''),actor) returning id into rid;
 else update public.inbound_shipments set shipment_reference=trim(target_reference),purchase_order_id=target_purchase_order_id,carrier=nullif(trim(target_carrier),''),tracking_number=nullif(trim(target_tracking),''),expected_arrival_date=target_expected,actual_arrival_at=target_actual,status=target_status,package_count=target_packages,warehouse_id=target_warehouse_id,notes=nullif(trim(target_notes),''),updated_at=now() where id=target_id and organization_id=target_organization_id and supplier_id=target_supplier_id returning id into rid;if rid is null then raise exception'Shipment not found' using errcode='P0002';end if;end if;
 perform private.write_audit_event(actor,target_organization_id,case when target_id is null then'inbound_shipment.created'else'inbound_shipment.updated'end,'inbound_shipment',rid::text,jsonb_build_object('status',target_status));return rid;end$$;


create or replace function public.admin_save_quality_document(target_id uuid,target_organization_id uuid,target_lot_id uuid,target_type text,target_name text,target_laboratory text,target_report text,target_test_date date,target_status public.quality_document_status,target_notes text,target_storage_reference text) returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=private.require_phase3c_org(target_organization_id,'quality_documents.manage');rid uuid;begin if not exists(select 1 from public.inventory_lots where id=target_lot_id and organization_id=target_organization_id) then raise exception'Invalid lot' using errcode='22023';end if;if target_id is null then insert into public.quality_documents(organization_id,lot_id,document_type,document_name,testing_laboratory,report_reference,test_date,status,notes,storage_reference,created_by) values(target_organization_id,target_lot_id,target_type,trim(target_name),nullif(trim(target_laboratory),''),nullif(trim(target_report),''),target_test_date,target_status,nullif(trim(target_notes),''),nullif(trim(target_storage_reference),''),actor) returning id into rid;else update public.quality_documents set document_type=target_type,document_name=trim(target_name),testing_laboratory=nullif(trim(target_laboratory),''),report_reference=nullif(trim(target_report),''),test_date=target_test_date,status=target_status,notes=nullif(trim(target_notes),''),storage_reference=nullif(trim(target_storage_reference),''),updated_at=now() where id=target_id and organization_id=target_organization_id and lot_id=target_lot_id returning id into rid;if rid is null then raise exception'Document not found' using errcode='P0002';end if;end if;perform private.write_audit_event(actor,target_organization_id,case when target_id is null then'quality_document.created'else'quality_document.updated'end,'quality_document',rid::text,jsonb_build_object('type',target_type,'status',target_status));return rid;end$$;


create or replace function public.admin_save_supplier_issue(target_id uuid,target_organization_id uuid,target_supplier_id uuid,target_purchase_order_id uuid,target_receiving_id uuid,target_inbound_shipment_id uuid,target_lot_id uuid,target_issue_type text,target_quantity numeric,target_severity public.supplier_issue_severity,target_description text,target_status public.supplier_issue_status,target_supplier_notified timestamptz,target_owner uuid,target_resolution text,target_resolution_type public.supplier_resolution_type,target_replacement_quantity numeric,target_replacement_expected date,target_credit_amount numeric,target_currency text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=private.require_phase3c_org(target_organization_id,'supplier_issues.manage');rid uuid;begin
 if not exists(select 1 from public.suppliers where id=target_supplier_id and organization_id=target_organization_id) then raise exception'Invalid supplier' using errcode='22023';end if;if target_credit_amount is not null and not private.has_permission(target_organization_id,'purchasing.view_costs',actor) then raise exception'Cost permission required' using errcode='42501';end if;
 if target_id is null then insert into public.supplier_issues(organization_id,supplier_id,purchase_order_id,receiving_id,inbound_shipment_id,lot_id,issue_type,quantity_affected,severity,description,status,supplier_notified_at,internal_owner_user_id,resolution,resolution_type,replacement_quantity,replacement_expected_date,credit_amount,currency,resolved_at,created_by,idempotency_key) values(target_organization_id,target_supplier_id,target_purchase_order_id,target_receiving_id,target_inbound_shipment_id,target_lot_id,target_issue_type,target_quantity,target_severity,trim(target_description),target_status,target_supplier_notified,target_owner,nullif(trim(target_resolution),''),target_resolution_type,target_replacement_quantity,target_replacement_expected,target_credit_amount,case when target_currency is null then null else upper(target_currency) end,case when target_status in('resolved','closed') then now() end,actor,target_idempotency_key) returning id into rid;
 else update public.supplier_issues set purchase_order_id=target_purchase_order_id,receiving_id=target_receiving_id,inbound_shipment_id=target_inbound_shipment_id,lot_id=target_lot_id,issue_type=target_issue_type,quantity_affected=target_quantity,severity=target_severity,description=trim(target_description),status=target_status,supplier_notified_at=target_supplier_notified,internal_owner_user_id=target_owner,resolution=nullif(trim(target_resolution),''),resolution_type=target_resolution_type,replacement_quantity=target_replacement_quantity,replacement_expected_date=target_replacement_expected,credit_amount=case when private.has_permission(target_organization_id,'purchasing.view_costs',actor) then target_credit_amount else credit_amount end,currency=case when private.has_permission(target_organization_id,'purchasing.view_costs',actor) then coalesce(upper(target_currency),currency) else currency end,resolved_at=case when target_status in('resolved','closed') then coalesce(resolved_at,now()) else null end,updated_at=now() where id=target_id and organization_id=target_organization_id and supplier_id=target_supplier_id returning id into rid;if rid is null then raise exception'Issue not found' using errcode='P0002';end if;end if;
 perform private.write_audit_event(actor,target_organization_id,case when target_id is null then'supplier_issue.created'else'supplier_issue.updated'end,'supplier_issue',rid::text,jsonb_build_object('status',target_status,'resolution_type',target_resolution_type));return rid;end$$;


create or replace function public.admin_save_purchase_order(target_id uuid,target_organization_id uuid,target_supplier_id uuid,target_number text,target_supplier_reference text,target_order_date date,target_expected_ship date,target_expected_delivery date,target_currency text,target_subtotal numeric,target_freight numeric,target_additional numeric,target_status public.purchase_order_status,target_notes text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=private.require_phase3c_org(target_organization_id,'purchasing.manage');rid uuid;begin
 if not private.has_permission(target_organization_id,'purchasing.view_costs',actor) and (coalesce(target_subtotal,0)<>0 or coalesce(target_freight,0)<>0 or coalesce(target_additional,0)<>0) then raise exception'Cost permission required' using errcode='42501';end if;
 if not exists(select 1 from public.suppliers where id=target_supplier_id and organization_id=target_organization_id and status='active') then raise exception'Invalid supplier' using errcode='22023';end if;
 if target_id is null and target_idempotency_key is not null then select id into rid from public.purchase_orders where organization_id=target_organization_id and idempotency_key=target_idempotency_key;if rid is not null then return rid;end if;end if;
 if target_id is null then insert into public.purchase_orders(organization_id,supplier_id,purchase_order_number,supplier_reference,order_date,expected_ship_date,expected_delivery_date,currency,subtotal,freight_cost,additional_cost,status,internal_notes,created_by,idempotency_key) values(target_organization_id,target_supplier_id,trim(target_number),nullif(trim(target_supplier_reference),''),target_order_date,target_expected_ship,target_expected_delivery,upper(target_currency),coalesce(target_subtotal,0),coalesce(target_freight,0),coalesce(target_additional,0),target_status,nullif(trim(target_notes),''),actor,target_idempotency_key) returning id into rid;
 else update public.purchase_orders set purchase_order_number=trim(target_number),supplier_reference=nullif(trim(target_supplier_reference),''),order_date=target_order_date,expected_ship_date=target_expected_ship,expected_delivery_date=target_expected_delivery,status=target_status,internal_notes=nullif(trim(target_notes),''),subtotal=case when private.has_permission(target_organization_id,'purchasing.view_costs',actor) then coalesce(target_subtotal,subtotal) else subtotal end,freight_cost=case when private.has_permission(target_organization_id,'purchasing.view_costs',actor) then coalesce(target_freight,freight_cost) else freight_cost end,additional_cost=case when private.has_permission(target_organization_id,'purchasing.view_costs',actor) then coalesce(target_additional,additional_cost) else additional_cost end,updated_at=now() where id=target_id and organization_id=target_organization_id and supplier_id=target_supplier_id returning id into rid; if rid is null then raise exception'PO not found' using errcode='P0002';end if;end if;
 perform private.write_audit_event(actor,target_organization_id,case when target_id is null then'purchase_order.created'else'purchase_order.updated'end,'purchase_order',rid::text,jsonb_build_object('status',target_status));return rid;end$$;


-- Mutations touching supplier identities require supplier visibility as well as feature access.
create or replace function private.require_phase3c_org(org_id uuid,permission_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 perform private.require_inventory_org(org_id,permission_code,actor);
 if permission_code like 'purchasing.%' or permission_code like 'supplier_issues.%' then
  perform private.require_inventory_org(org_id,'suppliers.view',actor);
 end if;return actor;
end $$;

create function private.validate_phase3c_relationships() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='supplier_issues' then
  if new.purchase_order_id is not null and not exists(select 1 from public.purchase_orders p where p.id=new.purchase_order_id and p.organization_id=new.organization_id and p.supplier_id=new.supplier_id) then raise exception 'Supplier/PO mismatch' using errcode='22023';end if;
  if new.inbound_shipment_id is not null and not exists(select 1 from public.inbound_shipments s where s.id=new.inbound_shipment_id and s.organization_id=new.organization_id and s.supplier_id=new.supplier_id and (new.purchase_order_id is null or s.purchase_order_id=new.purchase_order_id)) then raise exception 'Supplier/shipment mismatch' using errcode='22023';end if;
  if new.receiving_id is not null and not exists(select 1 from public.receivings r join public.purchase_orders p on p.id=r.purchase_order_id where r.id=new.receiving_id and r.organization_id=new.organization_id and p.supplier_id=new.supplier_id and (new.purchase_order_id is null or p.id=new.purchase_order_id)) then raise exception 'Supplier/receiving mismatch' using errcode='22023';end if;
  if new.internal_owner_user_id is not null and not exists(select 1 from public.organization_memberships m join public.profiles p on p.id=m.user_id where m.organization_id=new.organization_id and m.user_id=new.internal_owner_user_id and m.status='active' and p.status='active') then raise exception 'Invalid issue owner' using errcode='22023';end if;
 elsif tg_table_name='purchase_order_lines' then
  if new.quantity_ordered>='Infinity'::numeric or new.unit_cost>='Infinity'::numeric then raise exception 'Invalid PO line quantity/cost' using errcode='22023';end if;
  if tg_op='UPDATE' and new.quantity_ordered is distinct from old.quantity_ordered and new.quantity_ordered<old.quantity_received then raise exception 'Ordered quantity cannot be reduced below received quantity' using errcode='22023';end if;
 end if;return new;
end $$;
revoke all on function private.validate_phase3c_relationships() from public,anon,authenticated;
create trigger supplier_issue_relationships before insert or update on public.supplier_issues for each row execute function private.validate_phase3c_relationships();
create trigger purchase_line_integrity before insert or update on public.purchase_order_lines for each row execute function private.validate_phase3c_relationships();
create function public.admin_resolve_inventory_hold(target_organization_id uuid,target_quarantine_transaction_id bigint,target_approved numeric,target_rejected numeric,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_phase3c_org(target_organization_id,'qc.release');t public.inventory_transactions%rowtype;l public.inventory_lots%rowtype;d public.qc_hold_decisions%rowtype;used numeric;rid uuid;
begin
 select * into t from public.inventory_transactions where id=target_quarantine_transaction_id and organization_id=target_organization_id and transaction_type='quarantine' and reference_type='quarantine';
 if t.id is null then raise exception 'Operational quarantine event required' using errcode='22023';end if;
 select * into l from public.inventory_lots where id=t.lot_id for update;
 if not l.qc_controlled then raise exception 'Use the standard non-QC quarantine workflow' using errcode='22023';end if;
 select * into d from public.qc_hold_decisions where organization_id=target_organization_id and idempotency_key=target_idempotency_key;
 if d.id is not null then
  if (d.quarantine_transaction_id,d.approved_quantity,d.rejected_quantity,d.reason) is distinct from (t.id,target_approved,target_rejected,trim(target_reason)) then raise exception 'Conflicting hold decision retry' using errcode='22023';end if;return d.id;
 end if;
 if target_approved is null or target_rejected is null or least(target_approved,target_rejected)<0 or target_approved+target_rejected<=0 or greatest(target_approved,target_rejected)>='Infinity'::numeric or length(trim(target_idempotency_key))<8 or target_idempotency_key is null then raise exception 'Invalid hold decision' using errcode='22023';end if;
 if target_approved>0 and (l.status in('rejected','recalled','expired') or l.expiration_date<current_date or l.bud_date<current_date) then raise exception 'Lot is not releasable' using errcode='42501';end if;
 select coalesce(sum(approved_quantity+rejected_quantity),0) into used from public.qc_hold_decisions where quarantine_transaction_id=t.id;
 if target_approved+target_rejected>t.quarantined_delta-used then raise exception 'Hold decision exceeds unresolved quantity' using errcode='23514';end if;
 insert into public.qc_hold_decisions(organization_id,quarantine_transaction_id,approved_quantity,rejected_quantity,reason,actor_user_id,idempotency_key) values(target_organization_id,t.id,target_approved,target_rejected,trim(target_reason),actor,target_idempotency_key) returning id into rid;
 if target_approved>0 then perform private.apply_inventory_delta(target_organization_id,t.warehouse_id,t.location_id,t.product_variant_id,t.lot_id,'release_quarantine',0,target_approved,0,-target_approved,0,'qc_hold_decision',rid::text,actor,target_reason,target_idempotency_key,1);end if;
 if target_rejected>0 then perform private.apply_inventory_delta(target_organization_id,t.warehouse_id,t.location_id,t.product_variant_id,t.lot_id,'damage',0,0,0,-target_rejected,target_rejected,'qc_hold_decision',rid::text,actor,target_reason,target_idempotency_key,2);end if;
 perform private.write_audit_event(actor,target_organization_id,'qc.hold_resolved','qc_hold_decision',rid::text,jsonb_build_object('approved',target_approved,'rejected',target_rejected));return rid;
end $$;
revoke all on function public.admin_resolve_inventory_hold(uuid,bigint,numeric,numeric,text,text) from public,anon;
grant execute on function public.admin_resolve_inventory_hold(uuid,bigint,numeric,numeric,text,text) to authenticated;
commit;
