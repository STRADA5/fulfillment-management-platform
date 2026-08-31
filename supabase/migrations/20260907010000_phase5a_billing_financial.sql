begin;

-- Phase 5A: provider-neutral billing, invoicing, payments, credits, refunds,
-- statements, reconciliation, and immutable financial history.

insert into public.permissions(code,name,description) values
 ('billing.view','View billing','View client-safe invoices, payments, credits, refunds, and statements'),
 ('invoices.manage','Manage invoices','Create, issue, void, and administer invoices'),
 ('payments.record','Record payments','Record authorized manual or local-test payments'),
 ('payments.reconcile','Reconcile payments','Reconcile payment transactions and provider callbacks'),
 ('credits.manage','Manage credits','Create and apply credit memos'),
 ('refunds.manage','Manage refunds','Approve and record refunds and reversals'),
 ('financial.admin','Financial administration','Perform privileged financial adjustments and settlement administration')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in('SUPER_ADMIN','ADMIN') and p.code in('billing.view','invoices.manage','payments.record','payments.reconcile','credits.manage','refunds.manage','financial.admin')) or
 (r.code in('CLIENT_ADMIN','CLIENT_USER') and p.code='billing.view')
on conflict do nothing;

create table public.invoice_number_counters(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 fiscal_year integer not null check(fiscal_year between 2000 and 9999),
 next_number bigint not null default 1 check(next_number>0),
 primary key(organization_id,fiscal_year)
);

create table public.invoices(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,
 invoice_number text not null,
 status text not null default 'draft' check(status in('draft','issued','partially_paid','paid','overdue','voided','credited','written_off')),
 currency text not null check(currency~'^[A-Z]{3}$'),
 subtotal numeric(20,6) not null check(subtotal>=0),
 shipping_total numeric(20,6) not null default 0 check(shipping_total>=0),
 adjustment_total numeric(20,6) not null default 0,
 total numeric(20,6) not null check(total>=0),
 amount_paid numeric(20,6) not null default 0 check(amount_paid>=0),
 credits_applied numeric(20,6) not null default 0 check(credits_applied>=0),
 amount_refunded numeric(20,6) not null default 0 check(amount_refunded>=0),
 balance_due numeric(20,6) generated always as (greatest(total+adjustment_total-amount_paid-credits_applied,0)) stored,
 overpayment numeric(20,6) generated always as (greatest(amount_paid-(total+adjustment_total),0)) stored,
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),
 idempotency_key text not null,
 request_hash text not null,
 due_at timestamptz,
 issued_at timestamptz,
 immutable_at timestamptz,
 created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,invoice_number), unique(organization_id,idempotency_key), unique(organization_id,order_id)
);
create trigger invoices_set_updated_at before update on public.invoices for each row execute function private.set_updated_at();

create table public.invoice_lines(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict,
 line_number integer not null check(line_number>0),
 source_type text not null check(source_type in('order_line','shipping_package','addendum','replacement','adjustment','credit')),
 source_id text,
 description text not null,
 product_id uuid,
 variant_id uuid,
 shipment_id uuid,
 package_id uuid,
 quantity numeric(20,6) not null default 1 check(quantity>0),
 unit_price numeric(20,6) not null check(unit_price>=0),
 line_total numeric(20,6) not null check(line_total>=0),
 currency text not null check(currency~'^[A-Z]{3}$'),
 pricing_snapshot jsonb not null check(jsonb_typeof(pricing_snapshot)='object'),
 created_at timestamptz not null default now(),
 unique(invoice_id,line_number)
);

create table public.invoice_adjustments(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict,
 adjustment_type text not null check(adjustment_type in('debit','credit','writeoff')),
 amount numeric(20,6) not null check(amount>0),
 currency text not null check(currency~'^[A-Z]{3}$'),
 reason text not null,
 source_type text,
 source_id text,
 idempotency_key text not null,
 created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);

create table public.payment_transactions(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_id uuid references public.invoices(id) on delete restrict,
 transaction_type text not null check(transaction_type in('payment','refund','reversal')),
 status text not null check(status in('pending','authorized','captured','settled','failed','declined','cancelled','reversed','partially_refunded','refunded')),
 provider_code text not null check(char_length(provider_code) between 1 and 80),
 provider_transaction_id text,
 amount numeric(20,6) not null check(amount>0),
 currency text not null check(currency~'^[A-Z]{3}$'),
 amount_refunded numeric(20,6) not null default 0 check(amount_refunded>=0 and amount_refunded<=amount),
 idempotency_key text not null,
 request_hash text,
 failure_code text,
 failure_message text,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 captured_at timestamptz,
 created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,idempotency_key),
 unique(organization_id,provider_code,provider_transaction_id)
);

