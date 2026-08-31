begin;

-- Phase 4F: trusted notification projections, internal alerts, preferences,
-- immutable history, split-order letters, and discrepancy-case foundation.

alter table public.notification_outbox
  add column if not exists audience text not null default 'client',
  add column if not exists source_event_type text,
  add column if not exists source_event_id text,
  add column if not exists suppressed_at timestamptz;
alter table public.notification_outbox
  drop constraint if exists notification_outbox_audience_check;
alter table public.notification_outbox
  add constraint notification_outbox_audience_check check (audience in ('client','internal'));

alter table public.dashboard_alerts
  add column if not exists audience text not null default 'internal',
  add column if not exists source_event_type text,
  add column if not exists source_event_id text,
  add column if not exists acknowledged_by_user_id uuid references auth.users(id),
  add column if not exists resolved_by_user_id uuid references auth.users(id);
alter table public.dashboard_alerts
  drop constraint if exists dashboard_alerts_audience_check;
alter table public.dashboard_alerts
  add constraint dashboard_alerts_audience_check check (audience in ('client','internal'));
create unique index if not exists dashboard_alerts_source_dedupe
  on public.dashboard_alerts(organization_id,source_event_type,source_event_id)
  where source_event_type is not null and source_event_id is not null;

create table public.notification_preferences(
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 120),
  in_app_enabled boolean not null default true,
  suppressed_until timestamptz,
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,user_id,event_type)
);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();

create table public.notification_event_history(
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid not null references public.notification_outbox(id) on delete cascade,
  event_type text not null,
  status text not null check(status in ('queued','processing','sent','failed','suppressed')),
  attempt integer not null check(attempt>=0),
  error_message text,
  source_event_type text,
  source_event_id text,
  observed_at timestamptz not null default now()
);

create table public.split_order_letters(
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  addendum_id uuid not null references public.order_addendums(id) on delete cascade,
  continuation_shipment_id uuid references public.shipments(id) on delete set null,
  version integer not null check(version>0),
  content jsonb not null check(jsonb_typeof(content)='object'),
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(addendum_id,version)
);

