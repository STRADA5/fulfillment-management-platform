import Link from "next/link";
import { CatalogList } from "@/components/catalog/catalog-list";
import { PageHeading } from "@/components/ui/page-heading";
import { can, requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function Page(){
 const c=await requirePermission("receiving.view"),s=await createClient(),org=c.membership!.organizationId;
 const requestDate=new Date(),endDate=new Date(requestDate);endDate.setUTCDate(endDate.getUTCDate()+30);
 const today=requestDate.toISOString().slice(0,10),soon=endDate.toISOString().slice(0,10);
 const [{data:receiving},{data:shipments},{data:issues},{data:lots}]=await Promise.all([
  s.rpc("get_receiving_work_items",{target_organization_id:org}),
  can(c,"purchasing.view")&&can(c,"suppliers.view")?s.from("inbound_shipments").select("id,supplier_id,warehouse_id,shipment_reference,expected_arrival_date,status").eq("organization_id",org).not("status","in","(received,closed)"):Promise.resolve({data:[]}),
  can(c,"supplier_issues.view")&&can(c,"suppliers.view")?s.from("supplier_issues").select("id,supplier_id,issue_type,status,replacement_quantity,replacement_expected_date").eq("organization_id",org).not("status","in","(resolved,closed)"):Promise.resolve({data:[]}),
  can(c,"inventory.view")?s.from("inventory_lots").select("id,product_variant_id,lot_number,status,expiration_date,bud_date").eq("organization_id",org).or(`expiration_date.lte.${soon},bud_date.lte.${soon}`).order("expiration_date",{ascending:true,nullsFirst:false}):Promise.resolve({data:[]}),
 ]);
 return <><PageHeading title="Procurement work queues" description="Current organization only. Supplier projections and operational queues respect their separate permissions."/>
 <div className="my-4 flex gap-4"><Link href="/receiving">Receive stock</Link>{can(c,"qc.view")?<><Link href="/qc">Pending QC / release</Link><Link href="/qc/quarantine">Quarantined stock</Link></>:null}</div>
 <CatalogList title="Receiving pending" rows={(receiving??[]).filter(r=>Number(r.quantity_received)<Number(r.quantity_ordered))}/>
 <CatalogList title="Expected inbound shipments" rows={shipments??[]}/>
 <CatalogList title="Overdue inbound shipments" rows={(shipments??[]).filter(r=>r.expected_arrival_date&&r.expected_arrival_date<today)}/>
 <CatalogList title="Open exceptions and replacements" rows={issues??[]}/>
 <CatalogList title="Approaching expiration / BUD (30 days)" rows={(lots??[]).map(l=>({...l,effective_expiry:[l.expiration_date,l.bud_date].filter(Boolean).sort()[0]??""})).sort((a,b)=>a.effective_expiry.localeCompare(b.effective_expiry))}/>
 </>;
}
