begin;

-- Phase 4D: carrier-neutral shipping, labels, tracking, and immutable shipping lock.
-- This migration is additive and intentionally uses only a deterministic local adapter.

insert into public.permissions(code,name,description) values
 ('shipping.view','View shipping','View internal shipping queues and package status'),
 ('shipping.manage','Manage shipping','Configure package shipping and exceptions'),
 ('shipping.quote','Create shipping quotes','Create server-calculated shipping charge snapshots'),
 ('shipping.label.create','Create shipping labels','Create and lock local/test shipping labels'),
 ('shipping.label.void','Void shipping labels','Void labels before dispatch'),
 ('shipping.tracking.manage','Manage tracking','Ingest and reconcile tracking events'),
 ('shipping.exception.manage','Manage shipping exceptions','Manage carrier exception states')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('SUPER_ADMIN','ADMIN') and p.code like 'shipping.%' on conflict do nothing;

alter table public.shipment_packages
  add column if not exists length numeric(20,6),
  add column if not exists width numeric(20,6),
  add column if not exists height numeric(20,6),
  add column if not exists dimension_unit text not null default 'in',
  add column if not exists shipping_locked_at timestamptz;
alter table public.shipment_packages
  drop constraint if exists shipment_packages_dimensions_check;
alter table public.shipment_packages
  add constraint shipment_packages_dimensions_check check
    ((length is null and width is null and height is null) or
     (length > 0 and width > 0 and height > 0 and length < 'Infinity'::numeric and width < 'Infinity'::numeric and height < 'Infinity'::numeric));

create table public.shipping_services(
 id uuid primary key default extensions.gen_random_uuid(),
 carrier_code text not null check(carrier_code ~ '^[a-z0-9_]+$'),
 service_code text not null,
 service_name text not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(carrier_code,service_code)
);
insert into public.shipping_services(carrier_code,service_code,service_name) values
 ('test','ground','Local Test Ground'),('usps','priority','USPS Priority'),('ups','ground','UPS Ground'),('fedex','ground','FedEx Ground'),('dhl','express','DHL Express')
on conflict(carrier_code,service_code) do nothing;

create table public.shipment_shipping_selections(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict,
 package_id uuid not null references public.shipment_packages(id) on delete restrict,
 shipping_service_id uuid not null references public.shipping_services(id) on delete restrict,
 selected_by_user_id uuid not null references auth.users(id), selected_at timestamptz not null default now(),
 unique(package_id)
);

create table public.shipping_charge_snapshots(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict,
 package_id uuid not null references public.shipment_packages(id) on delete restrict,
 shipping_service_id uuid not null references public.shipping_services(id) on delete restrict,
 currency text not null check(currency ~ '^[A-Z]{3}$'), base_charge numeric(20,6) not null check(base_charge>=0),
 fuel_surcharge numeric(20,6) not null default 0 check(fuel_surcharge>=0), handling_charge numeric(20,6) not null default 0 check(handling_charge>=0),
 total_charge numeric(20,6) generated always as (base_charge+fuel_surcharge+handling_charge) stored,
 quote_reference text not null, quoted_at timestamptz not null default now(), effective_at timestamptz not null default now(),
 immutable_at timestamptz, created_by_user_id uuid not null references auth.users(id), unique(package_id)
);

create table public.shipping_labels(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict,
 package_id uuid not null references public.shipment_packages(id) on delete restrict,
 carrier_code text not null, service_code text not null, provider_label_id text not null,
 tracking_number text not null, label_status text not null default 'created' check(label_status in('created','voided','failed')),
 label_format text not null default 'test-reference', label_reference text, created_by_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), voided_at timestamptz, unique(package_id), unique(carrier_code,tracking_number)
);

create table public.shipping_tracking_events(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict, package_id uuid not null references public.shipment_packages(id) on delete restrict,
 shipping_label_id uuid not null references public.shipping_labels(id) on delete restrict,
 provider_event_id text not null, event_hash text not null, normalized_status text not null check(normalized_status in('label_created','pre_transit','picked_up','in_transit','out_for_delivery','delayed','exception','delivered','returned','unknown')),
 carrier_status_code text, occurred_at timestamptz not null, received_at timestamptz not null default now(), location text, message text, source text not null default 'test_adapter' check(source in('test_adapter','webhook','poll','manual')),
 raw_payload jsonb not null default '{}'::jsonb, created_by_user_id uuid references auth.users(id), unique(shipping_label_id,provider_event_id), unique(shipping_label_id,event_hash)
);