create table public.discrepancy_cases(
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_organization_id uuid references public.organizations(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  shipment_id uuid references public.shipments(id) on delete set null,
  case_number text not null,
  case_type text not null check(case_type in ('quantity','receiving','qc','packing','shipping','delay','delivery','other')),
  severity text not null check(severity in ('low','medium','high','critical')),
  status text not null default 'open' check(status in ('open','acknowledged','investigating','resolved','rejected')),
  title text not null,
  description text not null default '',
  source_event_type text,
  source_event_id text,
  assigned_to_user_id uuid references auth.users(id),
  resolution text,
  idempotency_key text not null,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(organization_id,idempotency_key),
  unique(organization_id,case_number)
);
create trigger discrepancy_cases_set_updated_at before update on public.discrepancy_cases
for each row execute function private.set_updated_at();

create table public.discrepancy_case_events(
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  discrepancy_case_id uuid not null references public.discrepancy_cases(id) on delete cascade,
  event_type text not null,
  before_state jsonb not null default '{}',
  after_state jsonb not null default '{}',
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

do $$declare t text;begin foreach t in array array['notification_preferences','notification_event_history','split_order_letters','discrepancy_cases','discrepancy_case_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;

drop policy if exists notification_read on public.notification_outbox;
drop policy if exists alert_read on public.dashboard_alerts;
create policy notification_read on public.notification_outbox for select to authenticated using(
 (audience='client' and client_organization_id is not null and private.can_access_order(client_organization_id,organization_id,'orders.view'))
 or (audience='internal' and private.has_permission(organization_id,'notifications.manage'))
);
create policy alert_read on public.dashboard_alerts for select to authenticated using(
 (audience='client' and client_organization_id is not null and private.can_access_order(client_organization_id,organization_id,'orders.view'))
 or (audience='internal' and private.has_permission(organization_id,'notifications.manage'))
);
create policy notification_preferences_read on public.notification_preferences for select to authenticated using(
 user_id=auth.uid() or private.has_permission(organization_id,'notifications.manage')
);
create policy notification_history_read on public.notification_event_history for select to authenticated using(
 private.has_permission(organization_id,'notifications.manage')
);
create policy split_letter_read on public.split_order_letters for select to authenticated using(
 private.can_access_order(client_organization_id,organization_id,'orders.view')
);
create policy discrepancy_case_read on public.discrepancy_cases for select to authenticated using(
 private.has_permission(organization_id,'notifications.manage')
);
create policy discrepancy_event_read on public.discrepancy_case_events for select to authenticated using(
 private.has_permission(organization_id,'notifications.manage')
);
grant select on public.notification_preferences,public.notification_event_history,public.split_order_letters,public.discrepancy_cases,public.discrepancy_case_events to authenticated;
grant update (in_app_enabled,suppressed_until) on public.notification_preferences to authenticated;

create or replace function private.enqueue_notification_event(
 target_order uuid,target_event text,target_dedupe text,target_payload jsonb,target_audience text default 'client',
 target_source_event_type text default null,target_source_event_id text default null,target_shipment uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; rid uuid; enabled boolean:=true;
begin
 if target_audience not in('client','internal') then raise exception 'Invalid notification audience' using errcode='22023'; end if;
 select * into o from public.orders where id=target_order;
 if o.id is null then return null; end if;
 insert into public.notification_outbox(organization_id,client_organization_id,order_id,shipment_id,event_type,dedupe_key,payload,status,audience,source_event_type,source_event_id,suppressed_at)
 values(o.organization_id,o.client_organization_id,o.id,target_shipment,target_event,target_dedupe,target_payload,case when enabled then 'pending' else 'suppressed' end,target_audience,target_source_event_type,target_source_event_id,case when enabled then null else now() end)
 on conflict(organization_id,dedupe_key) do nothing returning id into rid;
 if rid is not null then
   insert into public.notification_event_history(organization_id,notification_id,event_type,status,attempt,source_event_type,source_event_id)
   select o.organization_id,rid,target_event,case when enabled then 'queued' else 'suppressed' end,0,target_source_event_type,target_source_event_id;
 end if;
 return rid;
end$$;
revoke all on function private.enqueue_notification_event(uuid,text,text,jsonb,text,text,text,uuid) from public,anon,authenticated;

create or replace function private.enqueue_order_notification(target_order uuid,target_event text,target_dedupe text,target_payload jsonb) returns uuid language sql security definer set search_path='' as $$
 select private.enqueue_notification_event(target_order,target_event,target_dedupe,target_payload,'client',null,null,null);
$$;
revoke all on function private.enqueue_order_notification(uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function private.enqueue_internal_alert(target_order uuid,target_type text,target_title text,target_message text,target_severity text,target_dedupe text,target_source_type text,target_source_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; rid uuid;
begin select * into o from public.orders where id=target_order; if o.id is null then return null; end if;
 insert into public.dashboard_alerts(organization_id,client_organization_id,order_id,alert_type,severity,title,message,metadata,audience,source_event_type,source_event_id)
 values(o.organization_id,o.client_organization_id,o.id,target_type,target_severity,target_title,target_message,'{}','internal',target_source_type,target_source_id)
 on conflict do nothing returning id into rid;
 if rid is not null then perform private.write_audit_event(null,o.organization_id,'notification.internal_alert_created','dashboard_alert',rid::text,jsonb_build_object('alert_type',target_type,'source_event_id',target_source_id)); end if;
 return rid;
end$$;
revoke all on function private.enqueue_internal_alert(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;

create or replace function public.get_client_notification_feed(target_limit integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; lim integer:=greatest(1,least(coalesce(target_limit,50),200));
begin
 if not private.is_active_profile() then raise exception 'Not authorized' using errcode='42501'; end if;
 select coalesce(jsonb_agg(x order by (x->>'created_at') desc),'[]'::jsonb) into result from (
   select jsonb_build_object('kind','notification','event_type',n.event_type,'payload',n.payload,'created_at',n.created_at) x from public.notification_outbox n where n.audience='client' and n.status<>'suppressed' and (n.client_organization_id is not null and (private.can_access_order(n.client_organization_id,n.organization_id,'orders.view') or private.is_super_admin())) and not exists(select 1 from public.notification_preferences p where p.organization_id=n.client_organization_id and p.user_id=auth.uid() and p.event_type in('*',n.event_type) and (not p.in_app_enabled or (p.suppressed_until is not null and p.suppressed_until>now()))) order by n.created_at desc limit lim
 ) q; return result;
end$$;
revoke all on function public.get_client_notification_feed(integer) from public,anon;grant execute on function public.get_client_notification_feed(integer) to authenticated;

create or replace function public.get_internal_alert_feed(target_organization_id uuid,target_limit integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; lim integer:=greatest(1,least(coalesce(target_limit,50),200));
begin
 if not private.has_permission(target_organization_id,'notifications.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind','alert','alert_type',a.alert_type,'severity',a.severity,'title',a.title,'message',a.message,'metadata',a.metadata,'status',a.status,'created_at',a.created_at) order by a.created_at desc),'[]'::jsonb) into result from (select * from public.dashboard_alerts a where a.organization_id=target_organization_id and a.audience='internal' order by a.created_at desc limit lim) a; return result;
end$$;
revoke all on function public.get_internal_alert_feed(uuid,integer) from public,anon;grant execute on function public.get_internal_alert_feed(uuid,integer) to authenticated;

create or replace function public.get_split_order_letter(target_order_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('order_id',l.order_id,'addendum_id',l.addendum_id,'shipment_id',l.continuation_shipment_id,'version',l.version,'content',l.content,'created_at',l.created_at)
 from public.split_order_letters l join public.orders o on o.id=l.order_id
 where l.order_id=target_order_id and private.can_access_order(o.client_organization_id,o.organization_id,'orders.view') order by l.version desc limit 1;
$$;
revoke all on function public.get_split_order_letter(uuid) from public,anon;grant execute on function public.get_split_order_letter(uuid) to authenticated;

create or replace function public.set_notification_preference(target_organization_id uuid,target_user_id uuid,target_event_type text,target_in_app_enabled boolean,target_suppressed_until timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rid uuid;
begin
 if actor is null or (target_user_id<>actor and not private.has_permission(target_organization_id,'notifications.manage',actor)) then raise exception 'Not authorized' using errcode='42501'; end if;
 if not private.has_organization_access(target_organization_id,actor) or length(trim(target_event_type))=0 then raise exception 'Invalid preference' using errcode='22023'; end if;
 insert into public.notification_preferences(organization_id,user_id,event_type,in_app_enabled,suppressed_until,updated_by_user_id) values(target_organization_id,target_user_id,trim(target_event_type),target_in_app_enabled,target_suppressed_until,actor)
 on conflict(organization_id,user_id,event_type) do update set in_app_enabled=excluded.in_app_enabled,suppressed_until=excluded.suppressed_until,updated_by_user_id=actor,updated_at=now() returning id into rid;
 perform private.write_audit_event(actor,target_organization_id,'notification.preference_updated','notification_preference',rid::text,jsonb_build_object('event_type',target_event_type,'enabled',target_in_app_enabled)); return rid;
end$$;
revoke all on function public.set_notification_preference(uuid,uuid,text,boolean,timestamptz) from public,anon;grant execute on function public.set_notification_preference(uuid,uuid,text,boolean,timestamptz) to authenticated;

create or replace function public.process_local_notification_outbox(target_organization_id uuid,target_limit integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare n record; processed integer:=0;
begin
 if not private.has_permission(target_organization_id,'notifications.manage') then raise exception 'Not authorized' using errcode='42501'; end if;
 for n in select * from public.notification_outbox where organization_id=target_organization_id and status in('pending','failed') and available_at<=now() order by created_at for update skip locked limit greatest(1,least(coalesce(target_limit,100),500)) loop
   update public.notification_outbox set status='processing',attempts=attempts+1 where id=n.id;
   insert into public.notification_event_history(organization_id,notification_id,event_type,status,attempt,source_event_type,source_event_id) values(n.organization_id,n.id,n.event_type,'processing',n.attempts+1,n.source_event_type,n.source_event_id);
   update public.notification_outbox set status='sent',processed_at=now(),last_error=null where id=n.id;
   insert into public.notification_event_history(organization_id,notification_id,event_type,status,attempt,source_event_type,source_event_id) values(n.organization_id,n.id,n.event_type,'sent',n.attempts+1,n.source_event_type,n.source_event_id);
   processed:=processed+1;
 end loop; return processed;
end$$;
revoke all on function public.process_local_notification_outbox(uuid,integer) from public,anon;grant execute on function public.process_local_notification_outbox(uuid,integer) to authenticated;

create or replace function public.create_discrepancy_case(target_organization_id uuid,target_client_organization_id uuid,target_order_id uuid,target_shipment_id uuid,target_case_type text,target_severity text,target_title text,target_description text,target_source_event_type text,target_source_event_id text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rid uuid; num integer;
begin
 if not private.has_permission(target_organization_id,'notifications.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_case_type not in('quantity','receiving','qc','packing','shipping','delay','delivery','other') or target_severity not in('low','medium','high','critical') or length(trim(target_title)) not between 1 and 200 or length(trim(target_idempotency_key))<8 then raise exception 'Invalid discrepancy case' using errcode='22023'; end if;
 select id into rid from public.discrepancy_cases where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key); if rid is not null then return rid; end if;
 select count(*)+1 into num from public.discrepancy_cases where organization_id=target_organization_id;
 insert into public.discrepancy_cases(organization_id,client_organization_id,order_id,shipment_id,case_number,case_type,severity,title,description,source_event_type,source_event_id,idempotency_key,created_by_user_id) values(target_organization_id,target_client_organization_id,target_order_id,target_shipment_id,'DISC-'||to_char(now(),'YYYYMMDD')||'-'||lpad(num::text,4,'0'),target_case_type,target_severity,trim(target_title),coalesce(target_description,''),target_source_event_type,target_source_event_id,trim(target_idempotency_key),actor) returning id into rid;
 insert into public.discrepancy_case_events(organization_id,discrepancy_case_id,event_type,after_state,actor_user_id) select target_organization_id,rid,'created',to_jsonb(c),actor from public.discrepancy_cases c where c.id=rid;
 perform private.write_audit_event(actor,target_organization_id,'discrepancy.created','discrepancy_case',rid::text,jsonb_build_object('case_type',target_case_type,'severity',target_severity)); return rid;
end$$;
revoke all on function public.create_discrepancy_case(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text) from public,anon;grant execute on function public.create_discrepancy_case(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text) to authenticated;

create or replace function public.update_discrepancy_case(target_organization_id uuid,target_id uuid,target_status text,target_severity text,target_assigned_to uuid,target_resolution text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); before_state jsonb; rid uuid;
begin
 if not private.has_permission(target_organization_id,'notifications.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_status not in('open','acknowledged','investigating','resolved','rejected') or target_severity not in('low','medium','high','critical') then raise exception 'Invalid discrepancy update' using errcode='22023'; end if;
 select to_jsonb(c) into before_state from public.discrepancy_cases c where c.id=target_id and c.organization_id=target_organization_id for update; if before_state is null then raise exception 'Case not found' using errcode='P0002'; end if;
 update public.discrepancy_cases set status=target_status,severity=target_severity,assigned_to_user_id=target_assigned_to,resolution=nullif(trim(coalesce(target_resolution,'')),''),resolved_at=case when target_status='resolved' then coalesce(resolved_at,now()) else null end where id=target_id returning id into rid;
 insert into public.discrepancy_case_events(organization_id,discrepancy_case_id,event_type,before_state,after_state,actor_user_id) select target_organization_id,rid,'updated',before_state,to_jsonb(c),actor from public.discrepancy_cases c where c.id=rid;
 perform private.write_audit_event(actor,target_organization_id,'discrepancy.updated','discrepancy_case',rid::text,jsonb_build_object('status',target_status)); return rid;
end$$;
revoke all on function public.update_discrepancy_case(uuid,uuid,text,text,uuid,text) from public,anon;grant execute on function public.update_discrepancy_case(uuid,uuid,text,text,uuid,text) to authenticated;

create or replace function private.generate_split_order_letter() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders; a public.order_addendums; sid uuid; v integer;
begin
 if new.event_type<>'continuation_created' then return new; end if;
 select * into o from public.orders where id=new.order_id; select * into a from public.order_addendums where id=new.addendum_id;
 sid:=nullif(new.snapshot->>'shipment_id','')::uuid; select coalesce(max(version),0)+1 into v from public.split_order_letters where addendum_id=new.addendum_id;
 insert into public.split_order_letters(organization_id,client_organization_id,order_id,addendum_id,continuation_shipment_id,version,content,created_by_user_id)
 values(o.organization_id,o.client_organization_id,o.id,a.id,sid,v,jsonb_build_object('order_number',o.order_number,'addendum_number',a.addendum_number,'shipment_sequence',new.snapshot->>'shipment_sequence','added_lines',coalesce((select jsonb_agg(jsonb_build_object('quantity',l.quantity_delta,'unit_price',l.unit_price)) from public.order_addendum_lines l where l.addendum_id=a.id),'[]'::jsonb),'notice','Additional items are planned in a separate shipment.'),new.actor_user_id);
 perform private.write_audit_event(new.actor_user_id,o.organization_id,'order.split_letter_generated','split_order_letter',a.id::text,jsonb_build_object('order_id',o.id,'shipment_id',sid)); return new;
end$$;
drop trigger if exists order_addendum_split_letter on public.order_addendum_events;
create trigger order_addendum_split_letter after insert on public.order_addendum_events for each row execute function private.generate_split_order_letter();
revoke all on function private.generate_split_order_letter() from public,anon,authenticated;

create or replace function private.enqueue_lifecycle_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.enqueue_notification_event(new.order_id,'order.'||new.action,'lifecycle-'||new.id::text,jsonb_build_object('status',new.new_status),'client','order_lifecycle_events',new.id::text,null);
 if new.new_status in('processing','ready','partially_fulfilled','fulfilled','exception') then
   perform private.enqueue_internal_alert(new.order_id,'order_'||new.new_status,'Order '||new.new_status,'Order status requires operational attention.','info','internal-lifecycle-'||new.id::text,'order_lifecycle_events',new.id::text);
 end if;
 return new;
end$$;

create or replace function private.enqueue_tracking_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin select order_id into oid from public.shipments where id=new.shipment_id;
 perform private.enqueue_notification_event(oid,'shipment.'||new.normalized_status,'tracking-'||new.id::text,jsonb_build_object('status',new.normalized_status,'shipment_id',new.shipment_id,'package_id',new.package_id),'client','shipping_tracking_events',new.id::text,new.shipment_id);
 if new.normalized_status in('delayed','exception','delivered') then perform private.enqueue_internal_alert(oid,'tracking_'||new.normalized_status,'Tracking status: '||new.normalized_status,'A shipment tracking event requires review.','warning','internal-tracking-'||new.id::text,'shipping_tracking_events',new.id::text); end if;
 return new;
end$$;

create or replace function private.enqueue_addendum_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.event_type='continuation_created' then perform private.enqueue_notification_event(new.order_id,'order.split_shipment','split-'||new.id::text,jsonb_build_object('shipment_id',new.snapshot->>'shipment_id','shipment_sequence',new.snapshot->>'shipment_sequence'),'client','order_addendum_events',new.id::text,null); end if; return new; end$$;
drop trigger if exists order_addendum_notification on public.order_addendum_events;
create trigger order_addendum_notification after insert on public.order_addendum_events for each row execute function private.enqueue_addendum_notification();

create or replace function private.enqueue_allocation_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.allocation_status is distinct from old.allocation_status then perform private.enqueue_notification_event(new.id,'order.allocation.'||new.allocation_status,'allocation-'||new.id::text||'-'||new.allocation_status,jsonb_build_object('allocation_status',new.allocation_status),'client','orders',new.id::text,null); if new.allocation_status in('backordered','preorder','ready') then perform private.enqueue_internal_alert(new.id,'allocation_'||new.allocation_status,'Allocation status: '||new.allocation_status,'Allocation state changed and may require action.','info','internal-allocation-'||new.id::text||'-'||new.allocation_status,'orders',new.id::text); end if; end if; return new; end$$;
drop trigger if exists order_allocation_notification on public.orders;
create trigger order_allocation_notification after update of allocation_status on public.orders for each row execute function private.enqueue_allocation_notification();

-- Existing client order feed must never return internal projections.
create or replace function public.get_client_order_notifications(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare o public.orders;begin select * into o from public.orders where id=target_order_id;if o.id is null or not private.can_access_order(o.client_organization_id,o.organization_id,'orders.view') then raise exception 'Not authorized' using errcode='42501';end if;return coalesce((select jsonb_agg(jsonb_build_object('event_type',n.event_type,'payload',n.payload,'created_at',n.created_at) order by n.created_at) from public.notification_outbox n where n.order_id=o.id and n.audience='client' and n.status<>'suppressed' and not exists(select 1 from public.notification_preferences p where p.organization_id=o.client_organization_id and p.user_id=auth.uid() and p.event_type in('*',n.event_type) and (not p.in_app_enabled or (p.suppressed_until is not null and p.suppressed_until>now())))),'[]'::jsonb);end$$;
revoke all on function public.get_client_order_notifications(uuid) from public,anon;grant execute on function public.get_client_order_notifications(uuid) to authenticated;

commit;
