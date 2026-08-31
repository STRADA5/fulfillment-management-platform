begin;

insert into public.permissions(code,name,description) values
 ('client_accounts.manage','Manage client accounts','Trusted client onboarding and lifecycle administration'),
 ('service_relationships.view','View service relationships','View explicit provider/client service grants'),
 ('service_relationships.manage','Manage service relationships','Super-admin controlled customer-data service grants'),
 ('customers.view','View customer records','View authorized client-owned customer records'),
 ('customers.manage','Manage customer records','Create and edit authorized customer contact records'),
 ('customers.lifecycle','Manage customer lifecycle','Activate, deactivate, or suspend customers'),
 ('customers.history','View customer history','View non-PII customer lifecycle history'),
 ('customer_addresses.view','View customer addresses','View authorized customer addresses and revisions'),
 ('customer_addresses.manage','Manage customer addresses','Manage validated addresses and default selections') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.code in('client_accounts.manage','service_relationships.view','service_relationships.manage','customers.view','customers.manage','customers.lifecycle','customers.history','customer_addresses.view','customer_addresses.manage')
and (r.code='SUPER_ADMIN' or (r.code in('ADMIN','CLIENT_ADMIN') and p.code not in('client_accounts.manage','service_relationships.manage')) or (r.code='CLIENT_USER' and p.code in('customers.view','customer_addresses.view'))) on conflict do nothing;

create table public.client_service_relationships(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,
 status public.organization_status not null default 'inactive',
 customer_access text not null default 'none' check(customer_access in('none','read','manage')),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,client_organization_id),check(organization_id<>client_organization_id)
);
create table public.customers(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 customer_number text not null check(customer_number~'^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$'),
 display_name text not null check(length(trim(display_name)) between 1 and 160),
 email text not null default '' check(length(email)<=254 and (email='' or email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 phone text not null default '' check(length(phone)<=40 and phone!~'[[:cntrl:]]'),
 status public.organization_status not null default 'inactive',version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,customer_number)
);
create table public.customer_addresses(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null,
 customer_id uuid not null,label text not null check(length(trim(label)) between 1 and 80),
 recipient text not null check(length(trim(recipient)) between 1 and 160),
 line1 text not null check(length(trim(line1)) between 1 and 200),line2 text not null default '' check(length(line2)<=200),
 city text not null check(length(trim(city)) between 1 and 100),region text not null default '' check(length(region)<=100),
 postal_code text not null default '' check(length(postal_code)<=24),country_code text not null check(country_code~'^[A-Z]{2}$'),
 status public.organization_status not null default 'inactive',
 is_default_shipping boolean not null default false,is_default_billing boolean not null default false,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id) on delete restrict,
 unique(organization_id,id),check(status='active' or (not is_default_shipping and not is_default_billing))
);
create unique index customer_one_shipping on public.customer_addresses(customer_id) where is_default_shipping;
create unique index customer_one_billing on public.customer_addresses(customer_id) where is_default_billing;
create index customer_search_scope on public.customers(organization_id,status,display_name,id);
create index customer_address_scope on public.customer_addresses(organization_id,customer_id);
create index service_client_lookup on public.client_service_relationships(client_organization_id,status);

-- Snapshot revisions preserve previous address values, but are NOT order snapshots.
create table public.customer_address_revisions(
 id bigint generated always as identity primary key,organization_id uuid not null,
 address_id uuid not null,version integer not null,snapshot jsonb not null,
 actor_user_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 foreign key(organization_id,address_id) references public.customer_addresses(organization_id,id) on delete restrict,
 unique(address_id,version)
);
create table public.customer_lifecycle_events(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete cascade,
 resource_type text not null check(resource_type in('client_account','service_relationship','customer','address')),
 resource_id uuid not null,action text not null,old_status text,new_status text,details jsonb not null default '{}',
 actor_user_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);