create table public.payment_allocations(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict,
 amount numeric(20,6) not null check(amount>0),
 created_at timestamptz not null default now(),
 unique(payment_transaction_id,invoice_id)
);

create table public.credit_memos(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict,
 order_id uuid references public.orders(id) on delete restrict,
 rma_id uuid references public.return_authorizations(id) on delete restrict,
 credit_number text not null,
 status text not null default 'issued' check(status in('draft','issued','partially_applied','applied','voided')),
 currency text not null check(currency~'^[A-Z]{3}$'),
 amount numeric(20,6) not null check(amount>0),
 applied_amount numeric(20,6) not null default 0 check(applied_amount>=0 and applied_amount<=amount),
 reason text not null,
 source_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(source_snapshot)='object'),
 idempotency_key text not null,
 created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,credit_number), unique(organization_id,idempotency_key)
);
create table public.credit_memo_lines(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 credit_memo_id uuid not null references public.credit_memos(id) on delete restrict,
 source_type text not null check(source_type in('invoice_line','return','replacement','adjustment')),
 source_id text,
 description text not null,
 quantity numeric(20,6) not null default 1 check(quantity>0),
 unit_amount numeric(20,6) not null check(unit_amount>=0),
 line_total numeric(20,6) not null check(line_total>=0),
 currency text not null check(currency~'^[A-Z]{3}$'),
 created_at timestamptz not null default now()
);

create table public.account_ledger_entries(
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 client_organization_id uuid references public.organizations(id) on delete restrict,
 invoice_id uuid references public.invoices(id) on delete restrict,
 payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
 credit_memo_id uuid references public.credit_memos(id) on delete restrict,
 entry_type text not null check(entry_type in('invoice','payment','credit','refund','reversal','adjustment','writeoff')),
 amount numeric(20,6) not null check(amount>0),
 currency text not null check(currency~'^[A-Z]{3}$'),
 direction text not null check(direction in('debit','credit')),
 description text not null,
 source_event_type text,
 source_event_id text,
 idempotency_key text not null,
 created_by_user_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);

create table public.financial_reconciliation_events(
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
 provider_code text not null,
 provider_event_id text not null,
 event_type text not null,
 status text not null check(status in('received','applied','ignored','failed')),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 error_message text,
 created_at timestamptz not null default now(),
 unique(organization_id,provider_code,provider_event_id)
);

do $$declare t text;begin foreach t in array array['invoice_number_counters','invoices','invoice_lines','invoice_adjustments','payment_transactions','payment_allocations','credit_memos','credit_memo_lines','account_ledger_entries','financial_reconciliation_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;

create policy invoice_read on public.invoices for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy invoice_line_read on public.invoice_lines for select to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and private.has_permission(i.organization_id,'billing.view')));
create policy adjustment_read on public.invoice_adjustments for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy payment_read on public.payment_transactions for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy payment_allocation_read on public.payment_allocations for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy credit_read on public.credit_memos for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy credit_line_read on public.credit_memo_lines for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy ledger_read on public.account_ledger_entries for select to authenticated using(private.has_permission(organization_id,'billing.view'));
create policy reconciliation_read on public.financial_reconciliation_events for select to authenticated using(private.has_permission(organization_id,'payments.reconcile'));
grant select on public.invoices,public.invoice_lines,public.invoice_adjustments,public.payment_transactions,public.payment_allocations,public.credit_memos,public.credit_memo_lines,public.account_ledger_entries,public.financial_reconciliation_events to authenticated;

create or replace function private.financial_year() returns integer language sql stable as $$select extract(year from statement_timestamp())::integer$$;

