begin;

create type public.catalog_status as enum ('active', 'inactive');
create type public.product_status as enum ('active', 'inactive', 'depleted', 'discontinued');

insert into public.permissions (code, name, description) values
  ('products.view', 'View product catalog', 'View catalog categories, products, and variants for an authorized fulfillment organization.'),
  ('products.manage', 'Manage product catalog', 'Create and update products and variants for an authorized fulfillment organization.'),
  ('categories.manage', 'Manage product categories', 'Create and update product categories for an authorized fulfillment organization.'),
  ('suppliers.view', 'View suppliers', 'View restricted supplier identities and sourcing relationships.'),
  ('suppliers.manage', 'Manage suppliers', 'Create and update restricted suppliers and sourcing relationships.'),
  ('supplier_costs.view', 'View supplier costs', 'View restricted supplier acquisition costs.'),
  ('supplier_costs.manage', 'Manage supplier costs', 'Create and update restricted supplier acquisition costs.')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'SUPER_ADMIN'
   or (r.code = 'ADMIN' and p.code in ('products.view', 'products.manage', 'categories.manage'))
   or (r.code in ('STAFF', 'WAREHOUSE') and p.code = 'products.view')
on conflict do nothing;

create table public.product_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 2000),
  status public.catalog_status not null default 'active',
  display_order integer not null default 0 check (display_order between 0 and 1000000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, slug), unique (organization_id, id)
);
create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  category_id uuid not null,
  product_name text not null check (char_length(trim(product_name)) between 1 and 200),
  search_name text not null check (char_length(trim(search_name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 10000),
  product_type text not null check (char_length(trim(product_type)) between 1 and 80),
  status public.product_status not null default 'active',
  default_unit_of_measure text not null check (char_length(trim(default_unit_of_measure)) between 1 and 40),
  lot_tracking_required boolean not null default false,
  expiration_tracking_required boolean not null default false,
  coa_tracking_applicable boolean not null default false,
  future_backorder_eligible boolean not null default false,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 10000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id, category_id) references public.product_categories(organization_id, id) on delete restrict,
  unique (organization_id, id)
);
create table public.product_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  sku text not null check (char_length(trim(sku)) between 1 and 100),
  variant_name text not null check (char_length(trim(variant_name)) between 1 and 200),
  strength_value numeric(18,6) check (strength_value is null or strength_value >= 0),
  strength_unit text check (strength_unit is null or char_length(strength_unit) <= 40),
  package_size numeric(18,6) check (package_size is null or package_size > 0),
  package_unit text check (package_unit is null or char_length(package_unit) <= 40),
  concentration text check (concentration is null or char_length(concentration) <= 100),
  volume_value numeric(18,6) check (volume_value is null or volume_value >= 0),
  volume_unit text check (volume_unit is null or char_length(volume_unit) <= 40),
  barcode text check (barcode is null or char_length(barcode) <= 100),
  status public.catalog_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  unique (organization_id, sku), unique (organization_id, id)
);
create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_name text not null check (char_length(trim(supplier_name)) between 1 and 200),
  supplier_code text not null check (char_length(trim(supplier_code)) between 1 and 60),
  contact_name text, email text, phone text, website text, country text,
  address_line_1 text, address_line_2 text, city text, region text, postal_code text,
  status public.catalog_status not null default 'active',
  lead_time_days integer check (lead_time_days is null or lead_time_days between 0 and 3650),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 10000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, supplier_code), unique (organization_id, id)
);
create table public.supplier_product_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_id uuid not null, product_variant_id uuid not null,
  supplier_sku text, typical_lead_time_days integer check (typical_lead_time_days is null or typical_lead_time_days between 0 and 3650),
  minimum_order_quantity numeric(18,6) check (minimum_order_quantity is null or minimum_order_quantity > 0),
  is_preferred boolean not null default false, status public.catalog_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id, supplier_id) references public.suppliers(organization_id, id) on delete restrict,
  foreign key (organization_id, product_variant_id) references public.product_variants(organization_id, id) on delete restrict,
  unique (supplier_id, product_variant_id), unique (organization_id, id)
);
create table public.supplier_product_variant_costs (
  relationship_id uuid primary key references public.supplier_product_variants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_cost numeric(18,6) not null check (supplier_cost >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id, relationship_id) references public.supplier_product_variants(organization_id, id) on delete cascade
);

do $$ declare t text; begin foreach t in array array['product_categories','products','product_variants','suppliers','supplier_product_variants','supplier_product_variant_costs'] loop execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t, t); end loop; end $$;
create index products_org_name_idx on public.products (organization_id, search_name);
create index variants_product_idx on public.product_variants (product_id);
create index suppliers_org_name_idx on public.suppliers (organization_id, supplier_name);

