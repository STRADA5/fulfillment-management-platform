import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { saveClientAccount, saveClientService } from "@/lib/customers/actions";
import { FoundationForm, type FoundationField } from "@/components/customers/foundation-form";
import { PageHeading } from "@/components/ui/page-heading";
import { onboardClientWithSalesperson } from "@/lib/salespeople/actions";
import { can, getAppContext } from "@/lib/auth/authorization";

const states=["inactive","active","suspended"].map(value=>({value,label:value}));
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await requireUser();const appContext=await getAppContext();const s=await createClient();
 if(appContext.membership?.roleCode === "STAFF"){
  if(!can(appContext, "salesperson.dashboard"))notFound();
  const {data:dashboard,error}=await s.rpc("get_salesperson_dashboard",{target_provider_id:appContext.membership.organizationId});
  if(error)throw Error("Assigned client access unavailable.");
  const assigned=(dashboard as {assigned_clients?:Array<{id:string;name:string}>}|null)?.assigned_clients??[];
  return <><PageHeading title="Assigned clients" description="Salesperson client visibility is limited to active assignments."/><div className="mt-6 space-y-2">{assigned.map(client=><p key={client.id} className="rounded border p-3">{client.name}</p>)}{!assigned.length?<p className="rounded border p-3 text-sm text-slate-500">No assigned clients.</p>:null}</div></>;
 }
 const p=await searchParams;
 const{data:adminContext,error}=await s.rpc("get_client_account_admin_context");if(error)throw Error("Client administration unavailable.");
 const context=adminContext as {can_manage:boolean;companies:{id:string;name:string}[]};
 const {data:phase5bContext}=context.can_manage&&appContext.membership?await s.rpc("get_phase5b_admin_context",{target_provider_id:appContext.membership.organizationId}):{data:null};
 const phase5b=(phase5bContext??{}) as {salespeople?:{id:string;display_name:string;status:string}[];pricing_tiers?:{id:string;name:string;status:string}[]};
 const page=Math.max(0,Math.min(100000,Number.parseInt(p.page??"0",10)||0));
 let clientsQuery=s.from("organizations").select("id,name,slug,parent_organization_id,contact_email,contact_phone,status",{count:"exact"}).eq("organization_type","client_company").order("name").range(page*25,page*25+24);
 if(p.q)clientsQuery=clientsQuery.ilike("name",`%${p.q.slice(0,160)}%`);
 if(p.status==='active'||p.status==='inactive'||p.status==='suspended')clientsQuery=clientsQuery.eq('status',p.status);
 const[{data:clients,count},{data:scopes},{data:services},{data:client},{data:service},{data:history}]=await Promise.all([
 clientsQuery,s.rpc("get_customer_contexts"),s.from("client_service_relationships").select("*").order("created_at",{ascending:false}).range(page*25,page*25+24),
 p.client&&context.can_manage?s.from("organizations").select("*").eq("organization_type","client_company").eq("id",p.client).maybeSingle():Promise.resolve({data:null}),
 p.service&&context.can_manage?s.from("client_service_relationships").select("*").eq("id",p.service).maybeSingle():Promise.resolve({data:null}),
 s.from("customer_lifecycle_events").select("id,resource_type,resource_id,action,old_status,new_status,details,actor_user_id,created_at").in("resource_type",['client_account','service_relationship']).order("created_at",{ascending:false}).limit(50),
 ]);
 if((p.client&&!client)||(p.service&&!service))notFound();
 const companies=context.companies.map(x=>({value:x.id,label:x.name}));
 const clientOptions=(clients??[]).map(x=>({value:x.id,label:x.name}));
 if(service&&!clientOptions.some(x=>x.value===service.client_organization_id))clientOptions.push({value:service.client_organization_id,label:service.client_organization_id});
 const clientFields:FoundationField[]=[{name:"parentId",label:"Parent company (not an access grant)",options:client?[{value:client.parent_organization_id!,label:context.companies.find(x=>x.id===client.parent_organization_id)?.name??client.parent_organization_id!}]:companies},{name:"name",label:"Client company name",required:true},{name:"slug",label:"Client slug (immutable)",required:true,readOnly:!!client},{name:"email",label:"Business email",type:"email"},{name:"phone",label:"Business phone"},{name:"status",label:"Client status",options:states}];
 const serviceFields:FoundationField[]=[{name:"providerId",label:"Service provider",options:service?[{value:service.organization_id,label:context.companies.find(x=>x.id===service.organization_id)?.name??service.organization_id}]:companies},{name:"clientId",label:"Client organization",options:service?clientOptions.filter(x=>x.value===service.client_organization_id):clientOptions},{name:"status",label:"Service status",options:states},{name:"access",label:"Customer data capability (also requires user permissions)",options:['none','read','manage'].map(value=>({value,label:value}))}];
 const onboardingFields:FoundationField[]=[{name:"parentId",label:"Parent company",options:companies,required:true},{name:"name",label:"Client company name",required:true},{name:"slug",label:"Client slug",required:true},{name:"email",label:"Business email",type:"email"},{name:"phone",label:"Business phone"},{name:"status",label:"Initial status",options:states},{name:"salespersonId",label:"Assigned salesperson",options:(phase5b.salespeople??[]).filter(x=>x.status==='active').map(x=>({value:x.id,label:x.display_name})),required:true},{name:"pricingTierId",label:"Initial pricing tier (optional)",options:[{value:"",label:"No tier yet"},...(phase5b.pricing_tiers??[]).filter(x=>x.status==='active').map(x=>({value:x.id,label:x.name}))]}];
 const href=(changes:Record<string,string>)=>`/clients?${new URLSearchParams({q:p.q??'',status:p.status??'',page:String(page),...changes})}`;
 return <><PageHeading title="Clients & service relationships" description="Client accounts, catalog connections, and customer-data service grants are separate boundaries."/>
 <p className="mt-3 text-sm"><Link className="text-blue-700" href="/client-relationships">Configure multi-role capabilities, product ownership, and client referrals</Link></p>
 <form className="my-6 flex flex-wrap gap-3"><label>Search client<input name="q" defaultValue={p.q} className="m-2 rounded border p-2"/></label><label>Status<select name="status" defaultValue={p.status??''} className="m-2 rounded border p-2"><option value="">All</option>{states.map(x=><option key={x.value}>{x.value}</option>)}</select></label><button className="rounded bg-slate-900 px-4 text-white">Filter</button></form>
 {context.can_manage?<><div className="grid gap-6 xl:grid-cols-2"><FoundationForm key={client?.id??'new-client'} title={client?'Edit client account':'Create client account'} action={saveClientAccount} fields={clientFields} values={client?{id:client.id,parentId:client.parent_organization_id,name:client.name,slug:client.slug,email:client.contact_email,phone:client.contact_phone,status:client.status}:{status:'inactive'}}/><FoundationForm key={`${service?.id??'new-service'}-${service?.version??0}`} title={service?'Edit service relationship':'Establish service relationship'} action={saveClientService} fields={serviceFields} values={service?{id:service.id,version:service.version,providerId:service.organization_id,clientId:service.client_organization_id,status:service.status,access:service.customer_access}:{status:'inactive',access:'none'}}/></div><div className="mt-6"><FoundationForm title="Onboard client with salesperson attribution" action={onboardClientWithSalesperson} fields={onboardingFields} values={{status:'inactive'}}/></div></>:<p>Only active super-admins onboard clients or grant service access. Your permitted customer contexts are listed below.</p>}
 <h2 className="mt-8 text-xl">Client accounts ({count??0})</h2>{clients?.map(x=><div key={x.id} className="my-2 rounded border p-3"><p>{x.name} · {x.status} · {x.contact_email} · {x.contact_phone}</p>{context.can_manage?<Link href={href({client:x.id})} className="text-blue-700">Edit client</Link>:null}</div>)}
 <h2 className="mt-8 text-xl">Authorized customer contexts</h2>{scopes?.map(x=><p key={x.id}><Link href={`/customers?org=${x.id}`} className="text-blue-700">{x.name} — customers</Link></p>)}{!scopes?.length?<p>No active customer-data grants.</p>:null}
 <h2 className="mt-8 text-xl">Service relationships</h2>{services?.map(x=><div key={x.id} className="my-2 rounded border p-3"><p>Provider {context.companies.find(c=>c.id===x.organization_id)?.name??x.organization_id} → client {clientOptions.find(c=>c.value===x.client_organization_id)?.label??x.client_organization_id}</p><p>{x.status} · capability {x.customer_access} · version {x.version}</p>{context.can_manage?<Link href={href({service:x.id})} className="text-blue-700">Edit service</Link>:null}</div>)}
 <nav className="my-4 flex gap-4">{page>0?<Link href={href({page:String(page-1)})}>Previous</Link>:null}{(count??0)>(page+1)*25||services?.length===25?<Link href={href({page:String(page+1)})}>Next</Link>:null}<Link href={href({client:'',service:''})}>Clear edit selection</Link></nav>
 <p className="my-6">Onboarding creates no user accounts, memberships, catalog grants, or stock activity. Use the existing <Link href="/administration/invitations" className="text-blue-700">trusted invitation workflow</Link> with the appropriate organization authority.</p>
 {history?.length?<><h2 className="text-xl">Account / service history (latest 50)</h2>{history?.map(x=><p key={x.id} className="my-2 text-sm">{x.created_at} · {x.action} · {x.resource_id} · {x.old_status??'new'} → {x.new_status} · {JSON.stringify(x.details)} · actor {x.actor_user_id??'system'}</p>)}</>:null}
 </>;
}