create function private.can_access_customers(client uuid,permission_code text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_profile() and exists(select 1 from public.organizations where id=client and organization_type='client_company' and status='active') and (
 private.is_super_admin() or private.has_permission(client,permission_code) or exists(
 select 1 from public.client_service_relationships s join public.organizations p on p.id=s.organization_id
 where s.client_organization_id=client and s.status='active' and p.status='active' and p.organization_type in('fulfillment_company','white_label')
 and s.customer_access in('read','manage') and (permission_code in('customers.view','customers.history','customer_addresses.view') or s.customer_access='manage')
 and private.has_permission(p.id,permission_code)));
$$;
revoke all on function private.can_access_customers(uuid,text) from public,anon;
grant execute on function private.can_access_customers(uuid,text) to authenticated;

do $$declare t text;begin foreach t in array array['client_service_relationships','customers','customer_addresses','customer_address_revisions','customer_lifecycle_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end $$;
grant usage,select on sequence public.customer_address_revisions_id_seq,public.customer_lifecycle_events_id_seq to service_role;
create policy service_read on public.client_service_relationships for select to authenticated using(
 private.is_active_profile() and (private.is_super_admin() or (private.has_permission(organization_id,'service_relationships.view') and exists(select 1 from public.organizations where id=organization_id and status='active')) or private.has_permission(client_organization_id,'service_relationships.view')));
create policy customers_read on public.customers for select to authenticated using(private.can_access_customers(organization_id,'customers.view'));
create policy addresses_read on public.customer_addresses for select to authenticated using(private.can_access_customers(organization_id,'customers.view') and private.can_access_customers(organization_id,'customer_addresses.view'));
create policy address_revisions_read on public.customer_address_revisions for select to authenticated using(private.can_access_customers(organization_id,'customers.view') and private.can_access_customers(organization_id,'customer_addresses.view'));
create policy customer_history_read on public.customer_lifecycle_events for select to authenticated using(
 (resource_type in('customer','address') and private.can_access_customers(organization_id,'customers.view') and private.can_access_customers(organization_id,'customers.history'))
 or (resource_type in('client_account','service_relationship') and private.is_super_admin())
 or (resource_type='service_relationship' and private.has_permission(organization_id,'service_relationships.view')));

create function private.record_customer_event(org uuid,kind text,rid uuid,operation text,previous text,current_status text,detail jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$begin
 insert into public.customer_lifecycle_events(organization_id,resource_type,resource_id,action,old_status,new_status,details,actor_user_id)
 values(org,kind,rid,operation,previous,current_status,detail,auth.uid());
 perform private.write_audit_event(auth.uid(),org,'customer_foundation.'||operation,kind,rid::text,jsonb_build_object('old_status',previous,'status',current_status));
end $$;
revoke all on function private.record_customer_event(uuid,text,uuid,text,text,text,jsonb) from public,anon,authenticated;

create function private.validate_customer_record() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='client_service_relationships' then
  if not exists(select 1 from public.organizations where id=new.organization_id and organization_type in('fulfillment_company','white_label')) or not exists(select 1 from public.organizations where id=new.client_organization_id and organization_type='client_company') then raise exception 'Invalid service parties' using errcode='22023';end if;
  if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.client_organization_id<>old.client_organization_id) then raise exception 'Service parties are immutable' using errcode='22023';end if;
 else
  if not exists(select 1 from public.organizations where id=new.organization_id and organization_type='client_company') then raise exception 'Customer owner must be a client organization' using errcode='22023';end if;
  if tg_op='UPDATE' and new.organization_id<>old.organization_id then raise exception 'Customer ownership is immutable' using errcode='22023';end if;
  if tg_table_name='customer_addresses' then
   if tg_op='UPDATE' and new.customer_id<>old.customer_id then raise exception 'Address customer is immutable' using errcode='22023';end if;
  else
   if tg_op='UPDATE' and new.customer_number<>old.customer_number then raise exception 'Customer number is immutable' using errcode='22023';end if;
  end if;
 end if;
 new.version:=case when tg_op='INSERT' then 1 else old.version+1 end;new.updated_at:=now();return new;
end $$;
revoke all on function private.validate_customer_record() from public,anon,authenticated;
create trigger customer_validate before insert or update on public.customers for each row execute function private.validate_customer_record();
create trigger address_validate before insert or update on public.customer_addresses for each row execute function private.validate_customer_record();
create trigger service_validate before insert or update on public.client_service_relationships for each row execute function private.validate_customer_record();

create function private.audit_customer_record() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;org uuid;before_status text;detail jsonb:='{}';begin
 if tg_op='UPDATE' then before_status:=old.status::text;end if;
 kind:=case tg_table_name when 'customers' then 'customer' when 'customer_addresses' then 'address' else 'service_relationship' end;
 org:=new.organization_id;
 if kind='address' then insert into public.customer_address_revisions(organization_id,address_id,version,snapshot,actor_user_id) values(org,new.id,new.version,to_jsonb(new),auth.uid());end if;
 if kind='service_relationship' then detail:=jsonb_build_object('access',new.customer_access,'old_access',case when tg_op='UPDATE' then old.customer_access else null end);end if;
 perform private.record_customer_event(org,kind,new.id,kind||case when tg_op='INSERT' then '_created' else '_updated' end,before_status,new.status::text,detail);
 return new;
end $$;
revoke all on function private.audit_customer_record() from public,anon,authenticated;
create trigger customer_audit after insert or update on public.customers for each row execute function private.audit_customer_record();
create trigger address_audit after insert or update on public.customer_addresses for each row execute function private.audit_customer_record();
create trigger service_audit after insert or update on public.client_service_relationships for each row execute function private.audit_customer_record();

-- Covers existing permitted client-profile writes too, without trusting settings/branding for authority.
create function private.audit_client_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.organization_type='client_company' then
  perform private.record_customer_event(new.id,'client_account',new.id,case when tg_op='INSERT' then 'client_account_created' else 'client_account_updated' end,case when tg_op='UPDATE' then old.status::text else null end,new.status::text);
 end if;return new;
end $$;
revoke all on function private.audit_client_account() from public,anon,authenticated;
create trigger client_account_audit after insert or update on public.organizations for each row execute function private.audit_client_account();

create function public.get_customer_contexts() returns table(id uuid,name text,can_manage boolean,can_lifecycle boolean,can_addresses boolean,can_edit_addresses boolean,can_history boolean)
language sql stable security definer set search_path='' as $$
 select o.id,o.name,private.can_access_customers(o.id,'customers.manage'),private.can_access_customers(o.id,'customers.lifecycle'),private.can_access_customers(o.id,'customer_addresses.view'),private.can_access_customers(o.id,'customer_addresses.manage'),private.can_access_customers(o.id,'customers.history')
 from public.organizations o where private.can_access_customers(o.id,'customers.view') order by o.name,o.id;
$$;
create function public.get_client_account_admin_context() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.is_super_admin() then return jsonb_build_object('can_manage',false,'companies','[]'::jsonb);end if;
 return jsonb_build_object('can_manage',true,'companies',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.organizations where organization_type in('fulfillment_company','white_label') and status='active'));
end $$;
create function public.admin_save_client_account(target_id uuid,parent_id uuid,target_name text,target_slug text,target_email text,target_phone text,target_status public.organization_status) returns uuid
language plpgsql security definer set search_path='' as $$declare rid uuid;begin
 if not private.is_super_admin() then raise exception 'Active super-admin required' using errcode='42501';end if;
 if target_name is null or length(trim(target_name)) not between 1 and 160 or length(target_email)>254 or (coalesce(target_email,'')<>'' and target_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or length(target_phone)>40 then raise exception 'Invalid client details' using errcode='22023';end if;
 if not exists(select 1 from public.organizations where id=parent_id and status='active' and organization_type in('fulfillment_company','white_label')) then raise exception 'Active parent required' using errcode='22023';end if;
 if target_id is null then
  insert into public.organizations(name,slug,organization_type,parent_organization_id,contact_email,contact_phone,status) values(trim(target_name),target_slug,'client_company',parent_id,target_email,target_phone,target_status) returning id into rid;
 else
  update public.organizations set name=trim(target_name),contact_email=target_email,contact_phone=target_phone,status=target_status
  where id=target_id and organization_type='client_company' and parent_organization_id=parent_id and slug=target_slug returning id into rid;
  if rid is null then raise exception 'Client not found or immutable identity changed' using errcode='P0002';end if;
 end if;return rid;
end $$;
create function public.admin_save_client_service(target_id uuid,provider_id uuid,client_id uuid,target_status public.organization_status,target_access text,expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$declare rid uuid;begin
 if not private.is_super_admin() then raise exception 'Active super-admin required' using errcode='42501';end if;
 if target_status='active' and (not exists(select 1 from public.organizations where id=provider_id and status='active') or not exists(select 1 from public.organizations where id=client_id and status='active')) then raise exception 'Active service parties required' using errcode='22023';end if;
 if target_id is null then insert into public.client_service_relationships(organization_id,client_organization_id,status,customer_access) values(provider_id,client_id,target_status,target_access) returning id into rid;
 else
  update public.client_service_relationships set status=target_status,customer_access=target_access where id=target_id and organization_id=provider_id and client_organization_id=client_id and version=expected_version returning id into rid;
  if rid is null then raise exception 'Service not found or stale version' using errcode='40001';end if;
 end if;return rid;
end $$;

-- Mutations lock service grants before authorizing, so a committed revocation is
-- observed before any subsequent customer/address mutation proceeds.
create function private.require_customer_mutation(client uuid,permission_code text) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.organizations where id=client for share;
 perform 1 from public.client_service_relationships where client_organization_id=client order by id for share;
 if not private.can_access_customers(client,'customers.view') or not private.can_access_customers(client,permission_code) then raise exception 'Not authorized' using errcode='42501';end if;
end $$;
revoke all on function private.require_customer_mutation(uuid,text) from public,anon,authenticated;
create function public.admin_save_customer(target_id uuid,client_id uuid,target_number text,target_name text,target_email text,target_phone text,target_status public.organization_status,expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$declare previous public.customers;rid uuid;begin
 perform private.require_customer_mutation(client_id,'customers.manage');
 if target_id is not null then select * into previous from public.customers where id=target_id and organization_id=client_id for update;
  if previous.id is null or previous.version is distinct from expected_version or previous.customer_number is distinct from target_number then raise exception 'Customer not found or stale/changed identity' using errcode='40001';end if;
 end if;
 if (target_id is null and target_status<>'inactive') or (target_id is not null and previous.status is distinct from target_status) then
  if not private.can_access_customers(client_id,'customers.lifecycle') then raise exception 'Lifecycle permission required' using errcode='42501';end if;
 end if;
 if target_id is null then insert into public.customers(organization_id,customer_number,display_name,email,phone,status) values(client_id,target_number,trim(target_name),coalesce(target_email,''),coalesce(target_phone,''),target_status) returning id into rid;
 else update public.customers set display_name=trim(target_name),email=coalesce(target_email,''),phone=coalesce(target_phone,''),status=target_status where id=target_id returning id into rid;end if;
 return rid;
end $$;
create function public.admin_save_customer_address(target_id uuid,client_id uuid,target_customer_id uuid,target_address jsonb,target_status public.organization_status,shipping_default boolean,billing_default boolean,expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$declare previous public.customer_addresses;rid uuid;begin
 perform private.require_customer_mutation(client_id,'customer_addresses.manage');
 if not private.can_access_customers(client_id,'customer_addresses.view') then raise exception 'Address access required' using errcode='42501';end if;
 perform 1 from public.customers where id=target_customer_id and organization_id=client_id and status='active' for update;
 if not found then raise exception 'Active customer required' using errcode='42501';end if;
 if target_address is null or jsonb_typeof(target_address)<>'object' or exists(select 1 from jsonb_object_keys(target_address) k where k not in('label','recipient','line1','line2','city','region','postal_code','country_code')) or exists(select 1 from jsonb_each(target_address) j where jsonb_typeof(j.value)<>'string') then raise exception 'Invalid address fields' using errcode='22023';end if;
 if target_id is not null then select * into previous from public.customer_addresses where id=target_id and organization_id=client_id and customer_id=target_customer_id for update;
  if previous.id is null or previous.version is distinct from expected_version then raise exception 'Address not found or stale version' using errcode='40001';end if;
 end if;
 if target_status<>'active' and (shipping_default or billing_default) then raise exception 'Inactive address cannot be default' using errcode='22023';end if;
 if shipping_default then update public.customer_addresses set is_default_shipping=false where customer_id=target_customer_id and is_default_shipping and id is distinct from target_id;end if;
 if billing_default then update public.customer_addresses set is_default_billing=false where customer_id=target_customer_id and is_default_billing and id is distinct from target_id;end if;
 if target_id is null then
 insert into public.customer_addresses(organization_id,customer_id,label,recipient,line1,line2,city,region,postal_code,country_code,status,is_default_shipping,is_default_billing)
 values(client_id,target_customer_id,trim(target_address->>'label'),trim(target_address->>'recipient'),trim(target_address->>'line1'),coalesce(target_address->>'line2',''),trim(target_address->>'city'),coalesce(target_address->>'region',''),coalesce(target_address->>'postal_code',''),upper(target_address->>'country_code'),target_status,shipping_default,billing_default) returning id into rid;
 else update public.customer_addresses set label=trim(target_address->>'label'),recipient=trim(target_address->>'recipient'),line1=trim(target_address->>'line1'),line2=coalesce(target_address->>'line2',''),city=trim(target_address->>'city'),region=coalesce(target_address->>'region',''),postal_code=coalesce(target_address->>'postal_code',''),country_code=upper(target_address->>'country_code'),status=target_status,is_default_shipping=shipping_default,is_default_billing=billing_default where id=target_id returning id into rid;end if;
 return rid;
end $$;

revoke all on function public.get_customer_contexts(),public.get_client_account_admin_context(),public.admin_save_client_account(uuid,uuid,text,text,text,text,public.organization_status),public.admin_save_client_service(uuid,uuid,uuid,public.organization_status,text,integer),public.admin_save_customer(uuid,uuid,text,text,text,text,public.organization_status,integer),public.admin_save_customer_address(uuid,uuid,uuid,jsonb,public.organization_status,boolean,boolean,integer) from public,anon;
grant execute on function public.get_customer_contexts(),public.get_client_account_admin_context(),public.admin_save_client_account(uuid,uuid,text,text,text,text,public.organization_status),public.admin_save_client_service(uuid,uuid,uuid,public.organization_status,text,integer),public.admin_save_customer(uuid,uuid,text,text,text,text,public.organization_status,integer),public.admin_save_customer_address(uuid,uuid,uuid,jsonb,public.organization_status,boolean,boolean,integer) to authenticated;
commit;
