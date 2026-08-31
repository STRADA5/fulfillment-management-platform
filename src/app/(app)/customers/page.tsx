import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { saveAddress, saveCustomer } from "@/lib/customers/actions";
import { FoundationForm, type FoundationField } from "@/components/customers/foundation-form";
import { PageHeading } from "@/components/ui/page-heading";

const states = ["inactive", "active", "suspended"].map(value => ({ value, label: value }));
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(); const p = await searchParams, s = await createClient();
  const { data: contexts, error } = await s.rpc("get_customer_contexts");
  if (error) throw Error("Customer context could not be loaded.");
  if (!contexts?.length) return <PageHeading title="Customers" description="No authorized active client context. Catalog access and parent relationships do not grant customer access." />;
  const org = p.org ?? contexts[0].id, c = contexts.find(x => x.id === org); if (!c) notFound();
  const page = Math.max(0, Math.min(100000, Number.parseInt(p.page ?? "0", 10) || 0));
  let query = s.from("customers").select("*", { count: "exact" }).eq("organization_id", org).order("display_name").order("id").range(page * 25, page * 25 + 24);
  if (p.q) query = query.ilike("display_name", `%${p.q.slice(0,160)}%`);
  if (p.status === "active" || p.status === "inactive" || p.status === "suspended") query = query.eq("status", p.status);
  const [{ data: customers, count, error: listError }, { data: selected }] = await Promise.all([query, p.customer ? s.from("customers").select("*").eq("organization_id", org).eq("id", p.customer).maybeSingle() : Promise.resolve({ data: null })]);
  if (listError) throw Error("Customers could not be loaded."); if (p.customer && !selected) notFound();
  const [{ data: addresses }, { data: address }, { data: history }, { data: revisions }] = await Promise.all([
    selected && c.can_addresses ? s.from("customer_addresses").select("*").eq("organization_id",org).eq("customer_id",selected.id).order("created_at").limit(100) : Promise.resolve({data:[]}),
    selected && c.can_addresses && p.address ? s.from("customer_addresses").select("*").eq("organization_id",org).eq("customer_id",selected.id).eq("id",p.address).maybeSingle() : Promise.resolve({data:null}),
    selected && c.can_history ? s.from("customer_lifecycle_events").select("id,action,old_status,new_status,created_at,actor_user_id").eq("organization_id",org).eq("resource_id",selected.id).order("created_at",{ascending:false}).limit(50) : Promise.resolve({data:[]}),
    p.address && c.can_addresses ? s.from("customer_address_revisions").select("id,version,snapshot,created_at").eq("organization_id",org).eq("address_id",p.address).order("version",{ascending:false}).limit(50) : Promise.resolve({data:[]}),
  ]);
  if (p.address && !address) notFound();
  const link = (changes:Record<string,string>) => `/customers?${new URLSearchParams({org,q:p.q??"",status:p.status??"",page:String(page),...changes})}`;
  const owner:FoundationField = {name:"clientId",label:"Owning client (immutable)",options:[{value:org,label:c.name}]};
  const customerFields:FoundationField[] = [owner,{name:"number",label:"Customer number (immutable)",required:true,readOnly:!!selected},{name:"name",label:"Customer name",required:true},{name:"email",label:"Contact email",type:"email"},{name:"phone",label:"Contact phone"},{name:"status",label:"Customer status",options:c.can_lifecycle?states:[{value:selected?.status??"inactive",label:selected?.status??"inactive"}]}];
  const addressFields:FoundationField[] = [owner,{name:"customerId",label:"Customer (immutable)",options:selected?[{value:selected.id,label:selected.display_name}]:[]},...([['label','Address label',true],['recipient','Recipient',true],['line1','Address line 1',true],['line2','Address line 2',false],['city','City',true],['region','State / region',false],['postal_code','Postal code',false],['country_code','Country code (two letters)',true]] as const).map(([name,label,required])=>({name,label,required})),{name:"status",label:"Address status",options:states},{name:"shipping",label:"Default shipping address",type:"checkbox"},{name:"billing",label:"Default billing address",type:"checkbox"}];
  return <><PageHeading title="Customer management" description={`Customer owner: ${c.name}. No inventory or order activity is created here.`}/>
    <form className="my-6 flex flex-wrap gap-3"><label>Client<select name="org" defaultValue={org} className="m-2 rounded border p-2">{contexts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Search name<input name="q" defaultValue={p.q} className="m-2 rounded border p-2"/></label><label>Status<select name="status" defaultValue={p.status??""} className="m-2 rounded border p-2"><option value="">All</option>{states.map(x=><option key={x.value}>{x.value}</option>)}</select></label><button className="rounded bg-slate-900 px-4 text-white">Filter</button></form>
    {c.can_manage?<FoundationForm key={`${org}-${selected?.id??"new"}-${selected?.version??0}`} title={selected?"Edit customer":"Create customer"} action={saveCustomer} fields={customerFields} values={selected?{id:selected.id,version:selected.version,clientId:org,number:selected.customer_number,name:selected.display_name,email:selected.email,phone:selected.phone,status:selected.status}:{clientId:org,status:"inactive"}}/>:null}
    <h2 className="mt-8 text-xl">Customers ({count??0})</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Number','Name','Email','Phone','Status','Action'].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{customers?.map(x=><tr key={x.id}><td className="p-2">{x.customer_number}</td><td>{x.display_name}</td><td>{x.email}</td><td>{x.phone}</td><td>{x.status}</td><td><Link className="text-blue-700" href={link({customer:x.id})}>Details / edit</Link></td></tr>)}</tbody></table>{!customers?.length?<p>No matching customers.</p>:null}</div>
    <nav className="my-4 flex gap-4">{page>0?<Link href={link({page:String(page-1)})}>Previous</Link>:null}{(count??0)>(page+1)*25?<Link href={link({page:String(page+1)})}>Next</Link>:null}<Link href={link({customer:"",address:""})}>Clear selection / new customer</Link></nav>
    {selected?<section className="space-y-6"><h2 className="text-xl">{selected.display_name} — {selected.status}</h2>
      {c.can_addresses?<><h3 className="font-semibold">Addresses</h3>{addresses?.map(x=><article className="rounded border bg-white p-4" key={x.id}><p>{x.label}: {x.recipient}, {x.line1} {x.line2}, {x.city} {x.region} {x.postal_code}, {x.country_code}</p><p>{x.status} · shipping default: {String(x.is_default_shipping)} · billing default: {String(x.is_default_billing)} · version {x.version}</p><Link className="text-blue-700" href={link({customer:selected.id,address:x.id})}>Address details / edit / revisions</Link></article>)}{!addresses?.length?<p>No addresses recorded.</p>:null}</>:<p>Address access is not permitted.</p>}
      {c.can_addresses&&c.can_edit_addresses&&selected.status==='active'?<FoundationForm key={`${selected.id}-${address?.id??"new"}-${address?.version??0}`} title={address?"Edit address":"Add address"} action={saveAddress} fields={addressFields} values={address?{...address,clientId:org,customerId:selected.id,shipping:address.is_default_shipping,billing:address.is_default_billing}:{clientId:org,customerId:selected.id,country_code:"US",status:"inactive"}}/>:null}
      {selected.status!=='active'?<p>Address changes require an active customer. Existing history remains available to authorized users.</p>:null}
      {address?<><h3 className="font-semibold">Address revisions (latest 50)</h3>{revisions?.map(x=><details key={x.id} className="rounded border p-3"><summary>Version {x.version} — {x.created_at}</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(x.snapshot,null,2)}</pre></details>)}</>:null}
      {c.can_history?<><h3 className="font-semibold">Customer lifecycle history (latest 50)</h3>{history?.map(x=><p key={x.id} className="text-sm">{x.created_at} · {x.action} · {x.old_status??"new"} → {x.new_status} · actor {x.actor_user_id??"system"}</p>)}</>:null}
    </section>:null}
  </>;
}
