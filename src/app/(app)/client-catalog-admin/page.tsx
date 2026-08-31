import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogForm, type CatalogField } from "@/components/catalog/catalog-form";
import { PageHeading } from "@/components/ui/page-heading";
import { getAppContext } from "@/lib/auth/authorization";
import { saveClientConnection,saveClientEntry,saveClientPrice } from "@/lib/client-catalog/actions";
import { createClient } from "@/lib/supabase/server";

const states=[{value:"inactive",label:"Inactive / hidden"},{value:"active",label:"Active"}];
const utc=(value:string|null|undefined)=>value?new Date(value).toISOString().slice(0,16):"";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await getAppContext();
 const params=await searchParams,s=await createClient();
 const{data:companies,error}=await s.rpc("get_client_catalog_admin_companies");if(error||!companies?.length)notFound();
 const org=params.company??companies[0].id;if(!companies.some(x=>x.id===org))notFound();
 const selectedCompany=companies.find(x=>x.id===org)!;
 const canPrice=selectedCompany.can_price,canConnect=selectedCompany.can_connect;
 const page=Math.max(0,Math.min(100000,Number.parseInt(params.page??"0",10)||0));
 let entriesQuery=s.from("client_catalog_entries").select("*",{count:"exact"}).eq("organization_id",org).order("created_at").range(page*25,page*25+24);
 if(params.client)entriesQuery=entriesQuery.eq("client_organization_id",params.client);
 if(params.status==="active"||params.status==="inactive")entriesQuery=entriesQuery.eq("status",params.status);
 if(params.q)entriesQuery=entriesQuery.ilike("public_name",`%${params.q.slice(0,200)}%`);
 const [{data:connections},{data:products},{data:variants},{data:entries,count},{data:prices},{data:entry},{data:price},{data:clients}]=await Promise.all([
  s.from("client_catalog_connections").select("id,client_organization_id,status").eq("organization_id",org),
  s.from("products").select("id,product_name").eq("organization_id",org),
  s.from("product_variants").select("id,product_id,sku").eq("organization_id",org),entriesQuery,
  s.from("client_selling_prices").select("*").eq("organization_id",org).order("created_at",{ascending:false}).range(page*25,page*25+24),
  params.entry?s.from("client_catalog_entries").select("*").eq("organization_id",org).eq("id",params.entry).maybeSingle():Promise.resolve({data:null}),
  params.price?s.from("client_selling_prices").select("*").eq("organization_id",org).eq("id",params.price).maybeSingle():Promise.resolve({data:null}),
  canConnect?s.from("organizations").select("id,name").eq("organization_type","client_company").eq("status","active"):Promise.resolve({data:[]}),
 ]);
 if((params.entry&&!entry)||(params.price&&!price))notFound();
 const companyField:CatalogField={name:"organizationId",label:"Fulfillment company",options:[{value:org,label:companies.find(x=>x.id===org)!.name}]};
 const clientOptions=(connections??[]).filter(x=>x.status==="active").map(x=>({value:x.client_organization_id,label:x.client_organization_id}));
 const productFields:CatalogField[]=[{name:"productId",label:"Product",required:true,options:(products??[]).map(p=>({value:p.id,label:p.product_name}))},{name:"variantId",label:"SKU (optional; product grant does not grant SKUs)",options:[{value:"",label:"Product only / product-level price"},...(variants??[]).map(v=>({value:v.id,label:`${v.sku} — ${products?.find(p=>p.id===v.product_id)?.product_name??v.product_id}`}))]}];
 const dates:CatalogField[]=[{name:"startsAt",label:"Effective from (UTC)",type:"datetime-local",required:true},{name:"endsAt",label:"Effective until, exclusive (UTC)",type:"datetime-local"},{name:"status",label:"Status",options:states}];
 const baseValues={organizationId:org,startsAt:utc(new Date().toISOString()),status:"inactive"};
 const href=(changes:Record<string,string>)=>`/client-catalog-admin?${new URLSearchParams({...Object.fromEntries(Object.entries(params).filter((x):x is [string,string]=>x[1]!==undefined)),company:org,...changes})}`;
 return <><PageHeading title="Client catalog & selling prices" description="Explicit access only. Catalog grants never transfer inventory ownership. All effective dates are UTC."/>
 <form className="my-6 flex flex-wrap gap-3"><label>Company<select name="company" defaultValue={org} className="m-2 rounded border p-2">{companies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Client<select name="client" defaultValue={params.client??""} className="m-2 rounded border p-2"><option value="">All connected clients</option>{clientOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label>Search<input name="q" defaultValue={params.q} className="m-2 rounded border p-2"/></label><label>Status<select name="status" defaultValue={params.status??""} className="m-2 rounded border p-2"><option value="">All</option>{states.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><button className="rounded bg-slate-900 px-4 text-white">Filter</button></form>
 {canConnect?<CatalogForm title="Establish or deactivate an explicit client connection" action={saveClientConnection} values={baseValues} fields={[companyField,{name:"clientId",label:"Client organization",required:true,options:(clients??[]).map(x=>({value:x.id,label:x.name}))},{name:"status",label:"Connection status",options:states}]}/>:<p className="my-4 text-sm">A super-admin must establish client connections before assignments can be made.</p>}
 <p className="my-4 text-sm">Connected clients: {(connections??[]).map(x=>`${x.client_organization_id} (${x.status})`).join(", ")||"None"}</p>
 <div className="grid gap-6 xl:grid-cols-2">
 <CatalogForm key={`${org}-${entry?.id??"new-entry"}`} title={entry?"Edit client catalog entry":"Publish a client catalog entry"} action={saveClientEntry} values={entry?{id:entry.id,organizationId:org,clientId:entry.client_organization_id,productId:entry.product_id,variantId:entry.variant_id,name:entry.public_name,description:entry.public_description,status:entry.status,startsAt:utc(entry.starts_at),endsAt:utc(entry.ends_at)}:baseValues} fields={[companyField,{name:"clientId",label:"Explicitly connected client",required:true,options:clientOptions},...productFields,{name:"name",label:"Client-facing name",required:true},{name:"description",label:"Client-facing description (never internal notes)"},...dates]}/>
 {canPrice?<CatalogForm key={`${org}-${price?.id??"new-price"}`} title={price?"Edit selling-price rule":"Create selling-price rule"} action={saveClientPrice} values={price?{id:price.id,organizationId:org,clientId:price.client_organization_id,productId:price.product_id,variantId:price.variant_id,kind:price.price_kind,currency:price.currency,price:price.unit_price,minimum:price.minimum_quantity,maximum:price.maximum_quantity,status:price.status,startsAt:utc(price.starts_at),endsAt:utc(price.ends_at)}:{...baseValues,currency:"USD",minimum:1,kind:"client"}} fields={[companyField,{name:"clientId",label:"Price client (empty only for base)",options:[{value:"",label:"Base price — no client"},...clientOptions]},...productFields,{name:"kind",label:"Price kind",options:[{value:"base",label:"Standard/base"},{value:"client",label:"Client-specific"},{value:"override",label:"Temporary client override (end required)"}]},{name:"currency",label:"Currency",required:true},{name:"price",label:"Selling unit price",type:"number",required:true},{name:"minimum",label:"Minimum quantity",type:"number",required:true},{name:"maximum",label:"Maximum quantity (optional)",type:"number"},...dates]}/>:null}
 </div>
 <p className="my-4 text-sm">Precedence: override → client-specific → base; then SKU-specific → product-level; then highest applicable minimum quantity. Blank price in a client catalog means no effective price—not free inventory.</p>
 <h2 className="mt-8 text-xl">Catalog assignments ({count??0})</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Client","Published name","SKU / product","Status","Effective dates","Action"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{entries?.map(x=><tr key={x.id}><td className="p-2">{x.client_organization_id}</td><td>{x.public_name}</td><td>{variants?.find(v=>v.id===x.variant_id)?.sku??"Product only"}</td><td>{x.status}</td><td>{x.starts_at} – {x.ends_at??"open"}</td><td><Link className="text-blue-700" href={href({entry:x.id,price:""})}>Edit entry</Link></td></tr>)}</tbody></table>{!entries?.length?<p>No matching assignments.</p>:null}</div>
 <h2 className="mt-8 text-xl">Selling-price rules (25 per page)</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Client","Kind","Product / SKU","Price","Quantity","Status","Dates","Action"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{prices?.map(x=><tr key={x.id}><td className="p-2">{x.client_organization_id??"Base"}</td><td>{x.price_kind}</td><td>{variants?.find(v=>v.id===x.variant_id)?.sku??products?.find(p=>p.id===x.product_id)?.product_name}</td><td>{x.unit_price} {x.currency}</td><td>{x.minimum_quantity}–{x.maximum_quantity??"∞"}</td><td>{x.status}</td><td>{x.starts_at}–{x.ends_at??"open"}</td><td><Link className="text-blue-700" href={href({price:x.id,entry:""})}>Edit price</Link></td></tr>)}</tbody></table>{!prices?.length?<p>No visible selling-price rules.</p>:null}</div>
 <nav className="my-6 flex gap-6" aria-label="Catalog administration pages">{page>0?<Link href={href({page:String(page-1),entry:"",price:""})}>Previous</Link>:null}<span>Page {page+1}</span>{(count??0)>(page+1)*25||prices?.length===25?<Link href={href({page:String(page+1),entry:"",price:""})}>Next</Link>:null}<Link href={href({entry:"",price:""})}>Clear edit selection</Link></nav>
 </>;
}