create or replace function public.create_invoice_from_order(target_organization_id uuid,target_order_id uuid,target_idempotency_key text,target_due_at timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); o public.orders; inv public.invoices; line public.order_lines; p record; seq bigint; fy integer:=private.financial_year(); subtotal_amount numeric:=0; shipping_amount numeric:=0; total_amount numeric:=0; n integer:=0; hash text;
begin
 if not private.has_permission(target_organization_id,'invoices.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid invoice request' using errcode='22023'; end if;
 select * into o from public.orders where id=target_order_id and organization_id=target_organization_id for update;
 if o.id is null then raise exception 'Order not found' using errcode='P0002'; end if;
 select * into inv from public.invoices where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key) for update;
 if inv.id is not null then return inv.id; end if;
 insert into public.invoice_number_counters(organization_id,fiscal_year,next_number) values(target_organization_id,fy,2) on conflict(organization_id,fiscal_year) do update set next_number=public.invoice_number_counters.next_number+1 returning next_number-1 into seq;
 if seq is null then select next_number-1 into seq from public.invoice_number_counters where organization_id=target_organization_id and fiscal_year=fy; end if;
 insert into public.invoices(organization_id,client_organization_id,order_id,invoice_number,status,currency,subtotal,total,source_snapshot,idempotency_key,request_hash,due_at,created_by_user_id)
 values(target_organization_id,o.client_organization_id,o.id,'INV-'||fy||'-'||lpad(seq::text,6,'0'),'draft',o.currency,0,0,jsonb_build_object('order_id',o.id,'order_number',o.order_number,'customer',o.customer_snapshot,'address',o.address_snapshot),trim(target_idempotency_key),encode(extensions.digest(trim(target_idempotency_key),'sha256'),'hex'),target_due_at,actor) returning * into inv;
 for line in select * from public.order_lines where order_id=o.id order by created_at,id loop
   n:=n+1; subtotal_amount:=subtotal_amount+line.line_total;
   insert into public.invoice_lines(organization_id,invoice_id,line_number,source_type,source_id,description,product_id,variant_id,quantity,unit_price,line_total,currency,pricing_snapshot) values(target_organization_id,inv.id,n,'order_line',line.id::text,line.display_name,line.product_id,line.variant_id,line.quantity,line.unit_price,line.line_total,line.currency,line.pricing_snapshot);
 end loop;
 for p in select c.id,c.package_id,c.total_charge,c.currency,sp.shipment_id from public.shipping_charge_snapshots c join public.shipment_packages sp on sp.id=c.package_id where c.shipment_id in(select id from public.shipments where order_id=o.id) loop
   n:=n+1; shipping_amount:=shipping_amount+p.total_charge;
   insert into public.invoice_lines(organization_id,invoice_id,line_number,source_type,source_id,description,shipment_id,package_id,quantity,unit_price,line_total,currency,pricing_snapshot) values(target_organization_id,inv.id,n,'shipping_package',p.package_id::text,'Shipping package '||p.package_id,p.shipment_id,p.package_id,1,p.total_charge,p.total_charge,p.currency,jsonb_build_object('shipping_charge_snapshot_id',p.id,'total_charge',p.total_charge));
 end loop;
 total_amount:=subtotal_amount+shipping_amount;
 update public.invoices set subtotal=subtotal_amount,shipping_total=shipping_amount,total=total_amount,source_snapshot=source_snapshot||jsonb_build_object('subtotal',subtotal_amount,'shipping_total',shipping_amount,'total',total_amount) where id=inv.id returning * into inv;
 insert into public.account_ledger_entries(organization_id,client_organization_id,invoice_id,entry_type,amount,currency,direction,description,source_event_type,source_event_id,idempotency_key,created_by_user_id) values(target_organization_id,o.client_organization_id,inv.id,'invoice',total_amount,o.currency,'debit','Invoice issued from order','invoice.created',inv.id::text,'invoice-ledger-'||inv.id::text,actor);
 perform private.write_audit_event(actor,target_organization_id,'invoice.created','invoice',inv.id::text,jsonb_build_object('invoice_number',inv.invoice_number,'order_id',o.id,'total',total_amount,'currency',o.currency));
 return inv.id;
end$$;
revoke all on function public.create_invoice_from_order(uuid,uuid,text,timestamptz) from public,anon;grant execute on function public.create_invoice_from_order(uuid,uuid,text,timestamptz) to authenticated;