create table public.shipping_exceptions(
 id uuid primary key default extensions.gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict, package_id uuid references public.shipment_packages(id) on delete restrict,
 code text not null, severity text not null check(severity in('info','warning','critical')), details text not null default '', status text not null default 'open' check(status in('open','acknowledged','resolved')),
 opened_at timestamptz not null default now(), resolved_at timestamptz, created_by_user_id uuid not null references auth.users(id), resolved_by_user_id uuid references auth.users(id)
);

create table public.shipment_verification_shipping_events(
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
 shipment_id uuid not null references public.shipments(id) on delete restrict, shipment_verification_id uuid not null references public.shipment_verifications(id) on delete restrict,
 event_type text not null check(event_type in('shipping_locked','tracking_updated','exception_opened','exception_resolved','delivered')),
 carrier_code text, service_code text, tracking_number text, ship_date timestamptz, estimated_delivery timestamptz, normalized_status text, metadata jsonb not null default '{}'::jsonb,
 actor_user_id uuid references auth.users(id), created_at timestamptz not null default now()
);

do $$declare t text;begin foreach t in array array['shipping_services','shipment_shipping_selections','shipping_charge_snapshots','shipping_labels','shipping_tracking_events','shipping_exceptions','shipment_verification_shipping_events'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create policy shipping_services_read on public.shipping_services for select to authenticated using(enabled and (private.is_active_profile(auth.uid()) or private.is_super_admin(auth.uid())));
create policy shipping_selection_read on public.shipment_shipping_selections for select to authenticated using(private.has_permission(organization_id,'shipping.view'));
create policy shipping_charge_read on public.shipping_charge_snapshots for select to authenticated using(private.has_permission(organization_id,'shipping.view'));
create policy shipping_label_read on public.shipping_labels for select to authenticated using(private.has_permission(organization_id,'shipping.view'));
create policy tracking_event_read on public.shipping_tracking_events for select to authenticated using(private.has_permission(organization_id,'shipping.view'));
create policy shipping_exception_read on public.shipping_exceptions for select to authenticated using(private.has_permission(organization_id,'shipping.exception.manage'));
create policy verification_shipping_event_read on public.shipment_verification_shipping_events for select to authenticated using(private.has_permission(organization_id,'shipping.view'));
grant select on public.shipping_services,public.shipment_shipping_selections,public.shipping_charge_snapshots,public.shipping_labels,public.shipping_tracking_events,public.shipping_exceptions,public.shipment_verification_shipping_events to authenticated;

create or replace function private.enforce_shipping_dispatch() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='dispatched' and old.status is distinct from new.status and (exists(select 1 from public.shipment_shipping_selections ss where ss.shipment_id=new.id) or exists(select 1 from public.shipping_labels l where l.shipment_id=new.id)) then
   if exists(select 1 from public.shipment_packages p where p.shipment_id=new.id and p.shipping_locked_at is null)
      or exists(select 1 from public.shipment_packages p left join public.shipping_labels l on l.package_id=p.id and l.label_status='created' where p.shipment_id=new.id and l.id is null) then
     raise exception 'Every package requires an active shipping label before dispatch' using errcode='42501';
   end if;
 end if;
 return new;
end$$;
drop trigger if exists shipment_shipping_dispatch_guard on public.shipments;
create trigger shipment_shipping_dispatch_guard before update on public.shipments for each row execute function private.enforce_shipping_dispatch();

create or replace function private.prevent_locked_package_mutation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.shipping_locked_at is not null and (new.weight is distinct from old.weight or new.length is distinct from old.length or new.width is distinct from old.width or new.height is distinct from old.height or new.dimension_unit is distinct from old.dimension_unit or new.shipment_id is distinct from old.shipment_id) then
   raise exception 'Shipping-locked package is immutable' using errcode='42501';
 end if;
 return new;
end$$;
drop trigger if exists shipment_package_shipping_lock_guard on public.shipment_packages;
create trigger shipment_package_shipping_lock_guard before update on public.shipment_packages for each row execute function private.prevent_locked_package_mutation();

create or replace function private.require_shipping_org(target_org uuid, permission_code text) returns uuid language plpgsql security definer set search_path='' as $$begin if target_org is null or not private.has_permission(target_org,permission_code,auth.uid()) then raise exception 'Not authorized' using errcode='42501'; end if; return auth.uid(); end$$;
revoke all on function private.require_shipping_org(uuid,text) from public,anon,authenticated;

create or replace function public.admin_set_package_shipping(target_organization_id uuid,target_package_id uuid,target_carrier_code text,target_service_code text,target_length numeric,target_width numeric,target_height numeric,target_dimension_unit text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_shipping_org(target_organization_id,'shipping.manage'); p public.shipment_packages; s public.shipments; svc public.shipping_services; rid uuid;
begin
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid shipping request' using errcode='22023'; end if;
 select * into p from public.shipment_packages where id=target_package_id and organization_id=target_organization_id for update;
 if p.id is null or p.shipping_locked_at is not null or p.status<>'locked' then raise exception 'Package is not editable' using errcode='42501'; end if;
 select * into s from public.shipments where id=p.shipment_id for share; if s.status<>'ready_to_ship' or s.locked_at is null then raise exception 'Shipment is not ready for shipping' using errcode='42501'; end if;
 if target_length<=0 or target_width<=0 or target_height<=0 then raise exception 'Dimensions must be positive' using errcode='22023'; end if;
 select * into svc from public.shipping_services where carrier_code=lower(trim(target_carrier_code)) and service_code=lower(trim(target_service_code)) and enabled; if svc.id is null then raise exception 'Shipping service is unavailable' using errcode='22023'; end if;
 update public.shipment_packages set length=target_length,width=target_width,height=target_height,dimension_unit=coalesce(nullif(trim(target_dimension_unit),''),'in') where id=p.id;
 insert into public.shipment_shipping_selections(organization_id,shipment_id,package_id,shipping_service_id,selected_by_user_id) values(target_organization_id,s.id,p.id,svc.id,actor) on conflict(package_id) do update set shipping_service_id=excluded.shipping_service_id,selected_by_user_id=excluded.selected_by_user_id,selected_at=now() returning id into rid;
 perform private.write_audit_event(actor,target_organization_id,'shipping.package_configured','shipment_package',p.id::text,jsonb_build_object('carrier',svc.carrier_code,'service',svc.service_code)); return rid;
end$$;

create or replace function public.admin_quote_shipment_shipping(target_organization_id uuid,target_shipment_id uuid,target_currency text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_shipping_org(target_organization_id,'shipping.quote'); s public.shipments; p record; rid uuid; base numeric; quoted integer:=0;
begin
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid quote request' using errcode='22023'; end if;
 select * into s from public.shipments where id=target_shipment_id and organization_id=target_organization_id for update; if s.id is null or s.status<>'ready_to_ship' or s.locked_at is null then raise exception 'Shipment is not quoteable' using errcode='42501'; end if;
 for p in select sp.id,sp.weight,sp.length,sp.width,sp.height,ss.shipping_service_id from public.shipment_packages sp join public.shipment_shipping_selections ss on ss.package_id=sp.id where sp.shipment_id=s.id and sp.shipping_locked_at is null loop
   base:=round((coalesce(p.weight,1)*1.25 + coalesce(p.length*p.width*p.height,1)/5000 + 5)::numeric,2);
   insert into public.shipping_charge_snapshots(organization_id,shipment_id,package_id,shipping_service_id,currency,base_charge,fuel_surcharge,handling_charge,quote_reference,created_by_user_id) values(target_organization_id,s.id,p.id,p.shipping_service_id,upper(trim(target_currency)),base,round(base*.12,2),2,'LOCAL-QUOTE-'||replace(p.id::text,'-',''),actor) on conflict(package_id) do update set base_charge=excluded.base_charge,fuel_surcharge=excluded.fuel_surcharge,handling_charge=excluded.handling_charge,quoted_at=now(),created_by_user_id=excluded.created_by_user_id returning id into rid;
   quoted:=quoted+1;
 end loop;
 if quoted=0 then raise exception 'No quoteable packages' using errcode='22023'; end if;
 perform private.write_audit_event(actor,target_organization_id,'shipping.charge_quoted','shipment',s.id::text,jsonb_build_object('packages',quoted,'currency',target_currency)); return rid;
end$$;

create or replace function public.admin_create_test_shipping_labels(target_organization_id uuid,target_shipment_id uuid,target_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_shipping_org(target_organization_id,'shipping.label.create'); s public.shipments; p record; svc public.shipping_services; service_id uuid; lid uuid; tracking text; created integer:=0; total integer;
begin
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid label request' using errcode='22023'; end if;
 select * into s from public.shipments where id=target_shipment_id and organization_id=target_organization_id for update;
 if s.id is null or s.status<>'ready_to_ship' or s.locked_at is null then raise exception 'Shipment is not label-ready' using errcode='42501'; end if;
 select count(*) into total from public.shipment_packages where shipment_id=s.id and status='locked'; if total=0 then raise exception 'Shipment has no packages' using errcode='22023'; end if;
 for p in select * from public.shipment_packages where shipment_id=s.id order by package_sequence for update loop
   if p.shipping_locked_at is not null then continue; end if;
   if p.weight is null or p.length is null or p.width is null or p.height is null then raise exception 'Every package needs weight and dimensions' using errcode='22023'; end if;
   select ss.shipping_service_id into service_id from public.shipment_shipping_selections ss where ss.package_id=p.id; if service_id is null then raise exception 'Every package needs a shipping service' using errcode='22023'; end if;
   select * into svc from public.shipping_services where id=service_id;
   if not exists(select 1 from public.shipping_charge_snapshots c where c.package_id=p.id) then raise exception 'Every package needs a charge snapshot' using errcode='22023'; end if;
   tracking:='TEST-'||upper(substr(md5(p.id::text),1,16));
   insert into public.shipping_labels(organization_id,shipment_id,package_id,carrier_code,service_code,provider_label_id,tracking_number,created_by_user_id) values(target_organization_id,s.id,p.id,svc.carrier_code,svc.service_code,'TEST-LABEL-'||replace(p.id::text,'-',''),tracking,actor) on conflict(package_id) do nothing returning id into lid;
   if lid is not null then created:=created+1; end if;
   update public.shipment_packages set shipping_locked_at=coalesce(shipping_locked_at,now()) where id=p.id;
   insert into public.shipping_tracking_events(organization_id,shipment_id,package_id,shipping_label_id,provider_event_id,event_hash,normalized_status,occurred_at,source,created_by_user_id) select target_organization_id,s.id,p.id,lid,'label-created',md5(tracking||':label'),'label_created',now(),'test_adapter',actor where lid is not null on conflict do nothing;
   insert into public.shipment_verification_shipping_events(organization_id,shipment_id,shipment_verification_id,event_type,carrier_code,service_code,tracking_number,ship_date,normalized_status,actor_user_id) select target_organization_id,s.id,sv.id,'shipping_locked',sl.carrier_code,sl.service_code,sl.tracking_number,now(),'label_created',actor from public.shipment_verifications sv join public.shipping_labels sl on sl.package_id=p.id where sv.shipment_id=s.id and lid is not null;
 end loop;
 update public.shipping_charge_snapshots set immutable_at=coalesce(immutable_at,now()) where shipment_id=s.id;
 update public.shipments set updated_at=now(),version=version+1 where id=s.id;
 perform private.write_audit_event(actor,target_organization_id,'shipping.labels_created','shipment',s.id::text,jsonb_build_object('packages',total,'created',created,'irreversible',true));
 return jsonb_build_object('shipment_id',s.id,'packages',total,'labels_created',created,'locked',true);
end$$;

create or replace function public.admin_ingest_tracking_event(target_organization_id uuid,target_package_id uuid,target_provider_event_id text,target_normalized_status text,target_occurred_at timestamptz,target_message text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_shipping_org(target_organization_id,'shipping.tracking.manage'); l public.shipping_labels; p public.shipment_packages; eid uuid; h text;
begin
 if length(trim(coalesce(target_provider_event_id,'')))<1 or length(trim(coalesce(target_idempotency_key,'')))<8 or target_occurred_at is null then raise exception 'Invalid tracking event' using errcode='22023'; end if;
 select * into l from public.shipping_labels where package_id=target_package_id and organization_id=target_organization_id; if l.id is null then raise exception 'Shipping label not found' using errcode='P0002'; end if;
 select * into p from public.shipment_packages where id=target_package_id; h:=md5(l.tracking_number||':'||trim(target_provider_event_id)||':'||target_normalized_status||':'||coalesce(target_occurred_at::text,''));
 insert into public.shipping_tracking_events(organization_id,shipment_id,package_id,shipping_label_id,provider_event_id,event_hash,normalized_status,occurred_at,message,source,created_by_user_id) values(target_organization_id,p.shipment_id,p.id,l.id,trim(target_provider_event_id),h,target_normalized_status,target_occurred_at,nullif(trim(target_message),''),'manual',actor) on conflict(shipping_label_id,provider_event_id) do update set received_at=now() returning id into eid;
 perform private.write_audit_event(actor,target_organization_id,'shipping.tracking_event_recorded','shipping_tracking_event',eid::text,jsonb_build_object('package_id',p.id,'status',target_normalized_status)); return eid;
end$$;

create or replace function public.admin_void_shipping_label(target_organization_id uuid,target_package_id uuid,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_shipping_org(target_organization_id,'shipping.label.void'); l public.shipping_labels; p public.shipment_packages;begin
 select * into l from public.shipping_labels where package_id=target_package_id and organization_id=target_organization_id for update; if l.id is null then raise exception 'Label not found' using errcode='P0002'; end if;
 select * into p from public.shipment_packages where id=target_package_id for update; if p.shipping_locked_at is null or exists(select 1 from public.shipments s where s.id=p.shipment_id and s.status='dispatched') then raise exception 'Label cannot be voided after dispatch' using errcode='42501'; end if;
 if l.label_status='voided' then return l.id; end if; update public.shipping_labels set label_status='voided',voided_at=now() where id=l.id; perform private.write_audit_event(actor,target_organization_id,'shipping.label_voided','shipping_label',l.id::text,'{}'); return l.id; end$$;

create or replace function public.get_client_shipping_summary(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;begin select * into o from public.orders where id=target_order_id;if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.view') then raise exception 'Not authorized' using errcode='42501';end if;return jsonb_build_object('order_number',o.order_number,'shipments',(select coalesce(jsonb_agg(jsonb_build_object('shipment_sequence',s.shipment_sequence,'status',s.status,'verification_number',sv.verification_number,'packages',(select coalesce(jsonb_agg(jsonb_build_object('tracking_number',l.tracking_number,'carrier',l.carrier_code,'service',l.service_code,'status',coalesce((select e.normalized_status from public.shipping_tracking_events e where e.shipping_label_id=l.id order by e.occurred_at desc,e.received_at desc limit 1),'label_created')) order by l.id),'[]') from public.shipping_labels l where l.shipment_id=s.id and l.label_status='created')) order by s.shipment_sequence),'[]') from public.shipments s left join public.shipment_verifications sv on sv.shipment_id=s.id where s.order_id=o.id and s.status<>'cancelled'));end$$;

revoke all on function public.admin_set_package_shipping(uuid,uuid,text,text,numeric,numeric,numeric,text,text),public.admin_quote_shipment_shipping(uuid,uuid,text,text),public.admin_create_test_shipping_labels(uuid,uuid,text),public.admin_ingest_tracking_event(uuid,uuid,text,text,timestamptz,text,text),public.admin_void_shipping_label(uuid,uuid,text),public.get_client_shipping_summary(uuid) from public,anon;
grant execute on function public.admin_set_package_shipping(uuid,uuid,text,text,numeric,numeric,numeric,text,text),public.admin_quote_shipment_shipping(uuid,uuid,text,text),public.admin_create_test_shipping_labels(uuid,uuid,text),public.admin_ingest_tracking_event(uuid,uuid,text,text,timestamptz,text,text),public.admin_void_shipping_label(uuid,uuid,text),public.get_client_shipping_summary(uuid) to authenticated;

commit;
