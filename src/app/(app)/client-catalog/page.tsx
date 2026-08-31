import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const c=await requirePermission("client_catalog.view"),s=await createClient(),p=await searchParams;
 const page=Math.max(0,Number.parseInt(p.page??"0",10)||0),quantity=Number(p.quantity??1),currency=(p.currency??"USD").toUpperCase(),q=(p.q??"").slice(0,200);
 const{data,error}=await s.rpc("get_my_client_catalog",{target_client_organization_id:c.membership!.organizationId,target_currency:currency,target_quantity:quantity,target_search:q,target_offset:page*24,target_limit:24});
 const link=(page:number)=>`/client-catalog?${new URLSearchParams({page:String(page),quantity:String(quantity),currency,q})}`;
 return <><PageHeading title="Your catalog" description="Products explicitly available to your organization. Displayed prices do not reserve stock or transfer inventory ownership. Ordering is not available."/>
 <form className="my-6 flex flex-wrap gap-3"><label>Search<input className="m-2 rounded border p-2" name="q" defaultValue={q}/></label><label>Currency<input className="m-2 w-20 rounded border p-2" name="currency" defaultValue={currency} maxLength={3}/></label><label>Quantity for price preview<input className="m-2 w-24 rounded border p-2" name="quantity" type="number" min="1" max="1000000" step="1" defaultValue={quantity}/></label><button className="rounded bg-slate-900 px-4 text-white">View prices</button></form>
 {error?<p role="alert">Catalog unavailable. Check your active organization, currency and quantity.</p>:<><p>{data?.[0]?.total_count??0} matching entries</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data?.map(x=><article key={x.entry_id} className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">{x.display_name}</h2>{x.sku?<p className="text-sm">SKU: {x.sku}</p>:null}<p className="my-3 whitespace-pre-wrap">{x.description}</p><p className="font-semibold">{x.unit_price===null?"Price not currently available":`${Number(x.unit_price).toFixed(4)} ${x.currency} per unit`}</p></article>)}</div>{!data?.length?<p className="mt-6">No products are currently available in this catalog.</p>:null}</>}
 <nav className="my-6 flex gap-4" aria-label="Client catalog pages">{page>0?<Link href={link(page-1)}>Previous</Link>:null}{Number(data?.[0]?.total_count??0)>(page+1)*24?<Link href={link(page+1)}>Next</Link>:null}</nav>
 </>;
}