create or replace function public.issue_invoice(target_organization_id uuid,target_invoice_id uuid,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); i public.invoices;
begin
 if not private.has_permission(target_organization_id,'invoices.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into i from public.invoices where id=target_invoice_id and organization_id=target_organization_id for update;
 if i.id is null or i.status not in('draft','issued') then raise exception 'Invoice cannot be issued' using errcode='42501'; end if;
 update public.invoices set status='issued',issued_at=coalesce(issued_at,now()),immutable_at=coalesce(immutable_at,now()),updated_at=now() where id=i.id returning * into i;
 perform private.write_audit_event(actor,target_organization_id,'invoice.issued','invoice',i.id::text,jsonb_build_object('invoice_number',i.invoice_number,'total',i.total));
 return i.id;
end$$;
revoke all on function public.issue_invoice(uuid,uuid,text) from public,anon;grant execute on function public.issue_invoice(uuid,uuid,text) to authenticated;

create or replace function public.record_manual_payment(target_organization_id uuid,target_invoice_id uuid,target_amount numeric,target_currency text,target_reference text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); i public.invoices; pay public.payment_transactions; alloc numeric; scale integer;
begin
 if not private.has_permission(target_organization_id,'payments.record',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_amount is null or target_amount<=0 or length(trim(coalesce(target_idempotency_key,'')))<8 or target_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid payment' using errcode='22023'; end if;
 select * into pay from public.payment_transactions where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key) for update; if pay.id is not null then return pay.id; end if;
 select * into i from public.invoices where id=target_invoice_id and organization_id=target_organization_id for update;
 if i.id is null or i.status='voided' or i.currency<>upper(target_currency) then raise exception 'Invoice unavailable' using errcode='42501'; end if;
 scale:=private.money_scale(i.currency); target_amount:=round(target_amount,scale);
 insert into public.payment_transactions(organization_id,client_organization_id,invoice_id,transaction_type,status,provider_code,amount,currency,idempotency_key,metadata,captured_at,created_by_user_id) values(target_organization_id,i.client_organization_id,i.id,'payment','captured','manual',target_amount,i.currency,trim(target_idempotency_key),jsonb_build_object('reference',left(coalesce(target_reference,''),2000),'offline',true),now(),actor) returning * into pay;
 alloc:=least(target_amount,i.balance_due);
 if alloc>0 then insert into public.payment_allocations(organization_id,payment_transaction_id,invoice_id,amount) values(target_organization_id,pay.id,i.id,alloc); end if;
 update public.invoices set amount_paid=amount_paid+target_amount,status=case when amount_paid+target_amount>=total then 'paid' else 'partially_paid' end,updated_at=now() where id=i.id;
 insert into public.account_ledger_entries(organization_id,client_organization_id,invoice_id,payment_transaction_id,entry_type,amount,currency,direction,description,source_event_type,source_event_id,idempotency_key,created_by_user_id) values(target_organization_id,i.client_organization_id,i.id,pay.id,'payment',target_amount,i.currency,'credit','Manual payment recorded','payment.captured',pay.id::text,'payment-ledger-'||pay.id::text,actor);
 perform private.write_audit_event(actor,target_organization_id,'payment.recorded','payment_transaction',pay.id::text,jsonb_build_object('invoice_id',i.id,'amount',target_amount,'currency',i.currency,'provider','manual'));
 perform private.enqueue_notification_event(i.order_id,'billing.payment_recorded','payment-'||pay.id::text,jsonb_build_object('invoice_number',i.invoice_number,'amount',target_amount,'currency',i.currency),'client','payment_transactions',pay.id::text,null);
 return pay.id;
end$$;
revoke all on function public.record_manual_payment(uuid,uuid,numeric,text,text,text) from public,anon;grant execute on function public.record_manual_payment(uuid,uuid,numeric,text,text,text) to authenticated;

create or replace function public.record_test_payment_callback(target_organization_id uuid,target_invoice_id uuid,target_provider text,target_provider_transaction_id text,target_status text,target_amount numeric,target_currency text,target_event_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.payment_transactions; r public.financial_reconciliation_events; i public.invoices;
begin
 if not private.has_permission(target_organization_id,'payments.reconcile',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_status not in('captured','failed','declined','reversed') or target_amount<=0 or length(trim(coalesce(target_event_id,'')))<8 then raise exception 'Invalid provider callback' using errcode='22023'; end if;
 select * into r from public.financial_reconciliation_events where organization_id=target_organization_id and provider_code=trim(target_provider) and provider_event_id=trim(target_event_id); if r.id is not null then return r.payment_transaction_id; end if;
 select * into p from public.payment_transactions where organization_id=target_organization_id and provider_code=trim(target_provider) and provider_transaction_id=trim(target_provider_transaction_id);
 if p.id is null then insert into public.payment_transactions(organization_id,client_organization_id,invoice_id,transaction_type,status,provider_code,provider_transaction_id,amount,currency,idempotency_key,request_hash,created_by_user_id) select target_organization_id,invrow.client_organization_id,invrow.id,'payment',target_status,trim(target_provider),trim(target_provider_transaction_id),target_amount,upper(target_currency),'provider-'||trim(target_event_id),trim(target_event_id),actor from public.invoices invrow where invrow.id=target_invoice_id and invrow.organization_id=target_organization_id returning * into p;
 elsif p.status is distinct from target_status then update public.payment_transactions set status=target_status where id=p.id returning * into p; end if;
 insert into public.financial_reconciliation_events(organization_id,payment_transaction_id,provider_code,provider_event_id,event_type,status,payload) values(target_organization_id,p.id,trim(target_provider),trim(target_event_id),'payment.'||target_status,'applied',jsonb_build_object('amount',target_amount,'currency',upper(target_currency))) returning * into r;
 if target_status='captured' then
   select * into i from public.invoices where id=target_invoice_id and organization_id=target_organization_id for update;
   if i.id is null then raise exception 'Invoice unavailable' using errcode='42501'; end if;
   insert into public.payment_allocations(organization_id,payment_transaction_id,invoice_id,amount)
   values(target_organization_id,p.id,i.id,least(p.amount,i.balance_due)) on conflict do nothing;
   insert into public.account_ledger_entries(organization_id,client_organization_id,invoice_id,payment_transaction_id,entry_type,amount,currency,direction,description,source_event_type,source_event_id,idempotency_key,created_by_user_id)
   values(target_organization_id,i.client_organization_id,i.id,p.id,'payment',p.amount,i.currency,'credit','Provider payment captured','payment.callback',r.id::text,'provider-payment-ledger-'||p.id::text,actor) on conflict do nothing;
   if found then update public.invoices set amount_paid=amount_paid+p.amount,status=case when amount_paid+p.amount>=total+adjustment_total then 'paid' else 'partially_paid' end,updated_at=now() where id=i.id; end if;
 end if;
 perform private.write_audit_event(actor,target_organization_id,'payment.callback_applied','financial_reconciliation_event',r.id::text,jsonb_build_object('provider',target_provider,'provider_event_id',target_event_id,'status',target_status)); return p.id;
end$$;
revoke all on function public.record_test_payment_callback(uuid,uuid,text,text,text,numeric,text,text) from public,anon;grant execute on function public.record_test_payment_callback(uuid,uuid,text,text,text,numeric,text,text) to authenticated;

create or replace function public.create_credit_memo(target_organization_id uuid,target_invoice_id uuid,target_amount numeric,target_reason text,target_rma_id uuid,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); i public.invoices; c public.credit_memos; seq bigint;
begin
 if not private.has_permission(target_organization_id,'credits.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_amount is null or target_amount<=0 or length(trim(coalesce(target_reason,'')))<3 or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid credit memo' using errcode='22023'; end if;
 select * into c from public.credit_memos where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key) for update; if c.id is not null then return c.id; end if;
 select * into i from public.invoices where id=target_invoice_id and organization_id=target_organization_id for update; if i.id is null or i.status='voided' then raise exception 'Invoice unavailable' using errcode='42501'; end if;
 if target_amount>i.total-i.credits_applied then raise exception 'Credit exceeds invoice value' using errcode='22023'; end if;
 select coalesce(max((regexp_match(credit_number,'([0-9]+)$'))[1]::bigint),0)+1 into seq from public.credit_memos where organization_id=target_organization_id;
 insert into public.credit_memos(organization_id,client_organization_id,invoice_id,order_id,rma_id,credit_number,currency,amount,reason,idempotency_key,created_by_user_id) values(target_organization_id,i.client_organization_id,i.id,i.order_id,target_rma_id,'CM-'||to_char(now(),'YYYYMMDD')||'-'||lpad(seq::text,5,'0'),i.currency,round(target_amount,private.money_scale(i.currency)),left(target_reason,2000),trim(target_idempotency_key),actor) returning * into c;
 insert into public.credit_memo_lines(organization_id,credit_memo_id,source_type,source_id,description,quantity,unit_amount,line_total,currency) values(target_organization_id,c.id,case when target_rma_id is null then 'adjustment' else 'return' end,coalesce(target_rma_id::text,i.id::text),'Approved credit',1,c.amount,c.amount,c.currency);
 update public.invoices set credits_applied=credits_applied+c.amount,status=case when credits_applied+c.amount>=total then 'credited' else status end,updated_at=now() where id=i.id;
 insert into public.account_ledger_entries(organization_id,client_organization_id,invoice_id,credit_memo_id,entry_type,amount,currency,direction,description,source_event_type,source_event_id,idempotency_key,created_by_user_id) values(target_organization_id,i.client_organization_id,i.id,c.id,'credit',c.amount,c.currency,'credit','Credit memo issued','credit.issued',c.id::text,'credit-ledger-'||c.id::text,actor);
 perform private.write_audit_event(actor,target_organization_id,'credit.memo_issued','credit_memo',c.id::text,jsonb_build_object('invoice_id',i.id,'amount',c.amount,'currency',c.currency,'rma_id',target_rma_id));
 perform private.enqueue_notification_event(i.order_id,'billing.credit_issued','credit-'||c.id::text,jsonb_build_object('credit_number',c.credit_number,'amount',c.amount,'currency',c.currency),'client','credit_memos',c.id::text,null);
 return c.id;
end$$;
revoke all on function public.create_credit_memo(uuid,uuid,numeric,text,uuid,text) from public,anon;grant execute on function public.create_credit_memo(uuid,uuid,numeric,text,uuid,text) to authenticated;

create or replace function public.record_refund(target_organization_id uuid,target_payment_id uuid,target_amount numeric,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.payment_transactions; r public.payment_transactions; refundable numeric;
begin
 if not private.has_permission(target_organization_id,'refunds.manage',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_amount is null or target_amount<=0 or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid refund' using errcode='22023'; end if;
 select * into r from public.payment_transactions where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key) for update; if r.id is not null then return r.id; end if;
 select * into p from public.payment_transactions where id=target_payment_id and organization_id=target_organization_id and transaction_type='payment' and status in('captured','settled','partially_refunded') for update; if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 refundable:=p.amount-p.amount_refunded; if target_amount>refundable then raise exception 'Refund exceeds captured amount' using errcode='22023'; end if;
 insert into public.payment_transactions(organization_id,client_organization_id,invoice_id,transaction_type,status,provider_code,amount,currency,idempotency_key,metadata,captured_at,created_by_user_id) values(target_organization_id,p.client_organization_id,p.invoice_id,'refund','refunded',p.provider_code,target_amount,p.currency,trim(target_idempotency_key),jsonb_build_object('payment_id',p.id,'reason',left(target_reason,2000)),now(),actor) returning * into r;
 update public.payment_transactions set amount_refunded=amount_refunded+target_amount,status=case when amount_refunded+target_amount>=amount then 'refunded' else 'partially_refunded' end where id=p.id;
 if p.invoice_id is not null then update public.invoices set amount_refunded=amount_refunded+target_amount,updated_at=now() where id=p.invoice_id; end if;
 insert into public.account_ledger_entries(organization_id,client_organization_id,invoice_id,payment_transaction_id,entry_type,amount,currency,direction,description,source_event_type,source_event_id,idempotency_key,created_by_user_id) values(target_organization_id,p.client_organization_id,p.invoice_id,r.id,'refund',target_amount,p.currency,'debit','Refund recorded','refund.recorded',r.id::text,'refund-ledger-'||r.id::text,actor);
 perform private.write_audit_event(actor,target_organization_id,'refund.recorded','payment_transaction',r.id::text,jsonb_build_object('payment_id',p.id,'amount',target_amount,'currency',p.currency)); return r.id;
end$$;
revoke all on function public.record_refund(uuid,uuid,numeric,text,text) from public,anon;grant execute on function public.record_refund(uuid,uuid,numeric,text,text) to authenticated;

create or replace function public.create_financial_adjustment(target_organization_id uuid,target_invoice_id uuid,target_type text,target_amount numeric,target_reason text,target_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); i public.invoices; a public.invoice_adjustments;
begin
 if not private.has_permission(target_organization_id,'financial.admin',actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_type not in('debit','credit','writeoff') or target_amount<=0 or length(trim(coalesce(target_reason,'')))<3 or length(trim(coalesce(target_idempotency_key,'')))<8 then raise exception 'Invalid adjustment' using errcode='22023'; end if;
 select * into a from public.invoice_adjustments where organization_id=target_organization_id and idempotency_key=trim(target_idempotency_key); if a.id is not null then return a.id; end if;
 select * into i from public.invoices where id=target_invoice_id and organization_id=target_organization_id for update; if i.id is null then raise exception 'Invoice unavailable' using errcode='42501'; end if;
 target_amount:=round(target_amount,private.money_scale(i.currency));
 if target_type<>'debit' and target_amount>greatest(i.total+i.adjustment_total-i.amount_paid-i.credits_applied,0) then raise exception 'Adjustment exceeds balance due' using errcode='22023'; end if;
 insert into public.invoice_adjustments(organization_id,invoice_id,adjustment_type,amount,currency,reason,idempotency_key,created_by_user_id) values(target_organization_id,i.id,target_type,round(target_amount,private.money_scale(i.currency)),i.currency,left(target_reason,2000),trim(target_idempotency_key),actor) returning * into a;
 update public.invoices set adjustment_total=adjustment_total+case when target_type='debit' then a.amount else -a.amount end, status=case when target_type in('credit','writeoff') and amount_paid+credits_applied>=total+adjustment_total-case when target_type='debit' then 0 else a.amount end then 'credited' else status end, updated_at=now() where id=i.id;
 insert into public.account_ledger_entries(organization_id,client_organization_id,invoice_id,entry_type,amount,currency,direction,description,source_event_type,source_event_id,idempotency_key,created_by_user_id) values(target_organization_id,i.client_organization_id,i.id,case when target_type='writeoff' then 'writeoff' else 'adjustment' end,a.amount,i.currency,case when target_type='debit' then 'debit' else 'credit' end,'Financial adjustment','financial.adjustment',a.id::text,'adjustment-ledger-'||a.id::text,actor);
 perform private.write_audit_event(actor,target_organization_id,'financial.adjustment_created','invoice_adjustment',a.id::text,jsonb_build_object('invoice_id',i.id,'type',target_type,'amount',a.amount)); return a.id;
end$$;
revoke all on function public.create_financial_adjustment(uuid,uuid,text,numeric,text,text) from public,anon;grant execute on function public.create_financial_adjustment(uuid,uuid,text,numeric,text,text) to authenticated;

create or replace function public.get_client_financial_summary(target_client_organization_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('invoices',coalesce((select jsonb_agg(jsonb_build_object('invoice_number',i.invoice_number,'status',i.status,'currency',i.currency,'total',i.total,'amount_paid',i.amount_paid,'credits_applied',i.credits_applied,'balance_due',i.balance_due,'issued_at',i.issued_at) order by i.created_at desc) from public.invoices i where i.client_organization_id=target_client_organization_id and private.can_access_order(i.client_organization_id,i.organization_id,'orders.view')),'[]'::jsonb),'credits',coalesce((select jsonb_agg(jsonb_build_object('credit_number',c.credit_number,'amount',c.amount,'status',c.status,'currency',c.currency,'created_at',c.created_at) order by c.created_at desc) from public.credit_memos c where c.client_organization_id=target_client_organization_id and private.can_access_order(c.client_organization_id,c.organization_id,'orders.view')),'[]'::jsonb));
$$;
revoke all on function public.get_client_financial_summary(uuid) from public,anon;grant execute on function public.get_client_financial_summary(uuid) to authenticated;

create or replace function public.get_client_account_statement(target_client_organization_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('entry_type',e.entry_type,'direction',e.direction,'amount',e.amount,'currency',e.currency,'description',e.description,'created_at',e.created_at,'invoice_number',(select i.invoice_number from public.invoices i where i.id=e.invoice_id)) order by e.created_at,e.id),'[]'::jsonb)
 from public.account_ledger_entries e where e.client_organization_id=target_client_organization_id and private.has_permission(e.organization_id,'billing.view');
$$;
revoke all on function public.get_client_account_statement(uuid) from public,anon;grant execute on function public.get_client_account_statement(uuid) to authenticated;

create or replace function private.reject_financial_history_mutation() returns trigger language plpgsql as $$begin raise exception 'Financial history is immutable' using errcode='42501'; end$$;
do $$declare t text;begin foreach t in array array['invoice_lines','invoice_adjustments','payment_allocations','credit_memos','credit_memo_lines','account_ledger_entries','financial_reconciliation_events'] loop execute format('create trigger %I_immutable before update or delete on public.%I for each row execute function private.reject_financial_history_mutation()',t,t); end loop;end$$;

commit;