do $$ declare t text; begin foreach t in array array['product_categories','products','product_variants','suppliers','supplier_product_variants','supplier_product_variant_costs'] loop execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon', t); end loop; end $$;
create policy categories_read on public.product_categories for select to authenticated using (private.has_permission(organization_id,'products.view'));
create policy products_read on public.products for select to authenticated using (private.has_permission(organization_id,'products.view'));
create policy variants_read on public.product_variants for select to authenticated using (private.has_permission(organization_id,'products.view'));
create policy suppliers_read on public.suppliers for select to authenticated using (private.has_permission(organization_id,'suppliers.view'));
create policy supplier_variants_read on public.supplier_product_variants for select to authenticated using (private.has_permission(organization_id,'suppliers.view'));
create policy supplier_costs_read on public.supplier_product_variant_costs for select to authenticated using (private.has_permission(organization_id,'supplier_costs.view'));
grant select on public.product_categories, public.products, public.product_variants, public.suppliers, public.supplier_product_variants, public.supplier_product_variant_costs to authenticated;
grant select,insert,update,delete on public.product_categories, public.products, public.product_variants, public.suppliers, public.supplier_product_variants, public.supplier_product_variant_costs to service_role;

create function private.require_catalog_org(target_organization_id uuid, required_permission text, actor_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin
  if actor_user_id is null or not private.has_permission(target_organization_id, required_permission, actor_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if not exists(select 1 from public.organizations where id=target_organization_id and status='active' and organization_type in ('fulfillment_company','white_label')) then raise exception 'Active fulfillment organization required' using errcode='42501'; end if;
end $$;
revoke all on function private.require_catalog_org(uuid,text,uuid) from public,anon,authenticated;

create function public.admin_save_product_category(target_id uuid,target_organization_id uuid,target_name text,target_slug text,target_description text,target_status public.catalog_status,target_display_order integer)
returns uuid language plpgsql security definer set search_path='' as $$ declare rid uuid; old jsonb; begin
 perform private.require_catalog_org(target_organization_id,'categories.manage',auth.uid());
 if char_length(trim(target_name)) not between 1 and 120 or target_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or target_display_order not between 0 and 1000000 then raise exception 'Invalid category' using errcode='22023'; end if;
 if target_id is null then insert into public.product_categories(organization_id,name,slug,description,status,display_order) values(target_organization_id,trim(target_name),target_slug,nullif(trim(target_description),''),target_status,target_display_order) returning id into rid;
 else select to_jsonb(c) into old from public.product_categories c where id=target_id and organization_id=target_organization_id for update; if old is null then raise exception 'Category not found' using errcode='P0002'; end if; update public.product_categories set name=trim(target_name),slug=target_slug,description=nullif(trim(target_description),''),status=target_status,display_order=target_display_order where id=target_id returning id into rid; end if;
 perform private.write_audit_event(auth.uid(),target_organization_id,case when target_id is null then 'category.created' else 'category.updated' end,'product_category',rid::text,jsonb_build_object('name',target_name,'previous',old)); return rid; end $$;

create function public.admin_save_product(target_id uuid,target_organization_id uuid,target_category_id uuid,target_name text,target_description text,target_type text,target_status public.product_status,target_uom text,target_lot boolean,target_expiration boolean,target_coa boolean,target_backorder boolean,target_notes text)
returns uuid language plpgsql security definer set search_path='' as $$ declare rid uuid; old jsonb; begin
 perform private.require_catalog_org(target_organization_id,'products.manage',auth.uid());
 if not exists(select 1 from public.product_categories where id=target_category_id and organization_id=target_organization_id) then raise exception 'Invalid category' using errcode='22023'; end if;
 if char_length(trim(target_name)) not between 1 and 200 or char_length(trim(target_type)) not between 1 and 80 or char_length(trim(target_uom)) not between 1 and 40 then raise exception 'Invalid product' using errcode='22023'; end if;
 if target_id is null then insert into public.products(organization_id,category_id,product_name,search_name,description,product_type,status,default_unit_of_measure,lot_tracking_required,expiration_tracking_required,coa_tracking_applicable,future_backorder_eligible,internal_notes) values(target_organization_id,target_category_id,trim(target_name),lower(trim(target_name)),nullif(trim(target_description),''),trim(target_type),target_status,trim(target_uom),target_lot,target_expiration,target_coa,target_backorder,nullif(trim(target_notes),'')) returning id into rid;
 else select to_jsonb(p) into old from public.products p where id=target_id and organization_id=target_organization_id for update; if old is null then raise exception 'Product not found' using errcode='P0002'; end if; update public.products set category_id=target_category_id,product_name=trim(target_name),search_name=lower(trim(target_name)),description=nullif(trim(target_description),''),product_type=trim(target_type),status=target_status,default_unit_of_measure=trim(target_uom),lot_tracking_required=target_lot,expiration_tracking_required=target_expiration,coa_tracking_applicable=target_coa,future_backorder_eligible=target_backorder,internal_notes=nullif(trim(target_notes),'') where id=target_id returning id into rid; end if;
 perform private.write_audit_event(auth.uid(),target_organization_id,case when target_id is null then 'product.created' else 'product.updated' end,'product',rid::text,jsonb_build_object('name',target_name,'previous',old)); return rid; end $$;

create function public.admin_save_product_variant(target_id uuid,target_organization_id uuid,target_product_id uuid,target_sku text,target_name text,target_strength numeric,target_strength_unit text,target_package_size numeric,target_package_unit text,target_concentration text,target_volume numeric,target_volume_unit text,target_barcode text,target_status public.catalog_status)
returns uuid language plpgsql security definer set search_path='' as $$ declare rid uuid; old jsonb; begin
 perform private.require_catalog_org(target_organization_id,'products.manage',auth.uid()); if not exists(select 1 from public.products where id=target_product_id and organization_id=target_organization_id) then raise exception 'Invalid product' using errcode='22023'; end if;
 if char_length(trim(target_sku)) not between 1 and 100 or char_length(trim(target_name)) not between 1 and 200 or coalesce(target_strength,0)<0 or target_package_size is not null and target_package_size<=0 or coalesce(target_volume,0)<0 then raise exception 'Invalid variant' using errcode='22023'; end if;
 if target_id is null then insert into public.product_variants(organization_id,product_id,sku,variant_name,strength_value,strength_unit,package_size,package_unit,concentration,volume_value,volume_unit,barcode,status) values(target_organization_id,target_product_id,upper(trim(target_sku)),trim(target_name),target_strength,nullif(trim(target_strength_unit),''),target_package_size,nullif(trim(target_package_unit),''),nullif(trim(target_concentration),''),target_volume,nullif(trim(target_volume_unit),''),nullif(trim(target_barcode),''),target_status) returning id into rid;
 else select to_jsonb(v) into old from public.product_variants v where id=target_id and organization_id=target_organization_id for update; if old is null then raise exception 'Variant not found' using errcode='P0002'; end if; update public.product_variants set product_id=target_product_id,sku=upper(trim(target_sku)),variant_name=trim(target_name),strength_value=target_strength,strength_unit=nullif(trim(target_strength_unit),''),package_size=target_package_size,package_unit=nullif(trim(target_package_unit),''),concentration=nullif(trim(target_concentration),''),volume_value=target_volume,volume_unit=nullif(trim(target_volume_unit),''),barcode=nullif(trim(target_barcode),''),status=target_status where id=target_id returning id into rid; end if;
 perform private.write_audit_event(auth.uid(),target_organization_id,case when target_id is null then 'variant.created' else 'variant.updated' end,'product_variant',rid::text,jsonb_build_object('sku',target_sku,'previous',old)); return rid; end $$;

create function public.admin_save_supplier(target_id uuid,target_organization_id uuid,target_name text,target_code text,target_contact text,target_email text,target_phone text,target_website text,target_country text,target_address1 text,target_address2 text,target_city text,target_region text,target_postal text,target_status public.catalog_status,target_lead integer,target_notes text)
returns uuid language plpgsql security definer set search_path='' as $$ declare rid uuid; old jsonb; begin
 perform private.require_catalog_org(target_organization_id,'suppliers.manage',auth.uid()); if char_length(trim(target_name)) not between 1 and 200 or char_length(trim(target_code)) not between 1 and 60 or target_lead is not null and target_lead not between 0 and 3650 then raise exception 'Invalid supplier' using errcode='22023'; end if;
 if target_id is null then insert into public.suppliers(organization_id,supplier_name,supplier_code,contact_name,email,phone,website,country,address_line_1,address_line_2,city,region,postal_code,status,lead_time_days,internal_notes) values(target_organization_id,trim(target_name),upper(trim(target_code)),nullif(trim(target_contact),''),nullif(trim(target_email),''),nullif(trim(target_phone),''),nullif(trim(target_website),''),nullif(trim(target_country),''),nullif(trim(target_address1),''),nullif(trim(target_address2),''),nullif(trim(target_city),''),nullif(trim(target_region),''),nullif(trim(target_postal),''),target_status,target_lead,nullif(trim(target_notes),'')) returning id into rid;
 else select to_jsonb(s) into old from public.suppliers s where id=target_id and organization_id=target_organization_id for update; if old is null then raise exception 'Supplier not found' using errcode='P0002'; end if; update public.suppliers set supplier_name=trim(target_name),supplier_code=upper(trim(target_code)),contact_name=nullif(trim(target_contact),''),email=nullif(trim(target_email),''),phone=nullif(trim(target_phone),''),website=nullif(trim(target_website),''),country=nullif(trim(target_country),''),address_line_1=nullif(trim(target_address1),''),address_line_2=nullif(trim(target_address2),''),city=nullif(trim(target_city),''),region=nullif(trim(target_region),''),postal_code=nullif(trim(target_postal),''),status=target_status,lead_time_days=target_lead,internal_notes=nullif(trim(target_notes),'') where id=target_id returning id into rid; end if;
 perform private.write_audit_event(auth.uid(),target_organization_id,case when target_id is null then 'supplier.created' else 'supplier.updated' end,'supplier',rid::text,jsonb_build_object('code',target_code,'status',target_status)); return rid; end $$;

create function public.admin_save_supplier_product(target_id uuid,target_organization_id uuid,target_supplier_id uuid,target_variant_id uuid,target_supplier_sku text,target_lead integer,target_moq numeric,target_preferred boolean,target_status public.catalog_status,target_cost numeric,target_currency text)
returns uuid language plpgsql security definer set search_path='' as $$ declare rid uuid; old_cost numeric; begin
 perform private.require_catalog_org(target_organization_id,'suppliers.manage',auth.uid());
 if target_cost is not null then perform private.require_catalog_org(target_organization_id,'supplier_costs.manage',auth.uid()); end if;
 if not exists(select 1 from public.suppliers where id=target_supplier_id and organization_id=target_organization_id) or not exists(select 1 from public.product_variants where id=target_variant_id and organization_id=target_organization_id) or target_lead is not null and target_lead not between 0 and 3650 or target_moq is not null and target_moq<=0 or target_cost is not null and target_cost<0 or target_cost is not null and target_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid supplier product' using errcode='22023'; end if;
 if target_id is null then insert into public.supplier_product_variants(organization_id,supplier_id,product_variant_id,supplier_sku,typical_lead_time_days,minimum_order_quantity,is_preferred,status) values(target_organization_id,target_supplier_id,target_variant_id,nullif(trim(target_supplier_sku),''),target_lead,target_moq,target_preferred,target_status) returning id into rid;
 else if not exists(select 1 from public.supplier_product_variants where id=target_id and organization_id=target_organization_id) then raise exception 'Relationship not found' using errcode='P0002'; end if; update public.supplier_product_variants set supplier_id=target_supplier_id,product_variant_id=target_variant_id,supplier_sku=nullif(trim(target_supplier_sku),''),typical_lead_time_days=target_lead,minimum_order_quantity=target_moq,is_preferred=target_preferred,status=target_status where id=target_id returning id into rid; end if;
 if target_cost is not null then select supplier_cost into old_cost from public.supplier_product_variant_costs where relationship_id=rid; insert into public.supplier_product_variant_costs(relationship_id,organization_id,supplier_cost,currency) values(rid,target_organization_id,target_cost,target_currency) on conflict(relationship_id) do update set supplier_cost=excluded.supplier_cost,currency=excluded.currency; end if;
 perform private.write_audit_event(auth.uid(),target_organization_id,case when target_id is null then 'supplier_product.created' else 'supplier_product.updated' end,'supplier_product_variant',rid::text,jsonb_build_object('supplier_id',target_supplier_id,'variant_id',target_variant_id));
 if target_cost is not null and old_cost is distinct from target_cost then perform private.write_audit_event(auth.uid(),target_organization_id,'supplier_cost.changed','supplier_product_variant',rid::text,jsonb_build_object('currency',target_currency,'cost_changed',true)); end if; return rid; end $$;

revoke all on function public.admin_save_product_category(uuid,uuid,text,text,text,public.catalog_status,integer), public.admin_save_product(uuid,uuid,uuid,text,text,text,public.product_status,text,boolean,boolean,boolean,boolean,text), public.admin_save_product_variant(uuid,uuid,uuid,text,text,numeric,text,numeric,text,text,numeric,text,text,public.catalog_status), public.admin_save_supplier(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,public.catalog_status,integer,text), public.admin_save_supplier_product(uuid,uuid,uuid,uuid,text,integer,numeric,boolean,public.catalog_status,numeric,text) from public,anon;
grant execute on function public.admin_save_product_category(uuid,uuid,text,text,text,public.catalog_status,integer), public.admin_save_product(uuid,uuid,uuid,text,text,text,public.product_status,text,boolean,boolean,boolean,boolean,text), public.admin_save_product_variant(uuid,uuid,uuid,text,text,numeric,text,numeric,text,text,numeric,text,text,public.catalog_status), public.admin_save_supplier(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,public.catalog_status,integer,text), public.admin_save_supplier_product(uuid,uuid,uuid,uuid,text,integer,numeric,boolean,public.catalog_status,numeric,text) to authenticated;
commit;
